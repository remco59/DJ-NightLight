// Pure publishing helpers: no database or Nuxt imports, so they can be unit tested directly.
import sharp from 'sharp'
import { InstagramApiError, type ContainerStatus } from './instagram'

const FLATTEN_BACKGROUND = '#0d0b10'
const CONTAINER_POLL_ATTEMPTS = 10
const CONTAINER_POLL_INTERVAL_MS = 3_000

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
export async function runImagePublish(steps: PublishSteps, existingContainerId: string | null = null): Promise<PublishOutcome> {
  let containerId = existingContainerId
  if (!containerId) {
    containerId = await steps.createContainer()
    await steps.onContainer(containerId)
  }

  for (let attempt = 0; ; attempt += 1) {
    const { status, detail } = await steps.getStatus(containerId)
    if (status === 'PUBLISHED') return { containerId, providerPostId: null, permalink: null }
    if (status === 'FINISHED') break
    if (status === 'ERROR' || status === 'EXPIRED') {
      throw new InstagramApiError(detail || 'Meta kon de afbeelding niet verwerken', 200, null, false)
    }
    if (attempt + 1 >= CONTAINER_POLL_ATTEMPTS) {
      throw new InstagramApiError('Meta heeft de afbeelding nog niet verwerkt. Probeer het over een paar minuten opnieuw.', 200, null, false)
    }
    await steps.sleep(CONTAINER_POLL_INTERVAL_MS)
  }

  const providerPostId = await steps.publish(containerId)
  // The post is live; a missing permalink must not turn it into a failure.
  const permalink = await steps.getPermalink(providerPostId).catch(() => null)
  return { containerId, providerPostId, permalink }
}

