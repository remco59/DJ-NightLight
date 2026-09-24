<script setup lang="ts">
import { usePostEditor, type PostCanvasSelection, type PostEditorTool } from '~/composables/usePostEditor'
import {
  coverImageRect,
  postImageDragDelta,
  POST_PRESETS,
  type PostPreset,
} from '~~/shared/post-generator'
import {
  clampStageZoom,
  fitPreviewSize,
  hitTestBoxes,
  pinchPostZoom,
  POST_STAGE_MAX_ZOOM,
  POST_STAGE_MIN_ZOOM,
  POST_STAGE_ZOOM_PRESETS,
  snapToCentre,
  stepStageZoom,
} from '~~/shared/post-editor-ui'

const emit = defineEmits<{
  /** A click on the canvas asks the inspector to show the matching tool. */
  'activate-tool': [tool: PostEditorTool]
}>()

const selection = defineModel<PostCanvasSelection>('selection', { required: true })
const inspectorCollapsed = defineModel<boolean>('inspectorCollapsed', { default: false })

const editor = usePostEditor()
const { design } = editor

const STAGE_PADDING = 40
const CLICK_SLOP = 4
const SNAP_PIXELS = 8

const formatLabels: Record<PostPreset, string> = {
  square: 'Instagram post (1:1)',
  portrait: 'Instagram post (4:5)',
  story: 'Instagram story (9:16)',
}
const compactFormatLabels: Record<PostPreset, string> = {
  square: 'Post 1:1',
  portrait: 'Post 4:5',
  story: 'Story 9:16',
}
const presetOptions = Object.entries(POST_PRESETS) as Array<[PostPreset, (typeof POST_PRESETS)[PostPreset]]>

const stageRef = ref<HTMLElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
const stageSize = reactive({ width: 0, height: 0 })
/** 'fit' follows the stage size; a number is a fixed preview scale. */
const zoomMode = ref<'fit' | number>('fit')
let resizeObserver: ResizeObserver | null = null

const target = computed(() => POST_PRESETS[design.preset])
const fitScale = computed(() => fitPreviewSize({
  availableWidth: stageSize.width - STAGE_PADDING * 2,
  availableHeight: stageSize.height - STAGE_PADDING * 2,
  designWidth: target.value.width,
  designHeight: target.value.height,
}).scale)
const scale = computed(() => zoomMode.value === 'fit' ? fitScale.value : zoomMode.value)
const displayWidth = computed(() => Math.max(1, Math.floor(target.value.width * scale.value)))
const displayHeight = computed(() => Math.max(1, Math.floor(target.value.height * scale.value)))
const zoomPercent = computed(() => Math.round(scale.value * 100))
// The header has less room than the stage beside a narrow canvas panel.
const formatOptionLabels = computed(() => stageSize.width && stageSize.width < 480 ? compactFormatLabels : formatLabels)
const contentStyle = computed(() => ({
  width: Math.max(stageSize.width, displayWidth.value + STAGE_PADDING * 2) + 'px',
  height: Math.max(stageSize.height, displayHeight.value + STAGE_PADDING * 2) + 'px',
}))
const frameStyle = computed(() => ({
  width: displayWidth.value + 'px',
  height: displayHeight.value + 'px',
}))
const zoomSelectValue = computed(() => {
  if (zoomMode.value === 'fit') return 'fit'
  const preset = POST_STAGE_ZOOM_PRESETS.find(value => Math.abs(value - scale.value) < .001)
  return preset === undefined ? 'custom' : String(preset)
})

function setZoom(value: number | 'fit') {
  zoomMode.value = value === 'fit' ? 'fit' : clampStageZoom(value)
  // Keep the post centred in the stage after the zoom changes.
  void nextTick(() => {
    const stage = stageRef.value
    if (!stage) return
    stage.scrollLeft = (stage.scrollWidth - stage.clientWidth) / 2
    stage.scrollTop = (stage.scrollHeight - stage.clientHeight) / 2
  })
}

function zoomBy(direction: 1 | -1) {
  setZoom(stepStageZoom(scale.value, direction))
}

function onZoomSelect(event: Event) {
  const value = (event.target as HTMLSelectElement).value
  if (value === 'custom') return
  setZoom(value === 'fit' ? 'fit' : Number(value))
}

// Trackpad pinch / Ctrl + wheel zooms the preview instead of the page.
function onWheel(event: WheelEvent) {
  if (!event.ctrlKey && !event.metaKey) return
  event.preventDefault()
  zoomMode.value = clampStageZoom(scale.value * Math.exp(-event.deltaY * .01))
}

// --- Overlay geometry (export pixels → on-screen pixels) -----------------------------

function toScreen(box: { x: number, y: number, width: number, height: number }) {
  const ratio = displayWidth.value / target.value.width
  return {
    left: box.x * ratio + 'px',
    top: box.y * ratio + 'px',
    width: box.width * ratio + 'px',
    height: box.height * ratio + 'px',
  }
}

const imageBoxStyle = computed(() => editor.imageRect.value ? toScreen(editor.imageRect.value) : null)
const imageOverflows = computed(() => {
  const rect = editor.imageRect.value
  return Boolean(rect && (rect.width > target.value.width + 1 || rect.height > target.value.height + 1))
})
const textBoxStyles = computed(() => editor.textBoxes.value.map(box => toScreen({
  x: box.x - 8,
  y: box.y - 6,
  width: box.width + 16,
  height: box.height + 12,
})))

// --- Direct manipulation ---------------------------------------------------------

const hoverText = ref(-1)
const pointer = reactive({
  id: -1,
  mode: 'idle' as 'idle' | 'pending' | 'move' | 'scale',
  startX: 0,
  startY: 0,
  startImageX: 0,
  startImageY: 0,
  startZoom: 1,
  startDistance: 0,
  centreX: 0,
  centreY: 0,
})
const snapped = reactive({ x: false, y: false })
const dragging = computed(() => pointer.mode === 'move' || pointer.mode === 'scale')

function canvasPoint(event: PointerEvent) {
  const bounds = canvasRef.value?.getBoundingClientRect()
  if (!bounds?.width) return null
  return {
    x: (event.clientX - bounds.left) * (target.value.width / bounds.width),
    y: (event.clientY - bounds.top) * (target.value.height / bounds.height),
  }
}

function textAt(event: PointerEvent) {
  const point = canvasPoint(event)
  return point ? hitTestBoxes(editor.textBoxes.value, point.x, point.y, 10) : -1
}

function startCanvasPointer(event: PointerEvent) {
  if (!canvasRef.value || !editor.sourceSize.width) return
  if (event.pointerType === 'mouse' && event.button !== 0) return
  // No preventDefault: the native mousedown focuses the frame (for arrow-key
  // nudging) without a keyboard focus ring; touch-action and user-select
  // already stop scrolling and selection.
  canvasRef.value.setPointerCapture(event.pointerId)
  Object.assign(pointer, {
    id: event.pointerId,
    mode: 'pending',
    startX: event.clientX,
    startY: event.clientY,
    startImageX: design.imageX,
    startImageY: design.imageY,
  })
  editor.beginTransient()
}

function moveCanvasPointer(event: PointerEvent) {
  if (pointer.mode === 'idle') {
    hoverText.value = textAt(event)
    return
  }
  if (event.pointerId !== pointer.id || pointer.mode === 'scale') return

  const deltaX = event.clientX - pointer.startX
  const deltaY = event.clientY - pointer.startY
  if (pointer.mode === 'pending') {
    if (Math.hypot(deltaX, deltaY) < CLICK_SLOP) return
    pointer.mode = 'move'
    selection.value = 'image'
    hoverText.value = -1
  }

  const rendered = coverImageRect({
    sourceWidth: editor.sourceSize.width,
    sourceHeight: editor.sourceSize.height,
    targetWidth: target.value.width,
    targetHeight: target.value.height,
    zoom: design.zoom,
    imageX: 0,
    imageY: 0,
  })
  const delta = postImageDragDelta({
    deltaX,
    deltaY,
    displayWidth: displayWidth.value,
    displayHeight: displayHeight.value,
    targetWidth: target.value.width,
    targetHeight: target.value.height,
    renderedWidth: rendered.width,
    renderedHeight: rendered.height,
  })
  // Snap to the centre within a few screen pixels (1 unit = half the overflow).
  const ratio = displayWidth.value / target.value.width
  const overflowX = (rendered.width - target.value.width) * ratio / 2
  const overflowY = (rendered.height - target.value.height) * ratio / 2
  const x = snapToCentre(clampUnit(pointer.startImageX + delta.x), overflowX > 0 ? SNAP_PIXELS / overflowX : 0)
  const y = snapToCentre(clampUnit(pointer.startImageY + delta.y), overflowY > 0 ? SNAP_PIXELS / overflowY : 0)
  design.imageX = x.value
  design.imageY = y.value
  snapped.x = x.snapped && overflowX > 0
  snapped.y = y.snapped && overflowY > 0
}

function endCanvasPointer(event: PointerEvent) {
  if (event.pointerId !== pointer.id) return
  if (canvasRef.value?.hasPointerCapture(event.pointerId)) canvasRef.value.releasePointerCapture(event.pointerId)
  const wasClick = pointer.mode === 'pending' && event.type === 'pointerup'
  pointer.mode = 'idle'
  pointer.id = -1
  snapped.x = false
  snapped.y = false
  editor.endTransient()

  if (!wasClick) return
  // A click selects what is under the pointer and opens its tool.
  if (textAt(event) >= 0) {
    selection.value = 'text'
    emit('activate-tool', 'text')
  } else {
    selection.value = 'image'
    emit('activate-tool', 'media')
  }
}

function startHandle(event: PointerEvent) {
  if (event.pointerType === 'mouse' && event.button !== 0) return
  const bounds = canvasRef.value?.getBoundingClientRect()
  if (!bounds) return
  event.preventDefault()
  event.stopPropagation()
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  const centreX = bounds.left + bounds.width / 2
  const centreY = bounds.top + bounds.height / 2
  Object.assign(pointer, {
    id: event.pointerId,
    mode: 'scale',
    startZoom: design.zoom,
    centreX,
    centreY,
    startDistance: Math.hypot(event.clientX - centreX, event.clientY - centreY),
  })
  editor.beginTransient()
}

function moveHandle(event: PointerEvent) {
  if (pointer.mode !== 'scale' || event.pointerId !== pointer.id) return
  const distance = Math.hypot(event.clientX - pointer.centreX, event.clientY - pointer.centreY)
  design.zoom = pinchPostZoom(pointer.startZoom, pointer.startDistance, distance)
}

function endHandle(event: PointerEvent) {
  if (event.pointerId !== pointer.id) return
  const handle = event.currentTarget as HTMLElement
  if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId)
  pointer.mode = 'idle'
  pointer.id = -1
  editor.endTransient()
}

function clampUnit(value: number) {
  return Math.max(-1, Math.min(1, value))
}

// Keyboard: arrows nudge the photo (Shift for bigger steps), Enter opens its tool.
function onFrameKey(event: KeyboardEvent) {
  const steps: Record<string, [number, number]> = {
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
    ArrowUp: [0, -1],
    ArrowDown: [0, 1],
  }
  const step = steps[event.key]
  if (step) {
    event.preventDefault()
    const amount = event.shiftKey ? .1 : .02
    selection.value = 'image'
    design.imageX = clampUnit(design.imageX + step[0] * amount)
    design.imageY = clampUnit(design.imageY + step[1] * amount)
  } else if (event.key === 'Enter') {
    event.preventDefault()
    selection.value = 'image'
    emit('activate-tool', 'media')
  } else if (event.key === 'Escape') {
    selection.value = 'none'
  }
}

function clearSelection() {
  selection.value = 'none'
}

// --- Lifecycle ------------------------------------------------------------------

function measureStage(entries: ResizeObserverEntry[]) {
  const entry = entries[0]
  if (!entry) return
  stageSize.width = entry.contentRect.width
  stageSize.height = entry.contentRect.height
}

watch(canvasRef, (canvas, previous) => {
  if (previous) editor.unregisterCanvas(previous)
  if (canvas) editor.registerCanvas(canvas)
})

// A different format needs a fresh fit.
watch(() => design.preset, () => setZoom('fit'))

onMounted(() => {
  if (canvasRef.value) editor.registerCanvas(canvasRef.value)
  resizeObserver = new ResizeObserver(measureStage)
  if (stageRef.value) resizeObserver.observe(stageRef.value)
})

onBeforeUnmount(() => {
  if (canvasRef.value) editor.unregisterCanvas(canvasRef.value)
  resizeObserver?.disconnect()
})

defineExpose({ zoomBy, fit: () => setZoom('fit'), actualSize: () => setZoom(1) })
</script>

<template>
  <section class="canvas-panel" aria-label="Canvas">
    <div class="canvas-header">
      <button
        type="button"
        class="panel-toggle"
        :aria-label="inspectorCollapsed ? 'Show inspector' : 'Hide inspector'"
        :title="inspectorCollapsed ? 'Show inspector' : 'Hide inspector'"
        :aria-expanded="!inspectorCollapsed"
        aria-controls="post-tool-panel"
        @click="inspectorCollapsed = !inspectorCollapsed"
      >
        <Icon :name="inspectorCollapsed ? 'lucide:panel-left-open' : 'lucide:panel-left-close'" aria-hidden="true" />
      </button>
      <label class="format-select">
        <Icon name="lucide:instagram" aria-hidden="true" />
        <select v-model="design.preset" aria-label="Post format">
          <option v-for="[key] in presetOptions" :key="key" :value="key">{{ formatOptionLabels[key] }}</option>
        </select>
        <Icon class="select-chevron" name="lucide:chevron-down" aria-hidden="true" />
      </label>
      <span class="dimensions">{{ target.width }} <IconTimes /> {{ target.height }} px</span>

      <span class="header-spacer" />

      <button
        type="button"
        class="header-button"
        :class="{ active: design.showSafeArea }"
        aria-label="Safe-area guides"
        :aria-pressed="design.showSafeArea"
        title="Show safe-area guides (preview only, never exported)"
        @click="design.showSafeArea = !design.showSafeArea"
      >
        <Icon :name="design.showSafeArea ? 'lucide:square-dashed' : 'lucide:eye-off'" aria-hidden="true" />
        <span class="header-button-label">Safe area</span>
        <span class="state">{{ design.showSafeArea ? 'On' : 'Off' }}</span>
      </button>
      <button
        type="button"
        class="header-button"
        :class="{ active: zoomMode === 'fit' }"
        aria-label="Fit to screen"
        :aria-pressed="zoomMode === 'fit'"
        title="Fit to screen (Shift + 1)"
        @click="setZoom('fit')"
      >
        <Icon name="lucide:scan" aria-hidden="true" />
        <span class="header-button-label">Fit to screen</span>
      </button>
    </div>

    <div class="stage-wrap">
      <div ref="stageRef" class="stage" @wheel="onWheel">
        <div class="stage-content" :style="contentStyle" @pointerdown.self="clearSelection">
          <div
            v-if="editor.selectedAsset.value"
            ref="frameRef"
            class="canvas-frame"
            :class="{ selected: selection === 'image', dragging }"
            :style="frameStyle"
            tabindex="0"
            role="group"
            aria-roledescription="canvas"
            :aria-label="`Post preview, ${formatLabels[design.preset]}. Drag or use the arrow keys to move the photo.`"
            @keydown="onFrameKey"
          >
            <canvas
              ref="canvasRef"
              class="preview-canvas"
              :class="{ 'over-text': hoverText >= 0 && !dragging }"
              @pointerdown="startCanvasPointer"
              @pointermove="moveCanvasPointer"
              @pointerup="endCanvasPointer"
              @pointercancel="endCanvasPointer"
              @pointerleave="pointer.mode === 'idle' && (hoverText = -1)"
            />

            <div class="overlay" aria-hidden="true">
              <!-- Full photo extent while it is selected, including the part outside the post. -->
              <div v-if="selection === 'image' && imageOverflows && imageBoxStyle" class="image-extent" :class="{ dragging }" :style="imageBoxStyle" />

              <template v-if="selection === 'text' || hoverText >= 0">
                <div
                  v-for="(style, index) in textBoxStyles"
                  v-show="selection === 'text' || index === hoverText"
                  :key="index"
                  class="text-box"
                  :class="{ hovered: index === hoverText }"
                  :style="style"
                />
              </template>

              <template v-if="dragging && pointer.mode === 'move'">
                <div class="guide vertical" :class="{ snapped: snapped.x }" />
                <div class="guide horizontal" :class="{ snapped: snapped.y }" />
              </template>
            </div>

            <template v-if="selection === 'image'">
              <span
                v-for="corner in ['nw', 'ne', 'sw', 'se']"
                :key="corner"
                class="handle"
                :class="corner"
                aria-hidden="true"
                @pointerdown="startHandle"
                @pointermove="moveHandle"
                @pointerup="endHandle"
                @pointercancel="endHandle"
              />
            </template>
          </div>

          <div v-else class="no-source">
            <span class="empty-icon"><Icon name="lucide:image" aria-hidden="true" /></span>
            <strong>Choose a source photo</strong>
            <small>Upload a photo or pick one from the media library.</small>
            <button type="button" class="empty-action" @click="emit('activate-tool', 'media')">Open media</button>
          </div>
        </div>
      </div>

      <p v-if="editor.selectedAsset.value" class="stage-hint" :class="{ active: dragging }">
        <Icon name="lucide:move" aria-hidden="true" />
        {{ pointer.mode === 'scale' ? `Scale ${Math.round(design.zoom * 100)}%` : dragging ? 'Repositioning photo' : 'Drag to reposition · click text to edit it' }}
      </p>
    </div>

    <div class="zoom-bar" role="toolbar" aria-label="Zoom">
      <div class="zoom-group">
        <button type="button" class="zoom-button" aria-label="Zoom out" title="Zoom out (Ctrl/⌘ −)" :disabled="scale <= POST_STAGE_MIN_ZOOM + .001" @click="zoomBy(-1)">
          <Icon name="lucide:zoom-out" aria-hidden="true" />
        </button>
        <label class="zoom-select">
          <span class="visually-hidden">Zoom level</span>
          <select :value="zoomSelectValue" @change="onZoomSelect">
            <option value="fit">Fit ({{ Math.round(fitScale * 100) }}%)</option>
            <option v-if="zoomSelectValue === 'custom'" value="custom">{{ zoomPercent }}%</option>
            <option v-for="preset in POST_STAGE_ZOOM_PRESETS" :key="preset" :value="String(preset)">{{ Math.round(preset * 100) }}%</option>
          </select>
          <span class="zoom-value" aria-hidden="true">{{ zoomPercent }}%</span>
          <Icon class="select-chevron" name="lucide:chevron-down" aria-hidden="true" />
        </label>
        <button type="button" class="zoom-button" aria-label="Zoom in" title="Zoom in (Ctrl/⌘ +)" :disabled="scale >= POST_STAGE_MAX_ZOOM - .001" @click="zoomBy(1)">
          <Icon name="lucide:zoom-in" aria-hidden="true" />
        </button>
      </div>
      <button type="button" class="zoom-group fit-button" :class="{ active: zoomMode === 'fit' }" :aria-pressed="zoomMode === 'fit'" title="Fit to screen (Shift + 1)" @click="setZoom('fit')">
        <Icon name="lucide:scan" aria-hidden="true" />
        Fit
      </button>
    </div>
  </section>
</template>

<style scoped>
.canvas-panel {
  container: canvas-panel / inline-size;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  border: 1px solid #221e27;
  border-radius: 1rem;
  background: #0b0a0e;
}

.canvas-header {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: .75rem;
  min-width: 0;
  padding: .65rem .75rem;
  border-bottom: 1px solid #1d1a22;
}

.panel-toggle {
  display: grid;
  flex: 0 0 auto;
  width: 2.1rem;
  height: 2.1rem;
  place-items: center;
  margin-right: -.25rem;
  border: 0;
  border-radius: .5rem;
  background: transparent;
  color: #8f8798;
  font-size: 1.05rem;
  cursor: pointer;
}

.panel-toggle:hover {
  background: #1a1620;
  color: #fff;
}

.format-select {
  position: relative;
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: .5rem;
  min-width: 0;
  padding: 0 .65rem;
  border: 1px solid #2a2530;
  border-radius: .6rem;
  background: #131018;
  color: #d9d2e1;
}

.format-select select {
  min-width: 0;
  padding: .5rem 1.3rem .5rem 0;
  border: 0;
  background: transparent;
  color: #f3eff8;
  font-size: .8rem;
  cursor: pointer;
  appearance: none;
}

.format-select select:focus {
  outline: none;
}

.format-select:focus-within {
  border-color: #8b5cf6;
}

.select-chevron {
  position: absolute;
  right: .55rem;
  color: #8f8798;
  pointer-events: none;
}

.dimensions {
  flex: 0 0 auto;
  color: #7f7888;
  font-size: .74rem;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.header-spacer {
  flex: 1 1 auto;
}

.header-button {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: .45rem;
  padding: .45rem .7rem;
  border: 1px solid #2a2530;
  border-radius: .6rem;
  background: #131018;
  color: #cfc8d6;
  font-size: .76rem;
  cursor: pointer;
}

.header-button:hover {
  border-color: #3d3546;
  color: #fff;
}

.header-button.active {
  border-color: #5b3f93;
  color: #fff;
}

.header-button .state {
  padding: .05rem .35rem;
  border-radius: .3rem;
  background: #221d29;
  color: #a89fb2;
  font-size: .66rem;
}

.header-button.active .state {
  background: #3b2566;
  color: #e3d5ff;
}

/* Stage */

.stage-wrap {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
}

.stage {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  overflow: auto;
  background-color: #0b0a0e;
  background-image:
    linear-gradient(rgba(255, 255, 255, .025) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, .025) 1px, transparent 1px);
  background-size: 24px 24px;
  scrollbar-color: #2e2934 transparent;
}

.stage-content {
  display: flex;
  align-items: center;
  justify-content: center;
}

.canvas-frame {
  position: relative;
  flex: 0 0 auto;
  box-shadow: 0 24px 70px rgba(0, 0, 0, .55);
}

.canvas-frame:focus-visible {
  outline: 2px solid #d9cfff;
  outline-offset: 6px;
}

.preview-canvas {
  display: block;
  width: 100%;
  height: 100%;
  cursor: grab;
  touch-action: none;
  user-select: none;
}

.preview-canvas.over-text {
  cursor: pointer;
}

.canvas-frame.dragging .preview-canvas {
  cursor: grabbing;
}

.overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.canvas-frame.selected::after {
  position: absolute;
  inset: 0;
  border: 1px solid #a47bff;
  content: '';
  pointer-events: none;
}

.image-extent {
  position: absolute;
  border: 1px dashed rgba(177, 140, 255, .45);
  transition: border-color .15s ease;
}

.image-extent.dragging {
  border-color: rgba(177, 140, 255, .8);
  background: rgba(139, 92, 246, .05);
}

.text-box {
  position: absolute;
  border: 1px dashed rgba(177, 140, 255, .55);
  border-radius: 3px;
}

.text-box.hovered {
  border-style: solid;
  border-color: #b18cff;
  background: rgba(139, 92, 246, .08);
}

.guide {
  position: absolute;
  background-image: linear-gradient(90deg, rgba(177, 140, 255, .7) 50%, transparent 50%);
}

.guide.vertical {
  top: -24px;
  bottom: -24px;
  left: 50%;
  width: 1px;
  background-image: linear-gradient(rgba(177, 140, 255, .7) 50%, transparent 50%);
  background-size: 1px 8px;
}

.guide.horizontal {
  top: 50%;
  right: -24px;
  left: -24px;
  height: 1px;
  background-size: 8px 1px;
}

.guide.snapped {
  background-image: none;
  background-color: #d4bfff;
  box-shadow: 0 0 6px rgba(177, 140, 255, .8);
}

.handle {
  position: absolute;
  z-index: 1;
  width: 12px;
  height: 12px;
  border: 2px solid #a47bff;
  border-radius: 3px;
  background: #fff;
  touch-action: none;
}

.handle.nw { top: -6px; left: -6px; cursor: nwse-resize; }
.handle.ne { top: -6px; right: -6px; cursor: nesw-resize; }
.handle.sw { bottom: -6px; left: -6px; cursor: nesw-resize; }
.handle.se { right: -6px; bottom: -6px; cursor: nwse-resize; }

.stage-hint {
  position: absolute;
  left: 50%;
  bottom: .75rem;
  display: inline-flex;
  align-items: center;
  gap: .4rem;
  width: max-content;
  margin: 0;
  padding: .35rem .7rem;
  border-radius: 999px;
  background: rgba(12, 10, 16, .82);
  color: #a89fb2;
  font-size: .7rem;
  opacity: .8;
  pointer-events: none;
  transform: translateX(-50%);
  backdrop-filter: blur(8px);
}

.stage-hint.active {
  color: #fff;
  opacity: 1;
}

.no-source {
  display: grid;
  justify-items: center;
  gap: .45rem;
  max-width: 20rem;
  padding: 2rem;
  text-align: center;
}

.empty-icon {
  display: grid;
  width: 3rem;
  height: 3rem;
  place-items: center;
  border-radius: .9rem;
  background: #1b1621;
  color: #c7b5de;
  font-size: 1.4rem;
}

.no-source small {
  color: #7f7888;
  font-size: .78rem;
}

.empty-action {
  margin-top: .4rem;
  padding: .5rem .9rem;
  border: 1px solid #5b3f93;
  border-radius: .6rem;
  background: rgba(124, 58, 237, .14);
  color: #fff;
  cursor: pointer;
}

/* Zoom bar */

.zoom-bar {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: .6rem;
  padding: .6rem;
  border-top: 1px solid #1d1a22;
}

.zoom-group {
  display: inline-flex;
  align-items: center;
  gap: .15rem;
  padding: .2rem;
  border: 1px solid #2a2530;
  border-radius: .65rem;
  background: #131018;
}

.zoom-button {
  display: grid;
  width: 2rem;
  height: 2rem;
  place-items: center;
  border: 0;
  border-radius: .45rem;
  background: transparent;
  color: #cfc8d6;
  cursor: pointer;
}

.zoom-button:hover:not(:disabled) {
  background: #221d29;
  color: #fff;
}

.zoom-button:disabled {
  cursor: not-allowed;
  opacity: .35;
}

.zoom-select {
  position: relative;
  display: inline-flex;
  align-items: center;
  min-width: 4.6rem;
  height: 2rem;
}

.zoom-select select {
  position: absolute;
  inset: 0;
  width: 100%;
  opacity: 0;
  cursor: pointer;
}

.zoom-value {
  flex: 1 1 auto;
  padding-right: 1rem;
  color: #f3eff8;
  font-size: .8rem;
  font-variant-numeric: tabular-nums;
  text-align: center;
}

.zoom-select:focus-within {
  border-radius: .45rem;
  outline: 2px solid #d9cfff;
}

.zoom-select .select-chevron {
  right: .25rem;
}

.fit-button {
  gap: .45rem;
  height: 2.5rem;
  padding: 0 .8rem;
  color: #cfc8d6;
  font-size: .8rem;
  cursor: pointer;
}

.fit-button:hover,
.fit-button.active {
  color: #fff;
}

.fit-button.active {
  border-color: #5b3f93;
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

@container canvas-panel (max-width: 720px) {
  .header-button-label {
    display: none;
  }
}

@container canvas-panel (max-width: 520px) {
  .dimensions {
    display: none;
  }
}
</style>
