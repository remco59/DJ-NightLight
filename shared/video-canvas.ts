import type { ItemTransform, TimelineItem, VideoProject } from './video-project'

// Geometry for direct manipulation on the preview canvas. All values are in
// output pixels. An item is drawn as a box centred on the canvas, then
// scaled, rotated and moved by its transform (the composition's CSS order:
// translate(x, y) rotate(r) scale(s) around the box centre).

export type CanvasItem = Exclude<TimelineItem, { type: 'audio' }>
export type Size = { width: number, height: number }
export type Point = { x: number, y: number }

/** Visual items showing at `frame`, frontmost first (tracks paint in array order). */
export function visualItemsAt(project: VideoProject, frame: number): CanvasItem[] {
  const items: CanvasItem[] = []
  for (const track of project.tracks) {
    if (track.hidden || track.kind === 'audio') continue
    for (const item of track.items) {
      if (item.type !== 'audio' && item.start <= frame && frame < item.start + item.duration) items.push(item)
    }
  }
  return items.reverse()
}

/** Untransformed size of an item's box. Every item currently fills the canvas. */
export function itemBoxSize(_item: CanvasItem, project: Pick<VideoProject, 'width' | 'height'>): Size {
  return { width: project.width, height: project.height }
}

/** Whether a canvas point falls inside the item's transformed box. */
export function hitsItem(point: Point, box: Size, transform: ItemTransform, canvas: Size) {
  const dx = point.x - (canvas.width / 2 + transform.x)
  const dy = point.y - (canvas.height / 2 + transform.y)
  const angle = -transform.rotation * Math.PI / 180
  const scale = Math.max(0.0001, transform.scale)
  const localX = (dx * Math.cos(angle) - dy * Math.sin(angle)) / scale
  const localY = (dx * Math.sin(angle) + dy * Math.cos(angle)) / scale
  return Math.abs(localX) <= box.width / 2 && Math.abs(localY) <= box.height / 2
}

export type SnapGuides = { vertical: number[], horizontal: number[] }

/**
 * Snaps a dragged position to the canvas centre lines and, for unrotated
 * items, lines the box edges up with the canvas edges. Returns the snapped
 * offset and the canvas coordinates of the guide lines to draw.
 */
export function snapPosition(position: Point, box: Size, scale: number, rotation: number, canvas: Size, threshold: number) {
  const guides: SnapGuides = { vertical: [], horizontal: [] }
  const axis = (value: number, boxLength: number, canvasLength: number, lines: number[]) => {
    const candidates: Array<{ offset: number, line: number }> = [{ offset: 0, line: canvasLength / 2 }]
    if (rotation % 360 === 0) {
      const edge = (canvasLength - boxLength * scale) / 2
      candidates.push({ offset: -edge, line: 0 }, { offset: edge, line: canvasLength })
    }
    let best: { offset: number, line: number } | null = null
    for (const candidate of candidates) {
      const distance = Math.abs(candidate.offset - value)
      if (distance <= threshold && (!best || distance < Math.abs(best.offset - value))) best = candidate
    }
    if (!best) return value
    lines.push(best.line)
    return best.offset
  }
  return {
    x: axis(position.x, box.width, canvas.width, guides.vertical),
    y: axis(position.y, box.height, canvas.height, guides.horizontal),
    guides,
  }
}
