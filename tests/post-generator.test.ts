import { describe, expect, it } from 'vitest'
import {
  applyPostTemplate,
  coverImageRect,
  defaultPostDesign,
  defaultPostGigItems,
  defaultPostVisibility,
  postImageDragDelta,
  POST_PRESETS,
  POST_TEMPLATE_KEYS,
  POST_TEMPLATES,
  restorePostDesign,
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

describe('post templates', () => {
  it('describes every template key exactly once', () => {
    expect(POST_TEMPLATES.map(template => template.key).sort()).toEqual([...POST_TEMPLATE_KEYS].sort())
  })

  it('applies a campaign template composition with its sample copy', () => {
    const next = applyPostTemplate(defaultPostDesign(), 'gig-announcement')
    expect(next).toMatchObject({
      templateKey: 'gig-announcement',
      preset: 'story',
      headline: 'DIT WEEKEND',
      timeText: '22:00 – 02:00',
      textAlign: 'center',
      textPosition: 'middle',
    })
    expect(next.visibility.gigList).toBe(false)
    expect(next.visibility.time).toBe(true)
  })

  it('keeps copy the user wrote when switching templates', () => {
    const design = { ...defaultPostDesign(), headline: 'KONINGSNACHT', locationText: 'Leeuwarden' }
    const next = applyPostTemplate(design, 'recap')
    expect(next.headline).toBe('KONINGSNACHT')
    expect(next.locationText).toBe('Leeuwarden')
    // Untouched sample copy is replaced by the new template's sample.
    expect(next.subline).toBe('TERUGBLIK')
    expect(next.visibility.time).toBe(false)
  })

  it('replaces sample copy from another template', () => {
    const gig = applyPostTemplate(defaultPostDesign(), 'gig-announcement')
    const planning = applyPostTemplate(gig, 'upcoming-gigs')
    expect(planning.headline).toBe('DECEMBER')
    expect(planning.ctaText).toBe('TOT OP DE DANSVLOER!')
    expect(planning.dateText).toBe('')
  })

  it('only swaps the style for flexible templates and never mutates the input', () => {
    const design = applyPostTemplate(defaultPostDesign(), 'recap')
    const snapshot = JSON.stringify(design)
    const next = applyPostTemplate(design, 'minimal')
    expect(next).toEqual({ ...design, templateKey: 'minimal' })
    expect(JSON.stringify(design)).toBe(snapshot)
  })

  it('keeps edited gig rows when returning to the planning template', () => {
    const design = defaultPostDesign()
    design.gigItems = [{ enabled: true, dateText: '01 JAN', title: 'Nieuwjaar', locationText: 'Sneek' }]
    expect(applyPostTemplate(design, 'upcoming-gigs').gigItems).toEqual(design.gigItems)
  })
})

describe('restoring a stored design', () => {
  it('loads every valid stored field', () => {
    const stored = applyPostTemplate(defaultPostDesign(), 'recap')
    stored.imageX = .4
    stored.zoom = 2
    stored.brandPreset = 'warm'
    expect(restorePostDesign(defaultPostDesign(), stored)).toEqual({ ...stored, showSafeArea: true })
  })

  it('keeps the current value for missing or invalid fields', () => {
    const base = defaultPostDesign()
    const restored = restorePostDesign(base, {
      preset: 'banner',
      templateKey: 'unknown',
      headline: 42,
      zoom: 9,
      imageY: Number.NaN,
      visibility: { logo: false, headline: 'yes' },
      gigItems: [null, { title: 'Only a title' }],
      showSafeArea: false,
    })
    expect(restored.preset).toBe(base.preset)
    expect(restored.templateKey).toBe(base.templateKey)
    expect(restored.headline).toBe(base.headline)
    expect(restored.zoom).toBe(3)
    expect(restored.imageY).toBe(base.imageY)
    expect(restored.visibility.logo).toBe(false)
    expect(restored.visibility.headline).toBe(true)
    expect(restored.gigItems).toEqual([{ enabled: true, dateText: '', title: 'Only a title', locationText: '' }])
    // Safe-area guides are a view preference, not part of a stored design.
    expect(restored.showSafeArea).toBe(true)
  })

  it('ignores non-object metadata', () => {
    expect(restorePostDesign(defaultPostDesign(), null)).toEqual(defaultPostDesign())
    expect(restorePostDesign(defaultPostDesign(), 'design')).toEqual(defaultPostDesign())
  })
})
