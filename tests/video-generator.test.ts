import { describe, expect, it } from 'vitest'
import {
  VIDEO_BRAND_PRESETS,
  VIDEO_MOTION_PRESETS,
  VIDEO_OUTPUT,
  VIDEO_RENDER_STATUSES,
  VIDEO_TEMPLATES,
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
    expect(VIDEO_TEMPLATES).toEqual(['spotlight', 'pulse', 'slide'])
    expect(VIDEO_MOTION_PRESETS).toEqual(['smooth', 'energy', 'minimal'])
    expect(VIDEO_BRAND_PRESETS).toEqual(['night', 'mono', 'warm'])
  })

  it('uses explicit persistent queue states', () => {
    expect(VIDEO_RENDER_STATUSES).toEqual(['queued', 'rendering', 'completed', 'failed'])
  })
})
