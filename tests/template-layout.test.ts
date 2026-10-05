import { describe, expect, it } from 'vitest'
import { safeInsets } from '../shared/template-layout'

describe('template safe insets', () => {
  it('keeps content above Instagram UI on 9:16 canvases', () => {
    const safe = safeInsets(1080, 1920)
    expect(safe.bottom).toBeGreaterThanOrEqual(350)
    expect(safe.top).toBeGreaterThanOrEqual(200)
  })

  it('only keeps a small margin on square, portrait and landscape canvases', () => {
    for (const [w, h] of [[1080, 1080], [1080, 1350], [1920, 1080]] as const) {
      expect(safeInsets(w, h)).toEqual({ top: 90, bottom: 90 })
    }
  })
})
