<script setup lang="ts">
import { clampZoom, quickActionsFor, type QuickAction } from '~~/shared/video-editor-ui'
import { DEFAULT_ITEM_SOUND } from '~~/shared/template-sounds'
import { useVideoEditor } from '~/composables/useVideoEditor'

const emit = defineEmits<{ replace: [] }>()

const editor = useVideoEditor()
const { state } = editor
const item = computed(() => editor.selection.value?.item || null)
const actions = computed(() => quickActionsFor(item.value))
const muted = computed(() => {
  if (item.value?.type === 'video') return item.value.muted
  return item.value?.type === 'graphic' && !item.value.sound?.enabled
})

const meta: Record<QuickAction, { label: string, icon: string }> = {
  split: { label: 'Splitsen', icon: 'lucide:scissors' },
  duplicate: { label: 'Dupliceren', icon: 'lucide:copy' },
  mute: { label: 'Dempen', icon: 'lucide:volume-x' },
  slip: { label: 'Verschuiven', icon: 'lucide:move-horizontal' },
  replace: { label: 'Vervangen', icon: 'lucide:replace' },
  'close-gaps': { label: 'Gaten sluiten', icon: 'lucide:fold-horizontal' },
  ripple: { label: 'Ripple delete', icon: 'lucide:arrow-left-to-line' },
  delete: { label: 'Verwijderen', icon: 'lucide:trash-2' },
}

function label(action: QuickAction) {
  if (action === 'mute' && muted.value) return 'Geluid aan'
  return meta[action].label
}

function icon(action: QuickAction) {
  if (action === 'mute' && muted.value) return 'lucide:volume-2'
  return meta[action].icon
}

function run(action: QuickAction) {
  if (action === 'split') editor.splitSelected()
  else if (action === 'duplicate') editor.duplicateSelected()
  else if (action === 'delete') editor.deleteSelected()
  else if (action === 'ripple') editor.rippleDeleteSelected()
  else if (action === 'close-gaps') {
    const track = editor.selection.value?.track
    if (track) editor.closeTrackGaps(track.id)
  }
  else if (action === 'replace') emit('replace')
  // Slip is a mode: while on, dragging the selected clip slips its source.
  else if (action === 'slip') state.slipMode = !state.slipMode
  else if (action === 'mute' && item.value) {
    editor.patchItem(item.value.id, (target) => {
      if (target.type === 'video') target.muted = !target.muted
      if (target.type === 'graphic') target.sound = { ...DEFAULT_ITEM_SOUND, ...target.sound, enabled: !target.sound?.enabled }
    }, `${item.value.id}:muted:${Date.now()}`)
  }
}

// Slip mode applies to the clip it was turned on for.
watch(() => state.selectedId, () => {
  state.slipMode = false
})

function zoomBy(factor: number) {
  state.zoom = clampZoom(state.zoom * factor)
}
</script>

<template>
  <div class="m-actions">
    <div class="actions" role="toolbar" :aria-label="item ? 'Acties voor gekozen clip' : 'Timeline-acties'">
      <button
        v-for="action in actions"
        :key="action"
        type="button"
        :class="{ danger: action === 'delete', on: action === 'slip' && state.slipMode }"
        :aria-pressed="action === 'slip' ? state.slipMode : undefined"
        :title="action === 'split' && !item ? 'De clip onder de afspeelpositie splitsen' : undefined"
        @click="run(action)"
      >
        <Icon :name="icon(action)" aria-hidden="true" />
        <span>{{ label(action) }}</span>
      </button>
    </div>
    <div class="zoom" role="group" aria-label="Zoom timeline">
      <button type="button" aria-label="Timeline uitzoomen" @click="zoomBy(0.75)"><Icon name="lucide:zoom-out" aria-hidden="true" /></button>
      <button type="button" aria-label="Timeline inzoomen" @click="zoomBy(1.33)"><Icon name="lucide:zoom-in" aria-hidden="true" /></button>
    </div>
  </div>
</template>

<style scoped>
.m-actions {
  display: flex;
  align-items: center;
  gap: .3rem;
  padding: .25rem .4rem;
  border-top: 1px solid var(--ve-border);
  border-bottom: 1px solid var(--ve-border);
  background: var(--ve-panel);
}

.actions {
  display: flex;
  flex: 1;
  gap: .25rem;
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: none;
}

.actions::-webkit-scrollbar { display: none; }

button {
  display: inline-flex;
  flex: none;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: .1rem;
  min-width: 52px;
  height: 44px;
  padding: 0 .35rem;
  border: 0;
  border-radius: 10px;
  background: var(--ve-raised);
  color: var(--ve-text);
  font-size: .62rem;
  cursor: pointer;
}

button svg { width: 17px; height: 17px; }

button.danger { background: rgba(239, 68, 68, .14); color: #fca5a5; }
button.on { background: rgba(124, 58, 237, .35); color: #fff; }

.zoom {
  display: flex;
  flex: none;
  gap: .25rem;
  padding-left: .4rem;
  border-left: 1px solid var(--ve-border);
}

.zoom button { min-width: 40px; padding: 0; }

button:focus-visible {
  outline: 2px solid #c4b5fd;
  outline-offset: 1px;
}
</style>
