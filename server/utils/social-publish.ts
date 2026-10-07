import { and, asc, eq, gte, inArray, isNull, lt, lte, or, sql } from 'drizzle-orm'
import { generatedPosts, socialAccounts, socialPostMedia, socialPosts, socialSettings, type SocialAccount, type SocialPost } from '../../db/schema'
import { hasFacebookPublishScope, hasPublishScope } from '../../shared/instagram'
import {
  canPublishPresetAsFeedImage,
  checkCaption,
  checkScheduleMoment,
  INSTAGRAM_ALT_TEXT_MAX,
  INSTAGRAM_DAILY_POST_LIMIT,
  INSTAGRAM_IMAGE_MAX_BYTES,
  SOCIAL_MAX_ATTEMPTS,
  socialRetryDelayMs,
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
  isRetryablePublishError,
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

/** A row stuck in `publishing` longer than this (crashed process) no longer blocks a new attempt and is recovered by the worker. */
export const STALE_PUBLISHING_MS = 10 * 60_000
/** Wait this long when Instagram's 24 hour limit is reached, without counting it as a failed attempt. */
const DAILY_LIMIT_DEFER_MS = 30 * 60_000

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

export type PostMode = 'now' | 'schedule' | 'draft'

export type PublishImageInput = {
  generatedPostId: string
  caption: string
  altText: string | null
  userId: string
  siteUrl: string
  /** Where to publish. Defaults to Instagram only. */
  platforms?: readonly SocialPlatform[]
  /** `now` publishes right away (default), `schedule` queues it for `scheduledAt`, `draft` only saves it. */
  mode?: PostMode
  scheduledAt?: string | null
}

type PreparedImage = {
  generated: typeof generatedPosts.$inferSelect
  caption: string
  altText: string | null
  title: string
  userId: string
  now: Date
}

type PostWithProvider = SocialPost & { provider: string }
type Outcome = { post: PostWithProvider, error: SocialPublishError | null }

function postTitle(generated: { design: unknown }) {
  return String((generated.design as { headline?: unknown }).headline ?? '').trim().slice(0, 200) || 'Social post'
}

/** Creates the row (with its media link) so a crash or Meta error always leaves a record. */
async function insertPost(
  account: SocialAccount,
  prepared: PreparedImage,
  state: { status: 'publishing' | 'scheduled' | 'draft', scheduledAt: Date | null },
) {
  const row = await db.transaction(async (tx) => {
    const [created] = await tx.insert(socialPosts).values({
      accountId: account.id,
      title: prepared.title,
      kind: 'image',
      caption: prepared.caption,
      altText: prepared.altText,
      status: state.status,
      scheduledAt: state.scheduledAt,
      lastAttemptAt: state.status === 'publishing' ? prepared.now : null,
      createdByUserId: prepared.userId,
    }).returning()
    await tx.insert(socialPostMedia).values({ postId: created!.id, position: 0, generatedPostId: prepared.generated.id })
    return created!
  })
  await recordAudit({
    userId: prepared.userId,
    entityType: 'social_post',
    entityId: row.id,
    action: state.status === 'publishing' ? 'social_post.publish_started' : state.status === 'scheduled' ? 'social_post.scheduled' : 'social_post.draft_saved',
    metadata: { kind: 'image', platform: account.provider, generatedPostId: prepared.generated.id, username: account.username, scheduledAt: state.scheduledAt?.toISOString() ?? null },
  })
  return row
}

async function finishPost(row: SocialPost, account: SocialAccount, userId: string | null, result: { providerPostId: string | null, permalink: string | null, containerId?: string | null }) {
  const publishedAt = new Date()
  const [published] = await db.update(socialPosts).set({
    status: 'published',
    containerId: result.containerId ?? row.containerId,
    providerPostId: result.providerPostId,
    permalink: result.permalink,
    publishedAt,
    nextRetryAt: null,
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

/**
 * Records the failure on the row and, for revoked access, on the account(s) sharing the token.
 * With `allowRetry` (the worker) a temporary Meta problem puts the post back in the queue with a
 * growing delay, up to `SOCIAL_MAX_ATTEMPTS`; permanent problems never retry.
 */
async function failPost(row: SocialPost, account: SocialAccount, userId: string | null, error: unknown, allowRetry = false): Promise<Outcome> {
  const permanentAuth = error instanceof InstagramApiError && error.permanent
  const message = errorText(error).slice(0, 500)
  const failedAt = new Date()
  const failures = row.retryCount + 1
  const retry = allowRetry && !permanentAuth && failures < SOCIAL_MAX_ATTEMPTS && isRetryablePublishError(error)
  const nextRetryAt = retry ? new Date(failedAt.getTime() + socialRetryDelayMs(failures)) : null

  const [failed] = await db.update(socialPosts).set(retry
    ? { status: 'scheduled', retryCount: failures, nextRetryAt, lastError: message, updatedAt: failedAt }
    : { status: 'failed', retryCount: allowRetry ? failures : row.retryCount, nextRetryAt: null, lastError: message, updatedAt: failedAt })
    .where(eq(socialPosts.id, row.id)).returning()
  if (permanentAuth) {
    await db.update(socialAccounts).set({ status: 'needs_reauth', lastError: message, updatedAt: failedAt })
      .where(inArray(socialAccounts.provider, ['instagram', 'facebook']))
  }
  await recordAudit({
    userId,
    entityType: 'social_post',
    entityId: row.id,
    action: retry ? 'social_post.retry_scheduled' : 'social_post.failed',
    metadata: { platform: account.provider, message, attempt: failures, nextRetryAt: nextRetryAt?.toISOString() ?? null },
  })
  structuredLog(retry ? 'warn' : 'error', retry ? 'social_publish_retry' : 'social_publish_failed', { postId: row.id, platform: account.provider, permanentAuth, attempt: failures, message })
  return { post: { ...failed!, provider: account.provider }, error: new SocialPublishError(message, permanentAuth ? 409 : 502) }
}

async function publishToInstagram(row: SocialPost, account: SocialAccount, generatedId: string, ctx: ExecuteContext) {
  const accessToken = decryptSecret(account.accessTokenEncrypted, password())
  const imageUrl = publicMediaUrl(ctx.siteUrl, generatedId)
  const outcome = await runImagePublish({
    createContainer: () => createImageContainer({ instagramId: account.externalId, accessToken, imageUrl, caption: row.caption, altText: row.altText }),
    getStatus: containerId => getContainerStatus({ containerId, accessToken }),
    publish: containerId => publishContainer({ instagramId: account.externalId, accessToken, containerId }),
    getPermalink: mediaId => getPermalink({ mediaId, accessToken }),
    onContainer: async (containerId) => {
      await db.update(socialPosts).set({ containerId, updatedAt: new Date() }).where(eq(socialPosts.id, row.id))
    },
    sleep: ms => new Promise(resolve => setTimeout(resolve, ms)),
  }, row.containerId)
  return outcome
}

async function publishToFacebookPage(row: SocialPost, account: SocialAccount, generatedId: string, ctx: ExecuteContext) {
  const accessToken = decryptSecret(account.accessTokenEncrypted, password())
  // Facebook takes the PNG as is; it fetches the same public, immutable URL as the export.
  const imageUrl = `${ctx.siteUrl.replace(/\/+$/, '')}/api/generated-posts/${generatedId}`
  const { postId } = await publishPagePhoto({ pageId: account.externalId, accessToken, imageUrl, caption: row.caption, altText: row.altText })
  // The post is live; a missing permalink must not turn it into a failure.
  const permalink = await getPostPermalink({ postId, accessToken }).catch(() => null)
  return { containerId: null, providerPostId: postId, permalink }
}

type ExecuteContext = {
  siteUrl: string
  /** Who triggered it; null for the worker. */
  userId: string | null
  /** The worker may retry temporary problems; an interactive publish shows the error right away. */
  allowRetry: boolean
  /** The row was left in `publishing` by a process that died, so what happened at Meta is unknown. */
  recovering?: boolean
}

/**
 * Publishes a row that is already in `publishing`. Never throws: the outcome is written to the row.
 * Re-running a row is safe: an existing Instagram container is checked (`PUBLISHED` is never published again).
 */
async function executePost(row: SocialPost, ctx: ExecuteContext): Promise<Outcome> {
  const [account] = await db.select().from(socialAccounts).where(eq(socialAccounts.id, row.accountId)).limit(1)
  if (!account) {
    return failPost(row, { provider: 'instagram', username: '' } as SocialAccount, ctx.userId, new SocialPublishError('Het gekoppelde account bestaat niet meer'))
  }
  const fail = (message: string) => failPost(row, account, ctx.userId, new SocialPublishError(message))

  try {
    if (account.status !== 'active') return await fail('De koppeling met Meta is niet actief. Verbind het account opnieuw en kies Opnieuw.')
    const isInstagram = account.provider === 'instagram'
    if (isInstagram ? !hasPublishScope(account.scopes) : !hasFacebookPublishScope(account.scopes)) {
      return await fail('Het account mist de publicatierechten. Verbind het account opnieuw en kies Opnieuw.')
    }
    if (!isPubliclyReachable(ctx.siteUrl)) return await fail('NUXT_PUBLIC_SITE_URL wijst naar een lokaal adres. Meta moet de afbeelding via internet kunnen ophalen.')
    if (row.kind !== 'image') return await fail('Dit soort post kan nog niet worden gepubliceerd')

    const [media] = await db.select({ generated: generatedPosts }).from(socialPostMedia)
      .innerJoin(generatedPosts, eq(generatedPosts.id, socialPostMedia.generatedPostId))
      .where(and(eq(socialPostMedia.postId, row.id), eq(socialPostMedia.position, 0)))
      .limit(1)
    if (!media) return await fail('De afbeelding van deze post bestaat niet meer')
    const generated = media.generated

    if (isInstagram) {
      if (!canPublishPresetAsFeedImage(generated.preset)) return await fail('Deze afmeting past niet in de Instagram-feed. Kies 1:1 of 4:5.')
      if (!row.containerId) {
        const jpeg = await ensureInstagramJpeg(generated)
        if (jpeg.length > INSTAGRAM_IMAGE_MAX_BYTES) return await fail('De afbeelding is groter dan 8 MB, het maximum van Instagram')
      }
      // The worker never exceeds the daily limit; the post waits instead of failing. This row counts itself.
      if (ctx.allowRetry && await recentPostCount(account.id, new Date()) > INSTAGRAM_DAILY_POST_LIMIT) {
        const deferred = await deferPost(row, `Instagram staat ${INSTAGRAM_DAILY_POST_LIMIT} posts per 24 uur toe. Deze post wacht tot er ruimte is.`)
        return { post: { ...deferred, provider: account.provider }, error: null }
      }
    } else if (ctx.recovering) {
      // Facebook has no container to look up, so a post that may already be live is not posted again.
      return await fail('Onduidelijk of de post op Facebook is geplaatst (het proces stopte halverwege). Controleer de pagina en kies Opnieuw als hij er niet staat.')
    }

    const result = isInstagram
      ? await publishToInstagram(row, account, generated.id, ctx)
      : await publishToFacebookPage(row, account, generated.id, ctx)
    return { post: await finishPost(row, account, ctx.userId, result), error: null }
  } catch (error) {
    return failPost(row, account, ctx.userId, error, ctx.allowRetry)
  }
}

/** Puts a claimed row back in the queue without counting an attempt. */
async function deferPost(row: SocialPost, reason: string) {
  const now = new Date()
  const [deferred] = await db.update(socialPosts).set({
    status: 'scheduled',
    nextRetryAt: new Date(now.getTime() + DAILY_LIMIT_DEFER_MS),
    lastError: reason,
    updatedAt: now,
  }).where(eq(socialPosts.id, row.id)).returning()
  return deferred!
}

function siteUrl() {
  return String(useRuntimeConfig().public.siteUrl || '')
}

/**
 * Handles an export for Instagram and/or the Facebook Page.
 * - `now` (default): publishes right away. Platforms are independent: one can fail while the other is live.
 *   Throws only when nothing was published.
 * - `schedule`: queues one post per platform for `scheduledAt`; the worker publishes them.
 * - `draft`: saves a "Concept" that can be planned or published later.
 */
export async function publishGeneratedImageNow(input: PublishImageInput): Promise<PostWithProvider[]> {
  const mode = input.mode ?? 'now'
  const caption = input.caption.trim()
  const captionCheck = checkCaption(caption)
  if (!captionCheck.ok) throw new SocialPublishError(captionCheck.message)
  const altText = input.altText?.trim() || null
  if (altText && altText.length > INSTAGRAM_ALT_TEXT_MAX) {
    throw new SocialPublishError(`De alternatieve tekst mag maximaal ${INSTAGRAM_ALT_TEXT_MAX} tekens hebben`)
  }
  if (mode !== 'draft' && !isPubliclyReachable(input.siteUrl)) {
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

  let scheduledAt: Date | null = null
  if (mode === 'schedule' || (mode === 'draft' && input.scheduledAt)) {
    // The post can only go out while the access stays valid.
    const limit = [instagram, facebook].filter((a): a is SocialAccount => Boolean(a))
      .reduce<Date | null>((earliest, a) => (!earliest || a.tokenExpiresAt < earliest ? a.tokenExpiresAt : earliest), null)
    const check = checkScheduleMoment(input.scheduledAt, now, limit)
    if (!check.ok) throw new SocialPublishError(check.message)
    scheduledAt = check.at
  }

  if (mode === 'now') {
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
  }

  if (instagram && mode !== 'draft') {
    // Converted now, so a broken export is reported to the person and not first discovered by the worker.
    const jpeg = await ensureInstagramJpeg(generated)
    if (jpeg.length > INSTAGRAM_IMAGE_MAX_BYTES) {
      throw new SocialPublishError('De afbeelding is groter dan 8 MB, het maximum van Instagram')
    }
  }

  const prepared: PreparedImage = {
    generated,
    caption,
    altText,
    title: postTitle(generated),
    userId: input.userId,
    now,
  }
  const accounts = [instagram, facebook].filter((a): a is SocialAccount => Boolean(a))

  if (mode !== 'now') {
    const status = mode === 'schedule' ? 'scheduled' : 'draft'
    const rows: PostWithProvider[] = []
    for (const account of accounts) {
      rows.push({ ...await insertPost(account, prepared, { status, scheduledAt }), provider: account.provider })
    }
    return rows
  }

  const results: Outcome[] = []
  for (const account of accounts) {
    const row = await insertPost(account, prepared, { status: 'publishing', scheduledAt: null })
    results.push(await executePost(row, { siteUrl: input.siteUrl, userId: input.userId, allowRetry: false }))
  }

  const posts = results.map(result => result.post)
  if (results.every(result => result.error)) throw results[0]!.error
  return posts
}

/**
 * Moves rows to `publishing` and returns them. `FOR UPDATE SKIP LOCKED` lets several processes
 * share the queue without ever claiming the same row twice.
 */
async function claim(where: ReturnType<typeof and>, limit: number, now: Date) {
  return db.transaction(async (tx) => {
    const due = await tx.select({ id: socialPosts.id }).from(socialPosts)
      .where(where)
      .orderBy(asc(socialPosts.scheduledAt))
      .limit(limit)
      .for('update', { skipLocked: true })
    if (!due.length) return []
    return tx.update(socialPosts).set({ status: 'publishing', lastAttemptAt: now, updatedAt: now })
      .where(inArray(socialPosts.id, due.map(row => row.id))).returning()
  })
}

/**
 * One worker tick: first picks up posts a crashed process left in `publishing`, then publishes
 * everything that is due. Returns how many posts were handled.
 */
export async function processDueSocialPosts(limit = 5, now = new Date()) {
  const base = { siteUrl: siteUrl(), userId: null, allowRetry: true } as const
  let handled = 0

  const stale = await claim(
    and(eq(socialPosts.status, 'publishing'), lt(socialPosts.lastAttemptAt, new Date(now.getTime() - STALE_PUBLISHING_MS))),
    limit,
    now,
  )
  for (const row of stale) {
    structuredLog('warn', 'social_publish_recovering', { postId: row.id, containerId: row.containerId })
    await executePost(row, { ...base, recovering: true })
    handled += 1
  }

  const due = await claim(
    and(
      eq(socialPosts.status, 'scheduled'),
      lte(socialPosts.scheduledAt, now),
      or(isNull(socialPosts.nextRetryAt), lte(socialPosts.nextRetryAt, now)),
    ),
    limit,
    now,
  )
  for (const row of due) {
    await executePost(row, base)
    handled += 1
  }
  return handled
}
