<script setup lang="ts">
import type { GridLine } from '~~/shared/beat-grid'
import { sampleColumns, type Waveform } from '~/utils/audio-waveform'

// Draws the visible part of an audio clip's detailed waveform. Only the slice
// on screen is drawn (a long clip at high zoom is wider than a canvas may be),
// so the parent passes which item-local pixel range is visible.

const props = defineProps<{
  waveform: Waveform
  /** Source seconds at the clip's left edge. */
  offset: number
  pixelsPerSecond: number
  /** Visible range in item-local pixels. */
  from: number
  to: number
  /** Beat grid lines in item-local pixels. */
  beats?: Array<GridLine & { x: number }>
}>()

const canvas = ref<HTMLCanvasElement | null>(null)
let frame = 0

function draw() {
  frame = 0
  const element = canvas.value
  const context = element?.getContext('2d')
  if (!element || !context) return
  const ratio = window.devicePixelRatio || 1
  const width = Math.max(1, Math.round((props.to - props.from) * ratio))
  const height = Math.max(1, Math.round(element.clientHeight * ratio))
  if (element.width !== width) element.width = width
  if (element.height !== height) element.height = height
  context.clearRect(0, 0, width, height)

  const step = 1 / (props.pixelsPerSecond * ratio)
  const { peaks, bass } = sampleColumns(props.waveform, props.offset + props.from / props.pixelsPerSecond, step, width)
  const middle = height / 2
  const reach = middle * 0.92
  // Full signal first, then the bass band on top so drops read as solid blocks.
  context.fillStyle = 'rgba(74, 222, 128, .55)'
  for (let column = 0; column < width; column++) {
    const size = Math.max(ratio * 0.5, peaks[column]! * reach)
    context.fillRect(column, middle - size, 1, size * 2)
  }
  context.fillStyle = '#22d3ee'
  for (let column = 0; column < width; column++) {
    const size = Math.min(bass[column]!, peaks[column]!) * reach
    if (size >= 0.5) context.fillRect(column, middle - size, 1, size * 2)
  }
  // Beat grid: faint ticks per beat, full-height lines on bars. Beats closer than
  // 4px are skipped so a zoomed-out timeline shows bars only.
  const beatSpacing = (props.beats?.[1]?.x ?? Infinity) - (props.beats?.[0]?.x ?? 0)
  for (const line of props.beats || []) {
    if (!line.bar && beatSpacing < 4) continue
    const column = Math.round((line.x - props.from) * ratio)
    if (column < 0 || column >= width) continue
    context.fillStyle = line.bar ? 'rgba(255, 255, 255, .55)' : 'rgba(255, 255, 255, .22)'
    const tick = line.bar ? height : height * 0.3
    context.fillRect(column, line.bar ? 0 : height - tick, Math.max(1, Math.round(ratio)), tick)
  }
}

function schedule() {
  if (!frame) frame = requestAnimationFrame(draw)
}

watch(() => [props.waveform, props.offset, props.pixelsPerSecond, props.from, props.to, props.beats], schedule)
onMounted(schedule)
onBeforeUnmount(() => cancelAnimationFrame(frame))
</script>

<template>
  <canvas
    ref="canvas"
    class="wave-canvas"
    :style="{ left: `${props.from}px`, width: `${props.to - props.from}px` }"
    aria-hidden="true"
  />
</template>

<style scoped>
.wave-canvas {
  position: absolute;
  top: 0;
  height: 100%;
  pointer-events: none;
}
</style>
