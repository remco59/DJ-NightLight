export const VIDEO_OUTPUT = {
  width: 1080,
  height: 1920,
  fps: 30,
  durationSeconds: 10,
} as const

export const VIDEO_TEMPLATES = [
  'spotlight',
  'pulse',
  'slide',
  'gig-announcement',
  'recap',
  'upcoming-gigs',
] as const
export type VideoTemplateKey = typeof VIDEO_TEMPLATES[number]

export const VIDEO_MOTION_PRESETS = ['smooth', 'energy', 'minimal'] as const
export type VideoMotionPreset = typeof VIDEO_MOTION_PRESETS[number]

export const VIDEO_BRAND_PRESETS = ['night', 'mono', 'warm'] as const
export type VideoBrandPreset = typeof VIDEO_BRAND_PRESETS[number]

export const VIDEO_RENDER_STATUSES = ['queued', 'rendering', 'completed', 'failed', 'cancelled'] as const
export type VideoRenderStatus = typeof VIDEO_RENDER_STATUSES[number]

// A job can be cancelled until it has produced a video. That includes failed
// jobs and jobs left in 'rendering' by a worker that died, so a stuck export
// can always be cleared from the queue.
export const CANCELLABLE_RENDER_STATUSES = ['queued', 'rendering', 'failed'] as const satisfies readonly VideoRenderStatus[]
export const RETRYABLE_RENDER_STATUSES = ['failed', 'cancelled'] as const satisfies readonly VideoRenderStatus[]

export function canCancelRender(status: string) {
  return (CANCELLABLE_RENDER_STATUSES as readonly string[]).includes(status)
}

export function canRetryRender(status: string) {
  return (RETRYABLE_RENDER_STATUSES as readonly string[]).includes(status)
}

export type VideoTextAlign = 'left' | 'center' | 'right'
export type VideoTextPosition = 'top' | 'middle' | 'bottom'

export type VideoFieldVisibility = {
  logo: boolean
  headline: boolean
  subline: boolean
  date: boolean
  time: boolean
  location: boolean
  cta: boolean
  gigList: boolean
}

export type VideoGigItem = {
  enabled: boolean
  dateText: string
  title: string
  locationText: string
}

export type VideoDesign = {
  templateKey: VideoTemplateKey
  motionPreset: VideoMotionPreset
  brandPreset: VideoBrandPreset
  headline: string
  subline: string
  dateText: string
  timeText: string
  locationText: string
  ctaText: string
  logoText: string
  visibility: VideoFieldVisibility
  gigItems: VideoGigItem[]
  imageX: number
  imageY: number
  zoom: number
  overlayOpacity: number
  textAlign: VideoTextAlign
  textPosition: VideoTextPosition
}

export function defaultVideoVisibility(): VideoFieldVisibility {
  return {
    logo: true,
    headline: true,
    subline: true,
    date: true,
    time: true,
    location: true,
    cta: true,
    gigList: true,
  }
}

export function defaultVideoGigItems(): VideoGigItem[] {
  return [
    { enabled: true, dateText: '06 DEC', title: 'Eredivisie Dames', locationText: 'VC Sneek' },
    { enabled: true, dateText: '10 DEC', title: 'Eredivisie Dames', locationText: 'VC Sneek' },
    { enabled: true, dateText: '17 DEC', title: 'Tjas & Skeuvel', locationText: 'Collabo / Klobenstein' },
    { enabled: true, dateText: '27 DEC', title: '’T Portiertje', locationText: 'Uitgeest' },
  ]
}

export function videoDurationFrames() {
  return VIDEO_OUTPUT.fps * VIDEO_OUTPUT.durationSeconds
}
