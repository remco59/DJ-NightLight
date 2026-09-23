import { describe, expect, it } from 'vitest'
import {
  VIDEO_ASPECTS,
  collectProjectAssetIds,
  createGraphicItem,
  createMediaItem,
  createVideoProject,
  graphicBackdrop,
  parseVideoProject,
  projectDurationFrames,
  trackAccepts,
} from '../shared/video-project'
import { isLucideIcon } from '../shared/lucide-icons'
import { MOTION_TEMPLATES, MOTION_TEMPLATE_KEYS, iconProp, parseGigRow } from '../shared/video-templates'
import { inspectTimedMedia } from '../shared/media'

const assetId = '11111111-1111-4111-8111-111111111111'
const otherAssetId = '22222222-2222-4222-8222-222222222222'

describe('video project model', () => {
  it('creates a vertical project with video, graphics and audio tracks', () => {
    const project = createVideoProject('9:16')
    expect(project.width).toBe(1080)
    expect(project.height).toBe(1920)
    expect(project.fps).toBe(30)
    expect(project.tracks.map(track => track.kind)).toEqual(['video', 'graphics', 'audio'])
    expect(project.tracks[1]!.items[0]).toMatchObject({ type: 'graphic', templateKey: 'gig-announcement', start: 0, duration: 180 })
    expect(() => parseVideoProject(project)).not.toThrow()
  })

  it('supports the common social aspect ratios', () => {
    expect(Object.keys(VIDEO_ASPECTS)).toEqual(['9:16', '4:5', '1:1', '16:9'])
    expect(createVideoProject('16:9')).toMatchObject({ width: 1920, height: 1080 })
  })

  it('derives the duration from the timeline unless it is fixed', () => {
    const project = createVideoProject()
    expect(projectDurationFrames(project)).toBe(180)
    project.autoDuration = false
    project.durationFrames = 450
    expect(projectDurationFrames(project)).toBe(450)
    project.tracks.forEach(track => (track.items = []))
    project.autoDuration = true
    expect(projectDurationFrames(project)).toBe(30)
  })

  it('creates media items that respect the source length', () => {
    const video = createMediaItem({ id: assetId, mimeType: 'video/mp4', durationMs: 4000 }, 12, 30)
    expect(video).toMatchObject({ type: 'video', start: 12, duration: 120, trimStart: 0, speed: 1 })
    const audio = createMediaItem({ id: assetId, mimeType: 'audio/mpeg', durationMs: 154_000 }, 0, 30)
    expect(audio).toMatchObject({ type: 'audio', duration: 4620 })
    const image = createMediaItem({ id: assetId, mimeType: 'image/jpeg', durationMs: null }, 0, 30)
    expect(image).toMatchObject({ type: 'image', duration: 90 })
  })

  it('keeps media on compatible tracks', () => {
    expect(trackAccepts('video', 'video')).toBe(true)
    expect(trackAccepts('video', 'audio')).toBe(false)
    expect(trackAccepts('graphics', 'graphic')).toBe(true)
    expect(trackAccepts('graphics', 'image')).toBe(true)
    expect(trackAccepts('audio', 'graphic')).toBe(false)

    const project = createVideoProject()
    project.tracks[2]!.items.push(createGraphicItem('hype-title', 0, 30))
    expect(() => parseVideoProject(project)).toThrow(/cannot hold graphic/)
  })

  it('rejects duplicate item ids and unknown templates', () => {
    const project = createVideoProject()
    const graphic = project.tracks[1]!.items[0]!
    project.tracks[1]!.items.push({ ...graphic, start: 400 })
    expect(() => parseVideoProject(project)).toThrow(/Duplicate item id/)

    const unknown = createVideoProject() as unknown as { tracks: Array<{ items: Array<Record<string, unknown>> }> }
    unknown.tracks[1]!.items[0]!.templateKey = 'not-a-template'
    expect(() => parseVideoProject(unknown)).toThrow()
  })

  it('collects every referenced asset, including media inside templates', () => {
    const project = createVideoProject()
    project.tracks[0]!.items.push(createMediaItem({ id: assetId, mimeType: 'video/mp4', durationMs: 5000 }, 0, 30))
    const recap = createGraphicItem('clip-recap', 200, 30)
    recap.templateProps.media = [assetId, otherAssetId]
    project.tracks[1]!.items.push(recap)
    expect(collectProjectAssetIds(project).sort()).toEqual([assetId, otherAssetId])
  })
})

describe('motion templates', () => {
  it('ships the NightLight template library', () => {
    expect(MOTION_TEMPLATE_KEYS).toEqual([
      'gig-announcement',
      'recap-intro',
      'upcoming-gigs',
      'logo-sting',
      'lower-third',
      'hype-title',
      'photo-drop',
      'clip-recap',
      'neon-logo-reveal',
      'lightning-banner',
      'electric-gig-poster',
      'now-playing',
      'bolt-transition',
      'neon-outro',
    ])
  })

  it('provides defaults for every editable field', () => {
    for (const template of Object.values(MOTION_TEMPLATES)) {
      for (const field of template.fields) {
        expect(template.defaults, `${template.key}.${field.key}`).toHaveProperty(field.key)
      }
      const item = createGraphicItem(template.key, 0, 30)
      const project = createVideoProject()
      project.tracks[1]!.items = [item]
      expect(() => parseVideoProject(project)).not.toThrow()
    }
  })

  it('defaults every icon field to an icon the templates can draw', () => {
    for (const template of Object.values(MOTION_TEMPLATES)) {
      for (const field of template.fields.filter(field => field.kind === 'icon')) {
        expect(isLucideIcon(template.defaults[field.key]), `${template.key}.${field.key}`).toBe(true)
      }
    }
  })

  it('lets items swap or hide template icons', () => {
    const item = createGraphicItem('gig-announcement', 0, 30)
    expect(iconProp(item.templateKey, item.templateProps, 'dateIcon')).toBe('calendar')
    item.templateProps.dateIcon = 'ticket'
    expect(iconProp(item.templateKey, item.templateProps, 'dateIcon')).toBe('ticket')
    item.templateProps.dateIcon = ''
    expect(iconProp(item.templateKey, item.templateProps, 'dateIcon')).toBeNull()
    item.templateProps.dateIcon = 'not-an-icon'
    expect(iconProp(item.templateKey, item.templateProps, 'dateIcon')).toBeNull()
    // Projects saved before icons were editable keep the template default.
    delete item.templateProps.dateIcon
    expect(iconProp(item.templateKey, item.templateProps, 'dateIcon')).toBe('calendar')
  })

  it('dims the footage behind a template by default and lets items override it', () => {
    const item = createGraphicItem('electric-gig-poster', 0, 30)
    expect(graphicBackdrop(item)).toBe(MOTION_TEMPLATES['electric-gig-poster'].defaultBackdrop)
    expect(graphicBackdrop(createGraphicItem('lower-third', 0, 30))).toBe(0)
    // Projects saved before the setting existed fall back to the template default.
    delete item.backdrop
    const project = createVideoProject()
    project.tracks[1]!.items = [item]
    const parsed = parseVideoProject(project).tracks[1]!.items[0]!
    expect(parsed.type === 'graphic' && graphicBackdrop(parsed)).toBe(0.5)
    item.backdrop = 0
    expect(graphicBackdrop(item)).toBe(0)
    item.backdropStyle = 'blur'
    expect(() => parseVideoProject(project)).not.toThrow()
    item.backdropStyle = 'sepia' as never
    expect(() => parseVideoProject(project)).toThrow()
    item.backdropStyle = 'gradient'
    item.backdrop = 1
    expect(() => parseVideoProject(project)).toThrow()
  })

  it('parses upcoming gig rows', () => {
    expect(parseGigRow('06 DEC | Club Nova | Amsterdam')).toEqual({ date: '06 DEC', title: 'Club Nova', place: 'Amsterdam' })
    expect(parseGigRow('10 DEC')).toEqual({ date: '10 DEC', title: '', place: '' })
  })
})

describe('timed media validation', () => {
  const bytes = (text: string, offset = 0) => {
    const buffer = new Uint8Array(32)
    buffer.set(new TextEncoder().encode(text), offset)
    return buffer
  }

  it('detects video and audio containers from their signatures', () => {
    const mp4 = bytes('ftypisom', 4)
    expect(inspectTimedMedia(mp4)).toMatchObject({ kind: 'video', mimeType: 'video/mp4' })
    expect(inspectTimedMedia(bytes('ftypqt  ', 4))).toMatchObject({ kind: 'video', mimeType: 'video/quicktime' })
    expect(inspectTimedMedia(bytes('ftypM4A ', 4))).toMatchObject({ kind: 'audio', mimeType: 'audio/mp4' })
    expect(inspectTimedMedia(bytes('ID3'))).toMatchObject({ kind: 'audio', mimeType: 'audio/mpeg' })
    expect(inspectTimedMedia(bytes('OggS'))).toMatchObject({ kind: 'audio', mimeType: 'audio/ogg' })
    const wav = bytes('RIFF')
    wav.set(new TextEncoder().encode('WAVE'), 8)
    expect(inspectTimedMedia(wav)).toMatchObject({ kind: 'audio', mimeType: 'audio/wav' })
    const webm = new Uint8Array(32)
    webm.set([0x1a, 0x45, 0xdf, 0xa3])
    expect(inspectTimedMedia(webm)).toMatchObject({ kind: 'video', mimeType: 'video/webm' })
  })

  it('rejects files that only claim to be media', () => {
    expect(() => inspectTimedMedia(new TextEncoder().encode('<html>not really a video file</html>'))).toThrow()
  })
})
