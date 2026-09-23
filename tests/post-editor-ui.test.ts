import { describe, expect, it } from 'vitest'
import { POST_PRESETS } from '../shared/post-generator'
import {
  clampPostZoom,
  fitPreviewSize,
  pinchPostZoom,
  resolveSheetSnap,
  sheetSnapHeights,
} from '../shared/post-editor-ui'

describe('fitPreviewSize', () => {
  it.each(Object.entries(POST_PRESETS))('keeps the whole %s design inside the preview area', (_key, preset) => {
    for (const [availableWidth, availableHeight] of [[360, 620], [360, 280], [900, 400]]) {
      const fit = fitPreviewSize({ availableWidth, availableHeight, designWidth: preset.width, designHeight: preset.height })
      expect(fit.width).toBeLessThanOrEqual(availableWidth)
      expect(fit.height).toBeLessThanOrEqual(availableHeight)
      expect(fit.width === Math.floor(availableWidth) || fit.height === Math.floor(availableHeight)).toBe(true)
      expect(fit.width / fit.height).toBeCloseTo(preset.width / preset.height, 1)
    }
  })

  it('returns an empty size for missing space or dimensions', () => {
    expect(fitPreviewSize({ availableWidth: -10, availableHeight: 200, designWidth: 1080, designHeight: 1080 }))
      .toMatchObject({ width: 0, height: 0 })
    expect(fitPreviewSize({ availableWidth: 300, availableHeight: 200, designWidth: 0, designHeight: 1080 }))
      .toEqual({ width: 0, height: 0, scale: 0 })
  })
})

describe('bottom sheet snapping', () => {
  it('sizes the normal and expanded snap points from the viewport', () => {
    expect(sheetSnapHeights({ viewportHeight: 800, workspaceHeight: 680 })).toEqual({ closed: 0, normal: 336, expanded: 640 })
  })

  it('keeps room for the preview above a normal sheet on short screens', () => {
    const snaps = sheetSnapHeights({ viewportHeight: 500, workspaceHeight: 330 })
    expect(snaps.normal).toBe(170)
    expect(snaps.expanded).toBe(330)
  })

  it('settles on the nearest snap point after a slow drag', () => {
    const snaps = { closed: 0, normal: 340, expanded: 640 }
    expect(resolveSheetSnap({ height: 120, velocity: 0, snaps })).toBe('closed')
    expect(resolveSheetSnap({ height: 400, velocity: 0, snaps })).toBe('normal')
    expect(resolveSheetSnap({ height: 560, velocity: 0, snaps })).toBe('expanded')
  })

  it('follows the direction of a quick flick', () => {
    const snaps = { closed: 0, normal: 340, expanded: 640 }
    expect(resolveSheetSnap({ height: 360, velocity: 1.2, snaps })).toBe('expanded')
    expect(resolveSheetSnap({ height: 320, velocity: -1.2, snaps })).toBe('closed')
    expect(resolveSheetSnap({ height: 600, velocity: -1.2, snaps })).toBe('normal')
  })
})

describe('pinch zoom', () => {
  it('scales zoom by the finger distance ratio within bounds', () => {
    expect(pinchPostZoom(1.5, 100, 150)).toBeCloseTo(2.25)
    expect(pinchPostZoom(1, 100, 50)).toBe(1)
    expect(pinchPostZoom(2, 100, 400)).toBe(3)
    expect(pinchPostZoom(1.4, 0, 100)).toBe(1.4)
    expect(clampPostZoom(Number.NaN)).toBe(1)
  })
})
