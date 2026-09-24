<script setup lang="ts">
import { apiErrorMessage } from '~/utils/api-error'
import { uploadMediaFile } from '~/utils/media-upload'
import { mediaKind, type MediaKind } from '~~/shared/video-project'
import { MOTION_TEMPLATES, type MotionTemplateDefinition, type MotionTemplateKey } from '~~/shared/video-templates'
import { templateHasSound } from '~~/shared/template-sounds'
import { filterMediaAssets, formatMediaDuration, type MediaFilter } from '~~/shared/video-editor-ui'
import { canCancelRender, canRetryRender } from '~~/shared/video-generator'
import { useVideoEditor, type EditorMediaAsset } from '~/composables/useVideoEditor'

// Desktop shows media / templates / exports in the side panel. The mobile
// editor reuses this panel for its bottom tabs (plus an Audio tab) with
// tap-first cards instead of drag and drop.
const props = defineProps<{
  tab: 'media' | 'templates' | 'exports' | 'audio'
  mobile?: boolean
  /** Mobile "Replace" flow: tapping an asset of this kind swaps the selected clip's media. */
  replaceKind?: MediaKind | null
}>()
const emit = defineEmits<{
  refreshMedia: []
  refreshRenders: []
  templateAdded: []
  replaced: []
  cancelReplace: []
  openEdit: []
}>()

const editor = useVideoEditor()
const { state } = editor
const filter = ref<MediaFilter>('all')
const search = ref('')
const fileInput = ref<HTMLInputElement | null>(null)
const uploading = ref('')
const message = ref('')

const activeFilter = computed<MediaFilter>(() => props.replaceKind || filter.value)
const filteredMedia = computed(() => filterMediaAssets(state.media, activeFilter.value, search.value))
const audioMedia = computed(() => filterMediaAssets(state.media, 'audio', search.value))
const selectedAudio = computed(() => {
  const item = editor.selection.value?.item
  return item?.type === 'audio' ? item : null
})
const panel = ref<HTMLElement | null>(null)
watch(() => props.tab, () => {
  if (panel.value) panel.value.scrollTop = 0
})

const templateCategory = ref<'all' | MotionTemplateDefinition['category']>('all')
const templateCategories = computed(() => [...new Set(Object.values(MOTION_TEMPLATES).map(template => template.category))])
const visibleTemplates = computed(() => Object.values(MOTION_TEMPLATES)
  .filter(template => templateCategory.value === 'all' || template.category === templateCategory.value))

function addAsset(asset: EditorMediaAsset) {
  if (props.replaceKind) {
    if (editor.replaceSelectedAsset(asset)) emit('replaced')
    return
  }
  editor.addMedia(asset)
}

function addTemplate(key: MotionTemplateKey) {
  editor.addTemplate(key)
  emit('templateAdded')
}

function assetTitle(asset: EditorMediaAsset) {
  return asset.title || asset.originalFilename
}

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

async function cancelRender(id: string) {
  if (!confirm('Cancel this export?')) return
  try {
    await $fetch(`/api/admin/post-generator/video/${id}/cancel`, { method: 'POST' })
    emit('refreshRenders')
  } catch (error) {
    message.value = apiErrorMessage(error, 'Cancel failed.')
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
  <section ref="panel" class="panel" :class="{ mobile: props.mobile }">
    <input
      ref="fileInput"
      class="file-input"
      type="file"
      multiple
      :accept="props.tab === 'audio' ? 'audio/mpeg,audio/mp4,audio/wav,audio/ogg' : 'image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm,audio/mpeg,audio/mp4,audio/wav,audio/ogg'"
      @change="uploadFiles(($event.target as HTMLInputElement).files)"
    >

    <!-- Mobile: tap-first media library -->
    <template v-if="props.mobile && props.tab === 'media'">
      <header class="panel-head">
        <h2>{{ props.replaceKind ? 'Replace media' : 'Media' }}</h2>
        <button class="pill" type="button" :disabled="Boolean(uploading)" @click="fileInput?.click()">
          <Icon name="lucide:upload" aria-hidden="true" /><span>{{ uploading ? 'Uploading…' : 'Upload media' }}</span>
        </button>
      </header>
      <p v-if="props.replaceKind" class="replace-hint">
        <span>Tap a {{ props.replaceKind }} to swap it into the selected clip.</span>
        <button type="button" @click="emit('cancelReplace')">Cancel</button>
      </p>
      <div v-else class="chips scroll-x" role="group" aria-label="Filter media">
        <button v-for="option in (['all', 'video', 'image', 'audio'] as const)" :key="option" type="button" :class="{ active: filter === option }" :aria-pressed="filter === option" @click="filter = option">
          {{ option === 'all' ? 'All' : option === 'video' ? 'Video' : option === 'image' ? 'Images' : 'Audio' }}
        </button>
      </div>
      <input v-model="search" class="search" type="search" placeholder="Search media…" aria-label="Search media">
      <p v-if="uploading" class="hint">{{ uploading }}</p>
      <p v-if="message" class="message">{{ message }}</p>
      <div class="m-media-grid">
        <article v-for="asset in filteredMedia" :key="asset.id" class="m-media-card" :class="mediaKind(asset.mimeType)">
          <div v-if="mediaKind(asset.mimeType) === 'audio'" class="audio-thumb">
            <Icon name="lucide:music" aria-hidden="true" />
            <svg class="wave" viewBox="0 0 100 40" preserveAspectRatio="none"><path :d="waveformPath(asset.metadata?.peaks)" /></svg>
          </div>
          <div v-else class="thumb">
            <img v-if="asset.thumbnailUrl" :src="asset.thumbnailUrl" :alt="assetTitle(asset)" loading="lazy">
            <span v-else class="no-thumb"><Icon :name="mediaKind(asset.mimeType) === 'image' ? 'lucide:image' : 'lucide:film'" aria-hidden="true" /></span>
          </div>
          <span v-if="asset.durationMs" class="duration">{{ formatMediaDuration(asset.durationMs) }}</span>
          <button
            class="m-add"
            type="button"
            :aria-label="props.replaceKind ? `Replace with ${assetTitle(asset)}` : `Add ${assetTitle(asset)} at playhead`"
            @click="addAsset(asset)"
          >
            <Icon :name="props.replaceKind ? 'lucide:replace' : 'lucide:plus'" aria-hidden="true" />
          </button>
          <span class="m-title">{{ assetTitle(asset) }}</span>
        </article>
        <p v-if="!filteredMedia.length" class="empty">No media found. Upload clips, photos or music to start.</p>
      </div>
    </template>

    <!-- Mobile: swipeable template cards -->
    <template v-else-if="props.mobile && props.tab === 'templates'">
      <header class="panel-head">
        <h2>Templates</h2>
        <small class="hint">Tap to add at the playhead</small>
      </header>
      <div class="chips scroll-x" role="group" aria-label="Template category">
        <button type="button" :class="{ active: templateCategory === 'all' }" :aria-pressed="templateCategory === 'all'" @click="templateCategory = 'all'">All</button>
        <button v-for="category in templateCategories" :key="category" type="button" :class="{ active: templateCategory === category }" :aria-pressed="templateCategory === category" @click="templateCategory = category">{{ category }}</button>
      </div>
      <div class="m-template-rail">
        <button v-for="template in visibleTemplates" :key="template.key" type="button" class="m-template-card" @click="addTemplate(template.key)">
          <span class="template-art" :data-template="template.key"><i /><b>{{ template.label }}</b></span>
          <strong>{{ template.label }}</strong>
          <small>{{ template.category }} · {{ template.defaultDurationSeconds }}s<template v-if="templateHasSound(template)"> · sound</template></small>
        </button>
      </div>
    </template>

    <!-- Mobile: audio library -->
    <template v-else-if="props.tab === 'audio'">
      <header class="panel-head">
        <h2>Audio</h2>
        <button class="pill" type="button" :disabled="Boolean(uploading)" @click="fileInput?.click()">
          <Icon name="lucide:plus" aria-hidden="true" /><span>{{ uploading ? 'Uploading…' : 'Upload audio' }}</span>
        </button>
      </header>
      <button v-if="selectedAudio" type="button" class="selected-audio" @click="emit('openEdit')">
        <Icon name="lucide:sliders-horizontal" aria-hidden="true" />
        <span><strong>{{ editor.mediaById.value.get(selectedAudio.assetId)?.title || 'Selected audio' }}</strong><small>Volume {{ Math.round(selectedAudio.volume * 100) }}% · adjust volume and fades</small></span>
        <Icon name="lucide:chevron-right" aria-hidden="true" />
      </button>
      <input v-model="search" class="search" type="search" placeholder="Search audio…" aria-label="Search audio">
      <p v-if="uploading" class="hint">{{ uploading }}</p>
      <p v-if="message" class="message">{{ message }}</p>
      <ul class="m-audio-list">
        <li v-for="asset in audioMedia" :key="asset.id">
          <button type="button" class="m-add round" :aria-label="`Add ${assetTitle(asset)} at playhead`" @click="addAsset(asset)"><Icon name="lucide:plus" aria-hidden="true" /></button>
          <span class="audio-copy"><strong>{{ assetTitle(asset) }}</strong><small>{{ formatMediaDuration(asset.durationMs) }}</small></span>
          <svg class="wave" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true"><path :d="waveformPath(asset.metadata?.peaks)" /></svg>
        </li>
        <li v-if="!audioMedia.length" class="empty">No audio yet. Upload music, sound effects or a voice-over.</li>
      </ul>
    </template>

    <template v-else-if="props.tab === 'media'">
      <header class="panel-head">
        <h2>Media Library</h2>
      </header>
      <div class="chips" role="tablist">
        <button v-for="option in (['all', 'video', 'image', 'audio'] as const)" :key="option" type="button" :class="{ active: filter === option }" @click="filter = option">
          {{ option === 'all' ? 'All' : option === 'video' ? 'Videos' : option === 'image' ? 'Images' : 'Audio' }}
        </button>
      </div>
      <input v-model="search" class="search" type="search" placeholder="Search media…">
      <button
        class="upload"
        type="button"
        :disabled="Boolean(uploading)"
        @click="fileInput?.click()"
        @dragover.prevent
        @drop.prevent="uploadFiles($event.dataTransfer?.files)"
      >
        <Icon name="lucide:upload" aria-hidden="true" />
        <span>{{ uploading || 'Upload media' }}</span>
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
            <strong><Icon name="lucide:music" aria-hidden="true" /> {{ asset.title || asset.originalFilename }}</strong>
            <svg class="wave" viewBox="0 0 100 40" preserveAspectRatio="none"><path :d="waveformPath(asset.metadata?.peaks)" /></svg>
          </div>
          <div v-else class="thumb">
            <img v-if="asset.thumbnailUrl" :src="asset.thumbnailUrl" :alt="asset.title" loading="lazy">
            <span v-else class="no-thumb"><Icon :name="mediaKind(asset.mimeType) === 'image' ? 'lucide:image' : 'lucide:film'" aria-hidden="true" /></span>
          </div>
          <span v-if="asset.durationMs" class="duration">{{ formatDuration(asset.durationMs) }}</span>
          <footer>
            <span>{{ asset.title || asset.originalFilename }}</span>
            <button type="button" title="Add at playhead" @click="editor.addMedia(asset)"><Icon name="lucide:plus" aria-hidden="true" /></button>
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
            <em>{{ template.defaultDurationSeconds }}s<template v-if="templateHasSound(template)"> · <Icon name="lucide:volume-2" aria-hidden="true" /> sound</template></em>
          </span>
        </button>
      </div>
    </template>

    <template v-else>
      <header class="panel-head">
        <h2>Exports</h2>
        <button type="button" class="with-icon ghost" @click="emit('refreshRenders')"><Icon name="lucide:refresh-cw" aria-hidden="true" />Refresh</button>
      </header>
      <p class="hint">Every export renders a saved snapshot of this project with the render worker.</p>
      <p v-if="message" class="message">{{ message }}</p>
      <ol class="renders">
        <li v-for="render in state.renders" :key="render.id" :class="render.status">
          <div class="render-row">
            <strong>{{ new Date(render.createdAt).toLocaleString() }}</strong>
            <span class="status">{{ render.status }}</span>
          </div>
          <small>{{ render.width }}<IconTimes />{{ render.height }} · {{ render.durationSeconds }}s<template v-if="render.renderEngine"> · {{ render.renderEngine === 'intel' ? 'Intel GPU' : 'CPU' }}</template></small>
          <div v-if="render.status === 'rendering' || render.status === 'queued'" class="progress"><span :style="{ width: `${render.progress}%` }" /></div>
          <p v-if="render.error && render.status === 'failed'" class="message">{{ render.error }}</p>
          <div class="render-actions">
            <a v-if="render.videoUrl" class="with-icon" :href="render.videoUrl" target="_blank" rel="noopener"><Icon name="lucide:play" aria-hidden="true" />Open MP4</a>
            <a v-if="render.videoUrl" class="with-icon" :href="render.videoUrl" download><Icon name="lucide:download" aria-hidden="true" />Download</a>
            <button v-if="canRetryRender(render.status)" class="with-icon" type="button" @click="retryRender(render.id)"><Icon name="lucide:rotate-ccw" aria-hidden="true" />Retry</button>
            <button v-if="canCancelRender(render.status)" class="with-icon" type="button" @click="cancelRender(render.id)"><Icon name="lucide:circle-x" aria-hidden="true" />Cancel</button>
            <button v-if="render.status !== 'rendering'" class="with-icon danger" type="button" @click="deleteRender(render.id)"><Icon name="lucide:trash-2" aria-hidden="true" />Delete</button>
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
  display: flex;
  align-items: center;
  justify-content: center;
  gap: .45rem;
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
  font-size: 1.4rem;
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

.audio-thumb .wave {
  width: 100%;
  height: 40%;
}

.audio-thumb .wave path {
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
  display: inline-flex;
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

/* Electric set: thumbnails show the real logo artwork these templates animate. */
.template-art[data-template="neon-logo-reveal"],
.template-art[data-template="electric-gig-poster"],
.template-art[data-template="neon-outro"],
.template-art[data-template="lightning-banner"],
.template-art[data-template="now-playing"],
.template-art[data-template="bolt-transition"] {
  background: center / 84% auto no-repeat, radial-gradient(circle at 50% 50%, #6d28d966, transparent 62%), #07040d;
}

.template-art[data-template="neon-logo-reveal"],
.template-art[data-template="electric-gig-poster"],
.template-art[data-template="neon-outro"] {
  background-image: url("/brand/logo/emblem-thumb.webp"), radial-gradient(circle at 50% 50%, #6d28d966, transparent 62%);
  background-size: auto 88%, auto;
}

.template-art[data-template="lightning-banner"],
.template-art[data-template="now-playing"],
.template-art[data-template="bolt-transition"] {
  background-image: url("/brand/logo/wordmark-thumb.webp"), radial-gradient(circle at 50% 50%, #6d28d966, transparent 62%);
}

.template-art[data-template="neon-logo-reveal"] i,
.template-art[data-template="electric-gig-poster"] i,
.template-art[data-template="neon-outro"] i,
.template-art[data-template="lightning-banner"] i,
.template-art[data-template="now-playing"] i,
.template-art[data-template="bolt-transition"] i,
.template-art[data-template="neon-logo-reveal"] b,
.template-art[data-template="electric-gig-poster"] b,
.template-art[data-template="neon-outro"] b,
.template-art[data-template="lightning-banner"] b,
.template-art[data-template="now-playing"] b,
.template-art[data-template="bolt-transition"] b {
  display: none;
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
/* --- Mobile tabs ---------------------------------------------------------------- */

.panel.mobile {
  gap: .65rem;
  padding: .75rem 1rem 1rem;
  overscroll-behavior: contain;
}

.mobile .panel-head { gap: .75rem; min-height: 44px; }
.mobile .panel-head .hint { font-size: .75rem; }

.pill {
  display: inline-flex;
  align-items: center;
  gap: .4rem;
  min-height: 40px;
  padding: 0 1rem;
  border: 0;
  border-radius: 999px;
  background: var(--ve-accent);
  box-shadow: 0 0 18px rgba(124, 58, 237, .45);
  color: #fff;
  font-size: .82rem;
  font-weight: 700;
  cursor: pointer;
}

.pill:disabled { opacity: .7; cursor: progress; }

.scroll-x {
  overflow-x: auto;
  scrollbar-width: none;
}

.scroll-x::-webkit-scrollbar { display: none; }

.mobile .chips { gap: .4rem; }

.mobile .chips button {
  flex: none;
  min-height: 36px;
  padding: 0 .95rem;
  border: 1px solid var(--ve-border);
  border-radius: 999px;
  font-size: .8rem;
}

.mobile .chips button.active {
  border-color: var(--ve-accent);
  background: rgba(124, 58, 237, .28);
}

.mobile .search { min-height: 44px; font-size: 16px; }

.replace-hint {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: .6rem;
  margin: 0;
  padding: .55rem .75rem;
  border: 1px solid rgba(167, 139, 250, .4);
  border-radius: 10px;
  background: rgba(124, 58, 237, .16);
  font-size: .8rem;
}

.replace-hint button {
  min-height: 36px;
  padding: 0 .8rem;
  border: 1px solid var(--ve-border);
  border-radius: 8px;
  background: var(--ve-raised);
  color: var(--ve-text);
  cursor: pointer;
}

.m-media-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: .5rem;
}

.m-media-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: .25rem;
  min-width: 0;
}

.m-media-card .thumb, .m-media-card .audio-thumb {
  aspect-ratio: 1;
  border-radius: 10px;
}

.m-media-card .audio-thumb {
  align-items: center;
  justify-content: center;
  gap: .4rem;
  color: #4ade80;
}

.m-media-card .duration {
  top: auto;
  right: auto;
  bottom: 1.6rem;
  left: .35rem;
}

.m-title {
  overflow: hidden;
  color: var(--ve-muted);
  font-size: .7rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.m-add {
  position: absolute;
  top: .3rem;
  right: .3rem;
  display: grid;
  width: 36px;
  height: 36px;
  place-items: center;
  border: 0;
  border-radius: 50%;
  background: var(--ve-accent);
  box-shadow: 0 2px 10px rgba(0, 0, 0, .5), 0 0 12px rgba(124, 58, 237, .6);
  color: #fff;
  cursor: pointer;
}

/* Extend the tap area to the whole thumbnail. */
.m-media-card .m-add::before {
  position: absolute;
  inset: -.3rem -.3rem auto auto;
  width: 44px;
  height: 44px;
  content: "";
}

.m-add svg { width: 18px; height: 18px; }

.m-add.round {
  position: static;
  flex: none;
  width: 40px;
  height: 40px;
  box-shadow: none;
}

.m-template-rail {
  display: flex;
  gap: .7rem;
  margin: 0 -1rem;
  padding: 0 1rem .3rem;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  scroll-padding: 0 1rem;
  scrollbar-width: none;
}

.m-template-rail::-webkit-scrollbar { display: none; }

.m-template-card {
  display: flex;
  flex: none;
  flex-direction: column;
  gap: .3rem;
  width: 30%;
  min-width: 104px;
  max-width: 150px;
  padding: 0;
  border: 0;
  background: none;
  color: var(--ve-text);
  text-align: left;
  scroll-snap-align: start;
  cursor: pointer;
}

.m-template-card .template-art {
  height: auto;
  aspect-ratio: 4 / 5;
  border: 2px solid var(--ve-border);
  border-radius: 12px;
}

.m-template-card:focus-visible .template-art,
.m-template-card:active .template-art {
  border-color: var(--ve-accent);
  box-shadow: 0 0 16px rgba(124, 58, 237, .5);
}

.m-template-card .template-art b {
  max-width: 100%;
  padding: 0 .5rem;
  overflow-wrap: anywhere;
  font-size: .72rem;
  line-height: 1;
  text-align: center;
}

.m-template-card strong { font-size: .8rem; }
.m-template-card small { color: var(--ve-muted); font-size: .7rem; }

.selected-audio {
  display: flex;
  align-items: center;
  gap: .7rem;
  min-height: 52px;
  padding: .5rem .75rem;
  border: 1px solid rgba(167, 139, 250, .45);
  border-radius: 12px;
  background: rgba(124, 58, 237, .16);
  color: var(--ve-text);
  text-align: left;
  cursor: pointer;
}

.selected-audio span {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
}

.selected-audio strong, .audio-copy strong {
  overflow: hidden;
  font-size: .82rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.selected-audio small, .audio-copy small { color: var(--ve-muted); font-size: .72rem; }

.m-audio-list {
  display: flex;
  flex-direction: column;
  gap: .5rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.m-audio-list li {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) minmax(0, 1.2fr);
  align-items: center;
  gap: .7rem;
  min-height: 56px;
  padding: .45rem .7rem;
  border: 1px solid var(--ve-border);
  border-radius: 12px;
  background: var(--ve-raised);
}

.m-audio-list li.empty {
  display: block;
  border: 0;
  background: none;
}

.audio-copy {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.m-audio-list .wave {
  width: 100%;
  height: 32px;
}

.m-audio-list .wave path {
  stroke: #a78bfa;
  stroke-width: .8;
  vector-effect: non-scaling-stroke;
}

.mobile .renders li { padding: .85rem; }

.mobile .render-actions { gap: .4rem; }

.mobile .render-actions a, .mobile .render-actions button {
  display: inline-flex;
  align-items: center;
  gap: .35rem;
  min-height: 40px;
  padding: 0 .8rem;
  border: 1px solid var(--ve-border);
  border-radius: 9px;
  background: var(--ve-panel);
  text-decoration: none;
}

.mobile .render-actions .danger { color: #fca5a5; }

.mobile .ghost { min-height: 40px; padding: 0 .8rem; }

.mobile button:focus-visible, .mobile a:focus-visible {
  outline: 2px solid #c4b5fd;
  outline-offset: 2px;
}
</style>
