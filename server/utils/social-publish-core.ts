// Pure publishing helpers: no database or Nuxt imports, so they can be unit tested directly.
import sharp from 'sharp'
import {
  canPublishPresetAsStory,
  checkCarouselPresets,
  checkVideoForKind,
  type SocialPostKindKey,
} from '../../shared/social'
import { InstagramApiError, type ContainerStatus } from './instagram'

const FLATTEN_BACKGROUND = '#0d0b10'
const CONTAINER_POLL_ATTEMPTS = 10
const CONTAINER_POLL_INTERVAL_MS = 3_000
/** Video takes Meta longer; the worker prepares it ahead of time, so a publish only waits briefly for stragglers. */
export const VIDEO_POLL_ATTEMPTS = 10
export const VIDEO_POLL_INTERVAL_MS = 6_000
/** Reels and stories get their container this long before the planned moment, so Meta can process the video in time. */
export const CONTAINER_LEAD_MS = 10 * 60_000

/** Instagram only accepts JPEG. The key is stable, so the conversion happens once per export. */
export function instagramJpegKey(generatedPostId: string) {
  return `instagram/${generatedPostId}.jpg`
}

export async function convertToInstagramJpeg(png: Uint8Array) {
  return sharp(png)
    .flatten({ background: FLATTEN_BACKGROUND })
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer()
}

export function publicMediaUrl(siteUrl: string, generatedPostId: string) {
  return `${siteUrl.replace(/\/+$/, '')}/api/generated-posts/${generatedPostId}/instagram.jpg`
}

export function publicVideoUrl(siteUrl: string, videoRenderJobId: string) {
  return `${siteUrl.replace(/\/+$/, '')}/api/generated-videos/${videoRenderJobId}`
}

/** Meta has to fetch the image from the internet, which a local development URL does not allow. */
export function isPubliclyReachable(siteUrl: string) {
  try {
    const url = new URL(siteUrl)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return false
    const host = url.hostname
    return !(host === 'localhost' || host.endsWith('.local') || /^127\./.test(host) || host === '[::1]')
  } catch {
    return false
  }
}

/** Meta has not finished processing the media yet. Waiting longer usually helps. */
export class ContainerNotReadyError extends InstagramApiError {
  constructor() {
    super('Meta heeft de media nog niet verwerkt. Probeer het over een paar minuten opnieuw.', 200, null, false)
    this.name = 'ContainerNotReadyError'
  }
}

/** Meta error codes for temporary trouble: unknown/service errors and rate limits. */
const TRANSIENT_META_CODES = new Set([1, 2, 4, 17, 32, 341, 613])

/**
 * Whether trying again later can help. Revoked access and rejected media never fix themselves,
 * so those are shown as failed with Meta's text instead of being retried blindly.
 */
export function isRetryablePublishError(error: unknown) {
  if (error instanceof ContainerNotReadyError) return true
  if (error instanceof InstagramApiError) {
    if (error.permanent) return false
    return error.status >= 500 || error.status === 429 || (error.code !== null && TRANSIENT_META_CODES.has(error.code))
  }
  // Network trouble (fetch failed, timeouts, resets). Our own validation errors have their own class.
  if (error instanceof Error) return error.name === 'TypeError' || error.name === 'TimeoutError' || error.name === 'AbortError'
  return false
}

export type PublishSteps = {
  createContainer: () => Promise<string>
  getStatus: (containerId: string) => Promise<{ status: ContainerStatus, detail: string | null }>
  publish: (containerId: string) => Promise<string>
  getPermalink: (mediaId: string) => Promise<string | null>
  /** Called as soon as the container exists, before anything is published. */
  onContainer: (containerId: string) => Promise<void>
  sleep: (ms: number) => Promise<void>
}

export type PublishOutcome = { containerId: string, providerPostId: string | null, permalink: string | null }

/**
 * Container → wait until Meta has processed it → publish → permalink.
 *
 * A double post is public, so the container id is persisted before publishing, and an existing
 * container is checked instead of recreated: when Meta already reports `PUBLISHED`, nothing is published again.
 */
export type PublishPolling = { attempts?: number, intervalMs?: number }

export async function runContainerPublish(
  steps: PublishSteps,
  existingContainerId: string | null = null,
  polling: PublishPolling = {},
): Promise<PublishOutcome> {
  const pollAttempts = polling.attempts ?? CONTAINER_POLL_ATTEMPTS
  const pollIntervalMs = polling.intervalMs ?? CONTAINER_POLL_INTERVAL_MS
  let containerId = existingContainerId
  let reused = Boolean(existingContainerId)
  if (!containerId) {
    containerId = await steps.createContainer()
    await steps.onContainer(containerId)
  }

  for (let attempt = 0; ; attempt += 1) {
    const { status, detail } = await steps.getStatus(containerId)
    if (status === 'PUBLISHED') return { containerId, providerPostId: null, permalink: null }
    if (status === 'FINISHED') break
    if (status === 'ERROR' || status === 'EXPIRED') {
      // An old container from an earlier attempt is replaced once; a fresh one that fails is a real error.
      if (reused) {
        reused = false
        containerId = await steps.createContainer()
        await steps.onContainer(containerId)
        attempt = -1
        continue
      }
      throw new InstagramApiError(detail || 'Meta kon de media niet verwerken', 200, null, false)
    }
    if (attempt + 1 >= pollAttempts) throw new ContainerNotReadyError()
    await steps.sleep(pollIntervalMs)
  }

  const providerPostId = await steps.publish(containerId)
  // The post is live; a missing permalink must not turn it into a failure.
  const permalink = await steps.getPermalink(providerPostId).catch(() => null)
  return { containerId, providerPostId, permalink }
}


/** Kept for the image flow and its tests. */
export const runImagePublish = runContainerPublish

export type CarouselSteps = {
  createItem: (position: number) => Promise<string>
  getStatus: PublishSteps['getStatus']
  createCarousel: (childIds: string[]) => Promise<string>
  sleep: (ms: number) => Promise<void>
}

/**
 * Carousel container: one container per slide (each waited on until `FINISHED`), then the carousel
 * itself. Slides are never published on their own. Only the carousel container id is persisted: if
 * the process dies before that, nothing is public yet and the slides are simply created again.
 */
export async function createCarouselContainerFlow(steps: CarouselSteps, count: number): Promise<string> {
  const childIds: string[] = []
  for (let position = 0; position < count; position += 1) {
    const childId = await steps.createItem(position)
    for (let attempt = 0; ; attempt += 1) {
      const { status, detail } = await steps.getStatus(childId)
      if (status === 'FINISHED') break
      if (status === 'ERROR' || status === 'EXPIRED') {
        throw new InstagramApiError(detail || `Meta kon afbeelding ${position + 1} van de carrousel niet verwerken`, 200, null, false)
      }
      if (attempt + 1 >= CONTAINER_POLL_ATTEMPTS) throw new ContainerNotReadyError()
      await steps.sleep(CONTAINER_POLL_INTERVAL_MS)
    }
    childIds.push(childId)
  }
  return steps.createCarousel(childIds)
}

export type MediaForCheck = {
  kind: SocialPostKindKey
  images: ReadonlyArray<{ preset: string }>
  video: { status: string, outputKey: string | null, width: number, height: number, durationSeconds: number } | null
}

/**
 * What is wrong with this combination of media for this kind of post, or null. Used when the post is made
 * and again by the worker, because an export or render can change in between.
 */
export function mediaProblem(media: MediaForCheck): string | null {
  const { kind, images, video } = media
  if (video && (video.status !== 'completed' || !video.outputKey)) return 'De video is nog niet klaar of bestaat niet meer'
  if (kind === 'image') {
    return images.length === 1 && !video ? null : 'Een afbeeldingspost heeft precies één afbeelding nodig'
  }
  if (kind === 'carousel') {
    if (video) return 'Een carrousel kan geen video bevatten'
    const check = checkCarouselPresets(images.map(image => image.preset))
    return check.ok ? null : check.message
  }
  if (kind === 'reel') {
    if (images.length || !video) return 'Een reel heeft één video nodig'
    const check = checkVideoForKind('reel', { width: video.width, height: video.height, durationSeconds: video.durationSeconds })
    return check.ok ? null : check.message
  }
  if (video && !images.length) {
    const check = checkVideoForKind('story', { width: video.width, height: video.height, durationSeconds: video.durationSeconds })
    return check.ok ? null : check.message
  }
  if (images.length === 1 && !video) {
    return canPublishPresetAsStory(images[0]!.preset) ? null : 'Een story moet 9:16 zijn. Exporteer de afbeelding in het formaat 9:16.'
  }
  return 'Een story heeft één afbeelding of één video nodig'
}
