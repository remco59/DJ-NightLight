import { describe, expect, it } from 'vitest'
import { createGraphicItem, createMediaItem } from '../shared/video-project'
import {
  MAX_TIMELINE_ZOOM,
  MIN_TIMELINE_ZOOM,
  MIN_PREVIEW_WIDTH,
  clampPanelSizes,
  clampZoom,
  fitZoom,
  defaultPanelSizes,
  filterMediaAssets,
  formatMediaDuration,
  parsePanelSizes,
  pinchZoom,
  quickActionsFor,
  timelineDisplayOrder,
} from '../shared/video-editor-ui'

const video = { id: '11111111-1111-4111-8111-111111111111', mimeType: 'video/mp4', durationMs: 10_000 }
const image = { id: '22222222-2222-4222-8222-222222222222', mimeType: 'image/jpeg', durationMs: null }
const audio = { id: '33333333-3333-4333-8333-333333333333', mimeType: 'audio/mpeg', durationMs: 60_000 }

describe('zoom to fit', () => {
  it('fits the duration into the width without overflowing', () => {
    // 60s into 1200px = 20 px/s; 7s into 1000px = 142.86 → 142.
    expect(fitZoom(1800, 30, 1200)).toBe(20)
    expect(fitZoom(210, 30, 1000)).toBe(142)
    expect(fitZoom(210, 30, 1000) * 7).toBeLessThanOrEqual(1000)
  })

  it('stays within the zoom range', () => {
    expect(fitZoom(30 * 180, 30, 500)).toBe(MIN_TIMELINE_ZOOM)
    expect(fitZoom(3, 30, 2000)).toBe(MAX_TIMELINE_ZOOM)
  })
})

describe('timeline zoom', () => {
  it('clamps zoom to the supported range', () => {
    expect(clampZoom(2)).toBe(MIN_TIMELINE_ZOOM)
    expect(clampZoom(10_000)).toBe(MAX_TIMELINE_ZOOM)
    expect(clampZoom(80.4)).toBe(80)
    expect(clampZoom(Number.NaN)).toBe(MIN_TIMELINE_ZOOM)
  })

  it('scales zoom with the pinch distance', () => {
    expect(pinchZoom(80, 100, 200)).toBe(160)
    expect(pinchZoom(80, 200, 100)).toBe(40)
    expect(pinchZoom(300, 100, 400)).toBe(MAX_TIMELINE_ZOOM)
  })

  it('ignores degenerate pinches', () => {
    expect(pinchZoom(80, 0, 120)).toBe(80)
    expect(pinchZoom(80, 120, 0)).toBe(80)
  })
})

describe('media filtering', () => {
  const assets = [
    { title: 'Club night', originalFilename: 'club.mp4', mimeType: 'video/mp4' },
    { title: '', originalFilename: 'crowd.jpg', mimeType: 'image/jpeg' },
    { title: 'Night Drive', originalFilename: 'drive.mp3', mimeType: 'audio/mpeg' },
  ]

  it('filters by kind', () => {
    expect(filterMediaAssets(assets, 'audio', '').map(asset => asset.originalFilename)).toEqual(['drive.mp3'])
    expect(filterMediaAssets(assets, 'all', '')).toHaveLength(3)
  })

  it('searches titles and filenames case-insensitively', () => {
    expect(filterMediaAssets(assets, 'all', ' NIGHT ').map(asset => asset.originalFilename)).toEqual(['club.mp4', 'drive.mp3'])
    expect(filterMediaAssets(assets, 'image', 'crowd')).toHaveLength(1)
    expect(filterMediaAssets(assets, 'video', 'crowd')).toHaveLength(0)
  })
})

describe('quick actions', () => {
  it('offers split only without a selection', () => {
    expect(quickActionsFor(null)).toEqual(['split'])
  })

  it('offers mute only for video clips, slip for timed media and replace only for media', () => {
    const edits = ['close-gaps', 'ripple', 'delete']
    expect(quickActionsFor(createMediaItem(video, 0, 30))).toEqual(['split', 'duplicate', 'mute', 'slip', 'replace', ...edits])
    expect(quickActionsFor(createMediaItem(image, 0, 30))).toEqual(['split', 'duplicate', 'replace', ...edits])
    expect(quickActionsFor(createMediaItem(audio, 0, 30))).toEqual(['split', 'duplicate', 'slip', 'replace', ...edits])
    expect(quickActionsFor(createGraphicItem('hype-title', 0, 30))).toEqual(['split', 'duplicate', ...edits])
  })
})

describe('formatMediaDuration', () => {
  it('formats as m:ss', () => {
    expect(formatMediaDuration(134_000)).toBe('2:14')
    expect(formatMediaDuration(5_400)).toBe('0:05')
    expect(formatMediaDuration(null)).toBe('')
  })
})

describe('timeline display order', () => {
  it('lists the frontmost visual layer first and keeps audio at the bottom', () => {
    const tracks = [
      { id: 'video', kind: 'video' as const },
      { id: 'graphics', kind: 'graphics' as const },
      { id: 'audio', kind: 'audio' as const },
      { id: 'overlay', kind: 'video' as const },
      { id: 'audio-2', kind: 'audio' as const },
    ]
    expect(timelineDisplayOrder(tracks).map(track => track.id)).toEqual(['overlay', 'graphics', 'video', 'audio', 'audio-2'])
  })

  it('does not reorder the input array', () => {
    const tracks = [{ kind: 'video' as const }, { kind: 'graphics' as const }]
    timelineDisplayOrder(tracks)
    expect(tracks.map(track => track.kind)).toEqual(['video', 'graphics'])
  })
})

describe('resizable panels', () => {
  const desktop = { width: 1440, height: 900, rail: 76, inspectorVisible: true }

  it('keeps each panel within its limits', () => {
    expect(clampPanelSizes({ side: 50, inspector: 5000, timeline: 20 }, desktop)).toEqual({ side: 220, inspector: 480, timeline: 160 })
    // Timeline can take at most 65% of the height and must leave the workspace its minimum.
    expect(clampPanelSizes({ side: 300, inspector: 320, timeline: 5000 }, desktop).timeline).toBe(542)
    expect(clampPanelSizes({ side: 300, inspector: 320, timeline: 5000 }, { ...desktop, height: 2000 }).timeline).toBe(1300)
  })

  it('leaves the preview its minimum width, shrinking the panel not being dragged first', () => {
    const narrow = { ...desktop, width: 1100 }
    const available = narrow.width - narrow.rail - MIN_PREVIEW_WIDTH
    const sideFirst = clampPanelSizes({ side: 480, inspector: 480, timeline: 300 }, narrow, 'side')
    expect(sideFirst).toMatchObject({ side: 444, inspector: 260 })
    expect(sideFirst.side + sideFirst.inspector).toBeLessThanOrEqual(available)
    const inspectorFirst = clampPanelSizes({ side: 480, inspector: 480, timeline: 300 }, narrow, 'inspector')
    expect(inspectorFirst).toMatchObject({ side: 224, inspector: 480 })
  })

  it('ignores the inspector while it is hidden', () => {
    const compact = { width: 900, height: 800, rail: 64, inspectorVisible: false }
    expect(clampPanelSizes({ side: 480, inspector: 480, timeline: 300 }, compact).side).toBe(480)
    expect(clampPanelSizes({ side: 480, inspector: 480, timeline: 300 }, { ...compact, width: 700 }).side).toBe(316)
  })

  it('scales the default timeline with the window and reads stored sizes defensively', () => {
    expect(defaultPanelSizes(900).timeline).toBe(306)
    expect(defaultPanelSizes(500).timeline).toBe(220)
    expect(parsePanelSizes('{"side":250,"inspector":"wide","timeline":null}')).toEqual({ side: 250 })
    expect(parsePanelSizes('not json')).toEqual({})
    expect(parsePanelSizes(null)).toEqual({})
  })
})
