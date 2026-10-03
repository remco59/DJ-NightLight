import { isAnimated, keyframesOf, type KeyframeProp } from './video-keyframes'
import type { TimelineItem, VideoProject } from './video-project'

// Motion blur is a film-style shutter: a moving item is drawn several times at
// sub-frame times and the copies are averaged. It is applied to the MP4 export
// only; the editor preview stays sharp so scrubbing and playback stay smooth.

export const MOTION_BLUR_QUALITIES = {
  low: { label: 'Laag (snel)', samples: 4 },
  medium: { label: 'Middel', samples: 8 },
  high: { label: 'Hoog (trage export)', samples: 16 },
} as const
export type MotionBlurQuality = keyof typeof MOTION_BLUR_QUALITIES
export const MOTION_BLUR_QUALITY_KEYS = Object.keys(MOTION_BLUR_QUALITIES) as MotionBlurQuality[]

/** Project-wide switch and defaults; unset (older projects) means off. */
export type ProjectMotionBlur = {
  enabled: boolean
  /** 0–1 default per item; 0.5 is a 180° shutter, the classic film look. */
  strength: number
  quality: MotionBlurQuality
}

export const DEFAULT_MOTION_BLUR: ProjectMotionBlur = { enabled: false, strength: 0.5, quality: 'medium' }

export function projectMotionBlur(project: Pick<VideoProject, 'motionBlur'>): ProjectMotionBlur {
  return { ...DEFAULT_MOTION_BLUR, ...project.motionBlur }
}

/** Clips can opt out (0) or override the project strength with `item.motionBlur`. */
export function itemBlurStrength(project: Pick<VideoProject, 'motionBlur'>, item: TimelineItem) {
  const settings = projectMotionBlur(project)
  if (!settings.enabled || item.type === 'audio') return 0
  return Math.min(1, Math.max(0, item.motionBlur ?? settings.strength))
}

const MOVEMENT_PROPS: readonly KeyframeProp[] = ['x', 'y', 'scale', 'rotation']

/** Whether the item can move on screen at all; still items never get the (costly) blur pass. */
export function itemMoves(item: TimelineItem) {
  if (item.type === 'audio') return false
  if (item.type === 'graphic' && (item.entrance !== 'none' || item.exit !== 'none')) return true
  return MOVEMENT_PROPS.some((prop) => {
    if (!isAnimated(item, prop)) return false
    const values = keyframesOf(item, prop).map(keyframe => keyframe.value)
    return values.some(value => value !== values[0])
  })
}

/** Shutter angle in degrees for a strength; 0.5 → 180°. */
export function shutterAngle(strength: number) {
  return Math.round(Math.min(1, Math.max(0, strength)) * 360)
}

export function blurSamples(project: Pick<VideoProject, 'motionBlur'>) {
  return MOTION_BLUR_QUALITIES[projectMotionBlur(project).quality].samples
}
