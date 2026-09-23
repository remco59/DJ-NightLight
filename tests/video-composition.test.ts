import { existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { BRAND_LOGOS } from '../remotion/brand-logo'
import { MOTION_TEMPLATE_COMPONENTS } from '../remotion/motion-templates'
import { animationState } from '../remotion/animation'
import { MOTION_TEMPLATE_KEYS } from '../shared/video-templates'

describe('remotion project composition', () => {
  it('implements every motion template', () => {
    expect(Object.keys(MOTION_TEMPLATE_COMPONENTS).sort()).toEqual([...MOTION_TEMPLATE_KEYS].sort())
  })

  it('ships every logo layer the electric templates animate', () => {
    for (const [logo, spec] of Object.entries(BRAND_LOGOS)) {
      for (const layer of Object.keys(spec.layers)) {
        expect(existsSync(`public/brand/logo/${logo}-${layer}.webp`), `${logo}-${layer}`).toBe(true)
      }
      expect(existsSync(`public/brand/logo/${logo}-thumb.webp`)).toBe(true)
    }
  })

  it('animates entrances and exits and rests in between', () => {
    const base = { duration: 90, entrance: 'fade' as const, exit: 'fade' as const, entranceFrames: 15, exitFrames: 15 }
    expect(animationState({ ...base, frame: 0 }).opacity).toBe(0)
    expect(animationState({ ...base, frame: 45 })).toEqual({ opacity: 1, translateX: 0, translateY: 0, scale: 1, skew: 0, blur: 0 })
    expect(animationState({ ...base, frame: 80 }).opacity).toBeLessThan(1)
    expect(animationState({ ...base, frame: 89 }).opacity).toBe(0)
    expect(animationState({ ...base, frame: 0, entrance: 'none' }).opacity).toBe(1)
  })

  it('clamps animation windows on very short items', () => {
    const state = animationState({ frame: 2, duration: 4, entrance: 'zoom', exit: 'zoom-out', entranceFrames: 60, exitFrames: 60 })
    expect(state.opacity).toBeGreaterThan(0)
    expect(state.opacity).toBeLessThanOrEqual(1)
  })
})
