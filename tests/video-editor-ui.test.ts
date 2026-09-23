import { describe, expect, it } from 'vitest'
import { createGraphicItem, createMediaItem } from '../shared/video-project'
import {
  MAX_TIMELINE_ZOOM,
  MIN_TIMELINE_ZOOM,
  clampZoom,
  filterMediaAssets,
  formatMediaDuration,
  pinchZoom,
  quickActionsFor,
} from '../shared/video-editor-ui'

const video = { id: '11111111-1111-4111-8111-111111111111', mimeType: 'video/mp4', durationMs: 10_000 }
const image = { id: '22222222-2222-4222-8222-222222222222', mimeType: 'image/jpeg', durationMs: null }
const audio = { id: '33333333-3333-4333-8333-333333333333', mimeType: 'audio/mpeg', durationMs: 60_000 }

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

  it('offers mute only for video clips and replace only for media', () => {
    expect(quickActionsFor(createMediaItem(video, 0, 30))).toEqual(['split', 'duplicate', 'mute', 'replace', 'delete'])
    expect(quickActionsFor(createMediaItem(image, 0, 30))).toEqual(['split', 'duplicate', 'replace', 'delete'])
    expect(quickActionsFor(createMediaItem(audio, 0, 30))).toEqual(['split', 'duplicate', 'replace', 'delete'])
    expect(quickActionsFor(createGraphicItem('hype-title', 0, 30))).toEqual(['split', 'duplicate', 'delete'])
  })
})

describe('formatMediaDuration', () => {
  it('formats as m:ss', () => {
    expect(formatMediaDuration(134_000)).toBe('2:14')
    expect(formatMediaDuration(5_400)).toBe('0:05')
    expect(formatMediaDuration(null)).toBe('')
  })
})
