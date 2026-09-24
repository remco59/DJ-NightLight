import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_ITEM_SOUND,
  TEMPLATE_SOUNDS,
  TEMPLATE_SOUND_KEYS,
  boltTransitionMid,
  graphicSoundCues,
  hypeTitleLineFrames,
  soundFrames,
  templateHasSound,
} from '../shared/template-sounds'
import { createGraphicItem, createVideoProject, parseVideoProject, type GraphicItem } from '../shared/video-project'
import { MOTION_TEMPLATES, type MotionTemplateKey } from '../shared/video-templates'

function graphic(key: MotionTemplateKey, change: Partial<GraphicItem> = {}): GraphicItem {
  return { ...createGraphicItem(key, 0, 30), ...change }
}

function frames(item: GraphicItem) {
  return graphicSoundCues(item).map(cue => [cue.sound, cue.frame])
}

describe('template sound files', () => {
  it('ships every sound as a WAV of the declared length, with its licence', () => {
    for (const key of TEMPLATE_SOUND_KEYS) {
      const path = `public/${TEMPLATE_SOUNDS[key].file}`
      expect(existsSync(path), path).toBe(true)
      const file = readFileSync(path)
      expect(file.toString('ascii', 0, 4)).toBe('RIFF')
      expect(file.toString('ascii', 8, 12)).toBe('WAVE')
      const byteRate = file.readUInt32LE(28)
      const seconds = file.readUInt32LE(40) / byteRate
      expect(seconds, key).toBeCloseTo(TEMPLATE_SOUNDS[key].seconds, 2)
    }
    expect(existsSync('public/sfx/LICENSE.txt')).toBe(true)
  })

  it('converts sound lengths to project frames', () => {
    expect(soundFrames('impact', 30)).toBe(36)
    expect(soundFrames('impact', 60)).toBe(72)
    expect(soundFrames('punch', 24)).toBe(11)
  })
})

describe('graphic sound cues', () => {
  it('turns sound on for new graphics only', () => {
    expect(createGraphicItem('logo-sting', 0, 30).sound).toEqual(DEFAULT_ITEM_SOUND)
    expect(graphicSoundCues(graphic('logo-sting', { sound: undefined }))).toEqual([])
    expect(graphicSoundCues(graphic('logo-sting', { sound: { enabled: false, volume: 1 } }))).toEqual([])
    expect(graphicSoundCues(graphic('logo-sting', { sound: { enabled: true, volume: 0 } }))).toEqual([])
  })

  it('lands on the template hits in template frames, whatever the fps', () => {
    // Template animations use fixed frame numbers, so the cues do too.
    expect(frames(graphic('neon-logo-reveal'))).toEqual([['impact', 26], ['zap', 27]])
    expect(frames({ ...createGraphicItem('neon-logo-reveal', 0, 60) })).toEqual([['impact', 26], ['zap', 27]])
  })

  it('adds entrance and exit sounds for whip, zoom and glitch', () => {
    const item = graphic('lower-third', { duration: 120, entrance: 'whip', exit: 'whip', exitFrames: 12 })
    const bolt = ['zap', 14]
    expect(frames(item)).toEqual([['whoosh', 0], bolt, ['whoosh', 108]])
    expect(frames({ ...item, entrance: 'glitch', exit: 'fade' })).toEqual([['glitch', 0], bolt])
    expect(frames({ ...item, entrance: 'fade', exit: 'none' })).toEqual([bolt])
    expect(frames({ ...item, entranceFrames: 0, exitFrames: 0 })).toEqual([bolt])
  })

  it('follows the Bolt Transition flash when the item is resized', () => {
    expect(frames(graphic('bolt-transition', { duration: 30 }))).toEqual([['impact', 14], ['zap', 15]])
    expect(frames(graphic('bolt-transition', { duration: 60 }))).toEqual([['impact', 29], ['zap', 30]])
    expect(boltTransitionMid(2)).toBe(3)
  })

  it('punches every Hype Title line', () => {
    const item = graphic('hype-title', { duration: 90, templateProps: { lines: ['A', 'B', '', 'C'] } })
    const lineFrames = hypeTitleLineFrames(90, 3)
    expect(lineFrames).toEqual([0, 18, 36])
    expect(graphicSoundCues(item).filter(cue => cue.sound === 'punch').map(cue => cue.frame)).toEqual(lineFrames)
  })

  it('hits every Clip Recap cut after the first shot', () => {
    const media = ['a', 'b', 'c'].map(letter => `${letter}1111111-1111-4111-8111-111111111111`)
    expect(frames(graphic('clip-recap', { duration: 90, templateProps: { title: '', media } }))).toEqual([['punch', 30], ['punch', 60]])
    expect(frames(graphic('clip-recap', { duration: 90, templateProps: { title: '', media: [] } }))).toEqual([])
    // A title adds its rule frame's bolt strike.
    expect(frames(graphic('clip-recap', { duration: 90, templateProps: { title: 'GISTER', media } }))).toEqual([['zap', 16], ['punch', 30], ['punch', 60]])
  })

  it('drops cues past a shortened item and scales by the item volume', () => {
    expect(frames(graphic('neon-logo-reveal', { duration: 27 }))).toEqual([['impact', 26]])
    const [impact, zap] = graphicSoundCues(graphic('neon-logo-reveal', { sound: { enabled: true, volume: 0.5 } }))
    expect(impact!.volume).toBe(0.5)
    expect(zap!.volume).toBeCloseTo(0.35)
  })

  it('gives every template a sound', () => {
    // Since the Electric restyle every template strikes a bolt or slams something in.
    expect(Object.values(MOTION_TEMPLATES).filter(template => !templateHasSound(template)).map(template => template.key)).toEqual([])
  })

  it('follows the restyled logo builds', () => {
    expect(frames(graphic('logo-sting'))).toEqual([['whoosh', 0], ['impact', 14], ['zap', 15]])
    expect(frames(graphic('gig-announcement'))).toEqual([['punch', 12], ['zap', 19]])
    expect(frames(graphic('photo-drop'))).toEqual([['punch', 12], ['zap', 14]])
  })
})

describe('sound in saved projects', () => {
  it('loads projects saved before template sounds existed', () => {
    const project = createVideoProject()
    const item = project.tracks[1]!.items[0] as GraphicItem
    delete item.sound
    const parsed = parseVideoProject(JSON.parse(JSON.stringify(project)))
    expect((parsed.tracks[1]!.items[0] as GraphicItem).sound).toBeUndefined()
  })

  it('validates the sound settings', () => {
    const project = createVideoProject()
    expect(() => parseVideoProject(project)).not.toThrow()
    ;(project.tracks[1]!.items[0] as GraphicItem).sound = { enabled: true, volume: 2 }
    expect(() => parseVideoProject(project)).toThrow()
  })
})
