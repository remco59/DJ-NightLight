<script setup lang="ts">
// A field label you can drag sideways to change the number next to it, as in
// Figma or After Effects. Shift changes 10× faster, Alt 10× finer. The pointer
// is locked while dragging (where supported) so long drags do not run off
// screen. The parent owns the value and receives start / value / end events.

const props = defineProps<{
  value: number
  /** Change per pixel dragged. */
  step: number
  min: number
  max: number
  /** Decimal places kept in the emitted value. */
  precision?: number
}>()
const emit = defineEmits<{
  start: []
  scrub: [value: number]
  end: []
}>()

const active = ref(false)
let moved = false

function round(value: number) {
  const factor = 10 ** (props.precision ?? 0)
  return Math.round(value * factor) / factor
}

function pointerDown(event: PointerEvent) {
  if (event.button !== 0) return
  event.preventDefault()
  const label = event.currentTarget as HTMLElement
  const startValue = props.value
  let offset = 0
  moved = false
  active.value = true
  if (event.pointerType === 'mouse') {
    try {
      // Promise-returning in modern browsers; a rejection only means the cursor stays visible.
      void Promise.resolve(label.requestPointerLock?.()).catch(() => {})
    } catch {
      // Pointer lock unavailable: dragging still works while the pointer stays on screen.
    }
  }

  let lastX = event.clientX
  const move = (moveEvent: PointerEvent) => {
    // Locked pointers only report movement; otherwise (touch, no lock) use the position.
    const dx = document.pointerLockElement === label ? moveEvent.movementX : moveEvent.clientX - lastX
    lastX = moveEvent.clientX
    const factor = moveEvent.shiftKey ? 10 : moveEvent.altKey ? 0.1 : 1
    offset += dx * props.step * factor
    if (!moved) {
      if (!offset) return
      moved = true
      emit('start')
    }
    emit('scrub', round(Math.min(props.max, Math.max(props.min, startValue + offset))))
  }
  const end = () => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', end)
    window.removeEventListener('pointercancel', end)
    if (document.pointerLockElement === label) document.exitPointerLock()
    active.value = false
    if (moved) emit('end')
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', end)
  window.addEventListener('pointercancel', end)
}

function click(event: MouseEvent) {
  // A finished drag must not also focus the input the label belongs to.
  if (moved) event.preventDefault()
  moved = false
}
</script>

<template>
  <span
    class="scrub-label"
    :class="{ active }"
    title="Sleep opzij om te wijzigen (Shift: sneller, Alt: fijner)"
    @pointerdown="pointerDown"
    @click="click"
  ><slot /></span>
</template>

<style scoped>
.scrub-label {
  cursor: ew-resize;
  touch-action: none;
  user-select: none;
}

.scrub-label:hover, .scrub-label.active {
  color: var(--ve-text);
}
</style>
