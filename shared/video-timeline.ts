import {
  MIN_ITEM_FRAMES,
  MAX_PROJECT_SECONDS,
  findItem,
  itemEnd,
  mediaKind,
  newId,
  trackAccepts,
  MARKER_COLORS,
  type TimelineItem,
  type TimelineMarker,
  type VideoProject,
  type VideoTrack,
} from './video-project'

// Pure timeline editing operations. Every function returns a new project and
// leaves its input untouched so the editor can keep snapshots for undo/redo.
// Items on one track never overlap; operations that would collide are either
// clamped against the neighbouring clip or placed in the nearest free gap.

// Projects are plain JSON by design. A JSON round-trip (unlike structuredClone)
// also accepts the reactive proxies the editor holds.
function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value))
}

function maxFrame(project: VideoProject) {
  return project.fps * MAX_PROJECT_SECONDS
}

function overlaps(items: TimelineItem[], start: number, duration: number, ignoreId?: string) {
  const end = start + duration
  return items.some(item => item.id !== ignoreId && item.start < end && itemEnd(item) > start)
}

/** Nearest start frame to `desired` where an item of `duration` fits without overlap. */
export function findFreeStart(track: VideoTrack, duration: number, desired: number, ignoreId?: string) {
  const others = track.items.filter(item => item.id !== ignoreId)
  const candidates = [Math.max(0, desired)]
  for (const item of others) {
    candidates.push(itemEnd(item), item.start - duration)
  }
  const valid = candidates
    .filter(start => start >= 0 && !overlaps(others, start, duration))
    .sort((a, b) => Math.abs(a - desired) - Math.abs(b - desired) || a - b)
  return valid[0] ?? others.reduce((end, item) => Math.max(end, itemEnd(item)), 0)
}

/**
 * Makes an item end within the project limit. Audio and video are shortened
 * (a long song dropped late on the timeline keeps playing until the limit);
 * images and graphics have a chosen length, so they are refused instead.
 * Shortening from the tail keeps any free slot free, as the range only shrinks.
 */
function fitWithinProject(item: TimelineItem, max: number): TimelineItem | null {
  if (itemEnd(item) <= max) return item
  if (item.type !== 'audio' && item.type !== 'video') return null
  const duration = max - item.start
  if (duration < MIN_ITEM_FRAMES) return null
  const fitted = { ...item, duration }
  if (fitted.type === 'audio') {
    fitted.fadeIn = Math.min(fitted.fadeIn, duration)
    fitted.fadeOut = Math.min(fitted.fadeOut, duration)
  }
  return fitted
}

/** Source length in timeline frames for trimmable media, null when unlimited (images, graphics). */
export type SourceFramesLookup = (item: TimelineItem) => number | null

function sortItems(track: VideoTrack) {
  track.items.sort((a, b) => a.start - b.start)
}

export function addItem(project: VideoProject, trackId: string, item: TimelineItem) {
  const next = clone(project)
  const track = next.tracks.find(entry => entry.id === trackId)
  if (!track || !trackAccepts(track.kind, item.type)) return project
  const placed = fitWithinProject({ ...clone(item), start: findFreeStart(track, item.duration, item.start) }, maxFrame(next))
  if (!placed) return project
  track.items.push(placed)
  sortItems(track)
  return next
}

export function moveItem(project: VideoProject, itemId: string, desiredStart: number, targetTrackId?: string) {
  const next = clone(project)
  const found = findItem(next, itemId)
  if (!found) return project
  const target = targetTrackId ? next.tracks.find(track => track.id === targetTrackId) : found.track
  if (!target || !trackAccepts(target.kind, found.item.type)) return project

  found.track.items = found.track.items.filter(item => item.id !== itemId)
  const placed = fitWithinProject({ ...found.item, start: findFreeStart(target, found.item.duration, Math.round(desiredStart), itemId) }, maxFrame(next))
  if (!placed) return project
  target.items.push(placed)
  sortItems(target)
  return next
}

export function trimItem(
  project: VideoProject,
  itemId: string,
  edge: 'start' | 'end',
  delta: number,
  sourceFrames: SourceFramesLookup = () => null,
) {
  const next = clone(project)
  const found = findItem(next, itemId)
  if (!found) return project
  const { item, track } = found
  const neighbours = track.items.filter(entry => entry.id !== itemId)
  const speed = item.type === 'video' ? item.speed : 1
  const source = sourceFrames(item)
  const hasTrim = item.type === 'video' || item.type === 'audio'
  let change = Math.round(delta)

  if (edge === 'start') {
    const previousEnd = neighbours.filter(entry => itemEnd(entry) <= item.start).reduce((end, entry) => Math.max(end, itemEnd(entry)), 0)
    change = Math.max(change, previousEnd - item.start)
    change = Math.min(change, item.duration - MIN_ITEM_FRAMES)
    if (hasTrim) change = Math.max(change, -Math.floor(item.trimStart / speed))
    item.start += change
    item.duration -= change
    if (hasTrim) item.trimStart = Math.max(0, Math.round(item.trimStart + change * speed))
  } else {
    const nextStart = neighbours.filter(entry => entry.start >= itemEnd(item)).reduce((start, entry) => Math.min(start, entry.start), maxFrame(next))
    change = Math.min(change, nextStart - itemEnd(item))
    change = Math.max(change, MIN_ITEM_FRAMES - item.duration)
    if (hasTrim && source !== null) {
      const available = Math.floor((source - item.trimStart) / speed)
      change = Math.min(change, available - item.duration)
    }
    item.duration = Math.max(MIN_ITEM_FRAMES, item.duration + change)
  }
  return next
}

/**
 * Slip edit: shows a different part of the source without moving or resizing
 * the clip. `delta` is in timeline frames; positive moves the content right
 * (an earlier part of the source comes into view). The in-point stays within
 * the source.
 */
export function slipItem(project: VideoProject, itemId: string, delta: number, sourceFrames: SourceFramesLookup = () => null) {
  const found = findItem(project, itemId)
  if (!found || (found.item.type !== 'video' && found.item.type !== 'audio')) return project
  const { item } = found
  const speed = item.type === 'video' ? item.speed : 1
  const source = sourceFrames(item)
  const latest = source === null ? Infinity : Math.max(0, source - Math.ceil(item.duration * speed))
  const trimStart = Math.round(Math.min(latest, Math.max(0, item.trimStart - delta * speed)))
  if (trimStart === item.trimStart) return project
  return updateItem(project, itemId, (target) => {
    if (target.type === 'video' || target.type === 'audio') target.trimStart = trimStart
  })
}

export function splitItem(project: VideoProject, itemId: string, frame: number) {
  const found = findItem(project, itemId)
  if (!found) return { project, newItemId: null }
  const { item } = found
  const at = Math.round(frame)
  if (at < item.start + MIN_ITEM_FRAMES || at > itemEnd(item) - MIN_ITEM_FRAMES) return { project, newItemId: null }

  const next = clone(project)
  const target = findItem(next, itemId)!
  const head = target.item
  const tail = clone(head)
  const headDuration = at - head.start
  tail.id = newId()
  tail.start = at
  tail.duration = head.duration - headDuration
  head.duration = headDuration
  if (tail.type === 'video') tail.trimStart = Math.round(tail.trimStart + headDuration * tail.speed)
  if (tail.type === 'audio') {
    tail.trimStart += headDuration
    tail.fadeIn = 0
  }
  if (head.type === 'audio') head.fadeOut = 0
  if (head.type === 'graphic' && tail.type === 'graphic') {
    head.exit = 'none'
    tail.entrance = 'none'
  }
  target.track.items.push(tail)
  sortItems(target.track)
  return { project: next, newItemId: tail.id }
}

export function duplicateItem(project: VideoProject, itemId: string) {
  const found = findItem(project, itemId)
  if (!found) return { project, newItemId: null }
  const copy = { ...clone(found.item), id: newId(), start: itemEnd(found.item) }
  const next = addItem(project, found.track.id, copy)
  return { project: next, newItemId: next === project ? null : copy.id }
}

export function deleteItem(project: VideoProject, itemId: string) {
  const next = clone(project)
  for (const track of next.tracks) track.items = track.items.filter(item => item.id !== itemId)
  return next
}

export function updateItem(project: VideoProject, itemId: string, patch: (item: TimelineItem) => void) {
  const next = clone(project)
  const found = findItem(next, itemId)
  if (!found) return project
  patch(found.item)
  return next
}

/**
 * Swaps the media behind a clip while keeping its position, styling and timing.
 * Only same-kind swaps are allowed; video/audio restart at the head of the new
 * source and shrink when the new source is shorter than the clip.
 */
export function replaceItemAsset(
  project: VideoProject,
  itemId: string,
  asset: { id: string, mimeType: string, durationMs: number | null },
) {
  const found = findItem(project, itemId)
  if (!found || found.item.type === 'graphic' || found.item.type !== mediaKind(asset.mimeType)) return project
  if (found.item.assetId === asset.id) return project
  return updateItem(project, itemId, (item) => {
    if (item.type === 'graphic') return
    item.assetId = asset.id
    if (item.type !== 'video' && item.type !== 'audio') return
    item.trimStart = 0
    if (asset.durationMs) {
      const speed = item.type === 'video' ? item.speed : 1
      const available = Math.floor(Math.floor(asset.durationMs / 1000 * project.fps) / speed)
      item.duration = Math.max(MIN_ITEM_FRAMES, Math.min(item.duration, available))
    }
    if (item.type === 'audio') {
      item.fadeIn = Math.min(item.fadeIn, item.duration)
      item.fadeOut = Math.min(item.fadeOut, item.duration)
    }
  })
}

/** Frames that dragged edges should stick to: 0, the playhead, markers and every clip edge. */
export function snapTargets(project: VideoProject, playhead: number, ignoreId?: string) {
  const targets = new Set<number>([0, Math.round(playhead)])
  for (const marker of project.markers || []) {
    if (marker.id !== ignoreId) targets.add(marker.frame)
  }
  for (const track of project.tracks) {
    for (const item of track.items) {
      if (item.id === ignoreId) continue
      targets.add(item.start)
      targets.add(itemEnd(item))
    }
  }
  return [...targets]
}

export function snapFrame(value: number, targets: number[], threshold: number) {
  let best = value
  let distance = threshold + 1
  for (const target of targets) {
    const current = Math.abs(target - value)
    if (current <= threshold && current < distance) {
      best = target
      distance = current
    }
  }
  return best
}

// --- Markers -------------------------------------------------------------------

export const MAX_MARKERS = 100

function sortMarkers(markers: TimelineMarker[]) {
  return markers.sort((a, b) => a.frame - b.frame)
}

/** Adds a marker at `frame` (one per frame; colours cycle so neighbours differ). */
export function addMarker(project: VideoProject, frame: number, label?: string) {
  const at = Math.max(0, Math.min(maxFrame(project), Math.round(frame)))
  const markers = project.markers || []
  if (markers.length >= MAX_MARKERS || markers.some(marker => marker.frame === at)) return { project, markerId: null }
  const marker: TimelineMarker = { id: newId('mk'), frame: at, color: MARKER_COLORS[markers.length % MARKER_COLORS.length] }
  if (label?.trim()) marker.label = label.trim().slice(0, 40)
  const next = clone(project)
  next.markers = sortMarkers([...markers.map(entry => ({ ...entry })), marker])
  return { project: next, markerId: marker.id }
}

export function updateMarker(project: VideoProject, markerId: string, patch: Partial<Omit<TimelineMarker, 'id'>>) {
  const markers = project.markers || []
  if (!markers.some(marker => marker.id === markerId)) return project
  const next = clone(project)
  next.markers = sortMarkers(next.markers!.map((marker) => {
    if (marker.id !== markerId) return marker
    const updated = { ...marker, ...patch }
    updated.frame = Math.max(0, Math.min(maxFrame(project), Math.round(updated.frame)))
    const label = updated.label?.trim().slice(0, 40)
    if (label) updated.label = label
    else delete updated.label
    return updated
  }))
  return next
}

export function deleteMarker(project: VideoProject, markerId: string) {
  if (!(project.markers || []).some(marker => marker.id === markerId)) return project
  const next = clone(project)
  next.markers = next.markers!.filter(marker => marker.id !== markerId)
  return next
}

/** Frame of the nearest marker before (-1) or after (1) `frame`, or null. */
export function adjacentMarker(project: VideoProject, frame: number, direction: -1 | 1) {
  const frames = (project.markers || []).map(marker => marker.frame)
  const candidates = direction < 0 ? frames.filter(value => value < frame) : frames.filter(value => value > frame)
  if (!candidates.length) return null
  return direction < 0 ? Math.max(...candidates) : Math.min(...candidates)
}

// --- Undo / redo ------------------------------------------------------------

export type History<T> = {
  past: T[]
  future: T[]
}

export function createHistory<T>(): History<T> {
  return { past: [], future: [] }
}

export function recordHistory<T>(history: History<T>, previous: T, limit = 100): History<T> {
  const past = [...history.past, previous]
  return { past: past.slice(Math.max(0, past.length - limit)), future: [] }
}

export function undoHistory<T>(history: History<T>, current: T) {
  const previous = history.past.at(-1)
  if (previous === undefined) return null
  return {
    value: previous,
    history: { past: history.past.slice(0, -1), future: [current, ...history.future] },
  }
}

export function redoHistory<T>(history: History<T>, current: T) {
  const [following, ...rest] = history.future
  if (following === undefined) return null
  return {
    value: following,
    history: { past: [...history.past, current], future: rest },
  }
}
