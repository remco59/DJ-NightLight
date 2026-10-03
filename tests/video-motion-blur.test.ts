import { describe, expect, it } from 'vitest'
import { createGraphicItem, createMediaItem, createVideoProject, parseVideoProject } from '../shared/video-project'
import { setValueAt, toggleKeyframe } from '../shared/video-keyframes'
import { blurSamples, itemBlurStrength, itemMoves, projectMotionBlur, shutterAngle } from '../shared/video-motion-blur'

const asset = { id: '11111111-1111-4111-8111-111111111111', mimeType: 'video/mp4', durationMs: 10_000 }

describe('motion blur settings', () => {
  it('is off for projects without settings', () => {
    const project = createVideoProject()
    expect(projectMotionBlur(project).enabled).toBe(false)
    expect(itemBlurStrength(project, createMediaItem(asset, 0, 30))).toBe(0)
  })

  it('uses the project strength unless the item overrides it', () => {
    const project = { ...createVideoProject(), motionBlur: { enabled: true, strength: 0.5, quality: 'high' as const } }
    const clip = createMediaItem(asset, 0, 30)
    expect(itemBlurStrength(project, clip)).toBe(0.5)
    clip.motionBlur = 0
    expect(itemBlurStrength(project, clip)).toBe(0)
    clip.motionBlur = 0.8
    expect(itemBlurStrength(project, clip)).toBe(0.8)
    expect(blurSamples(project)).toBe(16)
    expect(shutterAngle(0.5)).toBe(180)
  })

  it('never blurs audio', () => {
    const project = { ...createVideoProject(), motionBlur: { enabled: true, strength: 1, quality: 'low' as const } }
    expect(itemBlurStrength(project, createMediaItem({ ...asset, mimeType: 'audio/mpeg' }, 0, 30))).toBe(0)
  })
})

describe('itemMoves', () => {
  it('is false for a still clip and a constant keyframe, true once a transform value changes', () => {
    const clip = createMediaItem(asset, 0, 30)
    expect(itemMoves(clip)).toBe(false)
    toggleKeyframe(clip, 'x', 0)
    expect(itemMoves(clip)).toBe(false)
    toggleKeyframe(clip, 'x', 20)
    setValueAt(clip, 'x', 20, 200)
    expect(itemMoves(clip)).toBe(true)
  })

  it('ignores opacity and volume animation', () => {
    const clip = createMediaItem(asset, 0, 30)
    toggleKeyframe(clip, 'opacity', 0)
    toggleKeyframe(clip, 'opacity', 10)
    setValueAt(clip, 'opacity', 10, 0)
    expect(itemMoves(clip)).toBe(false)
  })

  it('counts graphics with an entrance or exit animation', () => {
    const graphic = createGraphicItem('gig-announcement', 0, 30)
    graphic.entrance = 'none'
    graphic.exit = 'none'
    expect(itemMoves(graphic)).toBe(false)
    graphic.entrance = 'whip'
    expect(itemMoves(graphic)).toBe(true)
  })
})

describe('motion blur in the project schema', () => {
  it('accepts valid settings and rejects out-of-range ones', () => {
    const project = createVideoProject()
    expect(() => parseVideoProject({ ...project, motionBlur: { enabled: true, strength: 0.4, quality: 'medium' } })).not.toThrow()
    expect(() => parseVideoProject({ ...project, motionBlur: { enabled: true, strength: 2, quality: 'medium' } })).toThrow()
    expect(() => parseVideoProject({ ...project, motionBlur: { enabled: true, strength: 0.4, quality: 'ultra' } })).toThrow()
    const withItem = JSON.parse(JSON.stringify(project))
    withItem.tracks[1].items[0].motionBlur = 0.3
    expect(() => parseVideoProject(withItem)).not.toThrow()
    withItem.tracks[1].items[0].motionBlur = 3
    expect(() => parseVideoProject(withItem)).toThrow()
  })
})
