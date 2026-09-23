import { describe, expect, it } from 'vitest'
import { createMediaItem, createVideoProject, findItem, type TimelineItem, type VideoProject } from '../shared/video-project'
import {
  addItem,
  createHistory,
  deleteItem,
  duplicateItem,
  findFreeStart,
  moveItem,
  recordHistory,
  redoHistory,
  snapFrame,
  snapTargets,
  splitItem,
  trimItem,
  undoHistory,
} from '../shared/video-timeline'

const clipAsset = { id: '11111111-1111-4111-8111-111111111111', mimeType: 'video/mp4', durationMs: 10_000 }

function projectWithClips() {
  let project = createVideoProject()
  project.tracks[1]!.items = []
  const video = project.tracks[0]!
  const a = { ...createMediaItem(clipAsset, 0, 30), duration: 90 }
  const b = { ...createMediaItem(clipAsset, 90, 30), duration: 60 }
  project = addItem(project, video.id, a)
  project = addItem(project, video.id, b)
  return { project, a, b, trackId: video.id }
}

const item = (project: VideoProject, id: string) => findItem(project, id)!.item
const sourceFrames = (entry: TimelineItem) => entry.type === 'video' ? 300 : null

describe('timeline operations', () => {
  it('places new items in the nearest free gap instead of overlapping', () => {
    const { project, trackId } = projectWithClips()
    const track = project.tracks.find(entry => entry.id === trackId)!
    expect(findFreeStart(track, 30, 20)).toBe(150)
    expect(findFreeStart(track, 30, 200)).toBe(200)
  })

  it('moves clips and reorders them without mutating the input', () => {
    const { project, a, b } = projectWithClips()
    const moved = moveItem(project, b.id, 0)
    expect(item(project, b.id).start).toBe(90)
    // b cannot overlap a and there is no room before it, so it stays after a
    expect(item(moved, b.id).start).toBe(90)
    const reordered = moveItem(moveItem(project, a.id, 300), b.id, 0)
    expect(item(reordered, b.id).start).toBe(0)
    expect(item(reordered, a.id).start).toBe(300)
  })

  it('refuses to move items onto incompatible tracks', () => {
    const { project, a } = projectWithClips()
    const audioTrack = project.tracks.find(track => track.kind === 'audio')!
    expect(moveItem(project, a.id, 0, audioTrack.id)).toBe(project)
  })

  it('trims from either edge within the neighbours and the source media', () => {
    const { project, a, b } = projectWithClips()
    const shorter = trimItem(project, a.id, 'start', 30, sourceFrames)
    expect(item(shorter, a.id)).toMatchObject({ start: 30, duration: 60, trimStart: 30 })

    const backOut = trimItem(shorter, a.id, 'start', -100, sourceFrames)
    expect(item(backOut, a.id)).toMatchObject({ start: 0, duration: 90, trimStart: 0 })

    const blocked = trimItem(project, a.id, 'end', 50, sourceFrames)
    expect(item(blocked, a.id).duration).toBe(90)

    const longer = trimItem(project, b.id, 'end', 1000, sourceFrames)
    expect(item(longer, b.id).duration).toBe(300)

    const minimal = trimItem(project, b.id, 'end', -1000, sourceFrames)
    expect(item(minimal, b.id).duration).toBe(3)
  })

  it('splits at the playhead and continues the source in the second half', () => {
    const { project, a } = projectWithClips()
    const result = splitItem(project, a.id, 40)
    expect(result.newItemId).toBeTruthy()
    expect(item(result.project, a.id)).toMatchObject({ start: 0, duration: 40 })
    expect(item(result.project, result.newItemId!)).toMatchObject({ start: 40, duration: 50, trimStart: 40 })
    expect(splitItem(project, a.id, 1).newItemId).toBeNull()
  })

  it('duplicates into the next free slot and deletes items', () => {
    const { project, a } = projectWithClips()
    const result = duplicateItem(project, a.id)
    expect(item(result.project, result.newItemId!).start).toBe(150)
    const removed = deleteItem(result.project, a.id)
    expect(findItem(removed, a.id)).toBeNull()
  })

  it('snaps to clip edges and the playhead within the threshold', () => {
    const { project, a } = projectWithClips()
    const targets = snapTargets(project, 200, a.id)
    expect(targets).toEqual(expect.arrayContaining([0, 90, 150, 200]))
    expect(snapFrame(94, targets, 5)).toBe(90)
    expect(snapFrame(120, targets, 5)).toBe(120)
  })
})

describe('undo history', () => {
  it('undoes and redoes snapshots', () => {
    let history = createHistory<number>()
    history = recordHistory(history, 1)
    history = recordHistory(history, 2)
    const undone = undoHistory(history, 3)!
    expect(undone.value).toBe(2)
    const redone = redoHistory(undone.history, 2)!
    expect(redone.value).toBe(3)
    expect(undoHistory(createHistory<number>(), 1)).toBeNull()
  })

  it('caps the history length and clears redo on new edits', () => {
    let history = createHistory<number>()
    for (let index = 0; index < 150; index++) history = recordHistory(history, index, 100)
    expect(history.past).toHaveLength(100)
    const undone = undoHistory(history, 150)!
    expect(recordHistory(undone.history, 7).future).toEqual([])
  })
})
