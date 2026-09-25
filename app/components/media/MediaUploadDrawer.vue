<script setup lang="ts">
import { mediaKindFromMime, humanizeFilename } from '~~/shared/media'
import { collectMediaTags, mediaDisplayTitle, type MediaCollectionSummary, type MediaLibraryItem } from '~~/shared/media-library'
import {
  ACCEPTED_MEDIA_TYPES,
  uploadMediaFile,
  checkMediaFile,
  fetchRemoteMedia,
  type MediaUploadFields,
} from '~/utils/media-upload'

export type MediaUploadPreset = {
  parentAssetId?: string
  variantLabel?: string
  gigId?: string
  venueId?: string
  tags?: string
  collectionIds?: string[]
}

type QueueItem = {
  key: string
  file: File
  previewUrl: string | null
  status: 'ready' | 'uploading' | 'done' | 'error'
  progress: number
  error: string
  assetId: string
  sourceUrl: string
  /** Rejected before upload (type or size); retrying cannot help. */
  invalid: boolean
}

const props = withDefaults(defineProps<{
  assets: MediaLibraryItem[]
  collections: MediaCollectionSummary[]
  gigs: Array<{ id: string, title: string }>
  venues: Array<{ id: string, name: string }>
  preset?: MediaUploadPreset | null
  /** Restrict to images, e.g. when opened from an image-only picker. */
  imagesOnly?: boolean
}>(), { preset: null, imagesOnly: false })

const emit = defineEmits<{
  uploaded: [assetIds: string[]]
}>()

const open = defineModel<boolean>('open', { default: false })

const tab = ref<'upload' | 'url'>('upload')
const queue = ref<QueueItem[]>([])
const dragging = ref(false)
const running = ref(false)
const remoteUrl = ref('')
const remoteBusy = ref(false)
const remoteError = ref('')
const showAdvanced = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const meta = reactive({
  title: '',
  altText: '',
  tags: '',
  gigId: '',
  venueId: '',
  parentAssetId: '',
  variantLabel: '',
  collectionIds: [] as string[],
})

const accept = computed(() => props.imagesOnly ? 'image/jpeg,image/png,image/webp' : ACCEPTED_MEDIA_TYPES)
const pending = computed(() => queue.value.filter(item => item.status === 'ready' || (item.status === 'error' && !item.invalid)))
const doneCount = computed(() => queue.value.filter(item => item.status === 'done').length)
const failedCount = computed(() => queue.value.filter(item => item.status === 'error' && !item.invalid).length)
const finished = computed(() => queue.value.length > 0 && !running.value && doneCount.value > 0 && !queue.value.some(item => item.status === 'ready'))
const tagSuggestions = computed(() => collectMediaTags(props.assets).slice(0, 40))
const parentOptions = computed(() => props.assets
  .filter(asset => !asset.parentAssetId)
  .map(asset => ({ id: asset.id, label: mediaDisplayTitle(asset) }))
  .sort((a, b) => a.label.localeCompare(b.label, 'nl', { numeric: true })))
const parentAsset = computed(() => props.assets.find(asset => asset.id === meta.parentAssetId) || null)
const uploadLabel = computed(() => {
  if (running.value) return `Uploaden ${Math.min(doneCount.value + 1, queue.value.length)} van ${queue.value.length}…`
  const count = pending.value.length
  if (!count) return 'Uploaden'
  if (failedCount.value && failedCount.value === count) return `${count} mislukte opnieuw proberen`
  return `${count} bestand${count === 1 ? '' : 'en'} uploaden`
})

watch(open, (value) => {
  if (!value) return
  const preset = props.preset || {}
  meta.parentAssetId = preset.parentAssetId || ''
  meta.variantLabel = preset.variantLabel || ''
  meta.gigId = preset.gigId || ''
  meta.venueId = preset.venueId || ''
  meta.tags = preset.tags || ''
  meta.collectionIds = [...(preset.collectionIds || [])]
  showAdvanced.value = Boolean(preset.parentAssetId || preset.collectionIds?.length)
}, { immediate: true })

function addFiles(files: Iterable<File>, sourceUrl = '') {
  for (const file of files) {
    const problem = props.imagesOnly && !file.type.startsWith('image/')
      ? 'Hier kun je alleen JPEG-, PNG- en WebP-afbeeldingen gebruiken.'
      : checkMediaFile(file)
    queue.value.push({
      key: `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}`,
      file,
      previewUrl: file.type.startsWith('image/') || mediaKindFromMime(file.type) === 'video' ? URL.createObjectURL(file) : null,
      status: problem ? 'error' : 'ready',
      progress: 0,
      error: problem || '',
      assetId: '',
      sourceUrl,
      invalid: Boolean(problem),
    })
  }
}

function chooseFiles(event: Event) {
  const input = event.target as HTMLInputElement
  if (input.files) addFiles([...input.files])
  input.value = ''
}

function onDrop(event: DragEvent) {
  dragging.value = false
  if (event.dataTransfer?.files?.length) addFiles([...event.dataTransfer.files])
}

function removeItem(item: QueueItem) {
  if (item.status === 'uploading') return
  if (item.previewUrl) URL.revokeObjectURL(item.previewUrl)
  queue.value = queue.value.filter(entry => entry.key !== item.key)
}

async function addRemote() {
  if (!remoteUrl.value.trim()) return
  remoteBusy.value = true
  remoteError.value = ''
  try {
    const file = await fetchRemoteMedia(remoteUrl.value.trim())
    addFiles([file], remoteUrl.value.trim())
    remoteUrl.value = ''
  } catch (error) {
    remoteError.value = error instanceof Error ? error.message : 'Deze link ophalen is niet gelukt.'
  } finally {
    remoteBusy.value = false
  }
}

function fieldsFor(item: QueueItem, index: number, total: number): MediaUploadFields {
  const base = meta.title.trim()
  return {
    title: base ? (total > 1 ? `${base} ${index + 1}` : base) : humanizeFilename(item.file.name),
    altText: meta.altText,
    tags: meta.tags,
    gigId: meta.gigId,
    venueId: meta.venueId,
    parentAssetId: meta.parentAssetId,
    variantLabel: meta.parentAssetId ? meta.variantLabel : '',
    collectionIds: meta.collectionIds,
    source: item.sourceUrl ? 'url' : undefined,
    sourceUrl: item.sourceUrl || undefined,
  }
}

async function uploadOne(item: QueueItem, index: number, total: number) {
  item.status = 'uploading'
  item.progress = 0
  item.error = ''
  try {
    const result = await uploadMediaFile(item.file, fieldsFor(item, index, total), (fraction) => { item.progress = fraction })
    item.assetId = result.asset.id
    item.progress = 1
    item.status = 'done'
  } catch (error) {
    item.status = 'error'
    item.error = error instanceof Error ? error.message : 'Uploaden mislukt.'
  }
}

async function startUpload() {
  const batch = [...pending.value]
  if (!batch.length || running.value) return
  running.value = true
  const total = queue.value.length
  // Two uploads at a time keeps big batches moving without saturating the link.
  const workers = Array.from({ length: Math.min(2, batch.length) }, async () => {
    while (batch.length) {
      const item = batch.shift()!
      await uploadOne(item, queue.value.indexOf(item), total)
    }
  })
  await Promise.all(workers)
  running.value = false
  const ids = queue.value.filter(item => item.status === 'done').map(item => item.assetId)
  if (ids.length) emit('uploaded', ids)
}

function reset() {
  for (const item of queue.value) if (item.previewUrl) URL.revokeObjectURL(item.previewUrl)
  queue.value = []
  meta.title = ''
  meta.altText = ''
  remoteError.value = ''
  tab.value = 'upload'
}

function close() {
  if (running.value) return
  open.value = false
  reset()
}

function toggleCollection(id: string) {
  meta.collectionIds = meta.collectionIds.includes(id)
    ? meta.collectionIds.filter(existing => existing !== id)
    : [...meta.collectionIds, id]
}

function onKey(event: KeyboardEvent) {
  if (event.key === 'Escape' && open.value) close()
}
onMounted(() => document.addEventListener('keydown', onKey))
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKey)
  for (const item of queue.value) if (item.previewUrl) URL.revokeObjectURL(item.previewUrl)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="drawer">
      <div v-if="open" class="drawer-layer">
        <button type="button" class="mh-backdrop" aria-label="Uploaden sluiten" @click="close" />
        <aside class="drawer" role="dialog" aria-modal="true" aria-labelledby="upload-title">
          <header class="drawer-header">
            <h2 id="upload-title">{{ preset?.parentAssetId ? 'Variant uploaden' : 'Media uploaden' }}</h2>
            <button type="button" class="mh-icon-btn close" aria-label="Sluiten" :disabled="running" @click="close"><Icon name="lucide:x" aria-hidden="true" /></button>
          </header>

          <div class="tabs" role="tablist">
            <button type="button" role="tab" :aria-selected="tab === 'upload'" :class="{ active: tab === 'upload' }" @click="tab = 'upload'">Uploaden</button>
            <button type="button" role="tab" :aria-selected="tab === 'url'" :class="{ active: tab === 'url' }" @click="tab = 'url'">Via URL</button>
          </div>

          <div class="drawer-body">
            <label
              v-if="tab === 'upload'"
              class="dropzone"
              :class="{ dragging }"
              @dragenter.prevent="dragging = true"
              @dragover.prevent="dragging = true"
              @dragleave.prevent="dragging = false"
              @drop.prevent="onDrop"
            >
              <input ref="fileInput" type="file" multiple :accept="accept" class="visually-hidden" @change="chooseFiles">
              <Icon name="lucide:cloud-upload" class="drop-icon" aria-hidden="true" />
              <strong>Sleep bestanden hierheen</strong>
              <span>of <u>klik om te bladeren</u></span>
              <small>JPG, PNG of WebP · max. 15 MB per bestand<template v-if="!imagesOnly"><br>Video’s tot 250 MB · audio tot 50 MB</template></small>
            </label>

            <div v-else class="remote">
              <label class="mh-field">
                <span>Bestands-URL</span>
                <input v-model="remoteUrl" class="mh-input" type="url" placeholder="https://…/photo.jpg" @keydown.enter.prevent="addRemote">
              </label>
              <button type="button" class="mh-btn" :disabled="!remoteUrl.trim() || remoteBusy" @click="addRemote">
                <Icon name="lucide:link" aria-hidden="true" />{{ remoteBusy ? 'Ophalen…' : 'Toevoegen via link' }}
              </button>
              <small>Je browser downloadt het bestand en het wordt gecontroleerd zoals elke upload. Sommige sites blokkeren dit; download het bestand dan en upload het.</small>
              <p v-if="remoteError" class="error">{{ remoteError }}</p>
            </div>

            <ul v-if="queue.length" class="queue" aria-label="Gekozen bestanden">
              <li v-for="item in queue" :key="item.key" class="queue-item" :class="item.status" :title="item.error || item.file.name">
                <img v-if="item.previewUrl && item.file.type.startsWith('image/')" :src="item.previewUrl" alt="">
                <video v-else-if="item.previewUrl" :src="item.previewUrl" muted preload="metadata" />
                <span v-else class="file-icon"><Icon name="lucide:audio-lines" aria-hidden="true" /></span>
                <span v-if="item.status === 'uploading'" class="progress"><span :style="{ width: `${Math.round(item.progress * 100)}%` }" /></span>
                <span v-if="item.status === 'done'" class="state ok"><Icon name="lucide:check" aria-hidden="true" /></span>
                <span v-if="item.status === 'error'" class="state bad"><Icon name="lucide:triangle-alert" aria-hidden="true" /></span>
                <button v-if="item.status !== 'uploading' && item.status !== 'done'" type="button" class="remove" :aria-label="`${item.file.name} verwijderen`" @click="removeItem(item)">
                  <Icon name="lucide:x" aria-hidden="true" />
                </button>
              </li>
            </ul>
            <ul v-if="queue.some(entry => entry.status === 'error')" class="errors">
              <li v-for="item in queue.filter(entry => entry.status === 'error')" :key="item.key"><strong>{{ item.file.name }}</strong> — {{ item.error }}</li>
            </ul>

            <section class="meta">
              <h3>Gegevens <span>{{ queue.length > 1 ? `(geldt voor alle ${queue.length} bestanden)` : '' }}</span></h3>
              <label class="mh-field">
                <span>Titel</span>
                <input v-model="meta.title" class="mh-input" placeholder="bijv. Main room moments">
                <small v-if="queue.length > 1">Laat leeg om de bestandsnamen te gebruiken. Met een titel worden de bestanden genummerd 1–{{ queue.length }}.</small>
              </label>
              <label class="mh-field">
                <span>Alt-tekst</span>
                <input v-model="meta.altText" class="mh-input" placeholder="Beschrijf de media voor toegankelijkheid">
              </label>
              <label class="mh-field">
                <span>Tags</span>
                <input v-model="meta.tags" class="mh-input" list="upload-tag-suggestions" placeholder="Tags, gescheiden door komma’s">
                <datalist id="upload-tag-suggestions"><option v-for="tag in tagSuggestions" :key="tag" :value="tag" /></datalist>
              </label>
              <div class="two">
                <label class="mh-field">
                  <span>Koppelen aan gig</span>
                  <select v-model="meta.gigId" class="mh-select">
                    <option value="">Niet gekoppeld aan een gig</option>
                    <option v-for="gig in gigs" :key="gig.id" :value="gig.id">{{ gig.title }}</option>
                  </select>
                </label>
                <label class="mh-field">
                  <span>Koppelen aan locatie</span>
                  <select v-model="meta.venueId" class="mh-select">
                    <option value="">Niet gekoppeld aan een locatie</option>
                    <option v-for="venue in venues" :key="venue.id" :value="venue.id">{{ venue.name }}</option>
                  </select>
                </label>
              </div>

              <button type="button" class="advanced-toggle" :aria-expanded="showAdvanced" @click="showAdvanced = !showAdvanced">
                Geavanceerde opties <Icon :name="showAdvanced ? 'lucide:chevron-up' : 'lucide:chevron-down'" aria-hidden="true" />
              </button>
              <div v-if="showAdvanced" class="advanced">
                <div v-if="collections.length" class="mh-field">
                  <span>Aan collecties toevoegen</span>
                  <div class="chips">
                    <button
                      v-for="collection in collections"
                      :key="collection.id"
                      type="button"
                      class="mh-tag removable"
                      :class="{ on: meta.collectionIds.includes(collection.id) }"
                      :aria-pressed="meta.collectionIds.includes(collection.id)"
                      @click="toggleCollection(collection.id)"
                    >
                      <Icon :name="meta.collectionIds.includes(collection.id) ? 'lucide:check' : 'lucide:plus'" aria-hidden="true" />{{ collection.name }}
                    </button>
                  </div>
                </div>
                <label class="mh-field">
                  <span>Variant van</span>
                  <select v-model="meta.parentAssetId" class="mh-select">
                    <option value="">Geen variant (origineel)</option>
                    <option v-for="option in parentOptions" :key="option.id" :value="option.id">{{ option.label }}</option>
                  </select>
                  <small>Uitsneden, bewerkte versies en exports blijven gekoppeld aan hun origineel.</small>
                </label>
                <div v-if="parentAsset" class="parent-preview">
                  <img v-if="parentAsset.thumbnailUrl" :src="parentAsset.thumbnailUrl" alt="">
                  <span>Origineel: <strong>{{ mediaDisplayTitle(parentAsset) }}</strong></span>
                </div>
                <label v-if="meta.parentAssetId" class="mh-field">
                  <span>Variantlabel</span>
                  <input v-model="meta.variantLabel" class="mh-input" list="variant-label-suggestions" maxlength="80" placeholder="bijv. Instagram 4:5-uitsnede">
                  <datalist id="variant-label-suggestions">
                    <option value="Enhanced NR" />
                    <option value="Instagram 4:5-uitsnede" />
                    <option value="Story 9:16-uitsnede" />
                    <option value="Vierkant 1:1-uitsnede" />
                    <option value="Zwart-wit" />
                    <option value="Gig-recap graphic" />
                  </datalist>
                </label>
              </div>
            </section>
          </div>

          <footer class="drawer-footer">
            <template v-if="finished">
              <p class="summary">
                <Icon name="lucide:circle-check" aria-hidden="true" />{{ doneCount }} geüpload<template v-if="failedCount">, {{ failedCount }} mislukt</template>
              </p>
              <button v-if="failedCount" type="button" class="mh-btn primary block" @click="startUpload">{{ failedCount }} mislukte opnieuw proberen</button>
              <button type="button" class="mh-btn block" :class="{ primary: !failedCount }" @click="close">Klaar</button>
            </template>
            <template v-else>
              <button type="button" class="mh-btn primary block" :disabled="!pending.length || running" @click="startUpload">{{ uploadLabel }}</button>
              <button type="button" class="mh-btn block" :disabled="running" @click="close">Annuleren</button>
            </template>
          </footer>
        </aside>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.drawer-layer { position: fixed; inset: 0; z-index: 2100; }
.drawer-layer .mh-backdrop { border: 0; cursor: default; }
.drawer {
  position: absolute;
  inset: .75rem .75rem .75rem auto;
  display: flex;
  flex-direction: column;
  width: min(27rem, calc(100vw - 1.5rem));
  border: 1px solid #2c2733;
  border-radius: 1.1rem;
  background: #0f0d13;
  box-shadow: -1.5rem 0 4rem rgba(0, 0, 0, .5);
}
.drawer-header { display: flex; align-items: center; justify-content: space-between; padding: 1.2rem 1.3rem .6rem; }
.drawer-header h2 { margin: 0; font-size: 1.35rem; letter-spacing: -.02em; }
.close { border-color: transparent; background: transparent; }
.tabs { display: flex; gap: 1.4rem; margin: 0 1.3rem; border-bottom: 1px solid #25212c; }
.tabs button { position: relative; border: 0; padding: .7rem 0; background: transparent; color: #8f879a; font: inherit; font-size: .86rem; font-weight: 600; cursor: pointer; }
.tabs button.active { color: #fff; }
.tabs button.active::after { content: ""; position: absolute; right: 0; bottom: -1px; left: 0; height: 2px; border-radius: 2px; background: #8b5cf6; box-shadow: 0 0 .6rem rgba(139, 92, 246, .8); }
.drawer-body { flex: 1; overflow: auto; padding: 1.1rem 1.3rem; }
.dropzone {
  display: grid;
  justify-items: center;
  gap: .3rem;
  border: 1.5px dashed #3d3548;
  border-radius: .9rem;
  padding: 1.6rem 1rem;
  background: rgba(124, 58, 237, .03);
  color: #a79fb2;
  font-size: .84rem;
  text-align: center;
  cursor: pointer;
  transition: border-color .15s ease, background-color .15s ease;
}
.dropzone:hover, .dropzone.dragging { border-color: #8b5cf6; background: rgba(124, 58, 237, .09); }
.dropzone:focus-within { outline: 2px solid #8b5cf6; outline-offset: 2px; }
.drop-icon { width: 2.2rem; height: 2.2rem; margin-bottom: .3rem; color: #a78bfa; filter: drop-shadow(0 0 .6rem rgba(139, 92, 246, .6)); }
.dropzone strong { color: #f3eff7; font-size: .95rem; }
.dropzone u { color: #b69cff; text-decoration: none; }
.dropzone small { margin-top: .4rem; color: #7d7686; font-size: .74rem; line-height: 1.5; }
.visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.remote { display: grid; gap: .7rem; }
.remote small { color: #7d7686; font-size: .74rem; line-height: 1.5; }
.error { margin: 0; color: #f39aa6; font-size: .8rem; }
.queue { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: .55rem; margin: 1rem 0 0; padding: 0; list-style: none; }
.queue-item { position: relative; overflow: hidden; aspect-ratio: 1; border: 1px solid #2c2733; border-radius: .6rem; background: #09080c; }
.queue-item img, .queue-item video { display: block; width: 100%; height: 100%; object-fit: cover; }
.queue-item.done img, .queue-item.done video { opacity: .55; }
.queue-item.error { border-color: #7a3945; }
.file-icon { display: grid; width: 100%; height: 100%; place-items: center; color: #8f879a; font-size: 1.4rem; }
.progress { position: absolute; right: .35rem; bottom: .35rem; left: .35rem; height: .3rem; overflow: hidden; border-radius: 999px; background: rgba(255, 255, 255, .18); }
.progress span { display: block; height: 100%; border-radius: inherit; background: #a78bfa; transition: width .2s ease; }
.state { position: absolute; inset: 0; display: grid; place-items: center; font-size: 1.3rem; }
.state.ok { color: #86efac; }
.state.bad { color: #fda4af; background: rgba(40, 10, 16, .45); }
.remove { position: absolute; top: .3rem; right: .3rem; display: grid; width: 1.45rem; height: 1.45rem; place-items: center; border: 0; border-radius: .4rem; background: rgba(8, 7, 11, .75); color: #fff; font-size: .8rem; cursor: pointer; }
.errors { display: grid; gap: .3rem; margin: .7rem 0 0; padding: 0; color: #f39aa6; font-size: .76rem; list-style: none; }
.errors strong { color: #ffd1d7; }
.meta { display: grid; gap: .9rem; margin-top: 1.3rem; }
.meta h3 { margin: 0; font-size: .95rem; }
.meta h3 span { color: #8f879a; font-size: .8rem; font-weight: 500; }
.two { display: grid; grid-template-columns: 1fr 1fr; gap: .7rem; }
.advanced-toggle { display: inline-flex; align-items: center; gap: .35rem; justify-self: start; border: 0; padding: 0; background: transparent; color: #b69cff; font: inherit; font-size: .82rem; font-weight: 600; cursor: pointer; }
.advanced { display: grid; gap: .9rem; }
.chips { display: flex; flex-wrap: wrap; gap: .4rem; }
.chips .mh-tag { font: inherit; font-size: .76rem; }
.chips .mh-tag.on { border-color: #7c5ad9; background: #241a3d; color: #fff; }
.parent-preview { display: flex; align-items: center; gap: .6rem; color: #a79fb2; font-size: .78rem; }
.parent-preview img { width: 3rem; height: 2.2rem; border-radius: .35rem; object-fit: cover; }
.parent-preview strong { color: #efeaf4; }
.drawer-footer { display: grid; gap: .55rem; padding: 1rem 1.3rem 1.2rem; border-top: 1px solid #25212c; }
.drawer-footer .mh-btn { min-height: 2.9rem; }
.summary { display: flex; align-items: center; gap: .45rem; margin: 0 0 .2rem; color: #c9f2d6; font-size: .86rem; }

.drawer-enter-active, .drawer-leave-active { transition: opacity .2s ease; }
.drawer-enter-active .drawer, .drawer-leave-active .drawer { transition: transform .25s cubic-bezier(.2, .8, .2, 1); }
.drawer-enter-from, .drawer-leave-to { opacity: 0; }
.drawer-enter-from .drawer, .drawer-leave-to .drawer { transform: translateX(2rem); }

@media (max-width: 620px) {
  .drawer { inset: 0; width: 100%; border: 0; border-radius: 0; }
  .two { grid-template-columns: 1fr; }
  .queue { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .drawer-footer { padding-bottom: calc(1.2rem + env(safe-area-inset-bottom)); }
}
</style>
