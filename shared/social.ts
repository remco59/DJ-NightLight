// Browser-safe helpers for social posts: limits, validation and Dutch labels.
import type { PostPreset } from './post-generator'

export const INSTAGRAM_CAPTION_MAX = 2200
export const INSTAGRAM_HASHTAG_MAX = 30
export const INSTAGRAM_ALT_TEXT_MAX = 1000
/** Instagram refuses JPEGs over 8 MB. */
export const INSTAGRAM_IMAGE_MAX_BYTES = 8 * 1024 * 1024
/** Instagram allows 100 API-published posts per account per 24 hours. */
export const INSTAGRAM_DAILY_POST_LIMIT = 100

export const socialPostKinds = ['image', 'carousel', 'reel', 'story'] as const
export type SocialPostKindKey = typeof socialPostKinds[number]

export const socialPostKindLabels: Record<SocialPostKindKey, string> = {
  image: 'Afbeelding',
  carousel: 'Carrousel',
  reel: 'Reel',
  story: 'Story',
}

export const INSTAGRAM_CAROUSEL_MIN = 2
export const INSTAGRAM_CAROUSEL_MAX = 10
export const INSTAGRAM_REEL_MIN_SECONDS = 3
export const INSTAGRAM_REEL_MAX_SECONDS = 15 * 60
export const INSTAGRAM_STORY_VIDEO_MAX_SECONDS = 60

export const socialPostStatuses = ['draft', 'scheduled', 'publishing', 'published', 'failed', 'cancelled'] as const
export type SocialPostStatusKey = typeof socialPostStatuses[number]

export const socialPostStatusLabels: Record<SocialPostStatusKey, string> = {
  draft: 'Concept',
  scheduled: 'Gepland',
  publishing: 'Wordt gepubliceerd',
  published: 'Gepubliceerd',
  failed: 'Mislukt',
  cancelled: 'Geannuleerd',
}

export type SocialStatusTone = 'neutral' | 'info' | 'ok' | 'error'

export const socialPostStatusTones: Record<SocialPostStatusKey, SocialStatusTone> = {
  draft: 'neutral',
  scheduled: 'info',
  publishing: 'info',
  published: 'ok',
  failed: 'error',
  cancelled: 'neutral',
}

/** Presets Instagram accepts as a feed image (aspect ratio between 4:5 and 1.91:1). */
export function canPublishPresetAsFeedImage(preset: PostPreset | string) {
  return preset === 'square' || preset === 'portrait'
}

/** A story is a 9:16 image (the `story` preset) or video. */
export function canPublishPresetAsStory(preset: PostPreset | string) {
  return preset === 'story'
}

type CheckResult = { ok: true } | { ok: false, message: string }

/** Slides keep the ratio of the first one, so mixing 1:1 and 4:5 would crop. Every slide must be a feed ratio. */
export function checkCarouselPresets(presets: readonly string[]): CheckResult {
  if (presets.length < INSTAGRAM_CAROUSEL_MIN) return { ok: false, message: `Een carrousel heeft minstens ${INSTAGRAM_CAROUSEL_MIN} afbeeldingen nodig` }
  if (presets.length > INSTAGRAM_CAROUSEL_MAX) return { ok: false, message: `Een carrousel mag maximaal ${INSTAGRAM_CAROUSEL_MAX} afbeeldingen hebben` }
  if (!presets.every(canPublishPresetAsFeedImage)) return { ok: false, message: 'Een carrousel kan alleen 1:1- of 4:5-afbeeldingen bevatten' }
  if (new Set(presets).size > 1) return { ok: false, message: 'Alle afbeeldingen in een carrousel moeten hetzelfde formaat hebben (allemaal 1:1 of allemaal 4:5)' }
  return { ok: true }
}

/** Reels and video stories take a finished 9:16 MP4 within Instagram's duration limits. */
export function checkVideoForKind(kind: 'reel' | 'story', video: { width: number, height: number, durationSeconds: number }): CheckResult {
  // 9:16 within a rounding margin.
  if (Math.abs(video.width / video.height - 9 / 16) > 0.02) {
    return { ok: false, message: `Een ${kind === 'reel' ? 'reel' : 'story'} moet een video van 9:16 zijn` }
  }
  const max = kind === 'reel' ? INSTAGRAM_REEL_MAX_SECONDS : INSTAGRAM_STORY_VIDEO_MAX_SECONDS
  if (video.durationSeconds < INSTAGRAM_REEL_MIN_SECONDS || video.durationSeconds > max) {
    return { ok: false, message: `Een ${kind === 'reel' ? 'reel' : 'video-story'} duurt ${INSTAGRAM_REEL_MIN_SECONDS} tot ${kind === 'reel' ? '900 seconden (15 minuten)' : `${max} seconden`}` }
  }
  return { ok: true }
}

/** `m:ss` for a duration in seconds, as in the mockups ("0:18"). */
export function formatDuration(seconds: number) {
  const whole = Math.max(0, Math.round(seconds))
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}

export function countHashtags(caption: string) {
  return caption.match(/(?:^|\s)#[\p{L}\p{N}_]+/gu)?.length ?? 0
}

export type CaptionCheck = { ok: true } | { ok: false, message: string }

/** Instagram counts characters, not UTF-16 units, so emoji count once. */
export function captionLength(caption: string) {
  return [...caption].length
}

export function checkCaption(caption: string): CaptionCheck {
  if (captionLength(caption) > INSTAGRAM_CAPTION_MAX) {
    return { ok: false, message: `Het bijschrift mag maximaal ${INSTAGRAM_CAPTION_MAX.toLocaleString('nl-NL')} tekens hebben` }
  }
  if (countHashtags(caption) > INSTAGRAM_HASHTAG_MAX) {
    return { ok: false, message: `Instagram staat maximaal ${INSTAGRAM_HASHTAG_MAX} hashtags toe` }
  }
  return { ok: true }
}

/** What the publish drawer needs to know about the media it publishes. */
export type SocialPublishImage = { id: string, imageUrl: string, preset: string, social?: SocialBadge[] }
export type SocialPublishVideo = { id: string, videoUrl: string, width: number, height: number, durationSeconds: number, title: string | null }

export type SocialBadge = { provider: string, status: SocialPostStatusKey, permalink: string | null, scheduledAt: string | null, lastError: string | null }

export const socialProviderLabels: Record<string, string> = { instagram: 'Instagram', facebook: 'Facebook' }

/** Attempts (the first one included) before a scheduled post is given up on and shown as failed. */
export const SOCIAL_MAX_ATTEMPTS = 5

/** Wait before the next attempt after `failures` failed attempts: 2, 4, 8, 16 minutes, never more than 2 hours. */
export function socialRetryDelayMs(failures: number) {
  const step = Math.max(0, Math.min(failures - 1, 10))
  return Math.min(2 * 60 * 60 * 1000, 2 * 60_000 * (2 ** step))
}

/** A scheduled post is picked up by the worker, which ticks once a minute. */
export const SCHEDULE_MIN_LEAD_MS = 60_000
export const SCHEDULE_MAX_LEAD_MS = 366 * 24 * 60 * 60 * 1000

export type ScheduleCheck = { ok: true, at: Date } | { ok: false, message: string }

/** `limit` is the moment the account's access ends: a post planned after it could never be published. */
export function checkScheduleMoment(value: string | Date | null | undefined, now: Date, limit?: Date | null): ScheduleCheck {
  const at = value instanceof Date ? value : new Date(value ?? '')
  if (!value || Number.isNaN(at.getTime())) return { ok: false, message: 'Kies een geldige datum en tijd' }
  if (at.getTime() < now.getTime() + SCHEDULE_MIN_LEAD_MS) return { ok: false, message: 'Kies een moment in de toekomst' }
  if (at.getTime() > now.getTime() + SCHEDULE_MAX_LEAD_MS) return { ok: false, message: 'Je kunt maximaal een jaar vooruit plannen' }
  if (limit && at.getTime() >= limit.getTime()) {
    return { ok: false, message: 'De koppeling met Meta verloopt vóór dit moment. Verbind het account opnieuw of kies een eerdere datum.' }
  }
  return { ok: true, at }
}

export const socialTabs = ['queue', 'history', 'failed'] as const
export type SocialTab = typeof socialTabs[number]

export const socialTabLabels: Record<SocialTab, string> = {
  queue: 'Planning & wachtrij',
  history: 'Geschiedenis',
  failed: 'Mislukt',
}

/** Which tab a post belongs on. */
export const socialTabStatuses: Record<SocialTab, readonly SocialPostStatusKey[]> = {
  queue: ['draft', 'scheduled', 'publishing'],
  history: ['published', 'cancelled'],
  failed: ['failed'],
}

export function tabForStatus(status: SocialPostStatusKey): SocialTab {
  return socialTabs.find(tab => socialTabStatuses[tab].includes(status)) ?? 'queue'
}

/** What can still be done with a post in this status. */
export function socialPostActions(status: SocialPostStatusKey) {
  return {
    edit: status === 'draft' || status === 'scheduled',
    cancel: status === 'draft' || status === 'scheduled' || status === 'failed',
    retry: status === 'failed',
  }
}

/** Shape returned by `GET /api/admin/social/posts`. */
export type SocialPostItem = {
  id: string
  title: string
  kind: string
  status: SocialPostStatusKey
  provider: string
  accountName: string
  caption: string
  altText: string | null
  scheduledAt: string | null
  publishedAt: string | null
  permalink: string | null
  lastError: string | null
  retryCount: number
  nextRetryAt: string | null
  generatedPostId: string | null
  thumbnailUrl: string | null
  templateKey: string | null
  /** Set for reels and video stories, which have no thumbnail image. */
  videoUrl: string | null
  /** Number of images or videos in the post (carousel: 2 to 10). */
  mediaCount: number
  /** Seconds, for video posts. */
  durationSeconds: number | null
}

const AMSTERDAM = 'Europe/Amsterdam'

function amsterdamOffsetMs(at: Date) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: AMSTERDAM, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(at).map(part => [part.type, part.value]))
  const wall = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second))
  return wall - Math.floor(at.getTime() / 1000) * 1000
}

/** `2026-10-12T18:30` typed in Europe/Amsterdam → ISO instant (UTC). Null when the value is not a date. */
export function amsterdamLocalToIso(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value)
  if (!match) return null
  const [year, month, day, hour, minute] = match.slice(1).map(Number) as [number, number, number, number, number]
  const wallAsUtc = Date.UTC(year, month - 1, day, hour, minute)
  // The offset depends on the instant itself (summer/winter time), so settle it in two passes.
  const first = wallAsUtc - amsterdamOffsetMs(new Date(wallAsUtc))
  const instant = wallAsUtc - amsterdamOffsetMs(new Date(first))
  return Number.isNaN(instant) ? null : new Date(instant).toISOString()
}

/** ISO instant → `YYYY-MM-DDTHH:mm` on the Europe/Amsterdam wall clock, for `datetime-local` inputs. */
export function isoToAmsterdamLocal(iso: string) {
  const at = new Date(iso)
  const shifted = new Date(at.getTime() + amsterdamOffsetMs(at))
  return shifted.toISOString().slice(0, 16)
}

/** Start of the current week (Monday 00:00) in Europe/Amsterdam, as a UTC instant. */
export function startOfAmsterdamWeek(now = new Date()) {
  const wall = new Date(now.getTime() + amsterdamOffsetMs(now))
  const daysSinceMonday = (wall.getUTCDay() + 6) % 7
  const mondayWall = Date.UTC(wall.getUTCFullYear(), wall.getUTCMonth(), wall.getUTCDate() - daysSinceMonday)
  // Settle the offset at that Monday itself, so a clock change earlier in the week does not shift it.
  const first = mondayWall - amsterdamOffsetMs(new Date(mondayWall))
  return new Date(mondayWall - amsterdamOffsetMs(new Date(first)))
}
