<script setup lang="ts">
import { apiErrorMessage } from '~/utils/api-error'
import { uploadMediaFile } from '~/utils/media-upload'
import { mediaKind, type MediaKind } from '~~/shared/video-project'
import { MOTION_TEMPLATES, type MotionTemplateDefinition } from '~~/shared/video-templates'
import { useVideoEditor, type EditorMediaAsset } from '~/composables/useVideoEditor'

const props = defineProps<{ tab: 'media' | 'templates' | 'exports' }>()
const emit = defineEmits<{ refreshMedia: [], refreshRenders: [] }>()

const editor = useVideoEditor()
const { state } = editor
const filter = ref<'all' | MediaKind>('all')
const search = ref('')
const fileInput = ref<HTMLInputElement | null>(null)
const uploading = ref('')
const message = ref('')

const filteredMedia = computed(() => {
  const q = search.value.trim().toLowerCase()
  return state.media.filter((asset) => {
    if (filter.value !== 'all' && mediaKind(asset.mimeType) !== filter.value) return false
    return !q || `${asset.title} ${asset.originalFilename}`.toLowerCase().includes(q)
  })
})

const templateGroups = computed(() => {
  const groups = new Map<string, MotionTemplateDefinition[]>()
  for (const template of Object.values(MOTION_TEMPLATES)) {
    groups.set(template.category, [...(groups.get(template.category) || []), template])
  }
  return [...groups.entries()]
})

function formatDuration(ms: number | null) {
  if (!ms) return ''
  const seconds = Math.round(ms / 1000)
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

function waveformPath(peaks: number[] | undefined) {
  const values = peaks?.length ? peaks : Array.from({ length: 60 }, (_, index) => 0.3 + Math.abs(Math.sin(index * 1.7)) * 0.5)
  const step = 100 / values.length
  return values.map((value, index) => `M${(index * step).toFixed(2)} ${(20 - value * 18).toFixed(2)}V${(20 + value * 18).toFixed(2)}`).join('')
}

function dragMedia(event: DragEvent, asset: EditorMediaAsset) {
  event.dataTransfer?.setData('application/x-nightlight-media', asset.id)
  event.dataTransfer!.effectAllowed = 'copy'
}

function dragTemplate(event: DragEvent, key: string) {
  event.dataTransfer?.setData('application/x-nightlight-template', key)
  event.dataTransfer!.effectAllowed = 'copy'
}

async function uploadFiles(files: FileList | File[] | null | undefined) {
  const list = [...(files || [])]
  if (!list.length) return
  message.value = ''
  try {
    for (const [index, file] of list.entries()) {
      uploading.value = `Uploading ${index + 1}/${list.length}: ${file.name}`
      await uploadMediaFile(file)
    }
    emit('refreshMedia')
  } catch (error) {
    message.value = error instanceof Error && !('data' in error) ? error.message : apiErrorMessage(error, 'Upload failed.')
  } finally {
    uploading.value = ''
    if (fileInput.value) fileInput.value.value = ''
  }
}

async function retryRender(id: string) {
  try {
    await $fetch(`/api/admin/post-generator/video/${id}/retry`, { method: 'POST' })
    emit('refreshRenders')
  } catch (error) {
    message.value = apiErrorMessage(error, 'Retry failed.')
  }
}

async function deleteRender(id: string) {
  if (!confirm('Delete this export?')) return
  try {
    await $fetch(`/api/admin/post-generator/video/${id}`, { method: 'DELETE' })
    emit('refreshRenders')
  } catch (error) {
    message.value = apiErrorMessage(error, 'Delete failed.')
  }
}
</script>

<template>
  <section class="panel">
    <template v-if="props.tab === 'media'">
      <header class="panel-head">
        <h2>Media Library</h2>
      </header>
      <div class="chips" role="tablist">
        <button v-for="option in (['all', 'video', 'image', 'audio'] as const)" :key="option" type="button" :class="{ active: filter === option }" @click="filter = option">
          {{ option === 'all' ? 'All' : option === 'video' ? 'Videos' : option === 'image' ? 'Images' : 'Audio' }}
        </button>
      </div>
      <input v-model="search" class="search" type="search" placeholder="Search media…">
      <input
        ref="fileInput"
        class="file-input"
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm,audio/mpeg,audio/mp4,audio/wav,audio/ogg"
        @change="uploadFiles(($event.target as HTMLInputElement).files)"
      >
      <button
        class="upload"
        type="button"
        :disabled="Boolean(uploading)"
        @click="fileInput?.click()"
        @dragover.prevent
        @drop.prevent="uploadFiles($event.dataTransfer?.files)"
      >
        ⇪ {{ uploading || 'Upload media' }}
      </button>
      <p v-if="message" class="message">{{ message }}</p>

      <div class="media-grid">
        <article
          v-for="asset in filteredMedia"
          :key="asset.id"
          class="media-card"
          :class="mediaKind(asset.mimeType)"
          draggable="true"
          :title="`${asset.title || asset.originalFilename} — drag to the timeline or double-click to add at the playhead`"
          @dragstart="dragMedia($event, asset)"
          @dblclick="editor.addMedia(asset)"
        >
          <div v-if="mediaKind(asset.mimeType) === 'audio'" class="audio-thumb">
            <strong>♫ {{ asset.title || asset.originalFilename }}</strong>
            <svg viewBox="0 0 100 40" preserveAspectRatio="none"><path :d="waveformPath(asset.metadata?.peaks)" /></svg>
          </div>
          <div v-else class="thumb">
            <img v-if="asset.thumbnailUrl" :src="asset.thumbnailUrl" :alt="asset.title" loading="lazy">
            <span v-else class="no-thumb">▶</span>
          </div>
          <span v-if="asset.durationMs" class="duration">{{ formatDuration(asset.durationMs) }}</span>
          <footer>
            <span>{{ asset.title || asset.originalFilename }}</span>
            <button type="button" title="Add at playhead" @click="editor.addMedia(asset)">＋</button>
          </footer>
        </article>
        <p v-if="!filteredMedia.length" class="empty">No media yet. Upload clips, photos or music to start.</p>
      </div>
    </template>

    <template v-else-if="props.tab === 'templates'">
      <header class="panel-head">
        <h2>Motion templates</h2>
      </header>
      <p class="hint">Drag onto the Graphics track or click to add at the playhead. Edit text and style in the inspector.</p>
      <div v-for="[category, templates] in templateGroups" :key="category" class="template-group">
        <h3>{{ category }}</h3>
        <button
          v-for="template in templates"
          :key="template.key"
          type="button"
          class="template-card"
          :data-template="template.key"
          draggable="true"
          @dragstart="dragTemplate($event, template.key)"
          @click="editor.addTemplate(template.key)"
        >
          <span class="template-art" :data-template="template.key"><i /><b>{{ template.label.split(' ')[0] }}</b></span>
          <span class="template-copy">
            <strong>{{ template.label }}</strong>
            <small>{{ template.description }}</small>
            <em>{{ template.defaultDurationSeconds }}s</em>
          </span>
        </button>
      </div>
    </template>

    <template v-else>
      <header class="panel-head">
        <h2>Exports</h2>
        <button type="button" class="ghost" @click="emit('refreshRenders')">Refresh</button>
      </header>
      <p class="hint">Every export renders a saved snapshot of this project with the render worker.</p>
      <p v-if="message" class="message">{{ message }}</p>
      <ol class="renders">
        <li v-for="render in state.renders" :key="render.id" :class="render.status">
          <div class="render-row">
            <strong>{{ new Date(render.createdAt).toLocaleString() }}</strong>
            <span class="status">{{ render.status }}</span>
          </div>
          <small>{{ render.width }}×{{ render.height }} · {{ render.durationSeconds }}s</small>
          <div v-if="render.status === 'rendering' || render.status === 'queued'" class="progress"><span :style="{ width: `${render.progress}%` }" /></div>
          <p v-if="render.error && render.status === 'failed'" class="message">{{ render.error }}</p>
          <div class="render-actions">
            <a v-if="render.videoUrl" :href="render.videoUrl" target="_blank" rel="noopener">Open MP4</a>
            <a v-if="render.videoUrl" :href="render.videoUrl" download>Download</a>
            <button v-if="render.status === 'failed'" type="button" @click="retryRender(render.id)">Retry</button>
            <button v-if="render.status !== 'rendering'" type="button" @click="deleteRender(render.id)">Delete</button>
          </div>
        </li>
        <li v-if="!state.renders.length" class="empty">No exports yet.</li>
      </ol>
    </template>
  </section>
</template>

<style scoped>
.panel {
  display: flex;
  flex-direction: column;
  gap: .75rem;
  min-height: 0;
  padding: 1rem;
  overflow-y: auto;
}

.panel > * { flex-shrink: 0; }

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

h2 {
  margin: 0;
  font-size: 1.05rem;
}

h3 {
  margin: .5rem 0 .4rem;
  color: var(--ve-muted);
  font-size: .72rem;
  letter-spacing: .12em;
  text-transform: uppercase;
}

.hint {
  margin: 0;
  color: var(--ve-muted);
  font-size: .8rem;
  line-height: 1.4;
}

.chips {
  display: flex;
  gap: .25rem;
}

.chips button {
  padding: .35rem .7rem;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--ve-muted);
  font-size: .8rem;
  cursor: pointer;
}

.chips button.active {
  background: var(--ve-raised);
  color: var(--ve-text);
}

.search {
  width: 100%;
  padding: .55rem .75rem;
  border: 1px solid var(--ve-border);
  border-radius: 8px;
  background: var(--ve-bg);
  color: var(--ve-text);
}

.file-input { display: none; }

.upload {
  padding: .65rem;
  border: 0;
  border-radius: 8px;
  background: var(--ve-accent);
  color: #fff;
  font-weight: 700;
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.upload:disabled { opacity: .7; cursor: progress; }

.message {
  margin: 0;
  color: #fca5a5;
  font-size: .8rem;
}

.media-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: .6rem;
}

.media-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: .3rem;
  cursor: grab;
}

.thumb, .audio-thumb {
  aspect-ratio: 16 / 10;
  overflow: hidden;
  border: 1px solid var(--ve-border);
  border-radius: 8px;
  background: var(--ve-raised);
}

.thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  pointer-events: none;
}

.no-thumb {
  display: grid;
  height: 100%;
  place-items: center;
  color: var(--ve-muted);
}

.audio-thumb {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: .5rem;
}

.audio-thumb strong {
  overflow: hidden;
  font-size: .72rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.audio-thumb svg {
  width: 100%;
  height: 40%;
}

.audio-thumb path {
  stroke: #4ade80;
  stroke-width: .8;
  vector-effect: non-scaling-stroke;
}

.duration {
  position: absolute;
  top: .35rem;
  right: .35rem;
  padding: .1rem .35rem;
  border-radius: 4px;
  background: rgba(0, 0, 0, .7);
  font-size: .68rem;
  font-variant-numeric: tabular-nums;
}

.media-card footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: .25rem;
  font-size: .75rem;
}

.media-card footer span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.media-card footer button {
  border: 0;
  background: none;
  color: var(--ve-muted);
  cursor: pointer;
}

.media-card footer button:hover { color: var(--ve-text); }

.empty {
  grid-column: 1 / -1;
  color: var(--ve-muted);
  font-size: .82rem;
}

.template-group {
  display: flex;
  flex-direction: column;
  gap: .45rem;
}

.template-card {
  display: grid;
  grid-template-columns: 64px 1fr;
  gap: .7rem;
  align-items: center;
  padding: .5rem;
  border: 1px solid var(--ve-border);
  border-radius: 10px;
  background: var(--ve-raised);
  color: var(--ve-text);
  text-align: left;
  cursor: grab;
}

.template-card:hover { border-color: var(--ve-accent); }

.template-art {
  position: relative;
  display: grid;
  height: 64px;
  place-items: center;
  overflow: hidden;
  border-radius: 7px;
  background: radial-gradient(circle at 30% 20%, #7c3aed88, transparent 60%), #120c1b;
}

.template-art i {
  position: absolute;
  left: -10%;
  bottom: 30%;
  width: 120%;
  height: 6px;
  transform: rotate(-8deg) skewX(-20deg);
  background: var(--ve-accent);
  box-shadow: 0 0 10px var(--ve-accent);
}

.template-art b {
  position: relative;
  transform: rotate(-6deg);
  font-size: .72rem;
  font-style: italic;
  font-weight: 900;
  text-transform: uppercase;
}

.template-art[data-template="recap-intro"], .template-art[data-template="hype-title"] {
  background: radial-gradient(circle at 30% 20%, #ff2d9588, transparent 60%), #1b0c14;
}

.template-copy {
  display: flex;
  flex-direction: column;
  gap: .15rem;
}

.template-copy strong { font-size: .85rem; }

.template-copy small {
  color: var(--ve-muted);
  font-size: .72rem;
  line-height: 1.3;
}

.template-copy em {
  color: var(--ve-muted);
  font-size: .68rem;
  font-style: normal;
}

.ghost {
  padding: .3rem .6rem;
  border: 1px solid var(--ve-border);
  border-radius: 6px;
  background: none;
  color: var(--ve-text);
  font-size: .75rem;
  cursor: pointer;
}

.renders {
  display: flex;
  flex-direction: column;
  gap: .6rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.renders li {
  display: flex;
  flex-direction: column;
  gap: .3rem;
  padding: .7rem;
  border: 1px solid var(--ve-border);
  border-radius: 10px;
  background: var(--ve-raised);
  font-size: .8rem;
}

.renders li.empty {
  border: 0;
  background: none;
  color: var(--ve-muted);
}

.render-row {
  display: flex;
  justify-content: space-between;
  gap: .5rem;
}

.status {
  color: var(--ve-muted);
  text-transform: capitalize;
}

.completed .status { color: #4ade80; }
.failed .status { color: #f87171; }

.renders small { color: var(--ve-muted); }

.progress {
  height: 4px;
  overflow: hidden;
  border-radius: 2px;
  background: var(--ve-border);
}

.progress span {
  display: block;
  height: 100%;
  background: var(--ve-accent);
  transition: width .3s;
}

.render-actions {
  display: flex;
  flex-wrap: wrap;
  gap: .6rem;
}

.render-actions a, .render-actions button {
  padding: 0;
  border: 0;
  background: none;
  color: #c4b5fd;
  font-size: .78rem;
  cursor: pointer;
}
</style>
