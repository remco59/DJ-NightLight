<script setup lang="ts">
import { hitsItem, itemBoxSize, snapPosition, visualItemsAt, type CanvasItem, type Point, type SnapGuides } from '~~/shared/video-canvas'
import type { VideoProject } from '~~/shared/video-project'
import { updateItem } from '~~/shared/video-timeline'
import { useVideoEditor } from '~/composables/useVideoEditor'

// Direct manipulation on the preview: click selects the clip under the pointer
// (the selected clip wins over the ones above it), dragging moves it and the
// corner handles scale it. A whole drag is one undo step. Shift locks the move
// to one axis, Ctrl/Cmd turns snapping off and Escape cancels.

const props = defineProps<{ scale: number }>()

const editor = useVideoEditor()
const { state } = editor
const layer = ref<HTMLElement | null>(null)
const guides = ref<SnapGuides>({ vertical: [], horizontal: [] })
const dragging = ref(false)
const SNAP_PX = 8
const MIN_SCALE = 0.1
const MAX_SCALE = 3

const canvas = computed(() => ({ width: state.project.width, height: state.project.height }))

const selected = computed<CanvasItem | null>(() => {
  const item = editor.selection.value?.item
  if (!item || item.type === 'audio') return null
  return visualItemsAt(state.project, state.frame).some(entry => entry.id === item.id) ? item : null
})

const outline = computed(() => {
  const item = selected.value
  if (!item) return null
  const box = itemBoxSize(item, state.project)
  const { x, y, rotation, scale } = item.transform
  const s = props.scale
  return {
    left: `${(canvas.value.width - box.width) / 2 * s}px`,
    top: `${(canvas.value.height - box.height) / 2 * s}px`,
    width: `${box.width * s}px`,
    height: `${box.height * s}px`,
    transform: `translate(${x * s}px, ${y * s}px) rotate(${rotation}deg) scale(${scale})`,
    // Keep the outline and handles a constant on-screen size however far the clip is scaled.
    '--inverse-scale': String(1 / Math.max(0.01, scale)),
  }
})

function canvasPoint(event: PointerEvent): Point {
  const rect = layer.value!.getBoundingClientRect()
  return { x: (event.clientX - rect.left) / props.scale, y: (event.clientY - rect.top) / props.scale }
}

function itemAt(point: Point) {
  const items = visualItemsAt(state.project, state.frame)
  const hit = (item: CanvasItem) => hitsItem(point, itemBoxSize(item, state.project), item.transform, canvas.value)
  const current = items.find(item => item.id === state.selectedId)
  if (current && hit(current)) return current
  return items.find(hit) || null
}

function snapshot() {
  return JSON.parse(JSON.stringify(toRaw(state.project))) as VideoProject
}

function track(event: PointerEvent, onMove: (moveEvent: PointerEvent) => void) {
  const target = event.currentTarget as HTMLElement
  target.setPointerCapture(event.pointerId)
  let started = false
  const move = (moveEvent: PointerEvent) => {
    if (!started) {
      if (Math.hypot(moveEvent.clientX - event.clientX, moveEvent.clientY - event.clientY) < 3) return
      started = true
      dragging.value = true
      editor.beginTransient()
    }
    onMove(moveEvent)
  }
  const finish = (cancelled: boolean) => {
    target.removeEventListener('pointermove', move)
    target.removeEventListener('pointerup', up)
    target.removeEventListener('pointercancel', cancel)
    window.removeEventListener('keydown', escape)
    if (started) {
      if (cancelled) editor.cancelTransient()
      else editor.endTransient()
    }
    started = false
    dragging.value = false
    guides.value = { vertical: [], horizontal: [] }
  }
  const up = () => finish(false)
  const cancel = () => finish(true)
  const escape = (keyEvent: KeyboardEvent) => {
    if (keyEvent.key !== 'Escape' || !started) return
    keyEvent.stopPropagation()
    finish(true)
  }
  target.addEventListener('pointermove', move)
  target.addEventListener('pointerup', up)
  target.addEventListener('pointercancel', cancel)
  window.addEventListener('keydown', escape, { capture: true })
}

function pointerDown(event: PointerEvent) {
  if (event.button !== 0) return
  const origin = canvasPoint(event)
  const item = itemAt(origin)
  // Touch: the first tap only selects so a stray swipe never moves a clip.
  const touchSelectOnly = event.pointerType !== 'mouse' && item?.id !== state.selectedId
  state.selectedId = item?.id || null
  if (!item || touchSelectOnly) return
  event.preventDefault()
  const base = snapshot()
  const start = { ...item.transform }
  const box = itemBoxSize(item, state.project)
  track(event, (moveEvent) => {
    const point = canvasPoint(moveEvent)
    let dx = point.x - origin.x
    let dy = point.y - origin.y
    if (moveEvent.shiftKey) {
      if (Math.abs(dx) > Math.abs(dy)) dy = 0
      else dx = 0
    }
    let x = start.x + dx
    let y = start.y + dy
    if (!moveEvent.ctrlKey && !moveEvent.metaKey) {
      const snapped = snapPosition({ x, y }, box, start.scale, start.rotation, canvas.value, SNAP_PX / props.scale)
      x = moveEvent.shiftKey && dx === 0 ? x : snapped.x
      y = moveEvent.shiftKey && dy === 0 ? y : snapped.y
      guides.value = snapped.guides
    } else {
      guides.value = { vertical: [], horizontal: [] }
    }
    editor.transient(updateItem(base, item.id, (entry) => {
      if (!('transform' in entry)) return
      entry.transform.x = Math.round(x)
      entry.transform.y = Math.round(y)
    }))
  })
}

function handleDown(event: PointerEvent) {
  const item = selected.value
  if (event.button !== 0 || !item) return
  event.preventDefault()
  event.stopPropagation()
  const base = snapshot()
  const start = { ...item.transform }
  const centre = { x: canvas.value.width / 2 + start.x, y: canvas.value.height / 2 + start.y }
  const from = canvasPoint(event)
  const startDistance = Math.max(1, Math.hypot(from.x - centre.x, from.y - centre.y))
  track(event, (moveEvent) => {
    const point = canvasPoint(moveEvent)
    const distance = Math.hypot(point.x - centre.x, point.y - centre.y)
    const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, start.scale * distance / startDistance))
    editor.transient(updateItem(base, item.id, (entry) => {
      if ('transform' in entry) entry.transform.scale = Math.round(scale * 100) / 100
    }))
  })
}
</script>

<template>
  <div ref="layer" class="canvas-layer" :class="{ dragging }" @pointerdown="pointerDown">
    <div v-if="outline" class="outline" :style="outline">
      <span
        v-for="corner in ['nw', 'ne', 'sw', 'se']"
        :key="corner"
        class="handle"
        :class="corner"
        title="Drag to scale"
        @pointerdown="handleDown"
      />
    </div>
    <i v-for="line in guides.vertical" :key="`v${line}`" class="guide vertical" :style="{ left: `${line * props.scale}px` }" />
    <i v-for="line in guides.horizontal" :key="`h${line}`" class="guide horizontal" :style="{ top: `${line * props.scale}px` }" />
  </div>
</template>

<style scoped>
.canvas-layer {
  position: absolute;
  inset: 0;
  z-index: 2;
  touch-action: none;
}

.outline {
  position: absolute;
  box-sizing: border-box;
  outline: calc(1.5px * var(--inverse-scale)) solid #a78bfa;
  pointer-events: none;
}

.dragging .outline { outline-color: #c4b5fd; }

.handle {
  position: absolute;
  width: calc(12px * var(--inverse-scale));
  height: calc(12px * var(--inverse-scale));
  border: calc(1.5px * var(--inverse-scale)) solid #7c3aed;
  border-radius: 2px;
  background: #fff;
  pointer-events: auto;
}

.handle.nw { top: 0; left: 0; transform: translate(-50%, -50%); cursor: nwse-resize; }
.handle.ne { top: 0; right: 0; transform: translate(50%, -50%); cursor: nesw-resize; }
.handle.sw { bottom: 0; left: 0; transform: translate(-50%, 50%); cursor: nesw-resize; }
.handle.se { right: 0; bottom: 0; transform: translate(50%, 50%); cursor: nwse-resize; }

.guide {
  position: absolute;
  background: #f472b6;
  pointer-events: none;
}

.guide.vertical { top: 0; bottom: 0; width: 1px; }
.guide.horizontal { right: 0; left: 0; height: 1px; }
</style>
