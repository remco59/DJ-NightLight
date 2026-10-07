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
