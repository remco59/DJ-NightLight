import { describe, expect, it } from 'vitest'
import {
  VIDEO_BRAND_PRESETS,
  VIDEO_MOTION_PRESETS,
  VIDEO_OUTPUT,
  VIDEO_RENDER_STATUSES,
  VIDEO_TEMPLATES,
  canCancelRender,
  canRetryRender,
  defaultVideoGigItems,
  defaultVideoVisibility,
  videoDurationFrames,
} from '../shared/video-generator'

describe('video generator', () => {
  it('renders the requested Reel and Story format', () => {
    expect(VIDEO_OUTPUT).toEqual({
      width: 1080,
      height: 1920,
      fps: 30,
      durationSeconds: 10,
    })
    expect(videoDurationFrames()).toBe(300)
  })

  it('exposes motion-safe templates and presets', () => {
    expect(VIDEO_TEMPLATES).toEqual([
      'spotlight',
      'pulse',
      'slide',
      'gig-announcement',
      'recap',
      'upcoming-gigs',
    ])
    expect(VIDEO_MOTION_PRESETS).toEqual(['smooth', 'energy', 'minimal'])
    expect(VIDEO_BRAND_PRESETS).toEqual(['night', 'mono', 'warm'])
  })

  it('starts with all editable video fields visible', () => {
    expect(defaultVideoVisibility()).toEqual({
      logo: true,
      headline: true,
      subline: true,
      date: true,
      time: true,
      location: true,
      cta: true,
      gigList: true,
    })
  })

  it('provides editable default planning rows', () => {
    const gigs = defaultVideoGigItems()
    expect(gigs).toHaveLength(4)
    expect(gigs.every(item => item.enabled)).toBe(true)
  })

  it('uses explicit persistent queue states', () => {
    expect(VIDEO_RENDER_STATUSES).toEqual(['queued', 'rendering', 'completed', 'failed', 'cancelled'])
  })

  it('cancels any render that has not produced a video, including failed ones', () => {
    expect(VIDEO_RENDER_STATUSES.filter(canCancelRender)).toEqual(['queued', 'rendering', 'failed'])
    expect(VIDEO_RENDER_STATUSES.filter(canRetryRender)).toEqual(['failed', 'cancelled'])
  })
})
