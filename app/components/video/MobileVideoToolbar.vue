<script setup lang="ts">
import type { MobileVideoTool } from '~~/shared/video-editor-ui'

const props = defineProps<{ hasSelection: boolean, rendering: boolean }>()
const tool = defineModel<MobileVideoTool>({ required: true })

const tabs: Array<{ key: MobileVideoTool, label: string, icon: string }> = [
  { key: 'media', label: 'Media', icon: 'lucide:images' },
  { key: 'templates', label: 'Templates', icon: 'lucide:layout-template' },
  { key: 'edit', label: 'Bewerken', icon: 'lucide:sliders-horizontal' },
  { key: 'audio', label: 'Audio', icon: 'lucide:music' },
  { key: 'export', label: 'Export', icon: 'lucide:clapperboard' },
]
</script>

<template>
  <nav class="m-toolbar" aria-label="Editorgereedschap">
    <button
      v-for="tab in tabs"
      :key="tab.key"
      type="button"
      :class="{ active: tool === tab.key }"
      :aria-current="tool === tab.key ? 'page' : undefined"
      @click="tool = tab.key"
    >
      <span class="icon">
        <Icon :name="tab.icon" aria-hidden="true" />
        <i v-if="(tab.key === 'edit' && props.hasSelection) || (tab.key === 'export' && props.rendering)" class="dot" aria-hidden="true" />
      </span>
      <span>{{ tab.label }}</span>
    </button>
  </nav>
</template>

<style scoped>
.m-toolbar {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: .2rem;
  padding: .35rem .4rem calc(env(safe-area-inset-bottom) + .35rem);
  border-top: 1px solid var(--ve-border);
  background: var(--ve-panel);
}

button {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: .2rem;
  min-width: 0;
  min-height: 52px;
  padding: .3rem .1rem;
  border: 0;
  border-radius: 12px;
  background: none;
  color: var(--ve-muted);
  font-size: .66rem;
  cursor: pointer;
}

.icon {
  position: relative;
  display: grid;
  place-items: center;
}

.icon svg { width: 21px; height: 21px; }

.dot {
  position: absolute;
  top: -2px;
  right: -5px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #c4b5fd;
}

button.active {
  background: var(--ve-accent);
  box-shadow: 0 0 18px rgba(124, 58, 237, .55);
  color: #fff;
}

button.active .dot { background: #fff; }

button:focus-visible {
  outline: 2px solid #c4b5fd;
  outline-offset: 1px;
}
</style>
