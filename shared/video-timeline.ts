import {
  MIN_ITEM_FRAMES,
  MAX_PROJECT_SECONDS,
  findItem,
  itemEnd,
  mediaKind,
  newId,
  trackAccepts,
  type TimelineItem,
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

/** Source length in timeline frames for trimmable media, null when unlimited (images, graphics). */
export type SourceFramesLookup = (item: TimelineItem) => number | null

function sortItems(track: VideoTrack) {
  track.items.sort((a, b) => a.start - b.start)
}

export function addItem(project: VideoProject, trackId: string, item: TimelineItem) {
  const next = clone(project)
  const track = next.tracks.find(entry => entry.id === trackId)
  if (!track || !trackAccepts(track.kind, item.type)) return project
  const placed = { ...clone(item), start: findFreeStart(track, item.duration, item.start) }
  if (itemEnd(placed) > maxFrame(next)) return project
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
  const start = findFreeStart(target, found.item.duration, Math.round(desiredStart), itemId)
  if (start + found.item.duration > maxFrame(next)) return project
  target.items.push({ ...found.item, start })
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

/** Frames that dragged edges should stick to: 0, the playhead and every clip edge. */
export function snapTargets(project: VideoProject, playhead: number, ignoreId?: string) {
  const targets = new Set<number>([0, Math.round(playhead)])
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
