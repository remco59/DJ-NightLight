<script setup lang="ts">
import { formatTimecode, itemEnd, type TimelineItem, type TrackKind, type VideoProject, type VideoTrack } from '~~/shared/video-project'
import { moveItem, snapFrame, snapTargets } from '~~/shared/video-timeline'
import { MOTION_TEMPLATES, type MotionTemplateKey } from '~~/shared/video-templates'
import { clampZoom, pinchZoom, timelineDisplayOrder } from '~~/shared/video-editor-ui'
import { useVideoEditor } from '~/composables/useVideoEditor'

// `compact` is the touch-first mobile timeline: no toolbar, icon-only track
// labels, bigger trim handles and tap-to-select so panning never moves clips.
const props = defineProps<{ compact?: boolean }>()
const emit = defineEmits<{ seek: [frame: number] }>()

const editor = useVideoEditor()
const { state } = editor
const LABEL_WIDTH = computed(() => props.compact ? 44 : 150)
const SNAP_PX = computed(() => props.compact ? 12 : 8)

const scroller = ref<HTMLElement | null>(null)
const pxPerFrame = computed(() => state.zoom / state.project.fps)
const contentFrames = computed(() => editor.duration.value + state.project.fps * 6)
const contentWidth = computed(() => Math.max(600, contentFrames.value * pxPerFrame.value))

// Top row = top layer on the canvas (see timelineDisplayOrder).
const displayTracks = computed(() => timelineDisplayOrder(state.project.tracks))

const ticks = computed(() => {
  const fps = state.project.fps
  const step = state.zoom >= 60 ? 1 : state.zoom >= 30 ? 2 : state.zoom >= 14 ? 5 : 10
  const list: Array<{ frame: number, label: string }> = []
  for (let second = 0; second * fps <= contentFrames.value; second += step) {
    list.push({ frame: second * fps, label: `${second}s` })
  }
  return list
})

function x(frame: number) {
  return frame * pxPerFrame.value
}

function frameAt(clientX: number, element: Element) {
  const rect = element.getBoundingClientRect()
  return Math.max(0, Math.round((clientX - rect.left) / pxPerFrame.value))
}

// --- Scrubbing ---------------------------------------------------------------

function scrubStart(event: PointerEvent) {
  const ruler = event.currentTarget as HTMLElement
  ruler.setPointerCapture(event.pointerId)
  const seek = (clientX: number) => emit('seek', Math.min(editor.duration.value - 1, frameAt(clientX, ruler)))
  seek(event.clientX)
  const move = (moveEvent: PointerEvent) => seek(moveEvent.clientX)
  const end = () => {
    ruler.removeEventListener('pointermove', move)
    ruler.removeEventListener('pointerup', end)
    ruler.removeEventListener('pointercancel', end)
  }
  ruler.addEventListener('pointermove', move)
  ruler.addEventListener('pointerup', end)
  ruler.addEventListener('pointercancel', end)
}

function laneClick(event: PointerEvent) {
  if (event.target !== event.currentTarget) return
  // Touch lanes seek on tap (click) so a pan to scroll does not move the playhead.
  if (props.compact && event.pointerType !== 'mouse') return
  seekLane(event)
}

function laneTap(event: MouseEvent) {
  if (!props.compact || event.target !== event.currentTarget) return
  seekLane(event)
}

function seekLane(event: MouseEvent) {
  state.selectedId = null
  emit('seek', Math.min(editor.duration.value - 1, frameAt(event.clientX, event.currentTarget as Element)))
}

// --- Item drag / trim --------------------------------------------------------

type DragMode = 'move' | 'trim-start' | 'trim-end'
const dragging = ref<{ id: string, mode: DragMode } | null>(null)

function snapped(frame: number, base: VideoProject, itemId: string) {
  if (!state.snap) return frame
  return snapFrame(frame, snapTargets(base, state.frame, itemId), SNAP_PX.value / pxPerFrame.value)
}

function startDrag(event: PointerEvent, item: TimelineItem, mode: DragMode) {
  if (event.button !== 0) return
  event.stopPropagation()
  // On touch, only an already-selected clip can be dragged; the first tap selects
  // it (see itemTap) and a pan over unselected clips scrolls the timeline.
  if (props.compact && event.pointerType !== 'mouse' && state.selectedId !== item.id) return
  if (pinching) return
  state.selectedId = item.id
  const target = event.currentTarget as HTMLElement
  target.setPointerCapture(event.pointerId)
  const startX = event.clientX
  const base = JSON.parse(JSON.stringify(toRaw(state.project))) as VideoProject
  let started = false

  const move = (moveEvent: PointerEvent) => {
    const dx = moveEvent.clientX - startX
    if (!started) {
      if (Math.abs(dx) < 3 && mode === 'move' && Math.abs(moveEvent.clientY - event.clientY) < 6) return
      started = true
      dragging.value = { id: item.id, mode }
      editor.beginTransient()
    }
    const delta = Math.round(dx / pxPerFrame.value)
    if (mode === 'move') {
      const desired = item.start + delta
      const snapStart = snapped(desired, base, item.id)
      const snapEnd = snapped(desired + item.duration, base, item.id) - item.duration
      const start = Math.abs(snapStart - desired) <= Math.abs(snapEnd - desired) ? snapStart : snapEnd
      const lane = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY)?.closest<HTMLElement>('[data-track-id]')
      editor.transient(moveItem(base, item.id, start, lane?.dataset.trackId))
    } else if (mode === 'trim-start') {
      const edge = snapped(item.start + delta, base, item.id)
      editor.transient(editor.trim(base, item.id, 'start', edge - item.start))
    } else {
      const edge = snapped(itemEnd(item) + delta, base, item.id)
      editor.transient(editor.trim(base, item.id, 'end', edge - itemEnd(item)))
    }
  }
  const end = (endEvent: PointerEvent) => {
    target.removeEventListener('pointermove', move)
    target.removeEventListener('pointerup', end)
    target.removeEventListener('pointercancel', end)
    window.removeEventListener('keydown', cancel)
    if (started) {
      if (endEvent.type === 'pointercancel') editor.cancelTransient()
      else editor.endTransient()
    }
    dragging.value = null
  }
  const cancel = (keyEvent: KeyboardEvent) => {
    if (keyEvent.key !== 'Escape' || !started) return
    editor.cancelTransient()
    started = false
    dragging.value = null
  }
  target.addEventListener('pointermove', move)
  target.addEventListener('pointerup', end)
  target.addEventListener('pointercancel', end)
  window.addEventListener('keydown', cancel)
}

function itemTap(item: TimelineItem) {
  if (props.compact) state.selectedId = item.id
}

// --- Drop from the media / template panels ----------------------------------

const dropTrackId = ref('')

function acceptsDrop(event: DragEvent) {
  const types = event.dataTransfer?.types || []
  return types.includes('application/x-nightlight-media') || types.includes('application/x-nightlight-template')
}

function dragOver(event: DragEvent, track: VideoTrack) {
  if (!acceptsDrop(event)) return
  event.preventDefault()
  dropTrackId.value = track.id
}

function drop(event: DragEvent, track: VideoTrack) {
  dropTrackId.value = ''
  const frame = frameAt(event.clientX, event.currentTarget as Element)
  const mediaId = event.dataTransfer?.getData('application/x-nightlight-media')
  const templateKey = event.dataTransfer?.getData('application/x-nightlight-template')
  if (mediaId) {
    const asset = editor.mediaById.value.get(mediaId)
    if (asset) editor.addMedia(asset, track.id, snapped(frame, state.project, ''))
  } else if (templateKey && templateKey in MOTION_TEMPLATES) {
    editor.addTemplate(templateKey as MotionTemplateKey, track.id, snapped(frame, state.project, ''))
  }
}

// --- Item visuals -------------------------------------------------------------

function itemLabel(item: TimelineItem) {
  if (item.type === 'graphic') return MOTION_TEMPLATES[item.templateKey]?.label || 'Graphic'
  const asset = editor.mediaById.value.get(item.assetId)
  return asset?.title || asset?.originalFilename || 'Missing media'
}

function itemStyle(item: TimelineItem) {
  const style: Record<string, string> = {
    left: `${x(item.start)}px`,
    width: `${Math.max(6, x(item.duration))}px`,
  }
  if (item.type === 'video' || item.type === 'image') {
    const thumb = editor.mediaById.value.get(item.assetId)?.thumbnailUrl
    if (thumb) style.backgroundImage = `linear-gradient(rgba(10,6,20,.35), rgba(10,6,20,.35)), url(${thumb})`
  }
  return style
}

function waveform(item: TimelineItem) {
  if (item.type !== 'audio') return ''
  const asset = editor.mediaById.value.get(item.assetId)
  const peaks = asset?.metadata?.peaks
  const total = editor.sourceFrames(item)
  if (!peaks?.length || !total) return ''
  const from = Math.floor(item.trimStart / total * peaks.length)
  const to = Math.max(from + 1, Math.ceil((item.trimStart + item.duration) / total * peaks.length))
  const slice = peaks.slice(from, to)
  const step = 100 / slice.length
  return slice.map((value, index) => `M${(index * step + step / 2).toFixed(2)} ${(50 - value * 45).toFixed(1)}V${(50 + value * 45).toFixed(1)}`).join('')
}

const kindIcon: Record<TrackKind, string> = { video: 'lucide:film', graphics: 'lucide:type', audio: 'lucide:music' }

// Keep the playhead in view while playing.
watch(() => state.frame, (frame) => {
  const element = scroller.value
  if (!element || !state.playing) return
  const position = LABEL_WIDTH.value + x(frame)
  if (position > element.scrollLeft + element.clientWidth - 40) element.scrollLeft = position - LABEL_WIDTH.value - 40
})

function zoomBy(factor: number) {
  state.zoom = clampZoom(state.zoom * factor)
}

// --- Pinch to zoom (touch) -----------------------------------------------------

let pinching: { distance: number, zoom: number, frame: number, offset: number } | null = null

function touchDistance(touches: TouchList) {
  const [a, b] = [touches[0]!, touches[1]!]
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
}

function touchStart(event: TouchEvent) {
  const element = scroller.value
  if (event.touches.length !== 2 || !element) return
  // A second finger turns any clip drag into a pinch.
  if (dragging.value) {
    editor.cancelTransient()
    dragging.value = null
  }
  const midX = (event.touches[0]!.clientX + event.touches[1]!.clientX) / 2
  const offset = midX - element.getBoundingClientRect().left - LABEL_WIDTH.value
  pinching = { distance: touchDistance(event.touches), zoom: state.zoom, frame: (element.scrollLeft + offset) / pxPerFrame.value, offset }
}

function touchMove(event: TouchEvent) {
  if (!pinching || event.touches.length !== 2) return
  event.preventDefault()
  state.zoom = pinchZoom(pinching.zoom, pinching.distance, touchDistance(event.touches))
  const anchor = pinching
  // Keep the frame between the fingers in place while the content resizes.
  void nextTick(() => {
    if (scroller.value) scroller.value.scrollLeft = anchor.frame * pxPerFrame.value - anchor.offset
  })
}

function touchEnd(event: TouchEvent) {
  if (event.touches.length < 2) pinching = null
}

function wheel(event: WheelEvent) {
  if (!event.ctrlKey && !event.metaKey) return
  event.preventDefault()
  zoomBy(event.deltaY > 0 ? 0.85 : 1.18)
}
</script>

<template>
  <section class="timeline" :class="{ dragging: Boolean(dragging), compact: props.compact }">
    <div v-if="!props.compact" class="toolbar">
      <div class="group">
        <button type="button" title="Undo (Ctrl/Cmd+Z)" :disabled="!editor.canUndo.value" @click="editor.undo()"><Icon name="lucide:undo-2" aria-hidden="true" /></button>
        <button type="button" title="Redo (Ctrl/Cmd+Shift+Z)" :disabled="!editor.canRedo.value" @click="editor.redo()"><Icon name="lucide:redo-2" aria-hidden="true" /></button>
        <span class="divider" />
        <button type="button" title="Delete (Delete)" :disabled="!state.selectedId" @click="editor.deleteSelected()"><Icon name="lucide:trash-2" aria-hidden="true" /></button>
        <button type="button" title="Split at playhead (S)" @click="editor.splitSelected()"><Icon name="lucide:scissors" aria-hidden="true" /></button>
        <button type="button" title="Duplicate (Ctrl/Cmd+D)" :disabled="!state.selectedId" @click="editor.duplicateSelected()"><Icon name="lucide:copy" aria-hidden="true" /></button>
        <span class="divider" />
        <button type="button" title="Add video track" @click="editor.addTrack('video')"><Icon name="lucide:plus" aria-hidden="true" />Video</button>
        <button type="button" title="Add graphics track" @click="editor.addTrack('graphics')"><Icon name="lucide:plus" aria-hidden="true" />Graphics</button>
        <button type="button" title="Add audio track" @click="editor.addTrack('audio')"><Icon name="lucide:plus" aria-hidden="true" />Audio</button>
      </div>
      <div class="group">
        <span class="timecode">{{ formatTimecode(state.frame, state.project.fps) }}:{{ String(state.frame % state.project.fps).padStart(2, '0') }}</span>
        <button type="button" title="Zoom out" @click="zoomBy(0.8)"><Icon name="lucide:zoom-out" aria-hidden="true" /></button>
        <input v-model.number="state.zoom" class="zoom" type="range" min="8" max="400" aria-label="Timeline zoom">
        <button type="button" title="Zoom in" @click="zoomBy(1.25)"><Icon name="lucide:zoom-in" aria-hidden="true" /></button>
        <label class="snap"><input v-model="state.snap" type="checkbox"> Snap</label>
      </div>
    </div>

    <div
      ref="scroller"
      class="scroller"
      @wheel="wheel"
      @touchstart.passive="touchStart"
      @touchmove="touchMove"
      @touchend.passive="touchEnd"
      @touchcancel.passive="touchEnd"
    >
      <div class="grid" :style="{ width: `${LABEL_WIDTH + contentWidth}px` }">
        <div class="ruler-row">
          <div class="corner" :style="{ width: `${LABEL_WIDTH}px` }" />
          <div class="ruler" :style="{ width: `${contentWidth}px` }" @pointerdown="scrubStart">
            <span v-for="tick in ticks" :key="tick.frame" class="tick" :style="{ left: `${x(tick.frame)}px` }">{{ tick.label }}</span>
            <span class="end-marker" :style="{ left: `${x(editor.duration.value)}px` }" title="End of video" />
          </div>
        </div>

        <div v-for="track in displayTracks" :key="track.id" class="track-row" :class="[track.kind, { hidden: track.hidden, muted: track.muted }]">
          <div v-if="props.compact" class="track-label" :style="{ width: `${LABEL_WIDTH}px` }">
            <button
              type="button"
              class="track-toggle"
              :class="{ off: track.kind === 'audio' ? track.muted : track.hidden }"
              :aria-label="`${track.name}: ${track.kind === 'audio' ? (track.muted ? 'unmute' : 'mute') : (track.hidden ? 'show' : 'hide')}`"
              :aria-pressed="track.kind === 'audio' ? track.muted : track.hidden"
              @click="editor.toggleTrack(track.id, track.kind === 'audio' ? 'muted' : 'hidden')"
            >
              <Icon :name="kindIcon[track.kind]" aria-hidden="true" />
            </button>
          </div>
          <div v-else class="track-label" :style="{ width: `${LABEL_WIDTH}px` }">
            <Icon class="kind" :name="kindIcon[track.kind]" aria-hidden="true" />
            <span class="name">{{ track.name }}</span>
            <button v-if="track.kind !== 'audio'" type="button" :title="track.hidden ? 'Show track' : 'Hide track'" @click="editor.toggleTrack(track.id, 'hidden')"><Icon :name="track.hidden ? 'lucide:eye-off' : 'lucide:eye'" aria-hidden="true" /></button>
            <button v-if="track.kind !== 'graphics'" type="button" :title="track.muted ? 'Unmute track' : 'Mute track'" @click="editor.toggleTrack(track.id, 'muted')"><Icon :name="track.muted ? 'lucide:volume-x' : 'lucide:volume-2'" aria-hidden="true" /></button>
            <button v-if="state.project.tracks.length > 1 && !track.items.length" type="button" title="Remove empty track" @click="editor.removeTrack(track.id)"><Icon name="lucide:x" aria-hidden="true" /></button>
          </div>
          <div
            class="lane"
            :class="{ 'drop-target': dropTrackId === track.id }"
            :data-track-id="track.id"
            :style="{ width: `${contentWidth}px` }"
            @pointerdown="laneClick"
            @click="laneTap"
            @dragover="dragOver($event, track)"
            @dragleave="dropTrackId = ''"
            @drop="drop($event, track)"
          >
            <div
              v-for="item in track.items"
              :key="item.id"
              class="item"
              :class="[item.type, { selected: state.selectedId === item.id }]"
              :style="itemStyle(item)"
              :title="itemLabel(item)"
              @pointerdown="startDrag($event, item, 'move')"
              @click.stop="itemTap(item)"
            >
              <span class="handle start" @pointerdown="startDrag($event, item, 'trim-start')" />
              <svg v-if="item.type === 'audio'" class="wave" viewBox="0 0 100 100" preserveAspectRatio="none"><path :d="waveform(item)" /></svg>
              <span class="label">
                <b v-if="item.type === 'graphic'"><Icon name="lucide:type" aria-hidden="true" /></b>
                <b v-else-if="item.type === 'audio'"><Icon name="lucide:music" aria-hidden="true" /></b>
                {{ itemLabel(item) }}
              </span>
              <span class="handle end" @pointerdown="startDrag($event, item, 'trim-end')" />
            </div>
          </div>
        </div>

        <div class="playhead" :style="{ left: `${LABEL_WIDTH + x(state.frame)}px` }"><i /></div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.timeline {
  display: flex;
  flex-direction: column;
  min-height: 0;
  border-top: 1px solid var(--ve-border);
  background: var(--ve-panel);
  user-select: none;
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: .5rem;
  padding: .45rem .75rem;
  border-bottom: 1px solid var(--ve-border);
}

.group {
  display: flex;
  align-items: center;
  gap: .25rem;
}

.toolbar button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: .3rem;
  min-width: 30px;
  height: 30px;
  padding: 0 .5rem;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--ve-text);
  font-size: .82rem;
  cursor: pointer;
}

.toolbar button svg { width: 16px; height: 16px; }

.toolbar button:hover:not(:disabled) { background: var(--ve-raised); }
.toolbar button:disabled { opacity: .35; cursor: default; }

.divider {
  width: 1px;
  height: 18px;
  margin: 0 .3rem;
  background: var(--ve-border);
}

.timecode {
  margin-right: .5rem;
  color: var(--ve-muted);
  font-size: .8rem;
  font-variant-numeric: tabular-nums;
}

.zoom {
  width: 110px;
  accent-color: var(--ve-accent);
}

.snap {
  display: flex;
  align-items: center;
  gap: .3rem;
  margin-left: .5rem;
  font-size: .8rem;
}

.snap input { accent-color: var(--ve-accent); }

.scroller {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.grid {
  position: relative;
  min-height: 100%;
}

.ruler-row, .track-row {
  display: flex;
}

.corner, .track-label {
  position: sticky;
  left: 0;
  z-index: 3;
  flex: none;
  background: var(--ve-panel);
  border-right: 1px solid var(--ve-border);
}

.ruler {
  position: relative;
  height: 26px;
  border-bottom: 1px solid var(--ve-border);
  background: repeating-linear-gradient(90deg, transparent 0 9px, rgba(255,255,255,.05) 9px 10px);
  cursor: ew-resize;
}

.tick {
  position: absolute;
  top: 0;
  height: 100%;
  padding: 4px 0 0 4px;
  border-left: 1px solid rgba(255, 255, 255, .22);
  color: var(--ve-muted);
  font-size: .68rem;
  pointer-events: none;
}

.end-marker {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  background: #f472b6;
  pointer-events: none;
}

.track-row {
  height: 52px;
  border-bottom: 1px solid var(--ve-border);
}

.track-row.audio { height: 56px; }

.track-label {
  display: flex;
  align-items: center;
  gap: .3rem;
  padding: 0 .4rem 0 .6rem;
  font-size: .8rem;
}

.track-label .kind {
  flex: none;
  width: 14px;
  height: 14px;
  color: var(--ve-muted);
}

.track-label .name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.track-label button {
  display: inline-flex;
  padding: .1rem;
  border: 0;
  background: none;
  color: var(--ve-muted);
  font-size: .8rem;
  cursor: pointer;
}

.track-label button:hover { color: var(--ve-text); }

.lane {
  position: relative;
  flex: none;
}

.lane.drop-target { background: rgba(139, 92, 246, .12); }

.track-row.hidden .item, .track-row.muted.audio .item { opacity: .45; }

.item {
  position: absolute;
  top: 5px;
  bottom: 5px;
  display: flex;
  align-items: center;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, .18);
  border-radius: 6px;
  background-color: #2a2140;
  background-position: left center;
  background-repeat: repeat-x;
  background-size: auto 100%;
  color: #fff;
  font-size: .76rem;
  cursor: grab;
}

.timeline.dragging .item { cursor: grabbing; }

.item.graphic {
  background: linear-gradient(180deg, #7c3aed, #6d28d9);
  border-color: #a78bfa;
}

.item.audio {
  background: #123524;
  border-color: #22c55e88;
}

.item.selected {
  z-index: 2;
  outline: 2px solid #f5f3ff;
  outline-offset: -1px;
}

.label {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: .35rem;
  overflow: hidden;
  padding: 0 .7rem;
  text-overflow: ellipsis;
  text-shadow: 0 1px 2px rgba(0, 0, 0, .8);
  white-space: nowrap;
  pointer-events: none;
}

.label b {
  display: inline-flex;
  padding: .15rem .2rem;
  border-radius: 3px;
  background: rgba(0, 0, 0, .25);
  font-size: .7rem;
}

.wave {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.wave path {
  stroke: #4ade80;
  stroke-width: 1;
  vector-effect: non-scaling-stroke;
}

.handle {
  position: absolute;
  top: 0;
  bottom: 0;
  z-index: 2;
  width: 8px;
  cursor: ew-resize;
}

.handle.start { left: 0; }
.handle.end { right: 0; }

.item:hover .handle, .item.selected .handle {
  background: rgba(255, 255, 255, .35);
}

.playhead {
  position: absolute;
  top: 0;
  bottom: 0;
  z-index: 4;
  width: 2px;
  margin-left: -1px;
  background: #a78bfa;
  pointer-events: none;
}

.playhead i {
  position: absolute;
  top: 0;
  left: -6px;
  width: 14px;
  height: 14px;
  border-radius: 3px 3px 7px 7px;
  background: #a78bfa;
}
/* --- Compact (mobile) --------------------------------------------------------- */

.timeline.compact { border-top: 0; }

.compact .scroller {
  overscroll-behavior: contain;
  touch-action: pan-x pan-y;
}

.compact .ruler-row {
  position: sticky;
  top: 0;
  z-index: 5;
  background: var(--ve-panel);
}

.compact .ruler {
  height: 24px;
  touch-action: none;
}

.compact .track-row, .compact .track-row.audio { height: 40px; }

.compact .track-label {
  justify-content: center;
  padding: 0;
}

.track-toggle {
  display: grid;
  width: 36px;
  height: 36px;
  place-items: center;
  border-radius: 8px;
}

.compact .track-label .track-toggle {
  padding: 0;
  color: var(--ve-text);
}

.compact .track-label .track-toggle.off { color: var(--ve-muted); opacity: .6; }

.track-toggle svg { width: 16px; height: 16px; }

.compact .item {
  top: 3px;
  bottom: 3px;
  border-radius: 7px;
  font-size: .7rem;
}

.compact .item.selected {
  outline: 2px solid #c4b5fd;
  box-shadow: 0 0 14px rgba(167, 139, 250, .55);
  touch-action: none;
}

.compact .label { padding: 0 .5rem; }

.compact .handle { display: none; }

.compact .item.selected .handle {
  display: grid;
  width: 18px;
  place-items: center;
  background: #c4b5fd;
  touch-action: none;
}

.compact .item.selected .handle::after {
  width: 2px;
  height: 45%;
  border-radius: 1px;
  background: #2e1065;
  content: "";
}

.compact .item.selected .label { padding: 0 1.4rem; }

.compact .playhead { width: 2px; background: #f5f3ff; box-shadow: 0 0 8px rgba(167, 139, 250, .9); }

.compact .playhead i {
  left: -7px;
  width: 16px;
  height: 16px;
  background: #f5f3ff;
}
</style>
