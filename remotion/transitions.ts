import type React from 'react'
import { createElement as h } from 'react'
import { AbsoluteFill, Freeze, random, useCurrentFrame, useVideoConfig } from 'remotion'
import type { ImageClipItem, VideoClipItem } from '../shared/video-project'
import { transitionAt, type ClipTransitionEdge, type TransitionHost, type TransitionKey } from '../shared/video-transitions'

// How each transition in shared/video-transitions.ts looks. A look is a plain
// description of the clip's state (offset, scale, blur, colour split ...) for
// one frame; TransitionFrame turns it into CSS and, where CSS has no
// equivalent, an SVG filter. Looks are pure so they are easy to test.
//
// `amount` runs 0 (settled) → 1 (the state at the cut) for both clips of a cut,
// so a look only describes "how far into the effect" and, via `edge`, which
// side of the cut the clip is on. For an `overlap` transition the incoming
// clip's amount falls from 1 to 0 over the very frames the outgoing clip's
// rises from 0 to 1, so the two looks must fit together (see `whoosh`).

export type TransitionLook = {
  opacity?: number
  /** Offset in output pixels. */
  x?: number
  y?: number
  scale?: number
  rotate?: number
  skewX?: number
  /** Blur radius in pixels in every direction. */
  blur?: number
  /** Directional blur (standard deviation) in pixels. */
  blurX?: number
  blurY?: number
  brightness?: number
  hue?: number
  /** Red and blue channels move apart by this many pixels. */
  rgbSplit?: number
  /** Horizontal displacement of random bands of the picture, in pixels. */
  tear?: number
  tearSeed?: number
  /** Solid colour drawn over the clip's frame. */
  overlay?: { color: string, opacity: number }
}

export type TransitionLookContext = {
  amount: number
  edge: ClipTransitionEdge
  /** Frame since the clip started. */
  frame: number
  /** Stable per clip, so the glitch noise differs between clips but not between renders. */
  seed: string
  width: number
  height: number
  /** Output size relative to the 1080px short side the effects are tuned for. */
  unit: number
  /** The clip is the held outgoing clip of an `overlap` transition, drawn under the incoming one. */
  underlay: boolean
}

export type TransitionLookFn = (context: TransitionLookContext) => TransitionLook

/** Smoothstep. Point-symmetric (smooth(1 - a) = 1 - smooth(a)), which is what keeps the two clips of a push edge to edge. */
const smooth = (amount: number) => amount * amount * (3 - 2 * amount)

/**
 * A push: the outgoing clip is shoved out one side while the incoming clip
 * follows it in from the other, joined at the seam. Both smear along the
 * direction of travel, most where they move fastest (mid-transition).
 */
function whoosh(axis: 'x' | 'y', direction: 1 | -1): TransitionLookFn {
  return ({ amount, edge, width, height, unit }) => {
    const size = axis === 'x' ? width : height
    const side = (edge === 'out' ? -1 : 1) * direction
    // The blurred edges are see-through, so the clips tuck under each other mid-push instead of leaving a gap.
    const tuck = 0.2 * size * amount * (1 - amount)
    const offset = side * (size * smooth(amount) - tuck)
    const smear = 70 * unit * 4 * amount * (1 - amount)
    return {
      ...(axis === 'x' ? { x: offset, blurX: smear } : { y: offset, blurY: smear }),
      brightness: 1 + 0.2 * amount * (1 - amount),
    }
  }
}

export const TRANSITION_LOOKS: Record<TransitionKey, TransitionLookFn> = {
  // Crossfade: the incoming clip fades in over the outgoing one, which stays put beneath it.
  'fade': ({ amount, underlay }) => underlay ? {} : { opacity: 1 - amount },
  'dip': ({ amount }) => ({ opacity: 1 - amount }),
  'flash': ({ amount }) => ({
    overlay: { color: '#ffffff', opacity: amount ** 1.4 },
    brightness: 1 + 0.5 * amount,
  }),
  'blur': ({ amount, unit }) => ({
    blur: 56 * unit * amount ** 1.5,
    scale: 1 + 0.08 * amount,
    brightness: 1 + 0.25 * amount,
  }),
  'whoosh-left': whoosh('x', 1),
  'whoosh-right': whoosh('x', -1),
  'whoosh-up': whoosh('y', 1),
  'whoosh-down': whoosh('y', -1),
  'zoom': ({ amount, unit }) => ({
    scale: 1 + 1.4 * amount * amount,
    blur: 30 * unit * amount,
    brightness: 1 + 0.35 * amount,
  }),
  'spin': ({ amount, edge, unit, width, height }) => {
    // Both halves turn the same way: the outgoing clip ends tilted one way, the incoming one starts tilted the other.
    const angle = (edge === 'out' ? 1 : -1) * 35 * amount * amount
    const radians = Math.abs(angle) * Math.PI / 180
    const longSide = Math.max(width, height) / Math.min(width, height)
    // Zoom in just enough that the tilted frame's corners never show the background.
    const cover = Math.cos(radians) + longSide * Math.sin(radians)
    return { rotate: angle, scale: cover * (1 + 0.5 * amount * amount) * (1 + 0.02 * Math.min(1, amount * 8)), blur: 16 * unit * amount }
  },
  'glitch': ({ amount, frame, seed, unit }) => {
    const noise = (name: string) => random(`${seed}-${name}-${frame}`)
    const jitter = (noise('jitter') - 0.5) * 2 * 90 * unit * amount * amount
    return {
      x: jitter,
      skewX: jitter / 14,
      opacity: amount > 0.3 && noise('flicker') > 0.72 ? 0.35 : 1,
      brightness: 1 + noise('bright') * 0.5 * amount,
      hue: (noise('hue') - 0.5) * 80 * amount,
      rgbSplit: (14 + noise('split') * 40) * unit * amount,
      tear: 160 * unit * amount,
      tearSeed: Math.floor(noise('seed') * 1000),
    }
  },
  'rgb-split': ({ amount, unit }) => {
    const eased = amount * amount
    return {
      rgbSplit: 90 * unit * eased,
      scale: 1 + 0.12 * eased,
      blurX: 10 * unit * eased,
      brightness: 1 + 0.2 * amount,
    }
  },
  'strobe': ({ amount, frame }) => {
    if (amount < 0.08) return {}
    return frame % 2 === 0
      ? { brightness: 1 + 2.4 * amount }
      : { opacity: 1 - 0.85 * amount }
  },
}

export function transitionLook(key: TransitionKey, context: TransitionLookContext): TransitionLook {
  return TRANSITION_LOOKS[key](context)
}

function num(value: number) {
  return Math.round(value * 1000) / 1000
}

function transformOf(look: TransitionLook) {
  const parts: string[] = []
  if (look.x || look.y) parts.push(`translate(${num(look.x ?? 0)}px, ${num(look.y ?? 0)}px)`)
  if (look.rotate) parts.push(`rotate(${num(look.rotate)}deg)`)
  if (look.scale !== undefined && look.scale !== 1) parts.push(`scale(${num(look.scale)})`)
  if (look.skewX) parts.push(`skewX(${num(look.skewX)}deg)`)
  return parts.length ? parts.join(' ') : undefined
}

function needsSvgFilter(look: TransitionLook) {
  return Boolean(look.tear || look.rgbSplit || look.blurX || look.blurY)
}

function filterOf(look: TransitionLook, filterId: string) {
  const parts: string[] = []
  if (needsSvgFilter(look)) parts.push(`url(#${filterId})`)
  if (look.blur && look.blur > 0.2) parts.push(`blur(${num(look.blur)}px)`)
  if (look.brightness !== undefined && look.brightness !== 1) parts.push(`brightness(${num(look.brightness)})`)
  if (look.hue) parts.push(`hue-rotate(${num(look.hue)}deg)`)
  return parts.length ? parts.join(' ') : undefined
}

const CHANNEL_MATRIX = {
  r: '1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0',
  g: '0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0',
  b: '0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0',
} as const

/**
 * SVG filter for the effects CSS cannot do: sliced displacement (tear), colour
 * channel split and directional blur. It runs on the one rendered clip, so a
 * video is still decoded once however heavy the effect is.
 */
function svgFilter(id: string, look: TransitionLook) {
  const primitives: React.ReactElement[] = []
  let input = 'SourceGraphic'
  if (look.tear) {
    primitives.push(
      // Noise that only varies with y gives horizontal bands; stepping it makes the bands hard-edged slices.
      h('feTurbulence', { type: 'fractalNoise', baseFrequency: '0 0.022', numOctaves: 1, seed: look.tearSeed ?? 1, result: 'noise' }),
      // Red steers the sideways shift; blue stays at 0.5 so nothing moves vertically.
      h('feColorMatrix', { in: 'noise', type: 'matrix', values: '3 0 0 0 -1  0 0 0 0 0  0 0 0 0 0.5  0 0 0 0 1', result: 'map' }),
      h('feComponentTransfer', { in: 'map', result: 'steps' }, h('feFuncR', { type: 'discrete', tableValues: '0.5 0 1 0.5 0.1 0.9 0.5 0.25 0.75 0.5' })),
      h('feDisplacementMap', { in: input, in2: 'steps', scale: num(look.tear), xChannelSelector: 'R', yChannelSelector: 'B', result: 'torn' }),
    )
    input = 'torn'
  }
  if (look.rgbSplit) {
    const split = num(look.rgbSplit)
    primitives.push(
      h('feColorMatrix', { in: input, type: 'matrix', values: CHANNEL_MATRIX.r, result: 'red' }),
      h('feOffset', { in: 'red', dx: split, dy: 0, result: 'redShift' }),
      h('feColorMatrix', { in: input, type: 'matrix', values: CHANNEL_MATRIX.g, result: 'green' }),
      h('feColorMatrix', { in: input, type: 'matrix', values: CHANNEL_MATRIX.b, result: 'blue' }),
      h('feOffset', { in: 'blue', dx: -split, dy: 0, result: 'blueShift' }),
      h('feBlend', { in: 'redShift', in2: 'green', mode: 'screen', result: 'redGreen' }),
      h('feBlend', { in: 'redGreen', in2: 'blueShift', mode: 'screen', result: 'split' }),
    )
    input = 'split'
  }
  if (look.blurX || look.blurY) {
    primitives.push(h('feGaussianBlur', { in: input, stdDeviation: `${num(look.blurX ?? 0)} ${num(look.blurY ?? 0)}`, result: 'smeared' }))
  }
  return h(
    'svg',
    { width: 0, height: 0, style: { position: 'absolute' }, 'aria-hidden': true },
    h('defs', null, h('filter', { id, x: '-10%', y: '-10%', width: '120%', height: '120%', colorInterpolationFilters: 'sRGB' }, ...primitives)),
  )
}

/**
 * Wraps a clip and applies its transitions. The wrapper stays mounted with the
 * same shape whether or not a transition is running, so the media inside is
 * never remounted (a restarted video would flicker at the cut).
 *
 * `next` is the clip that starts where this one ends. When it begins with an
 * overlap transition this clip plays on past its end, held on its last frame
 * (the Sequence in ProjectComposition is lengthened to match).
 */
export const TransitionFrame: React.FC<{
  item: VideoClipItem | ImageClipItem
  next?: TransitionHost | null
  children: React.ReactNode
}> = ({ item, next, children }) => {
  const frame = useCurrentFrame()
  const { width, height } = useVideoConfig()
  const state = transitionAt(item, frame, next)
  const look = state ? transitionLook(state.key, {
    amount: state.amount,
    edge: state.edge,
    frame,
    seed: item.id,
    width,
    height,
    unit: Math.min(width, height) / 1080,
    underlay: state.underlay,
  }) : null
  const filterId = `nl-tr-${item.id}`
  const style: React.CSSProperties | undefined = look
    ? { opacity: look.opacity, transform: transformOf(look), filter: filterOf(look, filterId) }
    : undefined
  return h(
    AbsoluteFill,
    null,
    look && needsSvgFilter(look) ? svgFilter(filterId, look) : null,
    h(AbsoluteFill, { style }, h(Freeze, { frame: item.duration - 1, active: (at: number) => at >= item.duration, children })),
    look?.overlay ? h(AbsoluteFill, { style: { background: look.overlay.color, opacity: look.overlay.opacity } }) : null,
  )
}
