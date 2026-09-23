export type PostEditorSheetSnap = 'closed' | 'normal' | 'expanded'

export const POST_EDITOR_MIN_ZOOM = 1
export const POST_EDITOR_MAX_ZOOM = 3

/**
 * Scale a design surface so it fits completely inside the available preview
 * area (contain, never crop). Returns the on-screen CSS size in pixels.
 */
export function fitPreviewSize(input: {
  availableWidth: number
  availableHeight: number
  designWidth: number
  designHeight: number
}) {
  const { designWidth, designHeight } = input
  const availableWidth = Math.max(0, input.availableWidth)
  const availableHeight = Math.max(0, input.availableHeight)
  if (designWidth <= 0 || designHeight <= 0) return { width: 0, height: 0, scale: 0 }

  const scale = Math.min(availableWidth / designWidth, availableHeight / designHeight)
  return {
    // Epsilon guards against 359.99999… flooring a whole pixel away.
    width: Math.floor(designWidth * scale + 1e-6),
    height: Math.floor(designHeight * scale + 1e-6),
    scale,
  }
}

/**
 * Pixel heights for each bottom-sheet snap point. `viewportHeight` is the
 * visible (dynamic) viewport height, `workspaceHeight` the area between the
 * editor header and the bottom toolbar the sheet can grow into.
 */
export function sheetSnapHeights(input: {
  viewportHeight: number
  workspaceHeight: number
  minPreviewHeight?: number
}): Record<PostEditorSheetSnap, number> {
  const workspace = Math.max(0, input.workspaceHeight)
  const minPreview = input.minPreviewHeight ?? 160
  const normal = Math.round(Math.max(0, Math.min(input.viewportHeight * .42, workspace - minPreview)))
  const expanded = Math.round(Math.max(normal, Math.min(input.viewportHeight * .8, workspace)))
  return { closed: 0, normal, expanded }
}

/**
 * Pick the snap point a sheet should settle on after a drag, preferring the
 * direction of a quick flick over the nearest point.
 */
export function resolveSheetSnap(input: {
  height: number
  velocity: number
  snaps: Record<PostEditorSheetSnap, number>
}): PostEditorSheetSnap {
  const order: PostEditorSheetSnap[] = ['closed', 'normal', 'expanded']
  const flick = .5

  if (Math.abs(input.velocity) > flick) {
    if (input.velocity > 0) {
      const above = order.find(snap => input.snaps[snap] > input.height)
      return above ?? 'expanded'
    }
    const below = [...order].reverse().find(snap => input.snaps[snap] < input.height)
    return below ?? 'closed'
  }

  return order.reduce((best, snap) => (
    Math.abs(input.snaps[snap] - input.height) < Math.abs(input.snaps[best] - input.height) ? snap : best
  ), 'closed' as PostEditorSheetSnap)
}

export function clampPostZoom(value: number) {
  if (!Number.isFinite(value)) return POST_EDITOR_MIN_ZOOM
  return Math.max(POST_EDITOR_MIN_ZOOM, Math.min(POST_EDITOR_MAX_ZOOM, value))
}

/** New zoom for a two-finger pinch, relative to the zoom when the pinch began. */
export function pinchPostZoom(startZoom: number, startDistance: number, distance: number) {
  if (startDistance <= 0 || distance <= 0) return clampPostZoom(startZoom)
  return clampPostZoom(startZoom * (distance / startDistance))
}
