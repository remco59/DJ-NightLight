// Clip transitions: how a video or image clip arrives at its start
// (`transitionIn`) and leaves at its end (`transitionOut`).
//
// Clips on one track never overlap, so what happens at a cut depends on the
// transition's `mode`:
//
// - `through`: each clip plays its own half. The outgoing clip's last frames
//   run the effect up to the cut and the incoming clip's first frames run it
//   back down, so the two halves meet in the same "transitioned" state (a
//   glitch tears A apart and B back together). Nothing is on screen twice.
// - `overlap`: the clips share the screen, like a crossfade or a push. The
//   incoming clip owns the transition (`transitionIn`); the outgoing clip is
//   held on its last frame underneath it for the length of the transition.
//
// Either way the two clips of a cut carry the same setting (setClipTransition
// keeps them in step). A clip without a neighbour at that edge arrives from, or
// leaves into, the background.
//
// ADDING A TRANSITION: add an entry to TRANSITIONS below and a matching look in
// remotion/transitions.ts (TRANSITION_LOOKS is typed as a full record, so the
// compiler and the test suite flag a missing one). The picker, the project
// schema and the timeline badges follow from the registry; nothing else to wire.

import type { ImageClipItem, TimelineItem, VideoClipItem } from './video-project'

export const TRANSITION_GROUPS = {
  fade: 'Fade',
  whoosh: 'Whoosh',
  glitch: 'Glitch',
} as const
export type TransitionGroup = keyof typeof TRANSITION_GROUPS
export const TRANSITION_GROUP_KEYS = Object.keys(TRANSITION_GROUPS) as TransitionGroup[]

export type TransitionMode = 'through' | 'overlap'

export type TransitionDefinition = {
  label: string
  group: TransitionGroup
  /** See the top of this file. */
  mode: TransitionMode
  /** Lucide icon shown in the picker. */
  icon: string
  /** One line for the picker tooltip. */
  description: string
  /** Default `frames`, in seconds: one half for `through`, the whole transition for `overlap`. */
  defaultSeconds: number
}

export const TRANSITIONS = {
  'fade': {
    label: 'Fade',
    group: 'fade',
    mode: 'overlap',
    icon: 'lucide:blend',
    description: 'De volgende clip dooft over de vorige heen.',
    defaultSeconds: 0.6,
  },
  'dip': {
    label: 'Dip naar zwart',
    group: 'fade',
    mode: 'through',
    icon: 'lucide:moon',
    description: 'Dooft naar de achtergrond en komt er weer uit op.',
    defaultSeconds: 0.5,
  },
  'flash': {
    label: 'Flits',
    group: 'fade',
    mode: 'through',
    icon: 'lucide:sun',
    description: 'Een witte flits op de snede.',
    defaultSeconds: 0.25,
  },
  'blur': {
    label: 'Blur',
    group: 'fade',
    mode: 'through',
    icon: 'lucide:droplets',
    description: 'De clip raakt uit focus en wordt weer scherp.',
    defaultSeconds: 0.4,
  },
  'whoosh-left': {
    label: 'Whoosh links',
    group: 'whoosh',
    mode: 'overlap',
    icon: 'lucide:arrow-left',
    description: 'Duwt de vorige clip naar links weg met bewegingsonscherpte.',
    defaultSeconds: 0.45,
  },
  'whoosh-right': {
    label: 'Whoosh rechts',
    group: 'whoosh',
    mode: 'overlap',
    icon: 'lucide:arrow-right',
    description: 'Duwt de vorige clip naar rechts weg met bewegingsonscherpte.',
    defaultSeconds: 0.45,
  },
  'whoosh-up': {
    label: 'Whoosh omhoog',
    group: 'whoosh',
    mode: 'overlap',
    icon: 'lucide:arrow-up',
    description: 'Duwt de vorige clip omhoog weg met bewegingsonscherpte.',
    defaultSeconds: 0.45,
  },
  'whoosh-down': {
    label: 'Whoosh omlaag',
    group: 'whoosh',
    mode: 'overlap',
    icon: 'lucide:arrow-down',
    description: 'Duwt de vorige clip omlaag weg met bewegingsonscherpte.',
    defaultSeconds: 0.45,
  },
  'zoom': {
    label: 'Zoom',
    group: 'whoosh',
    mode: 'through',
    icon: 'lucide:zoom-in',
    description: 'Zoomt door de snede heen.',
    defaultSeconds: 0.3,
  },
  'spin': {
    label: 'Spin',
    group: 'whoosh',
    mode: 'through',
    icon: 'lucide:rotate-cw',
    description: 'Draait en zoomt weg, de volgende clip draait binnen.',
    defaultSeconds: 0.35,
  },
  'glitch': {
    label: 'Glitch',
    group: 'glitch',
    mode: 'through',
    icon: 'lucide:tv',
    description: 'Scheurende beeldlijnen, kleurverschuiving en flikkering.',
    defaultSeconds: 0.35,
  },
  'rgb-split': {
    label: 'RGB-split',
    group: 'glitch',
    mode: 'through',
    icon: 'lucide:layers',
    description: 'De kleurkanalen schuiven uit elkaar.',
    defaultSeconds: 0.3,
  },
  'strobe': {
    label: 'Strobe',
    group: 'glitch',
    mode: 'through',
    icon: 'lucide:sparkles',
    description: 'Snel knipperend beeld rond de snede.',
    defaultSeconds: 0.3,
  },
} as const satisfies Record<string, TransitionDefinition>

export type TransitionKey = keyof typeof TRANSITIONS
export const TRANSITION_KEYS = Object.keys(TRANSITIONS) as [TransitionKey, ...TransitionKey[]]

export const MAX_TRANSITION_FRAMES = 120

/** One half of a transition, stored on the clip edge it plays at. */
export type ClipTransition = {
  key: TransitionKey
  /** Length of this clip's half, in frames. */
  frames: number
}

export type ClipTransitionEdge = 'in' | 'out'

/** The part of a clip the transition maths needs. */
export type TransitionHost = {
  duration: number
  transitionIn?: ClipTransition
  transitionOut?: ClipTransition
}

export function createTransition(key: TransitionKey, fps: number): ClipTransition {
  return { key, frames: Math.max(1, Math.min(MAX_TRANSITION_FRAMES, Math.round(TRANSITIONS[key].defaultSeconds * fps))) }
}

/** Only video and image clips carry transitions. */
export function supportsTransitions(item: TimelineItem): item is VideoClipItem | ImageClipItem {
  return item.type === 'video' || item.type === 'image'
}

export function clipTransition(item: TransitionHost, edge: ClipTransitionEdge) {
  return (edge === 'in' ? item.transitionIn : item.transitionOut) ?? null
}

/**
 * Frames a transition really takes at an edge. A `through` half is clamped to
 * half the clip so its two halves never overlap; an `overlap` transition may
 * use the whole clip, as it only ever plays at the start.
 */
export function transitionFrames(item: TransitionHost, edge: ClipTransitionEdge) {
  const transition = clipTransition(item, edge)
  if (!transition) return 0
  return Math.min(transition.frames, maxTransitionFrames(item, transition.key))
}

/** Longest `frames` the clip can hold for a transition, for the editor's duration slider. */
export function maxTransitionFrames(item: Pick<TransitionHost, 'duration'>, key?: TransitionKey) {
  const room = key && TRANSITIONS[key].mode === 'overlap' ? item.duration : Math.floor(item.duration / 2)
  return Math.max(1, Math.min(MAX_TRANSITION_FRAMES, room))
}

/** How long the cut lasts on screen, in frames. */
export function transitionTotalFrames(transition: ClipTransition) {
  return TRANSITIONS[transition.key].mode === 'through' ? transition.frames * 2 : transition.frames
}

/**
 * Frames the clip before `next` must keep playing past its end, held on its
 * last frame, because `next` starts with an overlap transition. 0 when there is
 * none; pass the clip that starts exactly where this one ends.
 */
export function tailFrames(next: TransitionHost | null | undefined) {
  if (!next?.transitionIn || TRANSITIONS[next.transitionIn.key].mode !== 'overlap') return 0
  return transitionFrames(next, 'in')
}

export type TransitionState = {
  key: TransitionKey
  edge: ClipTransitionEdge
  /**
   * 0 = the clip is settled, 1 = fully transitioned (the state at the cut).
   * It never reaches exactly 1: the last frame of the outgoing side and the
   * first of the incoming side sit half a frame short of it, so they differ
   * and the cut does not show two identical frames.
   */
  amount: number
  /** The clip is the held outgoing clip of an `overlap` transition, drawn under the incoming one. */
  underlay: boolean
}

/**
 * The transition state of a clip `frame` frames after its start, or null while
 * it is settled. `next` is the clip starting exactly where this one ends; its
 * overlap transition runs on this clip's tail, which lies past `duration`.
 */
export function transitionAt(item: TransitionHost, frame: number, next?: TransitionHost | null): TransitionState | null {
  const inFrames = transitionFrames(item, 'in')
  if (item.transitionIn && frame >= 0 && frame < inFrames) {
    return { key: item.transitionIn.key, edge: 'in', amount: clamp01(1 - (frame + 0.5) / inFrames), underlay: false }
  }
  const tail = tailFrames(next)
  if (tail > 0) {
    if (frame >= item.duration && frame < item.duration + tail) {
      return { key: next!.transitionIn!.key, edge: 'out', amount: clamp01((frame - item.duration + 0.5) / tail), underlay: true }
    }
    // The next clip takes over this cut; the clip's own end half would play twice.
    return null
  }
  const outFrames = transitionFrames(item, 'out')
  const outStart = item.duration - outFrames
  if (item.transitionOut && frame >= outStart && frame < item.duration) {
    return { key: item.transitionOut.key, edge: 'out', amount: clamp01((frame - outStart + 0.5) / outFrames), underlay: false }
  }
  return null
}

export function hasTransitions(item: TransitionHost) {
  return Boolean(item.transitionIn || item.transitionOut)
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value))
}
