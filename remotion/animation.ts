import { Easing, interpolate, random } from 'remotion'
import type { EntranceAnimation, ExitAnimation } from '../shared/video-templates'

export type AnimationState = {
  opacity: number
  translateX: number
  translateY: number
  scale: number
  skew: number
  blur: number
}

const clampOptions = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const
const ease = Easing.bezier(0.16, 1, 0.3, 1)

function neutral(): AnimationState {
  return { opacity: 1, translateX: 0, translateY: 0, scale: 1, skew: 0, blur: 0 }
}

/** State for one side of the animation; `t` runs 0 (hidden) → 1 (settled). */
function variantState(variant: EntranceAnimation | ExitAnimation, t: number, frame: number, direction: 1 | -1): AnimationState {
  const state = neutral()
  const eased = ease(t)
  switch (variant) {
    case 'fade':
      state.opacity = eased
      break
    case 'fade-slide-up':
    case 'slide-down':
      state.opacity = eased
      state.translateY = (1 - eased) * 90 * direction
      break
    case 'zoom':
      state.opacity = eased
      state.scale = interpolate(eased, [0, 1], [1.45, 1])
      state.blur = (1 - eased) * 12
      break
    case 'zoom-out':
      state.opacity = eased
      state.scale = interpolate(eased, [0, 1], [0.6, 1])
      break
    case 'whip':
      state.opacity = Math.min(1, eased * 1.6)
      state.translateX = (1 - eased) * -900 * direction
      state.skew = (1 - eased) * -18 * direction
      state.blur = (1 - eased) * 18
      break
    case 'glitch': {
      const jitter = t < 1 ? (random(`glitch-${frame}`) - 0.5) * 60 * (1 - t) : 0
      state.opacity = t < 1 ? (random(`flicker-${frame}`) > 0.35 ? eased : eased * 0.2) : 1
      state.translateX = jitter
      state.skew = jitter / 6
      break
    }
    default:
      break
  }
  return state
}

/**
 * Combined entrance/exit state for an item at `frame` (relative to item start).
 * Entrance and exit windows are clamped so short items still animate cleanly.
 */
export function animationState(options: {
  frame: number
  duration: number
  entrance: EntranceAnimation
  exit: ExitAnimation
  entranceFrames: number
  exitFrames: number
}): AnimationState {
  const { frame, duration } = options
  const half = Math.max(1, Math.floor(duration / 2))
  const inFrames = Math.min(options.entranceFrames, half)
  const outFrames = Math.min(options.exitFrames, half)

  if (inFrames > 0 && options.entrance !== 'none' && frame < inFrames) {
    return variantState(options.entrance, interpolate(frame, [0, inFrames], [0, 1], clampOptions), frame, 1)
  }
  const exitStart = duration - outFrames
  if (outFrames > 0 && options.exit !== 'none' && frame >= exitStart) {
    // Fully gone on the last visible frame of the item.
    const exitEnd = Math.max(exitStart + 1, duration - 1)
    return variantState(options.exit, interpolate(frame, [exitStart, exitEnd], [1, 0], clampOptions), frame, -1)
  }
  return neutral()
}

export function animationStyle(state: AnimationState) {
  return {
    opacity: state.opacity,
    transform: `translate(${state.translateX}px, ${state.translateY}px) scale(${state.scale}) skewX(${state.skew}deg)`,
    filter: state.blur > 0.2 ? `blur(${state.blur}px)` : undefined,
  }
}

/** Staggered 0→1 reveal used for per-element build-ins inside templates. */
export function stagger(frame: number, index: number, delay = 4, length = 14) {
  return ease(interpolate(frame - index * delay, [0, length], [0, 1], clampOptions))
}
