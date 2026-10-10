<script setup lang="ts">
import { nextSnap, sheetHeights, type SheetSnap } from '~~/shared/video-editor-ui'

// Bottom sheet of the mobile editor: slides over the timeline, directly above
// the bottom navigation. It is an anchor of zero height placed right before the
// nav, so the timeline behind it keeps its size, scroll position and playhead.

defineProps<{ title: string }>()
const emit = defineEmits<{ close: [] }>()
const snap = defineModel<SheetSnap>('snap', { default: 'half' })

const viewportHeight = ref(800)
const heights = computed(() => sheetHeights(viewportHeight.value))
const dragOffset = ref<number | null>(null) // px the sheet is currently dragged above/below its snap
const baseHeight = computed(() => snap.value === 'full' ? heights.value.full : heights.value.half)
const liveHeight = computed(() => Math.max(0, baseHeight.value - (dragOffset.value ?? 0)))

function syncViewport() {
  viewportHeight.value = window.innerHeight
}

let drag: { startY: number, lastY: number, lastTime: number, velocity: number, pointerId: number } | null = null

function startDrag(event: PointerEvent) {
  if (event.pointerType === 'mouse' && event.button !== 0) return
  drag = { startY: event.clientY, lastY: event.clientY, lastTime: event.timeStamp, velocity: 0, pointerId: event.pointerId }
  dragOffset.value = 0
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
}

function moveDrag(event: PointerEvent) {
  if (!drag || event.pointerId !== drag.pointerId) return
  const dt = Math.max(1, event.timeStamp - drag.lastTime)
  drag.velocity = (event.clientY - drag.lastY) / dt
  drag.lastY = event.clientY
  drag.lastTime = event.timeStamp
  // Positive offset = dragged up (taller sheet); keep it within the screen.
  const raw = drag.startY - event.clientY
  dragOffset.value = Math.min(raw, heights.value.full - baseHeight.value)
}

function endDrag(event: PointerEvent) {
  if (!drag || event.pointerId !== drag.pointerId) return
  const height = liveHeight.value
  const velocity = drag.velocity
  const moved = Math.abs(event.clientY - drag.startY) > 4
  drag = null
  dragOffset.value = null
  if (!moved) return
  const next = nextSnap(height, velocity, heights.value)
  if (next === 'closed') emit('close')
  else snap.value = next
}

function cancelDrag() {
  drag = null
  dragOffset.value = null
}

// The handle doubles as a keyboard control: arrows resize, Escape closes.
function onHandleKey(event: KeyboardEvent) {
  if (event.key === 'ArrowUp') snap.value = 'full'
  else if (event.key === 'ArrowDown') {
    if (snap.value === 'full') snap.value = 'half'
    else emit('close')
  }
  else if (event.key === 'Escape') emit('close')
  else return
  event.preventDefault()
}

onMounted(() => {
  syncViewport()
  window.addEventListener('resize', syncViewport)
})
onBeforeUnmount(() => window.removeEventListener('resize', syncViewport))
</script>

<template>
  <div class="sheet-anchor">
    <div class="backdrop" aria-hidden="true" @pointerdown.prevent="emit('close')" />
    <section
      class="sheet"
      :class="{ dragging: dragOffset !== null }"
      :style="{ height: `${liveHeight}px` }"
      role="dialog"
      aria-modal="false"
      :aria-label="title"
    >
      <div
        class="grab"
        role="separator"
        tabindex="0"
        aria-orientation="horizontal"
        :aria-label="snap === 'full' ? 'Sheet verkleinen of sluiten' : 'Sheet vergroten of sluiten'"
        :aria-valuenow="snap === 'full' ? 100 : 50"
        @pointerdown="startDrag"
        @pointermove="moveDrag"
        @pointerup="endDrag"
        @pointercancel="cancelDrag"
        @keydown="onHandleKey"
      >
        <i class="handle" aria-hidden="true" />
      </div>
      <header class="sheet-head">
        <h2>{{ title }}</h2>
        <button type="button" class="close" aria-label="Sheet sluiten" @click="emit('close')">
          <Icon name="lucide:x" aria-hidden="true" />
        </button>
      </header>
      <div class="sheet-body">
        <slot />
      </div>
    </section>
  </div>
</template>

<style scoped>
.sheet-anchor {
  position: relative;
  z-index: 20;
  flex: none;
  height: 0;
}

/* Invisible catcher over the rest of the editor: a tap closes the sheet and the
   timeline behind it cannot be panned or pinched by accident. */
.backdrop {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  height: 100dvh;
  background: rgba(5, 4, 9, .35);
  touch-action: none;
  animation: fade .22s ease-out;
}

.sheet {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid rgba(167, 139, 250, .22);
  border-bottom: 0;
  border-radius: 22px 22px 0 0;
  background: var(--ve-panel);
  box-shadow: 0 -14px 40px rgba(0, 0, 0, .55), 0 -1px 24px rgba(124, 58, 237, .18);
  transition: height .25s cubic-bezier(.2, .8, .2, 1);
  animation: rise .25s cubic-bezier(.2, .8, .2, 1);
}

.sheet.dragging { transition: none; }

.grab {
  display: grid;
  flex: none;
  place-items: center;
  height: 26px;
  cursor: grab;
  touch-action: none;
}

.handle {
  width: 52px;
  height: 5px;
  border-radius: 3px;
  background: rgba(255, 255, 255, .28);
}

.grab:focus-visible { outline: 2px solid #c4b5fd; outline-offset: -2px; }

.sheet-head {
  display: flex;
  flex: none;
  align-items: center;
  gap: .75rem;
  padding: 0 .75rem 0 1rem;
  min-height: 40px;
}

.sheet-head h2 {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 700;
}

.close {
  display: grid;
  flex: none;
  place-items: center;
  width: 36px;
  height: 36px;
  margin-left: auto;
  border: 1px solid var(--ve-border);
  border-radius: 50%;
  background: none;
  color: var(--ve-text);
  cursor: pointer;
}

.close:focus-visible { outline: 2px solid #c4b5fd; outline-offset: 1px; }

/* The panels inside bring their own padding, scrolling and hint line; the sheet
   header already carries their title. */
.sheet-body :deep(.panel-head h2) { display: none; }
.sheet-body :deep(.panel.mobile) { padding-top: 0; }
.sheet-body :deep(.panel.mobile .panel-head) { min-height: 0; }
.sheet-body :deep(.inspector.mobile) { padding-top: .25rem; }
.sheet-body :deep(.panel-head:not(:has(*:not(h2)))) { display: none; }

.sheet-body {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  overscroll-behavior: contain;
}

.sheet-body > :deep(*) {
  flex: 1;
  min-height: 0;
}

@keyframes rise {
  from { transform: translateY(40%); opacity: 0; }
  to { transform: none; opacity: 1; }
}

@keyframes fade {
  from { opacity: 0; }
  to { opacity: 1; }
}

@media (prefers-reduced-motion: reduce) {
  .sheet, .backdrop { animation: none; transition: none; }
}
</style>
