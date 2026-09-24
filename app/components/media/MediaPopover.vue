<script setup lang="ts">
// A click-to-open panel anchored to its trigger. Closes on outside pointer
// down and on Escape (without letting Escape also close a parent dialog).
withDefaults(defineProps<{
  align?: 'start' | 'end'
  placement?: 'bottom' | 'top'
  /** On narrow screens, show the panel as a bottom sheet instead. */
  sheetOnMobile?: boolean
}>(), { align: 'start', placement: 'bottom', sheetOnMobile: false })

const open = defineModel<boolean>('open', { default: false })
const root = ref<HTMLElement | null>(null)

function close() {
  open.value = false
}
function toggle() {
  open.value = !open.value
}
function onPointer(event: PointerEvent) {
  if (open.value && root.value && !root.value.contains(event.target as Node)) close()
}
function onKey(event: KeyboardEvent) {
  if (event.key !== 'Escape' || !open.value) return
  event.stopPropagation()
  close()
}
onMounted(() => {
  document.addEventListener('pointerdown', onPointer)
  document.addEventListener('keydown', onKey, true)
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onPointer)
  document.removeEventListener('keydown', onKey, true)
})
</script>

<template>
  <div ref="root" class="popover">
    <slot name="trigger" :open="open" :toggle="toggle" />
    <div
      v-if="open"
      class="mh-panel popover-panel"
      :class="[align, placement, { sheet: sheetOnMobile }]"
    >
      <slot :close="close" />
    </div>
  </div>
</template>

<style scoped>
.popover { position: relative; display: inline-flex; }
.popover-panel { position: absolute; top: calc(100% + .4rem); left: 0; }
.popover-panel.end { right: 0; left: auto; }
.popover-panel.top { top: auto; bottom: calc(100% + .4rem); }
@media (max-width: 720px) {
  .popover-panel.sheet {
    position: fixed;
    inset: auto 0 0 0;
    max-height: 82dvh;
    overflow: auto;
    border-radius: 1.1rem 1.1rem 0 0;
    padding: 1rem 1rem calc(1rem + env(safe-area-inset-bottom));
  }
}
</style>
