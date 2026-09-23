import { describe, expect, it } from 'vitest'
import { hitsItem, itemBoxSize, mediaBoxSize, snapPosition, visualItemsAt } from '../shared/video-canvas'
import { createGraphicItem, createMediaItem, createTrack, createVideoProject, defaultTransform, mediaFit, parseVideoProject } from '../shared/video-project'

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
    const ids = visualItemsAt(project, 10).map(entry => entry.item.id)
    expect(ids).toEqual([graphics!.items[0]!.id, clip.id])
    graphics!.hidden = true
    expect(visualItemsAt(project, 10).map(entry => entry.item.id)).toEqual([clip.id])
  })
})

describe('media boxes', () => {
  const wide = { width: 1920, height: 1080 }

  it('keeps the source aspect ratio, covering or fitting the canvas', () => {
    // 16:9 on 9:16: covering makes a box wider than the canvas; the canvas edge crops it.
    const cover = mediaBoxSize(wide, canvas, 'cover')
    expect(cover.width).toBeCloseTo(3413.33, 1)
    expect(cover.height).toBeCloseTo(1920)
    const contain = mediaBoxSize(wide, canvas, 'contain')
    expect(contain.width).toBeCloseTo(1080)
    expect(contain.height).toBeCloseTo(607.5)
    expect(mediaBoxSize({ width: 0, height: 0 }, canvas, 'cover')).toEqual(canvas)
    expect(mediaBoxSize(null, canvas, 'contain')).toEqual(canvas)
  })

  it('defaults to filling on video tracks and fitting on graphics tracks', () => {
    const image = createMediaItem({ id: '11111111-1111-4111-8111-111111111111', mimeType: 'image/jpeg', durationMs: null }, 0, 30)
    if (image.type !== 'image') throw new Error('expected an image')
    expect(mediaFit(image, 'video')).toBe('cover')
    expect(mediaFit(image, 'graphics')).toBe('contain')
    expect(mediaFit({ ...image, fit: 'contain' }, 'video')).toBe('contain')
    expect(itemBoxSize(image, 'video', canvas, wide).height).toBeCloseTo(1920)
    expect(itemBoxSize(createGraphicItem('gig-announcement', 0, 30), 'graphics', canvas, wide)).toEqual(canvas)
  })

  it('accepts projects with and without a fit', () => {
    const project = createVideoProject()
    const image = { ...createMediaItem({ id: '11111111-1111-4111-8111-111111111111', mimeType: 'image/jpeg', durationMs: null }, 0, 30), fit: 'contain' as const }
    project.tracks[0]!.items.push(image)
    expect(() => parseVideoProject(project)).not.toThrow()
    project.tracks[0]!.items[0] = { ...image, fit: 'stretch' as never }
    expect(() => parseVideoProject(project)).toThrow()
  })
})
