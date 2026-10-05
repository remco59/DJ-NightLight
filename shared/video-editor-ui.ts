import { mediaKind, type MediaKind, type TimelineItem, type VideoTrack } from './video-project'

// Pure helpers for the editor UI (shared by the desktop and mobile layouts).

/** Timeline zoom bounds in pixels per second. */
export const MIN_TIMELINE_ZOOM = 8
export const MAX_TIMELINE_ZOOM = 400

export function clampZoom(zoom: number) {
  if (!Number.isFinite(zoom)) return MIN_TIMELINE_ZOOM
  return Math.min(MAX_TIMELINE_ZOOM, Math.max(MIN_TIMELINE_ZOOM, Math.round(zoom)))
}

/** Zoom (px per second) that fits `frames` into `width` pixels, rounded down so it never overflows. */
export function fitZoom(frames: number, fps: number, width: number) {
  const seconds = Math.max(1 / fps, frames / fps)
  return Math.min(MAX_TIMELINE_ZOOM, Math.max(MIN_TIMELINE_ZOOM, Math.floor(width / seconds)))
}

/** Zoom for a two-finger pinch that started at `startDistance` and is now `distance` apart. */
export function pinchZoom(startZoom: number, startDistance: number, distance: number) {
  if (startDistance <= 0 || distance <= 0) return clampZoom(startZoom)
  return clampZoom(startZoom * distance / startDistance)
}

/**
 * Tracks in the order the timeline lists them. The composition paints tracks in
 * array order (last on top), so visual tracks are reversed to put the frontmost
 * layer on the top row; audio has no stacking and stays below them.
 */
export function timelineDisplayOrder<T extends Pick<VideoTrack, 'kind'>>(tracks: T[]): T[] {
  const visual = tracks.filter(track => track.kind !== 'audio').reverse()
  return [...visual, ...tracks.filter(track => track.kind === 'audio')]
}

/** Tabs of the mobile editor's bottom navigation; only one tool panel is open at a time. */
export type MobileVideoTool = 'media' | 'templates' | 'edit' | 'audio' | 'export'

export type MediaFilter = 'all' | MediaKind

export function filterMediaAssets<T extends { title: string, originalFilename: string, mimeType: string }>(
  assets: T[],
  filter: MediaFilter,
  search: string,
) {
  const query = search.trim().toLowerCase()
  return assets.filter((asset) => {
    if (filter !== 'all' && mediaKind(asset.mimeType) !== filter) return false
    return !query || `${asset.title} ${asset.originalFilename}`.toLowerCase().includes(query)
  })
}

export type QuickAction = 'split' | 'duplicate' | 'mute' | 'slip' | 'replace' | 'ripple' | 'close-gaps' | 'delete'

/** Clip actions offered next to the mobile timeline for the current selection. */
export function quickActionsFor(item: TimelineItem | null): QuickAction[] {
  if (!item) return ['split']
  const actions: QuickAction[] = ['split', 'duplicate']
  // On a graphic, mute switches its template sounds.
  if (item.type === 'video' || item.type === 'graphic') actions.push('mute')
  if (item.type === 'video' || item.type === 'audio') actions.push('slip')
  if (item.type !== 'graphic') actions.push('replace')
  actions.push('close-gaps', 'ripple', 'delete')
  return actions
}

/** Seconds as m:ss for compact media labels. */
export function formatMediaDuration(ms: number | null) {
  if (!ms) return ''
  const seconds = Math.round(ms / 1000)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

// --- Resizable desktop panels ----------------------------------------------------

export type PanelSizes = { side: number, inspector: number, timeline: number }
export type PanelKey = keyof PanelSizes

export const PANEL_LIMITS = {
  side: { min: 220, max: 480 },
  inspector: { min: 260, max: 480 },
  timeline: { min: 160, maxShare: 0.65 },
} as const

/** Space the preview column keeps no matter how the panels are dragged. */
export const MIN_PREVIEW_WIDTH = 320
/** Top bar plus a workspace tall enough for a 200px preview, its title and the transport. */
export const MIN_WORKSPACE_HEIGHT = 58 + 300

export function defaultPanelSizes(viewportHeight: number): PanelSizes {
  return { side: 300, inspector: 320, timeline: Math.max(220, Math.round(viewportHeight * 0.34)) }
}

function clamp(value: number, min: number, max: number) {
  return Math.round(Math.min(Math.max(value, min), Math.max(min, max)))
}

/**
 * Keeps panel sizes inside their limits and leaves the preview its minimum room.
 * When side panel and inspector do not both fit, the one not being dragged
 * (`priority`) gives way first; the inspector is ignored while it is hidden.
 */
export function clampPanelSizes(
  sizes: PanelSizes,
  viewport: { width: number, height: number, rail: number, inspectorVisible: boolean },
  priority: PanelKey = 'side',
): PanelSizes {
  const { side: sideLimit, inspector: inspectorLimit, timeline: timelineLimit } = PANEL_LIMITS
  let side = clamp(sizes.side, sideLimit.min, sideLimit.max)
  let inspector = clamp(sizes.inspector, inspectorLimit.min, inspectorLimit.max)
  const available = viewport.width - viewport.rail - MIN_PREVIEW_WIDTH
  if (!viewport.inspectorVisible) {
    side = clamp(side, sideLimit.min, available)
  } else if (priority === 'inspector') {
    side = clamp(side, sideLimit.min, available - inspector)
    inspector = clamp(inspector, inspectorLimit.min, available - side)
  } else {
    inspector = clamp(inspector, inspectorLimit.min, available - side)
    side = clamp(side, sideLimit.min, available - inspector)
  }
  const timelineMax = Math.min(viewport.height * timelineLimit.maxShare, viewport.height - MIN_WORKSPACE_HEIGHT)
  const timeline = clamp(sizes.timeline, timelineLimit.min, timelineMax)
  return { side, inspector, timeline }
}

/** Reads stored panel sizes, ignoring anything malformed. */
export function parsePanelSizes(value: string | null): Partial<PanelSizes> {
  if (!value) return {}
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>
    const sizes: Partial<PanelSizes> = {}
    for (const key of ['side', 'inspector', 'timeline'] as const) {
      const entry = parsed?.[key]
      if (typeof entry === 'number' && Number.isFinite(entry)) sizes[key] = entry
    }
    return sizes
  } catch {
    return {}
  }
}
