import type { ItemTransform, TimelineItem } from './video-project'

// Keyframes animate an item's transform, opacity and volume over time. Frames
// are relative to the item's first frame, so moving an item keeps its animation
// intact. A property without keyframes keeps using the item's static value; as
// soon as it has one, the keyframes drive it (a single keyframe is a constant).
// Everything here is pure so the editor, the preview and the render worker
// resolve exactly the same value.

export const KEYFRAME_PROPS = ['x', 'y', 'scale', 'rotation', 'opacity', 'volume'] as const
export type KeyframeProp = typeof KEYFRAME_PROPS[number]

export const KEYFRAME_EASINGS = ['linear', 'ease-in', 'ease-out', 'ease-in-out', 'hold'] as const
export type KeyframeEasing = typeof KEYFRAME_EASINGS[number]

export const KEYFRAME_EASING_LABELS: Record<KeyframeEasing, string> = {
  'linear': 'Lineair',
  'ease-in': 'Ease in',
  'ease-out': 'Ease out',
  'ease-in-out': 'Ease in/out',
  'hold': 'Vasthouden',
}

export const KEYFRAME_PROP_LABELS: Record<KeyframeProp, string> = {
  x: 'X',
  y: 'Y',
  scale: 'Schaal',
  rotation: 'Rotatie',
  opacity: 'Dekking',
  volume: 'Volume',
}

export const MAX_KEYFRAMES_PER_PROP = 100

/** Allowed range of each property; the project schema and the editor clamp to it. */
export const KEYFRAME_LIMITS: Record<KeyframeProp, { min: number, max: number }> = {
  x: { min: -5000, max: 5000 },
  y: { min: -5000, max: 5000 },
  scale: { min: 0.05, max: 5 },
  rotation: { min: -360, max: 360 },
  opacity: { min: 0, max: 1 },
  volume: { min: 0, max: 1 },
}

/** `easing` shapes the segment that starts at this keyframe. */
export type Keyframe = {
  /** Frames after the item's first frame. */
  frame: number
  value: number
  easing: KeyframeEasing
}

export type ItemKeyframes = Partial<Record<KeyframeProp, Keyframe[]>>

type Animatable = { keyframes?: ItemKeyframes }

const TRANSFORM_PROPS: readonly KeyframeProp[] = ['x', 'y', 'scale', 'rotation']

/** Which properties an item can animate: audio only has volume, graphics and images no volume. */
export function keyframePropsFor(item: Pick<TimelineItem, 'type'>): readonly KeyframeProp[] {
  if (item.type === 'audio') return ['volume']
  if (item.type === 'video') return KEYFRAME_PROPS
  return ['x', 'y', 'scale', 'rotation', 'opacity']
}

export function clampKeyframeValue(prop: KeyframeProp, value: number) {
  const { min, max } = KEYFRAME_LIMITS[prop]
  return Math.min(max, Math.max(min, value))
}

function staticValue(item: TimelineItem, prop: KeyframeProp) {
  if (prop === 'opacity') return item.opacity
  if (prop === 'volume') return item.type === 'video' || item.type === 'audio' ? item.volume : 1
  return 'transform' in item ? item.transform[prop] : prop === 'scale' ? 1 : 0
}

function setStaticValue(item: TimelineItem, prop: KeyframeProp, value: number) {
  if (prop === 'opacity') item.opacity = value
  else if (prop === 'volume') {
    if (item.type === 'video' || item.type === 'audio') item.volume = value
  } else if ('transform' in item) item.transform[prop] = value
}

export function ease(easing: KeyframeEasing, t: number) {
  switch (easing) {
    case 'ease-in': return t * t
    case 'ease-out': return 1 - (1 - t) * (1 - t)
    case 'ease-in-out': return t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2
    case 'hold': return 0
    default: return t
  }
}

/** Interpolated value of a sorted keyframe list; holds the first/last value outside it. */
export function interpolateKeyframes(keyframes: readonly Keyframe[], frame: number) {
  const first = keyframes[0]!
  if (frame <= first.frame) return first.value
  const last = keyframes[keyframes.length - 1]!
  if (frame >= last.frame) return last.value
  let index = 0
  while (keyframes[index + 1]!.frame <= frame) index++
  const from = keyframes[index]!
  const to = keyframes[index + 1]!
  const t = (frame - from.frame) / (to.frame - from.frame)
  return from.value + (to.value - from.value) * ease(from.easing, t)
}

export function keyframesOf(item: Animatable, prop: KeyframeProp): readonly Keyframe[] {
  return item.keyframes?.[prop] || []
}

export function isAnimated(item: Animatable, prop: KeyframeProp) {
  return keyframesOf(item, prop).length > 0
}

export function hasKeyframes(item: Animatable) {
  return KEYFRAME_PROPS.some(prop => isAnimated(item, prop))
}

/** Value of a property `frame` frames into the item. */
export function valueAt(item: TimelineItem, prop: KeyframeProp, frame: number) {
  const keyframes = keyframesOf(item, prop)
  return keyframes.length ? interpolateKeyframes(keyframes, frame) : staticValue(item, prop)
}

export function itemTransformAt(item: Pick<TimelineItem, 'type'> & { transform: ItemTransform, keyframes?: ItemKeyframes }, frame: number): ItemTransform {
  if (!item.keyframes) return item.transform
  const resolved = { ...item.transform }
  for (const prop of TRANSFORM_PROPS) {
    const keyframes = keyframesOf(item, prop)
    if (keyframes.length) resolved[prop as keyof ItemTransform] = interpolateKeyframes(keyframes, frame)
  }
  return resolved
}

export function itemOpacityAt(item: TimelineItem, frame: number) {
  return valueAt(item, 'opacity', frame)
}

export function itemVolumeAt(item: TimelineItem, frame: number) {
  return valueAt(item, 'volume', frame)
}

export function keyframeAt(item: Animatable, prop: KeyframeProp, frame: number) {
  return keyframesOf(item, prop).find(keyframe => keyframe.frame === frame) || null
}

/** Sorted frames that carry a keyframe on any property. */
export function keyframeFrames(item: Animatable) {
  const frames = new Set<number>()
  for (const prop of KEYFRAME_PROPS) for (const keyframe of keyframesOf(item, prop)) frames.add(keyframe.frame)
  return [...frames].sort((a, b) => a - b)
}

// --- Mutations (operate on a cloned item, e.g. inside updateItem) -----------------

function writeKeyframes(item: TimelineItem, prop: KeyframeProp, keyframes: Keyframe[]) {
  if (!keyframes.length) {
    if (!item.keyframes) return
    const { [prop]: _removed, ...rest } = item.keyframes
    if (Object.keys(rest).length) item.keyframes = rest
    else delete item.keyframes
    return
  }
  item.keyframes = { ...item.keyframes, [prop]: keyframes }
}

function upsert(keyframes: readonly Keyframe[], entry: Keyframe) {
  const next = keyframes.filter(keyframe => keyframe.frame !== entry.frame)
  next.push(entry)
  return next.sort((a, b) => a.frame - b.frame).slice(0, MAX_KEYFRAMES_PER_PROP)
}

/**
 * Sets a property at a frame: updates the keyframe there (or adds one) when the
 * property is animated, otherwise changes the static value. Editing never
 * silently turns animation on; that is what the keyframe toggle is for.
 */
export function setValueAt(item: TimelineItem, prop: KeyframeProp, frame: number, value: number) {
  const next = clampKeyframeValue(prop, value)
  const keyframes = keyframesOf(item, prop)
  if (!keyframes.length) return setStaticValue(item, prop, next)
  const frameAt = Math.max(0, Math.round(frame))
  const existing = keyframeAt(item, prop, frameAt)
  writeKeyframes(item, prop, upsert(keyframes, { frame: frameAt, value: next, easing: existing?.easing ?? 'linear' }))
}

/**
 * Adds a keyframe holding the current value, or removes the one at `frame`.
 * Removing the last keyframe bakes its value into the static one so the item
 * does not jump. Returns whether a keyframe now exists at that frame.
 */
export function toggleKeyframe(item: TimelineItem, prop: KeyframeProp, frame: number) {
  const frameAt = Math.max(0, Math.round(frame))
  const keyframes = keyframesOf(item, prop)
  const existing = keyframeAt(item, prop, frameAt)
  if (existing) {
    const rest = keyframes.filter(keyframe => keyframe !== existing)
    if (!rest.length) setStaticValue(item, prop, existing.value)
    writeKeyframes(item, prop, [...rest])
    return false
  }
  const value = clampKeyframeValue(prop, valueAt(item, prop, frameAt))
  writeKeyframes(item, prop, upsert(keyframes, { frame: frameAt, value, easing: 'linear' }))
  return true
}

export function setKeyframeEasing(item: TimelineItem, frame: number, easing: KeyframeEasing, props: readonly KeyframeProp[] = KEYFRAME_PROPS) {
  for (const prop of props) {
    const keyframes = keyframesOf(item, prop)
    if (!keyframeAt(item, prop, frame)) continue
    writeKeyframes(item, prop, keyframes.map(keyframe => keyframe.frame === frame ? { ...keyframe, easing } : keyframe))
  }
}

/** Moves every keyframe at `from` (all properties) to `to`; a keyframe already at `to` is replaced. */
export function moveKeyframes(item: TimelineItem, from: number, to: number) {
  const target = Math.max(0, Math.round(to))
  if (target === from) return
  for (const prop of KEYFRAME_PROPS) {
    const keyframes = keyframesOf(item, prop)
    const moving = keyframes.find(keyframe => keyframe.frame === from)
    if (!moving) continue
    writeKeyframes(item, prop, upsert(keyframes.filter(keyframe => keyframe !== moving), { ...moving, frame: target }))
  }
}

export function removeKeyframesAt(item: TimelineItem, frame: number) {
  for (const prop of KEYFRAME_PROPS) {
    const keyframes = keyframesOf(item, prop)
    const existing = keyframeAt(item, prop, frame)
    if (!existing) continue
    const rest = keyframes.filter(keyframe => keyframe !== existing)
    if (!rest.length) setStaticValue(item, prop, existing.value)
    writeKeyframes(item, prop, [...rest])
  }
}

/** Drops all animation of the given properties; the static value stays as it is. */
export function clearKeyframes(item: TimelineItem, props: readonly KeyframeProp[] = KEYFRAME_PROPS) {
  for (const prop of props) writeKeyframes(item, prop, [])
}

/**
 * Re-bases keyframes after `delta` frames were cut off the head of the item
 * (trim start, or the tail of a split). A negative delta shifts them later. A
 * keyframe is added at the new first frame so the value there stays what it was.
 */
export function rebaseKeyframes(item: TimelineItem, delta: number) {
  if (!item.keyframes || !delta) return
  for (const prop of KEYFRAME_PROPS) {
    const keyframes = keyframesOf(item, prop)
    if (!keyframes.length) continue
    const shifted = keyframes.map(keyframe => ({ ...keyframe, frame: keyframe.frame - delta }))
    if (delta > 0 && shifted[0]!.frame < 0 && !shifted.some(keyframe => keyframe.frame === 0)) {
      const before = shifted.filter(keyframe => keyframe.frame < 0)
      const last = before[before.length - 1]!
      shifted.push({ frame: 0, value: interpolateKeyframes(keyframes, delta), easing: last.easing })
    }
    writeKeyframes(item, prop, shifted.filter(keyframe => keyframe.frame >= 0).sort((a, b) => a.frame - b.frame))
  }
}
