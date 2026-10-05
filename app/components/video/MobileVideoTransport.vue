<script setup lang="ts">
import { formatTimecode } from '~~/shared/video-project'
import { useVideoEditor } from '~/composables/useVideoEditor'

const emit = defineEmits<{ seek: [frame: number], toggle: [], fullscreen: [] }>()
const volume = defineModel<number>('volume', { required: true })

const editor = useVideoEditor()
const { state } = editor
let lastVolume = 1

function toggleMute() {
  if (volume.value > 0) {
    lastVolume = volume.value
    volume.value = 0
  } else {
    volume.value = lastVolume || 1
  }
}
</script>

<template>
  <div class="m-transport">
    <button type="button" :aria-label="state.playing ? 'Pauzeren' : 'Afspelen'" @click="emit('toggle')">
      <Icon :name="state.playing ? 'lucide:pause' : 'lucide:play'" aria-hidden="true" />
    </button>
    <span class="time">{{ formatTimecode(state.frame, state.project.fps) }} / {{ formatTimecode(editor.duration.value, state.project.fps) }}</span>
    <input
      class="scrub"
      type="range"
      min="0"
      :max="editor.duration.value - 1"
      :value="state.frame"
      aria-label="Afspeelpositie"
      @input="emit('seek', Number(($event.target as HTMLInputElement).value))"
    >
    <button type="button" :aria-label="volume > 0 ? 'Voorbeeld dempen' : 'Geluid voorbeeld aan'" :aria-pressed="volume === 0" @click="toggleMute">
      <Icon :name="volume > 0 ? 'lucide:volume-2' : 'lucide:volume-x'" aria-hidden="true" />
    </button>
    <button type="button" aria-label="Volledig scherm" @click="emit('fullscreen')">
      <Icon name="lucide:maximize" aria-hidden="true" />
    </button>
  </div>
</template>

<style scoped>
.m-transport {
  display: flex;
  align-items: center;
  gap: .2rem;
  padding: 0 .4rem;
}

button {
  display: grid;
  flex: none;
  width: 44px;
  height: 44px;
  place-items: center;
  border: 0;
  border-radius: 10px;
  background: none;
  color: var(--ve-text);
  cursor: pointer;
}

button svg { width: 20px; height: 20px; }

.time {
  flex: none;
  padding: 0 .2rem;
  font-size: .78rem;
  font-variant-numeric: tabular-nums;
}

.scrub {
  flex: 1;
  min-width: 0;
  height: 32px;
  margin: 0 .3rem;
  accent-color: var(--ve-accent);
}

button:focus-visible, .scrub:focus-visible {
  outline: 2px solid #c4b5fd;
  outline-offset: 1px;
}
</style>
