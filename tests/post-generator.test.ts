import { describe, expect, it } from 'vitest'
import {
  coverImageRect,
  defaultPostGigItems,
  defaultPostVisibility,
  postImageDragDelta,
  POST_PRESETS,
  POST_TEMPLATE_KEYS,
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

  it('includes the editable NightLight campaign templates', () => {
    expect(POST_TEMPLATE_KEYS).toContain('gig-announcement')
    expect(POST_TEMPLATE_KEYS).toContain('recap')
    expect(POST_TEMPLATE_KEYS).toContain('upcoming-gigs')
  })

  it('starts editable fields visible and provides planning rows', () => {
    expect(defaultPostVisibility()).toMatchObject({
      logo: true,
      headline: true,
      subline: true,
      date: true,
      time: true,
      location: true,
      cta: true,
      gigList: true,
    })
    const gigs = defaultPostGigItems()
    expect(gigs).toHaveLength(4)
    expect(gigs.every(item => item.enabled)).toBe(true)
  })

  it('maps preview drag distance to normalized image positioning', () => {
    const delta = postImageDragDelta({
      deltaX: 50,
      deltaY: -25,
      displayWidth: 540,
      displayHeight: 960,
      targetWidth: 1080,
      targetHeight: 1920,
      renderedWidth: 2160,
      renderedHeight: 2400,
    })
    expect(delta.x).toBeCloseTo(50 * 2 / (1080 * .5))
    expect(delta.y).toBeCloseTo(-25 * 2 / (480 * .5))
  })

  it('does not move on an axis without crop overflow', () => {
    const delta = postImageDragDelta({
      deltaX: 80,
      deltaY: 80,
      displayWidth: 540,
      displayHeight: 540,
      targetWidth: 1080,
      targetHeight: 1080,
      renderedWidth: 1080,
      renderedHeight: 1600,
    })
    expect(delta.x).toBe(0)
    expect(delta.y).toBeGreaterThan(0)
  })
})
