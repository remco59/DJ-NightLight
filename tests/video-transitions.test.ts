import { describe, expect, it } from 'vitest'
import { TRANSITION_LOOKS, transitionLook } from '../remotion/transitions'
import { createGraphicItem, createMediaItem, createVideoProject, findItem, parseVideoProject, type ImageClipItem, type VideoClipItem, type VideoProject } from '../shared/video-project'
import { addItem, adjacentClip, setClipTransition, splitItem } from '../shared/video-timeline'
import {
  MAX_TRANSITION_FRAMES,
  TRANSITIONS,
  TRANSITION_GROUPS,
  TRANSITION_KEYS,
  createTransition,
  maxTransitionFrames,
  tailFrames,
  transitionAt,
  transitionFrames,
  transitionTotalFrames,
} from '../shared/video-transitions'

const asset = { id: '11111111-1111-4111-8111-111111111111', mimeType: 'video/mp4', durationMs: 10_000 }
const photo = { id: '22222222-2222-4222-8222-222222222222', mimeType: 'image/jpeg', durationMs: null }

function projectWithCut() {
  let project = createVideoProject()
  project.tracks[1]!.items = []
  const track = project.tracks[0]!
  const a = { ...createMediaItem(asset, 0, 30), duration: 90 }
  const b = { ...createMediaItem(photo, 90, 30), duration: 60 }
  project = addItem(project, track.id, a)
  project = addItem(project, track.id, b)
  return { project, a, b, trackId: track.id }
}

const clip = (project: VideoProject, id: string) => findItem(project, id)!.item as VideoClipItem | ImageClipItem

describe('transition registry', () => {
  it('describes every transition and puts it in a known group', () => {
    for (const key of TRANSITION_KEYS) {
      const definition = TRANSITIONS[key]
      expect(definition.label, key).toBeTruthy()
      expect(definition.icon, key).toMatch(/^lucide:/)
      expect(Object.keys(TRANSITION_GROUPS), key).toContain(definition.group)
      expect(definition.defaultSeconds, key).toBeGreaterThan(0)
    }
  })

  it('has a look for every transition', () => {
    expect(Object.keys(TRANSITION_LOOKS).sort()).toEqual([...TRANSITION_KEYS].sort())
  })

  it('creates a transition at its default length', () => {
    expect(createTransition('fade', 30)).toEqual({ key: 'fade', frames: 18 })
    expect(createTransition('whoosh-left', 60).frames).toBe(27)
    for (const key of TRANSITION_KEYS) {
      const { frames } = createTransition(key, 60)
      expect(frames).toBeGreaterThanOrEqual(1)
      expect(frames).toBeLessThanOrEqual(MAX_TRANSITION_FRAMES)
    }
  })
})

describe('transition timing', () => {
  const host = { duration: 90, transitionIn: { key: 'dip' as const, frames: 15 }, transitionOut: { key: 'glitch' as const, frames: 20 } }

  it('is idle between the two halves', () => {
    expect(transitionAt(host, 15)).toBeNull()
    expect(transitionAt(host, 45)).toBeNull()
    expect(transitionAt(host, 69)).toBeNull()
    expect(transitionAt({ duration: 90 }, 0)).toBeNull()
  })

  it('runs the start half from the cut state down to settled', () => {
    const first = transitionAt(host, 0)!
    expect(first).toMatchObject({ key: 'dip', edge: 'in', underlay: false })
    expect(first.amount).toBeGreaterThan(0.9)
    expect(first.amount).toBeLessThan(1)
    const amounts = Array.from({ length: 15 }, (_, frame) => transitionAt(host, frame)!.amount)
    expect([...amounts].sort((a, b) => b - a)).toEqual(amounts)
    expect(amounts.at(-1)).toBeGreaterThan(0)
  })

  it('runs the end half from settled up to the cut state', () => {
    const last = transitionAt(host, 89)!
    expect(last).toMatchObject({ key: 'glitch', edge: 'out' })
    expect(last.amount).toBeLessThan(1)
    expect(last.amount).toBeGreaterThan(0.9)
    const amounts = Array.from({ length: 20 }, (_, index) => transitionAt(host, 70 + index)!.amount)
    expect([...amounts].sort((a, b) => a - b)).toEqual(amounts)
  })

  it('meets in the same state on both sides of a cut of equal halves', () => {
    const outgoing = { duration: 60, transitionOut: { key: 'dip' as const, frames: 12 } }
    const incoming = { duration: 60, transitionIn: { key: 'dip' as const, frames: 12 } }
    expect(transitionAt(outgoing, 59)!.amount).toBeCloseTo(transitionAt(incoming, 0)!.amount, 10)
  })

  it('clamps both halves of a short clip so they never overlap', () => {
    const short = { duration: 10, transitionIn: { key: 'dip' as const, frames: 100 }, transitionOut: { key: 'dip' as const, frames: 100 } }
    expect(transitionFrames(short, 'in')).toBe(5)
    expect(transitionFrames(short, 'out')).toBe(5)
    expect(transitionAt(short, 4)!.edge).toBe('in')
    expect(transitionAt(short, 5)!.edge).toBe('out')
    expect(maxTransitionFrames({ duration: 10 }, 'dip')).toBe(5)
    expect(maxTransitionFrames({ duration: 3 }, 'dip')).toBe(1)
    expect(maxTransitionFrames({ duration: 10_000 }, 'dip')).toBe(MAX_TRANSITION_FRAMES)
  })

  it('lets an overlap transition use the whole clip', () => {
    const clip = { duration: 10, transitionIn: { key: 'fade' as const, frames: 100 } }
    expect(transitionFrames(clip, 'in')).toBe(10)
    expect(maxTransitionFrames(clip, 'fade')).toBe(10)
    expect(transitionAt(clip, 9)).toMatchObject({ edge: 'in' })
  })

  it('reports how long a cut lasts on screen', () => {
    expect(transitionTotalFrames({ key: 'glitch', frames: 10 })).toBe(20)
    expect(transitionTotalFrames({ key: 'whoosh-left', frames: 10 })).toBe(10)
  })
})

describe('overlap transitions', () => {
  const incoming = { duration: 60, transitionIn: { key: 'whoosh-left' as const, frames: 12 } }
  const outgoing = { duration: 90, transitionOut: { key: 'whoosh-left' as const, frames: 12 } }

  it('keeps the outgoing clip on screen past its end for as long as the transition runs', () => {
    expect(tailFrames(incoming)).toBe(12)
    expect(transitionAt(outgoing, 89, incoming)).toBeNull()
    expect(transitionAt(outgoing, 90, incoming)).toMatchObject({ key: 'whoosh-left', edge: 'out', underlay: true })
    expect(transitionAt(outgoing, 101, incoming)).toMatchObject({ edge: 'out', underlay: true })
    expect(transitionAt(outgoing, 102, incoming)).toBeNull()
  })

  it('has the held clip leave exactly as fast as the incoming clip arrives', () => {
    for (let frame = 0; frame < 12; frame++) {
      const held = transitionAt(outgoing, 90 + frame, incoming)!
      const arriving = transitionAt(incoming, frame)!
      expect(held.amount + arriving.amount).toBeCloseTo(1, 10)
    }
  })

  it('does not play the outgoing clip\'s own end half on top of the held tail', () => {
    for (let frame = 60; frame < 90; frame++) expect(transitionAt(outgoing, frame, incoming)).toBeNull()
  })

  it('needs no tail for a through transition, a plain cut or a missing neighbour', () => {
    expect(tailFrames({ duration: 60, transitionIn: { key: 'glitch', frames: 12 } })).toBe(0)
    expect(tailFrames({ duration: 60 })).toBe(0)
    expect(tailFrames(null)).toBe(0)
    expect(transitionAt(outgoing, 85, { duration: 60, transitionIn: { key: 'glitch', frames: 12 } })).toMatchObject({ edge: 'out', underlay: false })
  })

  it('lets a clip with no neighbour leave into the background as usual', () => {
    expect(transitionAt(outgoing, 85)).toMatchObject({ key: 'whoosh-left', edge: 'out', underlay: false })
  })
})

describe('transition looks', () => {
  const context = { amount: 0.5, edge: 'out' as const, frame: 5, seed: 'it_abc', width: 1080, height: 1920, unit: 1, underlay: false }

  it('leave a settled clip untouched', () => {
    for (const key of TRANSITION_KEYS) {
      const look = transitionLook(key, { ...context, amount: 0 })
      expect(look.opacity ?? 1, key).toBe(1)
      expect(look.x ?? 0, key).toBeCloseTo(0)
      expect(look.y ?? 0, key).toBeCloseTo(0)
      expect(look.scale ?? 1, key).toBe(1)
      expect(look.blur ?? 0, key).toBe(0)
      expect(look.overlay?.opacity ?? 0, key).toBe(0)
    }
  })

  it('only produce finite numbers across the whole range', () => {
    for (const key of TRANSITION_KEYS) {
      for (const edge of ['in', 'out'] as const) {
        for (let amount = 0; amount <= 1; amount += 0.1) {
          for (let frame = 0; frame < 6; frame++) {
            const look = transitionLook(key, { ...context, amount, edge, frame })
            for (const [name, value] of Object.entries(look)) {
              if (typeof value === 'number') expect(Number.isFinite(value), `${key} ${name}`).toBe(true)
            }
          }
        }
      }
    }
  })

  it('dips to nothing at the cut', () => {
    expect(transitionLook('dip', { ...context, amount: 1 }).opacity).toBe(0)
  })

  it('crossfades by fading the incoming clip over a held outgoing one', () => {
    expect(transitionLook('fade', { ...context, edge: 'in', amount: 1 }).opacity).toBe(0)
    expect(transitionLook('fade', { ...context, edge: 'in', amount: 0.25 }).opacity).toBe(0.75)
    expect(transitionLook('fade', { ...context, edge: 'out', amount: 0.5, underlay: true }).opacity ?? 1).toBe(1)
    // Leaving into the background there is nothing beneath to fade into.
    expect(transitionLook('fade', { ...context, edge: 'out', amount: 0.5, underlay: false }).opacity).toBe(0.5)
  })

  it('pushes the outgoing clip one way and the incoming clip in from the other', () => {
    const out = transitionLook('whoosh-left', { ...context, edge: 'out', amount: 1 })
    const into = transitionLook('whoosh-left', { ...context, edge: 'in', amount: 1 })
    expect(out.x).toBe(-1080)
    expect(into.x).toBe(1080)
    expect(transitionLook('whoosh-right', { ...context, edge: 'out', amount: 1 }).x).toBe(1080)
    expect(transitionLook('whoosh-up', { ...context, edge: 'out', amount: 1 }).y).toBe(-1920)
    expect(transitionLook('whoosh-down', { ...context, edge: 'out', amount: 1 }).y).toBe(1920)
    expect(transitionLook('whoosh-left', { ...context, amount: 0 }).x ?? 0).toBeCloseTo(0)
  })

  it('keeps the pushed clips edge to edge, tucked slightly under each other mid-push', () => {
    for (const key of ['whoosh-left', 'whoosh-right'] as const) {
      for (let step = 0; step <= 20; step++) {
        const progress = step / 20
        const held = transitionLook(key, { ...context, edge: 'out', amount: progress, underlay: true })
        const arriving = transitionLook(key, { ...context, edge: 'in', amount: 1 - progress })
        const gap = Math.abs(arriving.x! - held.x!)
        expect(gap, `${key} ${progress}`).toBeLessThanOrEqual(1080 + 1e-6)
        expect(gap, `${key} ${progress}`).toBeGreaterThanOrEqual(1080 * 0.85)
      }
    }
  })

  it('smears most when moving fastest and not at all at rest', () => {
    const smear = (amount: number) => transitionLook('whoosh-left', { ...context, amount }).blurX!
    expect(smear(0)).toBe(0)
    expect(smear(1)).toBe(0)
    expect(smear(0.5)).toBeGreaterThan(smear(0.2))
    expect(smear(0.5)).toBeGreaterThan(smear(0.8))
    const vertical = transitionLook('whoosh-up', { ...context, amount: 0.5 })
    expect(vertical.blurY).toBeGreaterThan(0)
    expect(vertical.blurX).toBeUndefined()
  })

  it('glitches deterministically per clip and frame', () => {
    const a = transitionLook('glitch', { ...context, amount: 0.8 })
    expect(transitionLook('glitch', { ...context, amount: 0.8 })).toEqual(a)
    expect(transitionLook('glitch', { ...context, amount: 0.8, frame: 6 })).not.toEqual(a)
    expect(transitionLook('glitch', { ...context, amount: 0.8, seed: 'it_other' })).not.toEqual(a)
    expect(a.tear).toBeGreaterThan(0)
    expect(a.rgbSplit).toBeGreaterThan(0)
  })

  it('scales pixel effects with the output size', () => {
    const small = transitionLook('rgb-split', { ...context, amount: 1, unit: 1 })
    const large = transitionLook('rgb-split', { ...context, amount: 1, unit: 2 })
    expect(large.rgbSplit).toBe(small.rgbSplit! * 2)
  })

  it('alternates strobe frames', () => {
    const even = transitionLook('strobe', { ...context, amount: 1, frame: 4 })
    const odd = transitionLook('strobe', { ...context, amount: 1, frame: 5 })
    expect(even.brightness).toBeGreaterThan(1)
    expect(odd.opacity).toBeLessThan(1)
  })
})

describe('transition schema', () => {
  it('accepts transitions on video and image clips and keeps them', () => {
    const { project, a, b } = projectWithCut()
    const edited = setClipTransition(project, b.id, 'in', { key: 'glitch', frames: 10 })
    const parsed = parseVideoProject(JSON.parse(JSON.stringify(edited)))
    expect(clip(parsed, a.id).transitionOut).toEqual({ key: 'glitch', frames: 10 })
    expect(clip(parsed, b.id).transitionIn).toEqual({ key: 'glitch', frames: 10 })
  })

  it('rejects unknown transitions and impossible lengths', () => {
    const { project, a } = projectWithCut()
    const withValue = (value: unknown) => {
      const copy = JSON.parse(JSON.stringify(project))
      copy.tracks[0].items[0].transitionIn = value
      return copy
    }
    expect(() => parseVideoProject(withValue({ key: 'does-not-exist', frames: 10 }))).toThrow()
    expect(() => parseVideoProject(withValue({ key: 'fade', frames: 0 }))).toThrow()
    expect(() => parseVideoProject(withValue({ key: 'fade', frames: MAX_TRANSITION_FRAMES + 1 }))).toThrow()
    expect(() => parseVideoProject(withValue({ key: 'fade', frames: 1.5 }))).toThrow()
    expect(() => parseVideoProject(withValue({ key: 'fade', frames: 12 }))).not.toThrow()
    expect(a.id).toBeTruthy()
  })

  it('keeps parsing projects from before transitions existed', () => {
    const { project } = projectWithCut()
    expect(() => parseVideoProject(JSON.parse(JSON.stringify(project)))).not.toThrow()
  })
})

describe('transition editing', () => {
  it('finds the clip cut directly against an edge', () => {
    const { project, a, b } = projectWithCut()
    expect(adjacentClip(project, b.id, 'in')?.id).toBe(a.id)
    expect(adjacentClip(project, a.id, 'out')?.id).toBe(b.id)
    expect(adjacentClip(project, a.id, 'in')).toBeNull()
    expect(adjacentClip(project, b.id, 'out')).toBeNull()
  })

  it('does not link clips that have a gap between them', () => {
    const { project, b, trackId } = projectWithCut()
    const gap = addItem(project, trackId, { ...createMediaItem(photo, 200, 30), duration: 30 })
    const last = gap.tracks[0]!.items.at(-1)!
    expect(adjacentClip(gap, last.id, 'in')).toBeNull()
    expect(adjacentClip(gap, b.id, 'out')).toBeNull()
  })

  it('sets both halves of a cut at once', () => {
    const { project, a, b } = projectWithCut()
    const next = setClipTransition(project, b.id, 'in', { key: 'whoosh-left', frames: 9 })
    expect(clip(next, b.id).transitionIn).toEqual({ key: 'whoosh-left', frames: 9 })
    expect(clip(next, a.id).transitionOut).toEqual({ key: 'whoosh-left', frames: 9 })
    expect(clip(project, a.id).transitionOut).toBeUndefined()
    const fromTheOtherSide = setClipTransition(project, a.id, 'out', { key: 'fade', frames: 6 })
    expect(clip(fromTheOtherSide, b.id).transitionIn).toEqual({ key: 'fade', frames: 6 })
  })

  it('gives the neighbour its own copy of the transition', () => {
    const { project, a, b } = projectWithCut()
    const next = setClipTransition(project, b.id, 'in', { key: 'fade', frames: 9 })
    expect(clip(next, a.id).transitionOut).not.toBe(clip(next, b.id).transitionIn)
  })

  it('removes both halves of a cut', () => {
    const { project, a, b } = projectWithCut()
    const set = setClipTransition(project, b.id, 'in', { key: 'fade', frames: 9 })
    const cleared = setClipTransition(set, a.id, 'out', null)
    expect(clip(cleared, a.id).transitionOut).toBeUndefined()
    expect(clip(cleared, b.id).transitionIn).toBeUndefined()
  })

  it('leaves a lone edge on its own clip', () => {
    const { project, a, b } = projectWithCut()
    const next = setClipTransition(project, a.id, 'in', { key: 'blur', frames: 12 })
    expect(clip(next, a.id).transitionIn).toEqual({ key: 'blur', frames: 12 })
    expect(clip(next, b.id).transitionIn).toBeUndefined()
    expect(clip(next, a.id).transitionOut).toBeUndefined()
  })

  it('ignores clips that cannot carry a transition', () => {
    const { project } = projectWithCut()
    const graphic = createGraphicItem('gig-announcement', 0, 30)
    const withGraphic = addItem(project, project.tracks[1]!.id, graphic)
    expect(setClipTransition(withGraphic, graphic.id, 'in', { key: 'fade', frames: 9 })).toBe(withGraphic)
    expect(setClipTransition(project, 'missing', 'in', { key: 'fade', frames: 9 })).toBe(project)
  })

  it('keeps the start half on the head of a split and the end half on the tail', () => {
    const { project, a } = projectWithCut()
    let edited = setClipTransition(project, a.id, 'in', { key: 'blur', frames: 9 })
    edited = setClipTransition(edited, a.id, 'out', { key: 'glitch', frames: 9 })
    const { project: split, newItemId } = splitItem(edited, a.id, 40)
    expect(clip(split, a.id).transitionIn).toEqual({ key: 'blur', frames: 9 })
    expect(clip(split, a.id).transitionOut).toBeUndefined()
    expect(clip(split, newItemId!).transitionIn).toBeUndefined()
    expect(clip(split, newItemId!).transitionOut).toEqual({ key: 'glitch', frames: 9 })
  })
})
