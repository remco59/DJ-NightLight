import { mediaKind, type MediaKind, type TimelineItem } from './video-project'

// Pure helpers for the editor UI (shared by the desktop and mobile layouts).

/** Timeline zoom bounds in pixels per second. */
export const MIN_TIMELINE_ZOOM = 8
export const MAX_TIMELINE_ZOOM = 400

export function clampZoom(zoom: number) {
  if (!Number.isFinite(zoom)) return MIN_TIMELINE_ZOOM
  return Math.min(MAX_TIMELINE_ZOOM, Math.max(MIN_TIMELINE_ZOOM, Math.round(zoom)))
}

/** Zoom for a two-finger pinch that started at `startDistance` and is now `distance` apart. */
export function pinchZoom(startZoom: number, startDistance: number, distance: number) {
  if (startDistance <= 0 || distance <= 0) return clampZoom(startZoom)
  return clampZoom(startZoom * distance / startDistance)
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

export type QuickAction = 'split' | 'duplicate' | 'mute' | 'replace' | 'delete'

/** Clip actions offered next to the mobile timeline for the current selection. */
export function quickActionsFor(item: TimelineItem | null): QuickAction[] {
  if (!item) return ['split']
  const actions: QuickAction[] = ['split', 'duplicate']
  if (item.type === 'video') actions.push('mute')
  if (item.type !== 'graphic') actions.push('replace')
  actions.push('delete')
  return actions
}

/** Seconds as m:ss for compact media labels. */
export function formatMediaDuration(ms: number | null) {
  if (!ms) return ''
  const seconds = Math.round(ms / 1000)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}
