import { describe, expect, it } from 'vitest'
import {
  coverImageRect,
  POST_PRESETS,
  safeAreaInsets,
} from '../shared/post-generator'

describe('post generator', () => {
  it('uses the exact social export dimensions', () => {
    expect(POST_PRESETS.square).toMatchObject({ width: 1080, height: 1080 })
    expect(POST_PRESETS.portrait).toMatchObject({ width: 1080, height: 1350 })
    expect(POST_PRESETS.story).toMatchObject({ width: 1080, height: 1920 })
  })

  it('covers the output canvas without exposing empty background', () => {
    const rect = coverImageRect({
      sourceWidth: 1920,
      sourceHeight: 1080,
      targetWidth: 1080,
      targetHeight: 1920,
      zoom: 1,
      imageX: 0,
      imageY: 0,
    })
    expect(rect.width).toBeGreaterThanOrEqual(1080)
    expect(rect.height).toBeGreaterThanOrEqual(1920)
    expect(rect.x).toBeLessThanOrEqual(0)
    expect(rect.y).toBeLessThanOrEqual(0)
  })

  it('clamps zoom and positioning controls', () => {
    const rect = coverImageRect({
      sourceWidth: 1000,
      sourceHeight: 1000,
      targetWidth: 1080,
      targetHeight: 1080,
      zoom: 99,
      imageX: 99,
      imageY: -99,
    })
    expect(rect.width).toBe(3240)
    expect(rect.height).toBe(3240)
    expect(rect.x).toBe(0)
    expect(rect.y).toBe(1080 - 3240)
  })

  it('reserves extra story space for social UI', () => {
    const square = safeAreaInsets('square')
    const story = safeAreaInsets('story')
    expect(story.top).toBeGreaterThan(square.top)
    expect(story.bottom).toBeGreaterThan(square.bottom)
  })
})
