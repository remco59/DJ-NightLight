import { and, asc, eq, gte, inArray, isNull, lt, lte, or, sql } from 'drizzle-orm'
import { generatedPosts, socialAccounts, socialPostMedia, socialPosts, socialSettings, videoProjects, videoRenderJobs, type SocialAccount, type SocialPost } from '../../db/schema'
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
  type SocialPostKindKey,
} from '../../shared/social'
import { decryptSecret } from '../../shared/secret-box'
import { recordAudit } from './audit'
import { db } from './db'
import {
  createCarouselContainer,
  createCarouselItemContainer,
  createImageContainer,
  createStoryImageContainer,
  createVideoContainer,
  getContainerStatus,
  getPermalink,
  getPostPermalink,
  InstagramApiError,
  publishContainer,
  publishPagePhoto,
} from './instagram'
import { getGeneratedStorage } from './media-storage'
import {
  CONTAINER_LEAD_MS,
  ContainerNotReadyError,
  convertToInstagramJpeg,
  createCarouselContainerFlow,
  instagramJpegKey,
  isPubliclyReachable,
  isRetryablePublishError,
  mediaProblem,
  publicMediaUrl,
  publicVideoUrl,
  runContainerPublish,
  VIDEO_POLL_ATTEMPTS,
  VIDEO_POLL_INTERVAL_MS,
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
/** Wait before checking again when Meta is still processing the media. Counts as an attempt, so it cannot loop forever. */
const CONTAINER_NOT_READY_RETRY_MS = 60_000

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

export type PublishInput = {
  /** What to publish. Defaults to a single image. */
  kind?: SocialPostKindKey
  /** Exports to publish: one for an image or story, 2 to 10 for a carousel. Empty for a video. */
  generatedPostIds?: readonly string[]
  /** Completed render for a reel or a video story. */
  videoRenderJobId?: string | null
  caption: string
  altText: string | null
  userId: string
  siteUrl: string
  /** Where to publish. Defaults to Instagram only. Facebook only takes single images. */
  platforms?: readonly SocialPlatform[]
  /** `now` publishes right away (default), `schedule` queues it for `scheduledAt`, `draft` only saves it. */
  mode?: PostMode
  scheduledAt?: string | null
}

type GeneratedRow = typeof generatedPosts.$inferSelect
type VideoRow = typeof videoRenderJobs.$inferSelect

type PostMedia = { kind: SocialPostKindKey, images: GeneratedRow[], video: VideoRow | null }

type PreparedPost = PostMedia & {
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

async function preparedTitle(media: PostMedia) {
  if (media.video) {
    if (media.video.projectId) {
      const [project] = await db.select({ name: videoProjects.name }).from(videoProjects).where(eq(videoProjects.id, media.video.projectId)).limit(1)
      if (project?.name) return project.name.slice(0, 200)
    }
    return media.kind === 'story' ? 'Video-story' : 'Reel'
  }
  const first = postTitle(media.images[0]!)
  return media.kind === 'carousel' ? `${first} (carrousel)`.slice(0, 200) : first
}

/** Creates the row (with its media links) so a crash or Meta error always leaves a record. */
async function insertPost(
  account: SocialAccount,
  prepared: PreparedPost,
  state: { status: 'publishing' | 'scheduled' | 'draft', scheduledAt: Date | null },
) {
  const row = await db.transaction(async (tx) => {
    const [created] = await tx.insert(socialPosts).values({
      accountId: account.id,
      title: prepared.title,
      kind: prepared.kind,
      caption: prepared.caption,
      altText: prepared.altText,
      status: state.status,
      scheduledAt: state.scheduledAt,
      lastAttemptAt: state.status === 'publishing' ? prepared.now : null,
      createdByUserId: prepared.userId,
    }).returning()
    const links = prepared.video
      ? [{ postId: created!.id, position: 0, videoRenderJobId: prepared.video.id }]
      : prepared.images.map((image, position) => ({ postId: created!.id, position, generatedPostId: image.id }))
    await tx.insert(socialPostMedia).values(links)
    return created!
  })
  await recordAudit({
    userId: prepared.userId,
    entityType: 'social_post',
    entityId: row.id,
    action: state.status === 'publishing' ? 'social_post.publish_started' : state.status === 'scheduled' ? 'social_post.scheduled' : 'social_post.draft_saved',
    metadata: {
      kind: prepared.kind,
      platform: account.provider,
      generatedPostIds: prepared.images.map(image => image.id),
      videoRenderJobId: prepared.video?.id ?? null,
      username: account.username,
      scheduledAt: state.scheduledAt?.toISOString() ?? null,
    },
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
  // Media that Meta is still processing is checked again soon; other temporary trouble backs off.
  const delayMs = error instanceof ContainerNotReadyError ? CONTAINER_NOT_READY_RETRY_MS : socialRetryDelayMs(failures)
  const nextRetryAt = retry ? new Date(failedAt.getTime() + delayMs) : null

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

async function loadMedia(postId: string): Promise<{ images: GeneratedRow[], video: VideoRow | null }> {
  const rows = await db.select({ generated: generatedPosts, video: videoRenderJobs }).from(socialPostMedia)
    .leftJoin(generatedPosts, eq(generatedPosts.id, socialPostMedia.generatedPostId))
    .leftJoin(videoRenderJobs, eq(videoRenderJobs.id, socialPostMedia.videoRenderJobId))
    .where(eq(socialPostMedia.postId, postId))
    .orderBy(asc(socialPostMedia.position))
  return {
    images: rows.flatMap(row => (row.generated ? [row.generated] : [])),
    video: rows.find(row => row.video)?.video ?? null,
  }
}

function instagramPublishSteps(row: SocialPost, account: SocialAccount, accessToken: string) {
  return {
    getStatus: (containerId: string) => getContainerStatus({ containerId, accessToken }),
    publish: (containerId: string) => publishContainer({ instagramId: account.externalId, accessToken, containerId }),
    getPermalink: (mediaId: string) => getPermalink({ mediaId, accessToken }),
    onContainer: async (containerId: string) => {
      await db.update(socialPosts).set({ containerId, updatedAt: new Date() }).where(eq(socialPosts.id, row.id))
    },
    sleep: (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms)),
  }
}

/** Creates the Instagram container for any kind of post. Nothing is public until `media_publish`. */
function instagramContainerFactory(row: SocialPost, account: SocialAccount, accessToken: string, media: { images: GeneratedRow[], video: VideoRow | null }, siteUrl: string) {
  const instagramId = account.externalId
  const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))
  if (media.video) {
    return () => createVideoContainer({
      instagramId,
      accessToken,
      videoUrl: publicVideoUrl(siteUrl, media.video!.id),
      mediaType: row.kind === 'reel' ? 'REELS' : 'STORIES',
      caption: row.caption,
    })
  }
  if (row.kind === 'carousel') {
    return () => createCarouselContainerFlow({
      createItem: position => createCarouselItemContainer({ instagramId, accessToken, imageUrl: publicMediaUrl(siteUrl, media.images[position]!.id) }),
      getStatus: containerId => getContainerStatus({ containerId, accessToken }),
      createCarousel: children => createCarouselContainer({ instagramId, accessToken, children, caption: row.caption }),
      sleep,
    }, media.images.length)
  }
  if (row.kind === 'story') {
    return () => createStoryImageContainer({ instagramId, accessToken, imageUrl: publicMediaUrl(siteUrl, media.images[0]!.id) })
  }
  return () => createImageContainer({ instagramId, accessToken, imageUrl: publicMediaUrl(siteUrl, media.images[0]!.id), caption: row.caption, altText: row.altText })
}

async function publishToInstagram(row: SocialPost, account: SocialAccount, media: { images: GeneratedRow[], video: VideoRow | null }, ctx: ExecuteContext) {
  const accessToken = decryptSecret(account.accessTokenEncrypted, password())
  return runContainerPublish({
    createContainer: instagramContainerFactory(row, account, accessToken, media, ctx.siteUrl),
    ...instagramPublishSteps(row, account, accessToken),
  }, row.containerId, media.video ? { attempts: VIDEO_POLL_ATTEMPTS, intervalMs: VIDEO_POLL_INTERVAL_MS } : {})
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

/** Instagram needs a JPEG of every image; converting here reports a broken or oversized export as a normal failure. */
async function ensureJpegsWithinLimit(images: readonly GeneratedRow[]) {
  for (const image of images) {
    const jpeg = await ensureInstagramJpeg(image)
    if (jpeg.length > INSTAGRAM_IMAGE_MAX_BYTES) return 'De afbeelding is groter dan 8 MB, het maximum van Instagram'
  }
  return null
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
    if (!isPubliclyReachable(ctx.siteUrl)) return await fail('NUXT_PUBLIC_SITE_URL wijst naar een lokaal adres. Meta moet de media via internet kunnen ophalen.')
    if (!isInstagram && row.kind !== 'image') return await fail('Op de Facebook-pagina kunnen in NightLight alleen afbeeldingen worden geplaatst.')

    const media = await loadMedia(row.id)
    const kind = row.kind as SocialPostKindKey
    if (!media.images.length && !media.video) return await fail('De media van deze post bestaan niet meer')
    const problem = mediaProblem({ kind, ...media })
    if (problem) return await fail(problem)

    if (isInstagram) {
      if (kind === 'image' && !canPublishPresetAsFeedImage(media.images[0]!.preset)) {
        return await fail('Deze afmeting past niet in de Instagram-feed. Kies 1:1 of 4:5.')
      }
      if (!row.containerId && media.images.length) {
        const tooBig = await ensureJpegsWithinLimit(media.images)
        if (tooBig) return await fail(tooBig)
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
      ? await publishToInstagram(row, account, media, ctx)
      : await publishToFacebookPage(row, account, media.images[0]!.id, ctx)
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

/** Loads and validates the media of a new post. Throws a `SocialPublishError` that is shown to the person. */
async function loadRequestedMedia(input: PublishInput, kind: SocialPostKindKey): Promise<PostMedia> {
  const ids = [...new Set(input.generatedPostIds ?? [])]
  if ((input.generatedPostIds?.length ?? 0) !== ids.length) throw new SocialPublishError('Dezelfde afbeelding kan maar één keer in een post')
  const videoId = input.videoRenderJobId || null
  if (ids.length && videoId) throw new SocialPublishError('Kies afbeeldingen of een video, niet allebei')

  let images: GeneratedRow[] = []
  if (ids.length) {
    const found = await db.select().from(generatedPosts).where(inArray(generatedPosts.id, ids))
    if (found.length !== ids.length) throw new SocialPublishError('Gegenereerde post niet gevonden', 404)
    // Keep the order the person chose: it is the order of the slides.
    images = ids.map(id => found.find(row => row.id === id)!)
  }

  let video: VideoRow | null = null
  if (videoId) {
    const [job] = await db.select().from(videoRenderJobs).where(eq(videoRenderJobs.id, videoId)).limit(1)
    if (!job) throw new SocialPublishError('Video niet gevonden', 404)
    video = job
  }

  const media: PostMedia = { kind, images, video }
  const problem = mediaProblem(media)
  if (problem) throw new SocialPublishError(problem)
  return media
}

/**
 * Handles an image, carousel, story or reel for Instagram and (for single images) the Facebook Page.
 * - `now` (default): publishes right away. Platforms are independent: one can fail while the other is live.
 *   Throws only when nothing was published. Video is never waited on in the request: Meta needs a
 *   while to process it, so it goes to the worker (`scheduled` for this moment) and the status follows in Social.
 * - `schedule`: queues one post per platform for `scheduledAt`; the worker publishes them.
 * - `draft`: saves a "Concept" that can be planned or published later.
 */
export async function publishSocialPost(input: PublishInput): Promise<PostWithProvider[]> {
  const kind = input.kind ?? 'image'
  const mode = input.mode ?? 'now'
  // Stories carry no caption on Instagram, and alt text is only supported on a single image.
  const caption = kind === 'story' ? '' : input.caption.trim()
  const captionCheck = checkCaption(caption)
  if (!captionCheck.ok) throw new SocialPublishError(captionCheck.message)
  const altText = kind === 'image' ? (input.altText?.trim() || null) : null
  if (altText && altText.length > INSTAGRAM_ALT_TEXT_MAX) {
    throw new SocialPublishError(`De alternatieve tekst mag maximaal ${INSTAGRAM_ALT_TEXT_MAX} tekens hebben`)
  }
  if (mode !== 'draft' && !isPubliclyReachable(input.siteUrl)) {
    throw new SocialPublishError('NUXT_PUBLIC_SITE_URL wijst naar een lokaal adres. Meta moet de media via internet kunnen ophalen.', 409)
  }

  const platforms = input.platforms?.length ? input.platforms : ['instagram'] as const
  if (kind !== 'image' && platforms.includes('facebook')) {
    throw new SocialPublishError('Op de Facebook-pagina kunnen in NightLight alleen afbeeldingen worden geplaatst. Kies alleen Instagram.')
  }

  const media = await loadRequestedMedia(input, kind)
  if (platforms.includes('instagram') && kind === 'image' && !canPublishPresetAsFeedImage(media.images[0]!.preset)) {
    throw new SocialPublishError('Deze afmeting past niet in de Instagram-feed. Kies 1:1 of 4:5; voor 9:16 maak je een story.')
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
    const sameMedia = media.video
      ? eq(socialPostMedia.videoRenderJobId, media.video.id)
      : inArray(socialPostMedia.generatedPostId, media.images.map(image => image.id))
    const [inFlight] = await db.select({ id: socialPosts.id }).from(socialPosts)
      .innerJoin(socialPostMedia, eq(socialPostMedia.postId, socialPosts.id))
      .where(and(
        sameMedia,
        eq(socialPosts.status, 'publishing'),
        gte(socialPosts.lastAttemptAt, new Date(now.getTime() - STALE_PUBLISHING_MS)),
      ))
      .limit(1)
    if (inFlight) throw new SocialPublishError('Deze post wordt al gepubliceerd', 409)
  }

  if (instagram && mode !== 'draft' && media.images.length) {
    // Converted now, so a broken export is reported to the person and not first discovered by the worker.
    const tooBig = await ensureJpegsWithinLimit(media.images)
    if (tooBig) throw new SocialPublishError(tooBig)
  }

  const prepared: PreparedPost = {
    ...media,
    caption,
    altText,
    title: await preparedTitle(media),
    userId: input.userId,
    now,
  }
  const accounts = [instagram, facebook].filter((a): a is SocialAccount => Boolean(a))

  // Video is processed by Meta in the background, so it always goes through the queue, even "now".
  const viaQueue = mode !== 'now' || Boolean(media.video)
  if (viaQueue) {
    const status = mode === 'draft' ? 'draft' : 'scheduled'
    const moment = mode === 'now' ? now : scheduledAt
    const rows: PostWithProvider[] = []
    for (const account of accounts) {
      rows.push({ ...await insertPost(account, prepared, { status, scheduledAt: moment }), provider: account.provider })
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
 * Reels and video stories: creates the Instagram container shortly before the planned moment, so Meta
 * has processed the video when the post is due. Only a container is created here, nothing is public.
 * The id is stored on the row; the publish step later checks it and publishes once it is `FINISHED`.
 * A failure is only logged: the real attempt at the planned moment reports it properly (and retries).
 */
export async function prepareUpcomingContainers(limit = 3, now = new Date()) {
  const url = siteUrl()
  if (!isPubliclyReachable(url)) return 0
  const hasVideo = sql`exists (select 1 from ${socialPostMedia} where ${socialPostMedia.postId} = ${socialPosts.id} and ${socialPostMedia.videoRenderJobId} is not null)`
  let prepared = 0

  await db.transaction(async (tx) => {
    const rows = await tx.select().from(socialPosts)
      .where(and(
        eq(socialPosts.status, 'scheduled'),
        isNull(socialPosts.containerId),
        lte(socialPosts.scheduledAt, new Date(now.getTime() + CONTAINER_LEAD_MS)),
        or(isNull(socialPosts.nextRetryAt), lte(socialPosts.nextRetryAt, now)),
        hasVideo,
      ))
      .orderBy(asc(socialPosts.scheduledAt))
      .limit(limit)
      .for('update', { skipLocked: true })

    for (const row of rows) {
      try {
        const [account] = await tx.select().from(socialAccounts).where(eq(socialAccounts.id, row.accountId)).limit(1)
        if (!account || account.provider !== 'instagram' || account.status !== 'active' || !hasPublishScope(account.scopes)) continue
        const media = await loadMedia(row.id)
        if (!media.video || mediaProblem({ kind: row.kind as SocialPostKindKey, ...media })) continue
        const accessToken = decryptSecret(account.accessTokenEncrypted, password())
        const containerId = await instagramContainerFactory(row, account, accessToken, media, url)()
        await tx.update(socialPosts).set({ containerId, updatedAt: new Date() }).where(eq(socialPosts.id, row.id))
        prepared += 1
      } catch (error) {
        structuredLog('warn', 'social_container_prepare_failed', { postId: row.id, message: errorText(error).slice(0, 300) })
      }
    }
  })
  return prepared
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

  // Before the due posts, so a video that is due right now gets a head start on processing.
  await prepareUpcomingContainers(3, now).catch(error => structuredLog('warn', 'social_container_prepare_failed', { message: errorText(error).slice(0, 300) }))

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
