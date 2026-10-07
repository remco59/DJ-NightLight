import { and, eq, gte, inArray, sql } from 'drizzle-orm'
import { generatedPosts, socialAccounts, socialPostMedia, socialPosts, socialSettings, type SocialAccount, type SocialPost } from '../../db/schema'
import { hasFacebookPublishScope, hasPublishScope } from '../../shared/instagram'
import {
  canPublishPresetAsFeedImage,
  checkCaption,
  INSTAGRAM_ALT_TEXT_MAX,
  INSTAGRAM_DAILY_POST_LIMIT,
  INSTAGRAM_IMAGE_MAX_BYTES,
} from '../../shared/social'
import { decryptSecret } from '../../shared/secret-box'
import { recordAudit } from './audit'
import { db } from './db'
import {
  createImageContainer,
  getContainerStatus,
  getPermalink,
  getPostPermalink,
  InstagramApiError,
  publishContainer,
  publishPagePhoto,
} from './instagram'
import { getGeneratedStorage } from './media-storage'
import {
  convertToInstagramJpeg,
  instagramJpegKey,
  isPubliclyReachable,
  publicMediaUrl,
  runImagePublish,
} from './social-publish-core'
import { structuredLog } from './structured-log'

/** Returns the JPEG for an export, converting and storing it on first use. The original PNG is kept. */
export async function ensureInstagramJpeg(post: { id: string, outputKey: string }) {
  const storage = getGeneratedStorage()
  const key = instagramJpegKey(post.id)
  try {
    return await storage.read(key)
  } catch {
    const jpeg = await convertToInstagramJpeg(await storage.read(post.outputKey))
    await storage.putAt(key, jpeg)
    return jpeg
  }
}

/** A row stuck in `publishing` longer than this (crashed process) no longer blocks a new attempt. */
const STALE_PUBLISHING_MS = 10 * 60_000

export class SocialPublishError extends Error {
  constructor(message: string, readonly statusCode = 422) {
    super(message)
    this.name = 'SocialPublishError'
  }
}

function password() {
  return String(useRuntimeConfig().session.password || '')
}

function errorText(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

export type SocialPlatform = 'instagram' | 'facebook'

export async function loadActiveAccount(provider: SocialPlatform): Promise<SocialAccount | null> {
  const [account] = await db.select().from(socialAccounts)
    .where(and(eq(socialAccounts.provider, provider), eq(socialAccounts.status, 'active')))
    .limit(1)
  return account ?? null
}

/** Posts that count toward Instagram's 24 hour limit. */
async function recentPostCount(accountId: string, now: Date) {
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(socialPosts)
    .where(and(
      eq(socialPosts.accountId, accountId),
      inArray(socialPosts.status, ['publishing', 'published']),
      gte(socialPosts.lastAttemptAt, since),
    ))
  return row?.count ?? 0
}

export type PublishImageInput = {
  generatedPostId: string
  caption: string
  altText: string | null
  userId: string
  siteUrl: string
  /** Where to publish. Defaults to Instagram only. */
  platforms?: readonly SocialPlatform[]
}

type PreparedImage = {
  generated: typeof generatedPosts.$inferSelect
  caption: string
  altText: string | null
  title: string
  siteUrl: string
  userId: string
  now: Date
}

/** Creates the `publishing` row (with its media link) so a crash or Meta error always leaves a record. */
async function startPost(account: SocialAccount, prepared: PreparedImage) {
  const row = await db.transaction(async (tx) => {
    const [created] = await tx.insert(socialPosts).values({
      accountId: account.id,
      title: prepared.title,
      kind: 'image',
      caption: prepared.caption,
      altText: prepared.altText,
      status: 'publishing',
      lastAttemptAt: prepared.now,
      createdByUserId: prepared.userId,
    }).returning()
    await tx.insert(socialPostMedia).values({ postId: created!.id, position: 0, generatedPostId: prepared.generated.id })
    return created!
  })
  await recordAudit({
    userId: prepared.userId,
    entityType: 'social_post',
    entityId: row.id,
    action: 'social_post.publish_started',
    metadata: { kind: 'image', platform: account.provider, generatedPostId: prepared.generated.id, username: account.username },
  })
  return row
}

async function finishPost(row: SocialPost, account: SocialAccount, userId: string, result: { providerPostId: string | null, permalink: string | null, containerId?: string | null }) {
  const publishedAt = new Date()
  const [published] = await db.update(socialPosts).set({
    status: 'published',
    containerId: result.containerId ?? row.containerId,
    providerPostId: result.providerPostId,
    permalink: result.permalink,
    publishedAt,
    lastError: null,
    updatedAt: publishedAt,
  }).where(eq(socialPosts.id, row.id)).returning()
  await db.update(socialSettings).set({ lastPublishedAt: publishedAt }).where(eq(socialSettings.key, 'default'))
  await recordAudit({
    userId,
    entityType: 'social_post',
    entityId: row.id,
    action: 'social_post.published',
    metadata: { platform: account.provider, providerPostId: result.providerPostId, permalink: result.permalink },
  })
  return { ...published!, provider: account.provider }
}

/** Records the failure on the row and, for revoked access, on the account(s) sharing the token. */
async function failPost(row: SocialPost, account: SocialAccount, userId: string, error: unknown) {
  const permanentAuth = error instanceof InstagramApiError && error.permanent
  const message = errorText(error).slice(0, 500)
  const failedAt = new Date()
  const [failed] = await db.update(socialPosts).set({ status: 'failed', lastError: message, updatedAt: failedAt })
    .where(eq(socialPosts.id, row.id)).returning()
  if (permanentAuth) {
    await db.update(socialAccounts).set({ status: 'needs_reauth', lastError: message, updatedAt: failedAt })
      .where(inArray(socialAccounts.provider, ['instagram', 'facebook']))
  }
  await recordAudit({
    userId,
    entityType: 'social_post',
    entityId: row.id,
    action: 'social_post.failed',
    metadata: { platform: account.provider, message },
  })
  structuredLog('error', 'social_publish_failed', { postId: row.id, platform: account.provider, permanentAuth, message })
  return { post: { ...failed!, provider: account.provider }, error: new SocialPublishError(message, permanentAuth ? 409 : 502) }
}

async function publishToInstagram(account: SocialAccount, prepared: PreparedImage) {
  const row = await startPost(account, prepared)
  const accessToken = decryptSecret(account.accessTokenEncrypted, password())
  const imageUrl = publicMediaUrl(prepared.siteUrl, prepared.generated.id)
  try {
    const outcome = await runImagePublish({
      createContainer: () => createImageContainer({ instagramId: account.externalId, accessToken, imageUrl, caption: prepared.caption, altText: prepared.altText }),
      getStatus: containerId => getContainerStatus({ containerId, accessToken }),
      publish: containerId => publishContainer({ instagramId: account.externalId, accessToken, containerId }),
      getPermalink: mediaId => getPermalink({ mediaId, accessToken }),
      onContainer: async (containerId) => {
        await db.update(socialPosts).set({ containerId, updatedAt: new Date() }).where(eq(socialPosts.id, row.id))
      },
      sleep: ms => new Promise(resolve => setTimeout(resolve, ms)),
    })
    return { post: await finishPost(row, account, prepared.userId, outcome), error: null }
  } catch (error) {
    return failPost(row, account, prepared.userId, error)
  }
}

async function publishToFacebookPage(account: SocialAccount, prepared: PreparedImage) {
  const row = await startPost(account, prepared)
  const accessToken = decryptSecret(account.accessTokenEncrypted, password())
  // Facebook takes the PNG as is; it fetches the same public, immutable URL as the export.
  const imageUrl = `${prepared.siteUrl.replace(/\/+$/, '')}/api/generated-posts/${prepared.generated.id}`
  try {
    const { postId } = await publishPagePhoto({ pageId: account.externalId, accessToken, imageUrl, caption: prepared.caption, altText: prepared.altText })
    // The post is live; a missing permalink must not turn it into a failure.
    const permalink = await getPostPermalink({ postId, accessToken }).catch(() => null)
    return { post: await finishPost(row, account, prepared.userId, { providerPostId: postId, permalink }), error: null }
  } catch (error) {
    return failPost(row, account, prepared.userId, error)
  }
}

/**
 * Publishes an exported image right now to Instagram and, when asked, to the Facebook Page.
 * Platforms are independent: one can fail while the other is live, and each has its own row and status.
 * Throws only when nothing was published.
 */
export async function publishGeneratedImageNow(input: PublishImageInput): Promise<Array<SocialPost & { provider: string }>> {
  const caption = input.caption.trim()
  const captionCheck = checkCaption(caption)
  if (!captionCheck.ok) throw new SocialPublishError(captionCheck.message)
  const altText = input.altText?.trim() || null
  if (altText && altText.length > INSTAGRAM_ALT_TEXT_MAX) {
    throw new SocialPublishError(`De alternatieve tekst mag maximaal ${INSTAGRAM_ALT_TEXT_MAX} tekens hebben`)
  }
  if (!isPubliclyReachable(input.siteUrl)) {
    throw new SocialPublishError('NUXT_PUBLIC_SITE_URL wijst naar een lokaal adres. Meta moet de afbeelding via internet kunnen ophalen.', 409)
  }

  const platforms = input.platforms?.length ? input.platforms : ['instagram'] as const

  const [generated] = await db.select().from(generatedPosts).where(eq(generatedPosts.id, input.generatedPostId)).limit(1)
  if (!generated) throw new SocialPublishError('Gegenereerde post niet gevonden', 404)
  if (platforms.includes('instagram') && !canPublishPresetAsFeedImage(generated.preset)) {
    throw new SocialPublishError('Deze afmeting past niet in de Instagram-feed. Kies 1:1 of 4:5; stories volgen in een latere fase.')
  }

  let instagram: SocialAccount | null = null
  if (platforms.includes('instagram')) {
    instagram = await loadActiveAccount('instagram')
    if (!instagram) throw new SocialPublishError('Er is geen actief Instagram-account gekoppeld', 409)
    if (!hasPublishScope(instagram.scopes)) {
      throw new SocialPublishError('Het account mist de publicatierechten. Verbind het account opnieuw.', 409)
    }
  }

  let facebook: SocialAccount | null = null
  if (platforms.includes('facebook')) {
    facebook = await loadActiveAccount('facebook')
    if (!facebook) throw new SocialPublishError('Er is geen actieve Facebook-pagina gekoppeld', 409)
    if (!hasFacebookPublishScope(facebook.scopes)) {
      throw new SocialPublishError('De Facebook-pagina mist de toestemming om te posten (pages_manage_posts). Verbind het account opnieuw.', 409)
    }
  }

  const now = new Date()
  if (instagram && await recentPostCount(instagram.id, now) >= INSTAGRAM_DAILY_POST_LIMIT) {
    throw new SocialPublishError(`Instagram staat ${INSTAGRAM_DAILY_POST_LIMIT} gepubliceerde posts per 24 uur toe. Probeer het later opnieuw.`, 429)
  }

  // The same export cannot be published twice at the same moment (double click, two tabs).
  const [inFlight] = await db.select({ id: socialPosts.id }).from(socialPosts)
    .innerJoin(socialPostMedia, eq(socialPostMedia.postId, socialPosts.id))
    .where(and(
      eq(socialPostMedia.generatedPostId, generated.id),
      eq(socialPosts.status, 'publishing'),
      gte(socialPosts.lastAttemptAt, new Date(now.getTime() - STALE_PUBLISHING_MS)),
    ))
    .limit(1)
  if (inFlight) throw new SocialPublishError('Deze post wordt al gepubliceerd', 409)

  if (instagram) {
    const jpeg = await ensureInstagramJpeg(generated)
    if (jpeg.length > INSTAGRAM_IMAGE_MAX_BYTES) {
      throw new SocialPublishError('De afbeelding is groter dan 8 MB, het maximum van Instagram')
    }
  }

  const prepared: PreparedImage = {
    generated,
    caption,
    altText,
    title: String((generated.design as { headline?: unknown }).headline ?? '').trim().slice(0, 200) || 'Social post',
    siteUrl: input.siteUrl,
    userId: input.userId,
    now,
  }

  const results = []
  if (instagram) results.push(await publishToInstagram(instagram, prepared))
  if (facebook) results.push(await publishToFacebookPage(facebook, prepared))

  const posts = results.map(result => result.post)
  if (results.every(result => result.error)) throw results[0]!.error
  return posts
}
