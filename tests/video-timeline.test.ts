import { describe, expect, it } from 'vitest'
import { MAX_PROJECT_SECONDS, createGraphicItem, createMediaItem, createVideoProject, findItem, type TimelineItem, type VideoProject } from '../shared/video-project'
import {
  addItem,
  createHistory,
  deleteItem,
  duplicateItem,
  findFreeStart,
  moveItem,
  recordHistory,
  redoHistory,
  replaceItemAsset,
  slipItem,
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
  it('replaces clip media with the same kind and fits the new source', () => {
    const { project, a } = projectWithClips()
    const short = { id: '22222222-2222-4222-8222-222222222222', mimeType: 'video/mp4', durationMs: 2_000 }
    const replaced = replaceItemAsset(project, a.id, short)
    const clip = item(replaced, a.id)
    expect(clip.type === 'video' && clip.assetId).toBe(short.id)
    expect(clip.start).toBe(a.start)
    expect(clip.duration).toBe(60)
    expect(item(project, a.id).type === 'video' && (item(project, a.id) as { assetId: string }).assetId).toBe(clipAsset.id)
    const photo = { id: '33333333-3333-4333-8333-333333333333', mimeType: 'image/jpeg', durationMs: null }
    expect(replaceItemAsset(project, a.id, photo)).toBe(project)
    expect(replaceItemAsset(project, a.id, clipAsset)).toBe(project)
  })

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

  it('shortens long audio dropped late on the timeline to the project limit', () => {
    const project = createVideoProject()
    const audioTrack = project.tracks.find(track => track.kind === 'audio')!
    const song = createMediaItem({ id: '44444444-4444-4444-8444-444444444444', mimeType: 'audio/mpeg', durationMs: 200_000 }, 300, 30)
    expect(song.duration).toBe(30 * MAX_PROJECT_SECONDS)
    const added = addItem(project, audioTrack.id, song)
    expect(item(added, song.id)).toMatchObject({ start: 300, duration: 30 * MAX_PROJECT_SECONDS - 300, fadeOut: 30 })
  })

  it('shortens moved audio and video but refuses graphics past the project limit', () => {
    const { project, a } = projectWithClips()
    const limit = 30 * MAX_PROJECT_SECONDS
    const moved = moveItem(project, a.id, limit - 30)
    expect(item(moved, a.id)).toMatchObject({ start: limit - 30, duration: 30 })
    expect(moveItem(project, a.id, limit - 1)).toBe(project)

    const graphicsTrack = project.tracks.find(track => track.kind === 'graphics')!
    expect(addItem(project, graphicsTrack.id, createGraphicItem('gig-announcement', limit - 30, 30))).toBe(project)
  })

  it('slips the in-point without moving the clip, within the source', () => {
    const { project, a } = projectWithClips()
    // a: 90 frames at 0 from a 300-frame source; content moving left reveals later source.
    const later = slipItem(project, a.id, -40, sourceFrames)
    expect(item(later, a.id)).toMatchObject({ start: 0, duration: 90, trimStart: 40 })
    expect(item(slipItem(later, a.id, 100, sourceFrames), a.id)).toMatchObject({ trimStart: 0 })
    expect(item(slipItem(project, a.id, -1000, sourceFrames), a.id)).toMatchObject({ trimStart: 210 })
    expect(slipItem(project, a.id, 10, sourceFrames)).toBe(project)
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
