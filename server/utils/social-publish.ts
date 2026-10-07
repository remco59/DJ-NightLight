import { and, eq, gte, inArray, sql } from 'drizzle-orm'
import { generatedPosts, socialAccounts, socialPostMedia, socialPosts, socialSettings, type SocialAccount, type SocialPost } from '../../db/schema'
import { hasPublishScope } from '../../shared/instagram'
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
  InstagramApiError,
  publishContainer,
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

export async function loadActiveInstagramAccount(): Promise<SocialAccount | null> {
  const [account] = await db.select().from(socialAccounts)
    .where(and(eq(socialAccounts.provider, 'instagram'), eq(socialAccounts.status, 'active')))
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
}

/**
 * Publishes an exported image to Instagram right now. The row exists from the first moment
 * (status `publishing`), so a crash or a Meta error always leaves a visible record.
 */
export async function publishGeneratedImageNow(input: PublishImageInput): Promise<SocialPost> {
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

  const [generated] = await db.select().from(generatedPosts).where(eq(generatedPosts.id, input.generatedPostId)).limit(1)
  if (!generated) throw new SocialPublishError('Gegenereerde post niet gevonden', 404)
  if (!canPublishPresetAsFeedImage(generated.preset)) {
    throw new SocialPublishError('Deze afmeting past niet in de Instagram-feed. Kies 1:1 of 4:5; stories volgen in een latere fase.')
  }

  const account = await loadActiveInstagramAccount()
  if (!account) throw new SocialPublishError('Er is geen actief Instagram-account gekoppeld', 409)
  if (!hasPublishScope(account.scopes)) {
    throw new SocialPublishError('Het account mist de publicatierechten. Verbind het account opnieuw.', 409)
  }

  const now = new Date()
  if (await recentPostCount(account.id, now) >= INSTAGRAM_DAILY_POST_LIMIT) {
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

  const jpeg = await ensureInstagramJpeg(generated)
  if (jpeg.length > INSTAGRAM_IMAGE_MAX_BYTES) {
    throw new SocialPublishError('De afbeelding is groter dan 8 MB, het maximum van Instagram')
  }

  const title = String((generated.design as { headline?: unknown }).headline ?? '').trim().slice(0, 200) || 'Instagram-post'
  const row = await db.transaction(async (tx) => {
    const [created] = await tx.insert(socialPosts).values({
      accountId: account.id,
      title,
      kind: 'image',
      caption,
      altText,
      status: 'publishing',
      lastAttemptAt: now,
      createdByUserId: input.userId,
    }).returning()
    await tx.insert(socialPostMedia).values({ postId: created!.id, position: 0, generatedPostId: generated.id })
    return created!
  })

  await recordAudit({
    userId: input.userId,
    entityType: 'social_post',
    entityId: row.id,
    action: 'social_post.publish_started',
    metadata: { kind: 'image', generatedPostId: generated.id, username: account.username },
  })

  const accessToken = decryptSecret(account.accessTokenEncrypted, password())
  const imageUrl = publicMediaUrl(input.siteUrl, generated.id)

  try {
    const outcome = await runImagePublish({
      createContainer: () => createImageContainer({ instagramId: account.externalId, accessToken, imageUrl, caption, altText }),
      getStatus: containerId => getContainerStatus({ containerId, accessToken }),
      publish: containerId => publishContainer({ instagramId: account.externalId, accessToken, containerId }),
      getPermalink: mediaId => getPermalink({ mediaId, accessToken }),
      onContainer: async (containerId) => {
        await db.update(socialPosts).set({ containerId, updatedAt: new Date() }).where(eq(socialPosts.id, row.id))
      },
      sleep: ms => new Promise(resolve => setTimeout(resolve, ms)),
    })

    const publishedAt = new Date()
    const [published] = await db.update(socialPosts).set({
      status: 'published',
      containerId: outcome.containerId,
      providerPostId: outcome.providerPostId,
      permalink: outcome.permalink,
      publishedAt,
      lastError: null,
      updatedAt: publishedAt,
    }).where(eq(socialPosts.id, row.id)).returning()

    await db.update(socialSettings).set({ lastPublishedAt: publishedAt }).where(eq(socialSettings.key, 'default'))
    await recordAudit({
      userId: input.userId,
      entityType: 'social_post',
      entityId: row.id,
      action: 'social_post.published',
      metadata: { providerPostId: outcome.providerPostId, permalink: outcome.permalink },
    })
    return published!
  } catch (error) {
    const permanentAuth = error instanceof InstagramApiError && error.permanent
    const message = errorText(error).slice(0, 500)
    const failedAt = new Date()
    await db.update(socialPosts).set({ status: 'failed', lastError: message, updatedAt: failedAt }).where(eq(socialPosts.id, row.id))
    if (permanentAuth) {
      await db.update(socialAccounts).set({ status: 'needs_reauth', lastError: message, updatedAt: failedAt }).where(eq(socialAccounts.id, account.id))
    }
    await recordAudit({
      userId: input.userId,
      entityType: 'social_post',
      entityId: row.id,
      action: 'social_post.failed',
      metadata: { message },
    })
    structuredLog('error', 'instagram_publish_failed', { postId: row.id, permanentAuth, message })
    throw new SocialPublishError(message, permanentAuth ? 409 : 502)
  }
}
