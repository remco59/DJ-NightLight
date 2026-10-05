// Sound effects that motion templates play on their hit moments (a bolt
// strike, a letter slam, a whip entrance). The files are cut from real
// recordings by scripts/sfx/process-sfx.mjs; see public/sfx/LICENSE.txt.
//
// Cue frames live in the same frame space as the template animations in
// remotion/motion-templates.ts: those use fixed frame numbers that do not
// scale with fps, so a cue at frame 26 stays on the bolt strike at any rate.

import type { GraphicItem } from './video-project'
import type { EntranceAnimation, ExitAnimation, MotionTemplateDefinition, MotionTemplateKey } from './video-templates'

/**
 * `seconds` is the file length; `hit` is where the moment of impact lies in
 * the file. A cue's frame is the frame the hit lands on, so a sound that
 * builds up first (the zap's charge) starts that long before the cue.
 * Keep both in step with scripts/sfx/process-sfx.mjs.
 */
export const TEMPLATE_SOUNDS = {
  impact: { label: 'Impact', file: 'sfx/impact.wav', seconds: 1.5, hit: 0 },
  punch: { label: 'Punch', file: 'sfx/punch.wav', seconds: 0.35, hit: 0 },
  zap: { label: 'Zap', file: 'sfx/zap.wav', seconds: 1.5, hit: 0.48 },
  crackle: { label: 'Geknetter', file: 'sfx/crackle.wav', seconds: 0.8, hit: 0.1 },
  whoosh: { label: 'Whoosh', file: 'sfx/whoosh.wav', seconds: 0.8, hit: 0 },
  swish: { label: 'Swish', file: 'sfx/swish.wav', seconds: 0.4, hit: 0.05 },
  swoosh: { label: 'Swoosh', file: 'sfx/swoosh.wav', seconds: 0.7, hit: 0 },
  glitch: { label: 'Glitch', file: 'sfx/glitch.wav', seconds: 0.45, hit: 0 },
} as const
export type TemplateSound = keyof typeof TEMPLATE_SOUNDS
export const TEMPLATE_SOUND_KEYS = Object.keys(TEMPLATE_SOUNDS) as TemplateSound[]

export type ItemSound = {
  enabled: boolean
  /** 0–1, multiplied with each cue's own level. */
  volume: number
}

export const DEFAULT_ITEM_SOUND: ItemSound = { enabled: true, volume: 0.8 }

export type SoundCue = {
  sound: TemplateSound
  /** Frame relative to the item start. */
  frame: number
  volume: number
}

type CueContext = {
  duration: number
  props: GraphicItem['templateProps']
}

type CueSpec = { sound: TemplateSound, frame: number, volume?: number }

// --- Timing shared with the template components -----------------------------

/** Bolt Transition: the white flash peaks here, so a cut placed on it is hidden. */
export function boltTransitionMid(duration: number) {
  return Math.floor(Math.max(6, duration) / 2)
}

/** Hype Title: frames between one line punching in and the next. */
export function hypeTitlePerLine(duration: number, lineCount: number) {
  return Math.max(4, Math.floor((duration * 0.6) / Math.max(1, lineCount)))
}

/** Hype Title: the frame each line punches in. */
export function hypeTitleLineFrames(duration: number, lineCount: number) {
  const perLine = hypeTitlePerLine(duration, lineCount)
  return Array.from({ length: lineCount }, (_, index) => index * perLine)
}

/** Clip Recap: how long each photo or clip stays on screen. */
export function clipRecapSlot(duration: number, mediaCount: number) {
  return Math.max(1, Math.floor(duration / Math.max(1, mediaCount)))
}

function listCount(props: CueContext['props'], key: string, max: number) {
  const value = props[key]
  return Array.isArray(value) ? Math.min(max, value.filter(entry => typeof entry === 'string' && entry).length) : 0
}

// --- Cues per template ------------------------------------------------------

// Frames point at the moment a hit lands: a slam's overshoot starts bright and
// settles over a few frames, so the sound starts with it rather than after it.
// They mirror the timing in remotion/motion-templates.ts: when a template's
// animation changes, move its cues with it. The bolt frames follow from the
// logo builders there: RuleFrame strikes at start + 12, RingBadge at
// start + 14, WordmarkBuild at start + 4 + 10 × step, EmblemBuild at
// start + 8 + 10 × step.
const TEMPLATE_CUES: Record<MotionTemplateKey, (context: CueContext) => CueSpec[]> = {
  // The wordmark's bolt (step 1) strikes at 14; the date slams in the rule frame at 16.
  'gig-announcement': () => [
    { sound: 'zap', frame: 14, volume: 0.7 },
    { sound: 'punch', frame: 16, volume: 0.8 },
  ],
  // The headline slams in at 4, then the arcs start to crackle at 12.
  'recap-intro': () => [
    { sound: 'impact', frame: 4, volume: 0.9 },
    { sound: 'crackle', frame: 12, volume: 0.5 },
  ],
  // The arcs crackle at 14, then the quote arrives.
  'review': () => [
    { sound: 'crackle', frame: 14, volume: 0.6 },
    { sound: 'punch', frame: 16, volume: 0.45 },
  ],
  // The headline's rule frame strikes its bolt.
  'upcoming-gigs': () => [{ sound: 'zap', frame: 12, volume: 0.7 }],
  // The wordmark (step 1) strikes its bolt with the white flash.
  'logo-sting': () => [
    { sound: 'impact', frame: 14 },
    { sound: 'zap', frame: 15, volume: 0.7 },
  ],
  // The emblem (step 0.6) strikes its bolt.
  'lower-third': () => [{ sound: 'zap', frame: 14, volume: 0.6 }],
  'hype-title': ({ duration, props }) =>
    hypeTitleLineFrames(duration, listCount(props, 'lines', 4)).map(frame => ({ sound: 'punch', frame })),
  // The polaroid lands with a flash at 12, then the bolt pins it at 14.
  'photo-drop': () => [
    { sound: 'punch', frame: 12, volume: 0.8 },
    { sound: 'zap', frame: 14, volume: 0.7 },
  ],
  'clip-recap': ({ duration, props }) => {
    const count = listCount(props, 'media', 5)
    const slot = clipRecapSlot(duration, count)
    // The first shot is covered by the entrance; every later cut gets a whip and a hit.
    const cuts: CueSpec[] = Array.from({ length: Math.max(0, count - 1) }, (_, index): CueSpec[] => [
      { sound: 'swish', frame: (index + 1) * slot, volume: 0.5 },
      { sound: 'punch', frame: (index + 1) * slot, volume: 0.7 },
    ]).flat()
    // The title's rule frame (start 4) strikes its bolt.
    const title = typeof props.title === 'string' && props.title ? [{ sound: 'zap' as const, frame: 16, volume: 0.6 }] : []
    return [...cuts, ...title]
  },
  'neon-logo-reveal': () => [
    { sound: 'impact', frame: 26 },
    { sound: 'zap', frame: 27, volume: 0.7 },
  ],
  'lightning-banner': () => [{ sound: 'zap', frame: 12 }],
  // The header wordmark (step 1) strikes its bolt at 14; the date slams into the ring at 16.
  'electric-gig-poster': () => [
    { sound: 'zap', frame: 14, volume: 0.8 },
    { sound: 'punch', frame: 16, volume: 0.8 },
  ],
  'now-playing': () => [{ sound: 'zap', frame: 12, volume: 0.8 }],
  'bolt-transition': ({ duration }) => {
    const mid = boltTransitionMid(duration)
    return [
      { sound: 'impact', frame: Math.max(0, mid - 1) },
      { sound: 'zap', frame: mid, volume: 0.8 },
    ]
  },
  'neon-outro': () => [{ sound: 'zap', frame: 18, volume: 0.8 }],
}

const ENTRANCE_SOUNDS: Partial<Record<EntranceAnimation, TemplateSound>> = {
  whip: 'whoosh',
  zoom: 'whoosh',
  glitch: 'glitch',
}

const EXIT_SOUNDS: Partial<Record<ExitAnimation, TemplateSound>> = {
  whip: 'swoosh',
  glitch: 'glitch',
}

/** The template's own hits, before entrance/exit sounds and item settings. */
export function templateCues(templateKey: MotionTemplateKey, duration: number, props: CueContext['props'] = {}): CueSpec[] {
  return TEMPLATE_CUES[templateKey]?.({ duration, props }) ?? []
}

/**
 * Whether a template plays anything once filled in, for the template browser.
 * Media fields count as filled, since Clip Recap hits on its cuts.
 */
export function templateHasSound(template: Pick<MotionTemplateDefinition, 'key' | 'fields' | 'defaults' | 'defaultDurationSeconds' | 'defaultEntrance' | 'defaultExit'>) {
  const props = { ...template.defaults }
  for (const field of template.fields) {
    if (field.kind === 'assets') props[field.key] = Array.from({ length: field.maxItems || 5 }, (_, index) => `media-${index}`)
  }
  return templateCues(template.key, Math.round(template.defaultDurationSeconds * 30), props).length > 0
    || Boolean(ENTRANCE_SOUNDS[template.defaultEntrance] || EXIT_SOUNDS[template.defaultExit])
}

/**
 * Every sound a graphic item plays, in item frames. Empty when the item's
 * sound is off; items saved before template sounds existed stay silent.
 */
export function graphicSoundCues(item: Pick<GraphicItem, 'templateKey' | 'templateProps' | 'duration' | 'entrance' | 'exit' | 'entranceFrames' | 'exitFrames' | 'sound'>): SoundCue[] {
  const sound = item.sound
  if (!sound?.enabled || sound.volume <= 0) return []
  const cues: CueSpec[] = []
  // Same windows as animationState() in remotion/animation.ts.
  const half = Math.max(1, Math.floor(item.duration / 2))
  const entranceSound = ENTRANCE_SOUNDS[item.entrance]
  if (entranceSound && Math.min(item.entranceFrames, half) > 0) cues.push({ sound: entranceSound, frame: 0, volume: 0.7 })
  cues.push(...templateCues(item.templateKey, item.duration, item.templateProps))
  const exitSound = EXIT_SOUNDS[item.exit]
  const exitFrames = Math.min(item.exitFrames, half)
  if (exitSound && exitFrames > 0) cues.push({ sound: exitSound, frame: item.duration - exitFrames, volume: 0.6 })
  return cues
    .filter(cue => cue.frame >= 0 && cue.frame < item.duration)
    .map(cue => ({ sound: cue.sound, frame: Math.round(cue.frame), volume: Math.min(1, (cue.volume ?? 1) * sound.volume) }))
    .sort((a, b) => a.frame - b.frame)
}

/** Length of a sound in project frames. */
export function soundFrames(sound: TemplateSound, fps: number) {
  return Math.max(1, Math.ceil(TEMPLATE_SOUNDS[sound].seconds * fps))
}

/** Frames between the start of a sound and its hit. */
export function soundHitFrames(sound: TemplateSound, fps: number) {
  return Math.round(TEMPLATE_SOUNDS[sound].hit * fps)
}

/**
 * Where a cue's audio plays on the project timeline: it starts early enough
 * for its hit to land on `frame`, and is trimmed when that would be before
 * the start of the project.
 */
export function soundPlacement(sound: TemplateSound, frame: number, fps: number) {
  const start = frame - soundHitFrames(sound, fps)
  const trim = Math.max(0, -start)
  return { from: Math.max(0, start), trim, duration: Math.max(1, soundFrames(sound, fps) - trim) }
}
