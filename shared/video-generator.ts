export const VIDEO_OUTPUT = {
  width: 1080,
  height: 1920,
  fps: 30,
  durationSeconds: 10,
} as const

export const VIDEO_TEMPLATES = ['spotlight', 'pulse', 'slide'] as const
export type VideoTemplateKey = typeof VIDEO_TEMPLATES[number]

export const VIDEO_MOTION_PRESETS = ['smooth', 'energy', 'minimal'] as const
export type VideoMotionPreset = typeof VIDEO_MOTION_PRESETS[number]

export const VIDEO_BRAND_PRESETS = ['night', 'mono', 'warm'] as const
export type VideoBrandPreset = typeof VIDEO_BRAND_PRESETS[number]

export const VIDEO_RENDER_STATUSES = ['queued', 'rendering', 'completed', 'failed'] as const
export type VideoRenderStatus = typeof VIDEO_RENDER_STATUSES[number]

export type VideoDesign = {
  templateKey: VideoTemplateKey
  motionPreset: VideoMotionPreset
  brandPreset: VideoBrandPreset
  headline: string
  subline: string
  dateText: string
  locationText: string
  logoText: string
  overlayOpacity: number
}

export function videoDurationFrames() {
  return VIDEO_OUTPUT.fps * VIDEO_OUTPUT.durationSeconds
}
