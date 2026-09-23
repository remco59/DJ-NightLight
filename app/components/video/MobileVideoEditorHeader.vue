<script setup lang="ts">
import { VIDEO_ASPECTS, VIDEO_ASPECT_KEYS, type VideoAspect } from '~~/shared/video-project'
import { useVideoEditor } from '~/composables/useVideoEditor'

const props = defineProps<{ saveLabel: string, exporting: boolean }>()
const emit = defineEmits<{ commitName: [], export: [] }>()
const name = defineModel<string>('name', { required: true })

const editor = useVideoEditor()
const { state } = editor
</script>

<template>
  <header class="m-header">
    <div class="m-header-row">
      <NuxtLink to="/admin/post-generator/video" class="icon-button" aria-label="All video projects">
        <Icon name="lucide:arrow-left" aria-hidden="true" />
      </NuxtLink>
      <div class="title">
        <input
          v-model="name"
          class="name"
          type="text"
          maxlength="160"
          aria-label="Project name"
          @blur="emit('commitName')"
          @keydown.enter="($event.target as HTMLInputElement).blur()"
        >
        <span class="save" :class="state.saveState" role="status" :title="state.saveError || props.saveLabel">
          <i aria-hidden="true" />{{ props.saveLabel }}
          <button v-if="state.saveState === 'error'" type="button" @click="editor.save()">Retry</button>
        </span>
      </div>
      <button type="button" class="icon-button" aria-label="Undo" :disabled="!editor.canUndo.value" @click="editor.undo()">
        <Icon name="lucide:undo-2" aria-hidden="true" />
      </button>
      <button type="button" class="icon-button" aria-label="Redo" :disabled="!editor.canRedo.value" @click="editor.redo()">
        <Icon name="lucide:redo-2" aria-hidden="true" />
      </button>
      <button type="button" class="export" :disabled="props.exporting" @click="emit('export')">
        {{ props.exporting ? 'Queueing…' : 'Export' }}
      </button>
    </div>
    <div class="m-header-row options">
      <select
        class="aspect"
        :value="state.project.aspect"
        aria-label="Video format"
        @change="editor.setAspect(($event.target as HTMLSelectElement).value as VideoAspect)"
      >
        <option v-for="key in VIDEO_ASPECT_KEYS" :key="key" :value="key">{{ VIDEO_ASPECTS[key].label }}</option>
      </select>
      <label class="safe-toggle" :class="{ disabled: state.project.aspect !== '9:16' }">
        <input
          type="checkbox"
          role="switch"
          :checked="state.project.showSafeZones"
          @change="editor.patchProject(project => { project.showSafeZones = ($event.target as HTMLInputElement).checked })"
        >
        <span>Safe area</span>
      </label>
    </div>
  </header>
</template>

<style scoped>
.m-header {
  display: flex;
  flex-direction: column;
  gap: .15rem;
  padding: calc(env(safe-area-inset-top) + .25rem) .6rem .2rem;
  background: var(--ve-bg);
}

.m-header-row {
  display: flex;
  align-items: center;
  gap: .25rem;
  min-width: 0;
}

.icon-button {
  display: grid;
  flex: none;
  width: 40px;
  height: 44px;
  place-items: center;
  border: 0;
  border-radius: 10px;
  background: none;
  color: var(--ve-text);
  cursor: pointer;
}

.icon-button svg { width: 20px; height: 20px; }
.icon-button:disabled { opacity: .35; cursor: default; }

.title {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
}

.name {
  width: 100%;
  min-width: 0;
  padding: .1rem .3rem;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--ve-text);
  font-size: 16px;
  font-weight: 700;
  text-overflow: ellipsis;
}

.name:focus { border-color: var(--ve-border); background: var(--ve-panel); outline: none; }

.save {
  display: flex;
  align-items: center;
  gap: .35rem;
  overflow: hidden;
  padding: 0 .3rem;
  color: var(--ve-muted);
  font-size: .68rem;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.save i {
  width: 7px;
  height: 7px;
  flex: none;
  border-radius: 50%;
  background: #22c55e;
}

.save.dirty i, .save.saving i { background: #eab308; }
.save.error { color: #fca5a5; }
.save.error i { background: #ef4444; }

.save button {
  padding: 0;
  border: 0;
  background: none;
  color: #c4b5fd;
  font-size: inherit;
  text-decoration: underline;
  cursor: pointer;
}

.export {
  flex: none;
  min-height: 40px;
  margin-left: .2rem;
  padding: 0 1rem;
  border: 0;
  border-radius: 10px;
  background: var(--ve-accent);
  box-shadow: 0 0 20px rgba(124, 58, 237, .5);
  color: #fff;
  font-weight: 800;
  cursor: pointer;
}

.export:disabled { opacity: .7; cursor: progress; }

.options { justify-content: space-between; gap: .6rem; padding: 0 .2rem; }

.aspect {
  min-height: 34px;
  max-width: 60%;
  padding: 0 .7rem;
  border: 1px solid var(--ve-border);
  border-radius: 9px;
  background: var(--ve-panel);
  color: var(--ve-text);
  font-size: 16px;
}

.safe-toggle {
  display: flex;
  align-items: center;
  gap: .5rem;
  min-height: 36px;
  color: var(--ve-muted);
  font-size: .78rem;
  cursor: pointer;
}

.safe-toggle.disabled { opacity: .55; }

.safe-toggle input {
  position: relative;
  width: 40px;
  height: 24px;
  margin: 0;
  border-radius: 999px;
  background: #3f3a4d;
  transition: background .15s;
  appearance: none;
  cursor: pointer;
}

.safe-toggle input::after {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #fff;
  transition: transform .15s;
  content: "";
}

.safe-toggle input:checked { background: var(--ve-accent); }
.safe-toggle input:checked::after { transform: translateX(16px); }

.m-header :focus-visible {
  outline: 2px solid #c4b5fd;
  outline-offset: 2px;
}
</style>
