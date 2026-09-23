<script setup lang="ts">
// Drag handle between two editor panels. It reports how far the pointer moved
// since the drag started; the page owns the sizes and their limits.
// `vertical` = a vertical bar that resizes columns (drags along x).

const props = defineProps<{
  orientation: 'vertical' | 'horizontal'
  label: string
  value: number
  min: number
  max: number
}>()
const emit = defineEmits<{
  start: []
  move: [delta: number]
  end: []
  step: [delta: number]
  reset: []
}>()

const active = ref(false)

function pointerDown(event: PointerEvent) {
  if (event.button !== 0) return
  event.preventDefault()
  const handle = event.currentTarget as HTMLElement
  handle.setPointerCapture(event.pointerId)
  const origin = props.orientation === 'vertical' ? event.clientX : event.clientY
  active.value = true
  emit('start')
  const move = (moveEvent: PointerEvent) => {
    emit('move', (props.orientation === 'vertical' ? moveEvent.clientX : moveEvent.clientY) - origin)
  }
  const end = () => {
    handle.removeEventListener('pointermove', move)
    handle.removeEventListener('pointerup', end)
    handle.removeEventListener('pointercancel', end)
    active.value = false
    emit('end')
  }
  handle.addEventListener('pointermove', move)
  handle.addEventListener('pointerup', end)
  handle.addEventListener('pointercancel', end)
}

function keyDown(event: KeyboardEvent) {
  const back = props.orientation === 'vertical' ? 'ArrowLeft' : 'ArrowUp'
  const forward = props.orientation === 'vertical' ? 'ArrowRight' : 'ArrowDown'
  if (event.key !== back && event.key !== forward) return
  event.preventDefault()
  // The page's keyboard shortcuts (arrows move the playhead) must not also fire.
  event.stopPropagation()
  const size = event.shiftKey ? 64 : 16
  emit('step', event.key === back ? -size : size)
}
</script>

<template>
  <div
    class="splitter"
    :class="[props.orientation, { active }]"
    role="separator"
    tabindex="0"
    :aria-label="props.label"
    :aria-orientation="props.orientation"
    :aria-valuenow="props.value"
    :aria-valuemin="props.min"
    :aria-valuemax="props.max"
    title="Drag to resize, double-click to reset"
    @pointerdown="pointerDown"
    @keydown="keyDown"
    @dblclick="emit('reset')"
  />
</template>

<style scoped>
.splitter {
  position: absolute;
  z-index: 5;
  touch-action: none;
}

.splitter::after {
  position: absolute;
  background: transparent;
  content: '';
  transition: background .12s;
}

.splitter.vertical {
  top: 0;
  bottom: 0;
  width: 9px;
  margin-left: -4px;
  cursor: col-resize;
}

.splitter.vertical::after {
  top: 0;
  bottom: 0;
  left: 3px;
  width: 3px;
}

.splitter.horizontal {
  right: 0;
  left: 0;
  height: 9px;
  margin-top: -4px;
  cursor: row-resize;
}

.splitter.horizontal::after {
  top: 3px;
  right: 0;
  left: 0;
  height: 3px;
}

.splitter:hover::after, .splitter.active::after, .splitter:focus-visible::after {
  background: var(--ve-accent);
}

.splitter:focus-visible { outline: none; }
</style>
