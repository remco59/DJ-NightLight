import { itemBoxSize, visualItemsAt, type CanvasItem, type Size } from '~~/shared/video-canvas'
import type { TrackKind } from '~~/shared/video-project'
import { useVideoEditor } from '~/composables/useVideoEditor'

export type CanvasEntry = { item: CanvasItem, trackKind: TrackKind, box: Size }

/** Visual items at the playhead with their untransformed box sizes, frontmost first. */
export function useCanvasItems() {
  const editor = useVideoEditor()
  const { state } = editor

  const entries = computed<CanvasEntry[]>(() => visualItemsAt(state.project, state.frame).map(({ item, trackKind }) => {
    const asset = item.type === 'graphic' ? null : editor.mediaById.value.get(item.assetId)
    return { item, trackKind, box: itemBoxSize(item, trackKind, state.project, asset) }
  }))

  /** The selected clip, when it is visible at the playhead. */
  const selected = computed(() => entries.value.find(entry => entry.item.id === state.selectedId) || null)

  /** Screen-space style placing an element exactly over an entry's transformed box. */
  function boxStyle(entry: CanvasEntry, scale: number) {
    const { x, y, rotation, scale: itemScale } = entry.item.transform
    return {
      left: `${(state.project.width - entry.box.width) / 2 * scale}px`,
      top: `${(state.project.height - entry.box.height) / 2 * scale}px`,
      width: `${entry.box.width * scale}px`,
      height: `${entry.box.height * scale}px`,
      transform: `translate(${x * scale}px, ${y * scale}px) rotate(${rotation}deg) scale(${itemScale})`,
    }
  }

  return { entries, selected, boxStyle }
}
