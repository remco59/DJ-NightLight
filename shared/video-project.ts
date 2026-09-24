import { z } from 'zod'
import {
  BACKDROP_STYLE_KEYS,
  ENTRANCE_ANIMATION_KEYS,
  EXIT_ANIMATION_KEYS,
  MOTION_ACCENT_KEYS,
  MOTION_TEMPLATE_KEYS,
  MOTION_TEMPLATES,
  type BackdropStyle,
  type EntranceAnimation,
  type ExitAnimation,
  type MotionAccent,
  type MotionTemplateKey,
  type TemplateProps,
} from './video-templates'
import { MAX_BPM, MIN_BPM, type BeatGrid } from './beat-grid'
import { DEFAULT_ITEM_SOUND, type ItemSound } from './template-sounds'

// A video project is a small NLE sequence: fixed output settings plus ordered
// tracks holding timeline items. All times are integer frames at project fps.
// The same object drives the in-browser Remotion Player preview and the MP4
// render worker, so preview and export cannot drift apart.

export const VIDEO_PROJECT_VERSION = 1

export const VIDEO_ASPECTS = {
  '9:16': { label: '9:16 Reel', width: 1080, height: 1920 },
  '4:5': { label: '4:5 Feed', width: 1080, height: 1350 },
  '1:1': { label: '1:1 Vierkant', width: 1080, height: 1080 },
  '16:9': { label: '16:9 Liggend', width: 1920, height: 1080 },
} as const
export type VideoAspect = keyof typeof VIDEO_ASPECTS
export const VIDEO_ASPECT_KEYS = Object.keys(VIDEO_ASPECTS) as VideoAspect[]

export const VIDEO_FPS_OPTIONS = [24, 25, 30, 60] as const
export const MAX_PROJECT_SECONDS = 180
export const MIN_ITEM_FRAMES = 3

export const TRACK_KINDS = ['video', 'graphics', 'audio'] as const
export type TrackKind = typeof TRACK_KINDS[number]

export type ItemTransform = {
  /** Offset from centre in output pixels. */
  x: number
  y: number
  /** 1 = fill the frame (cover). */
  scale: number
  rotation: number
}

export type ItemCrop = { top: number, right: number, bottom: number, left: number }

/**
 * How footage sits in the frame at scale 1: `cover` fills it (the overflow is
 * cut off by the canvas edge and comes back when the clip is moved or zoomed
 * out), `contain` shows the whole source.
 */
export const MEDIA_FITS = ['cover', 'contain'] as const
export type MediaFit = typeof MEDIA_FITS[number]

type ItemBase = {
  id: string
  /** First frame on the timeline. */
  start: number
  /** Length on the timeline in frames. */
  duration: number
  opacity: number
}

export type VideoClipItem = ItemBase & {
  type: 'video'
  assetId: string
  /** Frames skipped at the head of the source (source frames at project fps). */
  trimStart: number
  transform: ItemTransform
  crop: ItemCrop
  /** Unset = the track default (see mediaFit). */
  fit?: MediaFit
  speed: number
  volume: number
  muted: boolean
}

export type ImageClipItem = ItemBase & {
  type: 'image'
  assetId: string
  transform: ItemTransform
  crop: ItemCrop
  fit?: MediaFit
  /** Subtle Ken Burns push-in, 0 = static. */
  kenBurns: number
}

export type AudioClipItem = ItemBase & {
  type: 'audio'
  assetId: string
  trimStart: number
  volume: number
  fadeIn: number
  fadeOut: number
  /** Beat grid corrected by hand; unset = the detected one. */
  beatGrid?: BeatGrid
}

export type GraphicItem = ItemBase & {
  type: 'graphic'
  templateKey: MotionTemplateKey
  templateProps: TemplateProps
  accent: MotionAccent
  entrance: EntranceAnimation
  exit: ExitAnimation
  entranceFrames: number
  exitFrames: number
  /** Strength (0–1) of the treatment behind the template; undefined uses the template default. */
  backdrop?: number
  backdropStyle?: BackdropStyle
  /** Template sound effects; unset (projects from before sounds existed) plays none. */
  sound?: ItemSound
  transform: ItemTransform
  /** Gig in the agenda the content was filled from; unset = typed by hand. */
  gigId?: string
}

export type TimelineItem = VideoClipItem | ImageClipItem | AudioClipItem | GraphicItem
export type TimelineItemType = TimelineItem['type']

export type VideoTrack = {
  id: string
  kind: TrackKind
  name: string
  hidden: boolean
  muted: boolean
  items: TimelineItem[]
}

export const MARKER_COLORS = ['#facc15', '#f472b6', '#38bdf8', '#4ade80'] as const
export type MarkerColor = typeof MARKER_COLORS[number]

/** Editing aid on the timeline (e.g. "Drop"); never rendered in the video. */
export type TimelineMarker = {
  id: string
  frame: number
  label?: string
  color?: MarkerColor
}

export type VideoProject = {
  version: typeof VIDEO_PROJECT_VERSION
  aspect: VideoAspect
  width: number
  height: number
  fps: number
  /** When true the duration follows the last item on the timeline. */
  autoDuration: boolean
  durationFrames: number
  background: string
  showSafeZones: boolean
  tracks: VideoTrack[]
  markers?: TimelineMarker[]
}

/** Minimal asset info the composition needs to resolve an assetId. */
export type ProjectAsset = {
  src: string
  mimeType: string
  width: number
  height: number
  durationMs: number | null
}
export type ProjectAssetMap = Record<string, ProjectAsset>

export function newId(prefix = 'it') {
  const random = globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`
  return `${prefix}_${random.replaceAll('-', '').slice(0, 12)}`
}

/** Video tracks fill the frame; images on graphics tracks are overlays shown whole. */
export function mediaFit(item: { fit?: MediaFit }, trackKind: TrackKind): MediaFit {
  return item.fit ?? (trackKind === 'graphics' ? 'contain' : 'cover')
}

export function trackAccepts(kind: TrackKind, type: TimelineItemType) {
  if (kind === 'video') return type === 'video' || type === 'image'
  if (kind === 'graphics') return type === 'graphic' || type === 'image'
  return type === 'audio'
}

export function defaultTransform(): ItemTransform {
  return { x: 0, y: 0, scale: 1, rotation: 0 }
}

export function defaultCrop(): ItemCrop {
  return { top: 0, right: 0, bottom: 0, left: 0 }
}

export function createTrack(kind: TrackKind, name?: string): VideoTrack {
  const label = kind === 'video' ? 'Video' : kind === 'graphics' ? 'Graphics' : 'Audio'
  return { id: newId('tr'), kind, name: name || label, hidden: false, muted: false, items: [] }
}

export const MAX_BACKDROP = 0.9

/** How strongly a graphic treats the footage behind it (0–1). */
export function graphicBackdrop(item: GraphicItem) {
  return item.backdrop ?? MOTION_TEMPLATES[item.templateKey]?.defaultBackdrop ?? 0
}

export function createGraphicItem(templateKey: MotionTemplateKey, start: number, fps: number): GraphicItem {
  const template = MOTION_TEMPLATES[templateKey]
  return {
    id: newId(),
    type: 'graphic',
    start: Math.max(0, Math.round(start)),
    duration: Math.round(template.defaultDurationSeconds * fps),
    opacity: 1,
    templateKey,
    templateProps: structuredClone(template.defaults),
    accent: template.defaultAccent,
    entrance: template.defaultEntrance,
    exit: template.defaultExit,
    entranceFrames: Math.round(fps * 0.6),
    exitFrames: Math.round(fps * 0.4),
    backdrop: template.defaultBackdrop,
    sound: { ...DEFAULT_ITEM_SOUND },
    transform: defaultTransform(),
  }
}

export type MediaKind = 'image' | 'video' | 'audio'

export function mediaKind(mimeType: string): MediaKind {
  if (mimeType.startsWith('video/')) return 'video'
  if (mimeType.startsWith('audio/')) return 'audio'
  return 'image'
}

export function createMediaItem(
  asset: { id: string, mimeType: string, durationMs: number | null },
  start: number,
  fps: number,
): TimelineItem {
  const kind = mediaKind(asset.mimeType)
  const sourceFrames = asset.durationMs ? Math.max(MIN_ITEM_FRAMES, Math.floor(asset.durationMs / 1000 * fps)) : null
  const base = { id: newId(), start: Math.max(0, Math.round(start)), opacity: 1 }
  if (kind === 'video') {
    return {
      ...base,
      type: 'video',
      assetId: asset.id,
      duration: sourceFrames ? Math.min(sourceFrames, fps * 8) : fps * 5,
      trimStart: 0,
      transform: defaultTransform(),
      crop: defaultCrop(),
      speed: 1,
      volume: 1,
      muted: false,
    }
  }
  if (kind === 'audio') {
    return {
      ...base,
      type: 'audio',
      assetId: asset.id,
      duration: sourceFrames ? Math.min(sourceFrames, fps * MAX_PROJECT_SECONDS) : fps * 15,
      trimStart: 0,
      volume: 1,
      fadeIn: 0,
      fadeOut: Math.round(fps),
    }
  }
  return {
    ...base,
    type: 'image',
    assetId: asset.id,
    duration: fps * 3,
    transform: defaultTransform(),
    crop: defaultCrop(),
    kenBurns: 0.3,
  }
}

export function createVideoProject(aspect: VideoAspect = '9:16', fps = 30): VideoProject {
  const size = VIDEO_ASPECTS[aspect]
  const graphics = createTrack('graphics')
  graphics.items.push(createGraphicItem('gig-announcement', 0, fps))
  return {
    version: VIDEO_PROJECT_VERSION,
    aspect,
    width: size.width,
    height: size.height,
    fps,
    autoDuration: true,
    durationFrames: fps * 10,
    background: '#09080b',
    showSafeZones: true,
    tracks: [createTrack('video'), graphics, createTrack('audio')],
  }
}

export function itemEnd(item: Pick<ItemBase, 'start' | 'duration'>) {
  return item.start + item.duration
}

export function contentEndFrame(project: VideoProject) {
  let end = 0
  for (const track of project.tracks) {
    for (const item of track.items) end = Math.max(end, itemEnd(item))
  }
  return end
}

export function projectDurationFrames(project: VideoProject) {
  const max = project.fps * MAX_PROJECT_SECONDS
  const duration = project.autoDuration ? contentEndFrame(project) : project.durationFrames
  return Math.min(max, Math.max(project.fps, Math.round(duration)))
}

/** Every media asset a project depends on, including assets used inside templates. */
export function collectProjectAssetIds(project: VideoProject) {
  const ids = new Set<string>()
  for (const track of project.tracks) {
    for (const item of track.items) {
      if (item.type === 'graphic') {
        for (const field of MOTION_TEMPLATES[item.templateKey]?.fields || []) {
          const value = item.templateProps[field.key]
          if (field.kind === 'asset' && typeof value === 'string' && value) ids.add(value)
          if (field.kind === 'assets' && Array.isArray(value)) value.filter(Boolean).forEach(id => ids.add(id))
        }
      } else {
        ids.add(item.assetId)
      }
    }
  }
  return [...ids]
}

export function findItem(project: VideoProject, itemId: string) {
  for (const track of project.tracks) {
    const item = track.items.find(entry => entry.id === itemId)
    if (item) return { track, item }
  }
  return null
}

export function formatTimecode(frame: number, fps: number) {
  const totalSeconds = Math.max(0, frame) / fps
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = Math.floor(totalSeconds % 60)
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

// --- Validation -----------------------------------------------------------

const frame = z.number().int().min(0).max(60 * MAX_PROJECT_SECONDS)
const duration = z.number().int().min(1).max(60 * MAX_PROJECT_SECONDS)
const uuid = z.string().uuid()
const itemId = z.string().min(1).max(40).regex(/^[\w-]+$/)
const transformSchema = z.object({
  x: z.number().min(-5000).max(5000),
  y: z.number().min(-5000).max(5000),
  scale: z.number().min(0.05).max(5),
  rotation: z.number().min(-360).max(360),
})
const cropSchema = z.object({
  top: z.number().min(0).max(0.45),
  right: z.number().min(0).max(0.45),
  bottom: z.number().min(0).max(0.45),
  left: z.number().min(0).max(0.45),
})
const baseSchema = {
  id: itemId,
  start: frame,
  duration,
  opacity: z.number().min(0).max(1),
}
const templatePropValue = z.union([
  z.string().max(500),
  z.array(z.string().max(200)).max(10),
])

export const timelineItemSchema = z.discriminatedUnion('type', [
  z.object({
    ...baseSchema,
    type: z.literal('video'),
    assetId: uuid,
    trimStart: frame,
    transform: transformSchema,
    crop: cropSchema,
    fit: z.enum(MEDIA_FITS).optional(),
    speed: z.number().min(0.25).max(4),
    volume: z.number().min(0).max(1),
    muted: z.boolean(),
  }),
  z.object({
    ...baseSchema,
    type: z.literal('image'),
    assetId: uuid,
    transform: transformSchema,
    crop: cropSchema,
    fit: z.enum(MEDIA_FITS).optional(),
    kenBurns: z.number().min(0).max(1),
  }),
  z.object({
    ...baseSchema,
    type: z.literal('audio'),
    assetId: uuid,
    trimStart: frame,
    volume: z.number().min(0).max(1),
    fadeIn: frame,
    fadeOut: frame,
    beatGrid: z.object({
      bpm: z.number().min(MIN_BPM / 2).max(MAX_BPM * 2),
      offset: z.number().min(0).max(60),
    }).optional(),
  }),
  z.object({
    ...baseSchema,
    type: z.literal('graphic'),
    templateKey: z.enum(MOTION_TEMPLATE_KEYS),
    templateProps: z.record(z.string().max(40), templatePropValue),
    accent: z.enum(MOTION_ACCENT_KEYS as [MotionAccent, ...MotionAccent[]]),
    entrance: z.enum(ENTRANCE_ANIMATION_KEYS as [EntranceAnimation, ...EntranceAnimation[]]),
    exit: z.enum(EXIT_ANIMATION_KEYS as [ExitAnimation, ...ExitAnimation[]]),
    entranceFrames: z.number().int().min(0).max(120),
    exitFrames: z.number().int().min(0).max(120),
    backdrop: z.number().min(0).max(MAX_BACKDROP).optional(),
    backdropStyle: z.enum(BACKDROP_STYLE_KEYS as [BackdropStyle, ...BackdropStyle[]]).optional(),
    sound: z.object({
      enabled: z.boolean(),
      volume: z.number().min(0).max(1),
    }).optional(),
    transform: transformSchema,
    gigId: uuid.optional(),
  }),
])

export const videoTrackSchema = z.object({
  id: itemId,
  kind: z.enum(TRACK_KINDS),
  name: z.string().trim().min(1).max(40),
  hidden: z.boolean(),
  muted: z.boolean(),
  items: z.array(timelineItemSchema).max(200),
}).superRefine((track, context) => {
  track.items.forEach((item, index) => {
    if (!trackAccepts(track.kind, item.type)) {
      context.addIssue({ code: 'custom', path: ['items', index, 'type'], message: `Een ${track.kind}-track kan geen ${item.type}-items bevatten` })
    }
  })
})

export const videoProjectSchema = z.object({
  version: z.literal(VIDEO_PROJECT_VERSION),
  aspect: z.enum(VIDEO_ASPECT_KEYS as [VideoAspect, ...VideoAspect[]]),
  width: z.number().int().min(240).max(3840),
  height: z.number().int().min(240).max(3840),
  fps: z.number().int().refine(value => (VIDEO_FPS_OPTIONS as readonly number[]).includes(value), 'Niet-ondersteunde framerate'),
  autoDuration: z.boolean(),
  durationFrames: duration,
  background: z.string().regex(/^#[0-9a-f]{6}$/i),
  showSafeZones: z.boolean(),
  tracks: z.array(videoTrackSchema).min(1).max(12),
  markers: z.array(z.object({
    id: itemId,
    frame,
    label: z.string().trim().max(40).optional(),
    color: z.enum(MARKER_COLORS).optional(),
  })).max(100).optional(),
}).superRefine((project, context) => {
  const ids = new Set<string>()
  project.tracks.forEach((track, trackIndex) => {
    track.items.forEach((item, itemIndex) => {
      if (ids.has(item.id)) {
        context.addIssue({ code: 'custom', path: ['tracks', trackIndex, 'items', itemIndex, 'id'], message: 'Dubbele item-ID' })
      }
      ids.add(item.id)
      if (item.start + item.duration > project.fps * MAX_PROJECT_SECONDS) {
        context.addIssue({ code: 'custom', path: ['tracks', trackIndex, 'items', itemIndex], message: `Items moeten binnen ${MAX_PROJECT_SECONDS} seconden eindigen` })
      }
    })
  })
})

export function parseVideoProject(value: unknown): VideoProject {
  return videoProjectSchema.parse(value) as VideoProject
}
