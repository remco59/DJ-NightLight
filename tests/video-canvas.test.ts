import { describe, expect, it } from 'vitest'
import { hitsItem, snapPosition, visualItemsAt } from '../shared/video-canvas'
import { createGraphicItem, createMediaItem, createTrack, createVideoProject, defaultTransform } from '../shared/video-project'

const canvas = { width: 1080, height: 1920 }
const box = { width: 1080, height: 1920 }

describe('canvas hit testing', () => {
  it('follows the item transform', () => {
    const moved = { ...defaultTransform(), x: 600, scale: 0.5 }
    // Centre of a half-size box moved 600px right sits at x = 1140, past the canvas edge.
    expect(hitsItem({ x: 1140, y: 960 }, box, moved, canvas)).toBe(true)
    expect(hitsItem({ x: 540, y: 960 }, box, moved, canvas)).toBe(false)
    expect(hitsItem({ x: 540, y: 960 }, box, defaultTransform(), canvas)).toBe(true)
  })

  it('accounts for rotation', () => {
    const wide = { width: 1000, height: 100 }
    const rotated = { ...defaultTransform(), rotation: 90 }
    expect(hitsItem({ x: 540, y: 960 + 400 }, wide, rotated, canvas)).toBe(true)
    expect(hitsItem({ x: 540 + 400, y: 960 }, wide, rotated, canvas)).toBe(false)
  })
})

describe('canvas snapping', () => {
  it('snaps to the centre lines within the threshold', () => {
    const snapped = snapPosition({ x: 6, y: -30 }, box, 0.5, 0, canvas, 8)
    expect(snapped).toMatchObject({ x: 0, y: -30 })
    expect(snapped.guides).toEqual({ vertical: [540], horizontal: [] })
  })

  it('lines unrotated box edges up with the canvas edges', () => {
    // Half-size box: its left edge touches the canvas edge at x = -270.
    expect(snapPosition({ x: -265, y: 0 }, box, 0.5, 0, canvas, 8)).toMatchObject({ x: -270, guides: { vertical: [0] } })
    expect(snapPosition({ x: 275, y: 0 }, box, 0.5, 0, canvas, 8)).toMatchObject({ x: 270, guides: { vertical: [1080] } })
    expect(snapPosition({ x: -265, y: 0 }, box, 0.5, 15, canvas, 8).x).toBe(-265)
  })
})

describe('visual items at a frame', () => {
  it('lists showing items frontmost first and skips hidden tracks and audio', () => {
    const project = createVideoProject()
    const [video, graphics] = project.tracks
    const clip = createMediaItem({ id: '11111111-1111-4111-8111-111111111111', mimeType: 'image/jpeg', durationMs: null }, 0, 30)
    video!.items.push(clip)
    const overlay = createTrack('graphics')
    const late = createGraphicItem('gig-announcement', 500, 30)
    overlay.items.push(late)
    project.tracks.push(overlay)
    const ids = visualItemsAt(project, 10).map(item => item.id)
    expect(ids).toEqual([graphics!.items[0]!.id, clip.id])
    graphics!.hidden = true
    expect(visualItemsAt(project, 10).map(item => item.id)).toEqual([clip.id])
  })
})
