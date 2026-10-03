import { describe, expect, it } from 'vitest'
import { createGraphicItem, createMediaItem, createVideoProject, parseVideoProject, type TimelineItem } from '../shared/video-project'
import {
  clearKeyframes,
  itemOpacityAt,
  itemTransformAt,
  itemVolumeAt,
  keyframeFrames,
  keyframePropsFor,
  moveKeyframes,
  rebaseKeyframes,
  setKeyframeEasing,
  setValueAt,
  toggleKeyframe,
  valueAt,
} from '../shared/video-keyframes'
import { splitItem, trimItem } from '../shared/video-timeline'

const clipAsset = { id: '11111111-1111-4111-8111-111111111111', mimeType: 'video/mp4', durationMs: 10_000 }

function graphic() {
  const item = createGraphicItem('gig-announcement', 0, 30)
  item.duration = 90
  return item as TimelineItem
}

describe('keyframes', () => {
  it('uses the static value without keyframes', () => {
    const item = graphic()
    expect(valueAt(item, 'x', 10)).toBe(0)
    expect(itemOpacityAt(item, 10)).toBe(1)
  })

  it('interpolates linearly and holds outside the keyframes', () => {
    const item = graphic()
    toggleKeyframe(item, 'x', 0)
    setValueAt(item, 'x', 0, 0)
    toggleKeyframe(item, 'x', 30)
    setValueAt(item, 'x', 30, 300)
    expect(valueAt(item, 'x', 15)).toBe(150)
    expect(valueAt(item, 'x', 60)).toBe(300)
    expect(itemTransformAt(item as never, 15).x).toBe(150)
  })

  it('applies easing of the segment start and hold', () => {
    const item = graphic()
    toggleKeyframe(item, 'opacity', 0)
    setValueAt(item, 'opacity', 0, 0)
    toggleKeyframe(item, 'opacity', 20)
    setValueAt(item, 'opacity', 20, 1)
    setKeyframeEasing(item, 0, 'ease-in')
    expect(valueAt(item, 'opacity', 10)).toBeCloseTo(0.25)
    setKeyframeEasing(item, 0, 'hold')
    expect(valueAt(item, 'opacity', 19)).toBe(0)
    expect(valueAt(item, 'opacity', 20)).toBe(1)
  })

  it('editing an animated property changes the keyframe, not the static value', () => {
    const item = graphic()
    toggleKeyframe(item, 'scale', 10)
    setValueAt(item, 'scale', 40, 2)
    expect(item.type === 'graphic' && item.transform.scale).toBe(1)
    expect(keyframeFrames(item)).toEqual([10, 40])
  })

  it('removing the last keyframe bakes its value into the static one', () => {
    const item = graphic()
    toggleKeyframe(item, 'x', 5)
    setValueAt(item, 'x', 5, 120)
    expect(toggleKeyframe(item, 'x', 5)).toBe(false)
    expect(item.keyframes).toBeUndefined()
    expect(valueAt(item, 'x', 0)).toBe(120)
  })

  it('clamps to the property range and only offers properties the item has', () => {
    const item = graphic()
    toggleKeyframe(item, 'opacity', 0)
    setValueAt(item, 'opacity', 0, 5)
    expect(valueAt(item, 'opacity', 0)).toBe(1)
    expect(keyframePropsFor(item)).not.toContain('volume')
    expect(keyframePropsFor({ type: 'audio' })).toEqual(['volume'])
  })

  it('moves and clears keyframes', () => {
    const item = graphic()
    toggleKeyframe(item, 'x', 10)
    toggleKeyframe(item, 'y', 10)
    moveKeyframes(item, 10, 25)
    expect(keyframeFrames(item)).toEqual([25])
    clearKeyframes(item)
    expect(item.keyframes).toBeUndefined()
  })

  it('animates video volume', () => {
    const clip = createMediaItem(clipAsset, 0, 30)
    toggleKeyframe(clip, 'volume', 0)
    setValueAt(clip, 'volume', 0, 0)
    toggleKeyframe(clip, 'volume', 30)
    setValueAt(clip, 'volume', 30, 1)
    expect(itemVolumeAt(clip, 15)).toBeCloseTo(0.5)
  })

  it('rebases when the head is cut off, keeping the value at the new start', () => {
    const item = graphic()
    toggleKeyframe(item, 'x', 0)
    setValueAt(item, 'x', 0, 0)
    toggleKeyframe(item, 'x', 40)
    setValueAt(item, 'x', 40, 400)
    rebaseKeyframes(item, 20)
    expect(valueAt(item, 'x', 0)).toBe(200)
    expect(valueAt(item, 'x', 20)).toBe(400)
    expect(keyframeFrames(item)).toEqual([0, 20])
  })
})

describe('keyframes in timeline operations', () => {
  function projectWithAnimatedClip() {
    const project = createVideoProject()
    const clip = createMediaItem(clipAsset, 0, 30)
    clip.duration = 120
    toggleKeyframe(clip, 'x', 0)
    toggleKeyframe(clip, 'x', 100)
    setValueAt(clip, 'x', 100, 500)
    project.tracks[0]!.items = [clip]
    return { project, clip }
  }

  it('split keeps the animation continuous across the cut', () => {
    const { project, clip } = projectWithAnimatedClip()
    const result = splitItem(project, clip.id, 50)
    const [head, tail] = result.project.tracks[0]!.items
    expect(valueAt(head!, 'x', 49)).toBeCloseTo(245)
    expect(valueAt(tail!, 'x', 0)).toBeCloseTo(250)
    expect(valueAt(tail!, 'x', 50)).toBe(500)
  })

  it('trimming the start shifts keyframes so the animation stays in place', () => {
    const { project, clip } = projectWithAnimatedClip()
    const next = trimItem(project, clip.id, 'start', 20, () => 300)
    const trimmed = next.tracks[0]!.items[0]!
    expect(trimmed.start).toBe(20)
    expect(valueAt(trimmed, 'x', 0)).toBeCloseTo(100)
  })

  it('projects with keyframes validate; unsorted or out-of-range ones do not', () => {
    const { project } = projectWithAnimatedClip()
    const clip = project.tracks[0]!.items[0]! as never as { assetId: string }
    clip.assetId = clipAsset.id
    expect(() => parseVideoProject(project)).not.toThrow()
    const bad = JSON.parse(JSON.stringify(project))
    bad.tracks[0].items[0].keyframes.x = [{ frame: 10, value: 0, easing: 'linear' }, { frame: 5, value: 0, easing: 'linear' }]
    expect(() => parseVideoProject(bad)).toThrow()
    const outOfRange = JSON.parse(JSON.stringify(project))
    outOfRange.tracks[0].items[0].keyframes.x = [{ frame: 0, value: 99999, easing: 'linear' }]
    expect(() => parseVideoProject(outOfRange)).toThrow()
  })
})
