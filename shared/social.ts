// Browser-safe helpers for social posts: limits, validation and Dutch labels.
import type { PostPreset } from './post-generator'

export const INSTAGRAM_CAPTION_MAX = 2200
export const INSTAGRAM_HASHTAG_MAX = 30
export const INSTAGRAM_ALT_TEXT_MAX = 1000
/** Instagram refuses JPEGs over 8 MB. */
export const INSTAGRAM_IMAGE_MAX_BYTES = 8 * 1024 * 1024
/** Instagram allows 100 API-published posts per account per 24 hours. */
export const INSTAGRAM_DAILY_POST_LIMIT = 100

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
