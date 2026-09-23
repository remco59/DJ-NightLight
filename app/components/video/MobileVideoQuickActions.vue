<script setup lang="ts">
import { clampZoom, quickActionsFor, type QuickAction } from '~~/shared/video-editor-ui'
import { useVideoEditor } from '~/composables/useVideoEditor'

const emit = defineEmits<{ replace: [] }>()

const editor = useVideoEditor()
const { state } = editor
const item = computed(() => editor.selection.value?.item || null)
const actions = computed(() => quickActionsFor(item.value))
const muted = computed(() => item.value?.type === 'video' && item.value.muted)

const meta: Record<QuickAction, { label: string, icon: string }> = {
  split: { label: 'Split', icon: 'lucide:scissors' },
  duplicate: { label: 'Duplicate', icon: 'lucide:copy' },
  mute: { label: 'Mute', icon: 'lucide:volume-x' },
  replace: { label: 'Replace', icon: 'lucide:replace' },
  delete: { label: 'Delete', icon: 'lucide:trash-2' },
}

function label(action: QuickAction) {
  if (action === 'mute' && muted.value) return 'Unmute'
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
  else if (action === 'replace') emit('replace')
  else if (action === 'mute' && item.value) {
    editor.patchItem(item.value.id, (target) => {
      if (target.type === 'video') target.muted = !target.muted
    }, `${item.value.id}:muted:${Date.now()}`)
  }
}

function zoomBy(factor: number) {
  state.zoom = clampZoom(state.zoom * factor)
}
</script>

<template>
  <div class="m-actions">
    <div class="actions" role="toolbar" :aria-label="item ? 'Selected clip actions' : 'Timeline actions'">
      <button
        v-for="action in actions"
        :key="action"
        type="button"
        :class="{ danger: action === 'delete' }"
        :title="action === 'split' && !item ? 'Split the clip under the playhead' : undefined"
        @click="run(action)"
      >
        <Icon :name="icon(action)" aria-hidden="true" />
        <span>{{ label(action) }}</span>
      </button>
    </div>
    <div class="zoom" role="group" aria-label="Timeline zoom">
      <button type="button" aria-label="Zoom out timeline" @click="zoomBy(0.75)"><Icon name="lucide:zoom-out" aria-hidden="true" /></button>
      <button type="button" aria-label="Zoom in timeline" @click="zoomBy(1.33)"><Icon name="lucide:zoom-in" aria-hidden="true" /></button>
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
