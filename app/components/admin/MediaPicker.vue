import { apiErrorMessage } from '~/utils/api-error'
import { createMediaThumbnail } from '~/utils/media-upload'
<script setup lang="ts">
type MediaAsset = {
  id: string
  originalFilename: string
  title: string
  altText: string
  tags: string[]
  width: number
  height: number
  url: string
  thumbnailUrl: string
}

type MediaData = {
  assets: MediaAsset[]
}

const props = withDefaults(defineProps<{
  modelValue: string | null
  label?: string
  description?: string
}>(), {
  label: 'Image',
  description: '',
})

const emit = defineEmits<{
  'update:modelValue': [value: string | null]
  selected: [asset: MediaAsset]
}>()

const { data, refresh } = await useFetch<MediaData>('/api/admin/media', {
  key: 'admin-media-picker-assets',
})

const open = ref(false)
const search = ref('')
const uploadFile = ref<File | null>(null)
const uploadTitle = ref('')
const uploadAlt = ref('')
const uploadBusy = ref(false)
const uploadMessage = ref('')
const fileInput = ref<HTMLInputElement | null>(null)

const currentUrl = computed({
  get: () => props.modelValue || '',
  set: value => emit('update:modelValue', value.trim() || null),
})

const selectedAsset = computed(() =>
  data.value?.assets.find(asset => asset.url === props.modelValue) || null,
)

const filteredAssets = computed(() => {
  const q = search.value.trim().toLowerCase()
  const assets = data.value?.assets || []
  if (!q) return assets
  return assets.filter(asset =>
    [asset.title, asset.altText, asset.originalFilename, asset.tags.join(' ')]
      .some(value => value.toLowerCase().includes(q)),
  )
})

function selectAsset(asset: MediaAsset) {
  emit('update:modelValue', asset.url)
  emit('selected', asset)
  open.value = false
  search.value = ''
}

function clearSelection() {
  emit('update:modelValue', null)
}

function chooseFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0] || null
  uploadFile.value = file
  if (file && !uploadTitle.value) {
    uploadTitle.value = file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ')
  }
}

async function upload() {
  if (!uploadFile.value) return
  uploadBusy.value = true
  uploadMessage.value = ''
  try {
    const thumbnail = await createMediaThumbnail(uploadFile.value)
    const form = new FormData()
    form.append('file', uploadFile.value)
    form.append('thumbnail', thumbnail, 'thumbnail.jpg')
    form.append('title', uploadTitle.value)
    form.append('altText', uploadAlt.value)
    form.append('tags', 'website')
    form.append('gigId', '')
    form.append('venueId', '')
    const result = await $fetch<{ asset: MediaAsset }>('/api/admin/media', {
      method: 'POST',
      body: form,
    })
    await refresh()
    emit('update:modelValue', result.asset.url)
    emit('selected', result.asset)
    uploadFile.value = null
    uploadTitle.value = ''
    uploadAlt.value = ''
    if (fileInput.value) fileInput.value.value = ''
    uploadMessage.value = 'Uploaded and selected.'
    open.value = false
  } catch (error) {
    uploadMessage.value = apiErrorMessage(error, error instanceof Error ? error.message : 'Upload failed.')
  } finally {
    uploadBusy.value = false
  }
}
</script>

<template>
  <div class="media-field">
    <div class="field-heading">
      <div>
        <strong>{{ label }}</strong>
        <span v-if="description">{{ description }}</span>
      </div>
      <button type="button" class="text-button" @click="open = true">
        {{ modelValue ? 'Change image' : 'Choose image' }}
      </button>
    </div>

    <div v-if="modelValue" class="selected-media">
      <img :src="modelValue" :alt="selectedAsset?.altText || selectedAsset?.title || label">
      <div class="selected-copy">
        <strong>{{ selectedAsset?.title || selectedAsset?.originalFilename || 'External image' }}</strong>
        <span v-if="selectedAsset">{{ selectedAsset.width }}×{{ selectedAsset.height }} · Media library</span>
        <span v-else>External URL</span>
        <button type="button" class="remove" @click="clearSelection">Remove</button>
      </div>
    </div>

    <div v-else class="empty-media" @click="open = true">
      <span>＋</span>
      <div>
        <strong>Select from Media</strong>
        <small>Or upload a new image without leaving this editor.</small>
      </div>
    </div>

    <details class="external">
      <summary>Use an external image URL</summary>
      <input v-model="currentUrl" type="url" placeholder="https://…">
    </details>

    <Teleport to="body">
      <div v-if="open" class="picker-backdrop" @click.self="open = false">
        <section class="picker-modal" role="dialog" aria-modal="true" :aria-label="`Choose ${label}`">
          <header class="picker-header">
            <div>
              <p class="eyebrow">Media library</p>
              <h2>Choose {{ label.toLowerCase() }}</h2>
              <p>Select an existing image or upload a new one.</p>
            </div>
            <button type="button" class="close" aria-label="Close" @click="open = false">×</button>
          </header>

          <div class="picker-toolbar">
            <input v-model="search" type="search" placeholder="Search title, filename or tag">
          </div>

          <div class="picker-body">
            <div class="library">
              <button
                v-for="asset in filteredAssets"
                :key="asset.id"
                type="button"
                class="asset"
                :class="{ active: asset.url === modelValue }"
                @click="selectAsset(asset)"
              >
                <img :src="asset.thumbnailUrl" :alt="asset.altText || asset.title || asset.originalFilename" loading="lazy">
                <span>
                  <strong>{{ asset.title || asset.originalFilename }}</strong>
                  <small>{{ asset.width }}×{{ asset.height }}</small>
                </span>
              </button>
              <p v-if="!filteredAssets.length" class="no-results">No images match your search.</p>
            </div>

            <aside class="upload-panel">
              <p class="eyebrow">New image</p>
              <h3>Upload to Media</h3>
              <p>JPEG, PNG or WebP · max 15 MB.</p>
              <input
                ref="fileInput"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                @change="chooseFile"
              >
              <label>
                <span>Title</span>
                <input v-model="uploadTitle" placeholder="Image title">
              </label>
              <label>
                <span>Alt text</span>
                <textarea v-model="uploadAlt" rows="3" placeholder="Describe the image"></textarea>
              </label>
              <p v-if="uploadMessage" class="upload-message">{{ uploadMessage }}</p>
              <button
                type="button"
                class="primary"
                :disabled="!uploadFile || uploadBusy"
                @click="upload"
              >
                {{ uploadBusy ? 'Uploading…' : 'Upload & use' }}
              </button>
            </aside>
          </div>
        </section>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.media-field{display:grid;gap:.65rem}.field-heading{display:flex;align-items:end;justify-content:space-between;gap:1rem}.field-heading>div{display:grid;gap:.2rem}.field-heading strong{color:#d8d2de;font-size:.82rem}.field-heading span{color:#81798a;font-size:.72rem;line-height:1.45}.text-button,.remove{border:0;padding:0;background:transparent;color:#b8a5d1;font-size:.75rem;cursor:pointer}.selected-media{display:grid;grid-template-columns:8rem minmax(0,1fr);gap:.8rem;align-items:center;padding:.65rem;border:1px solid #312b37;border-radius:.8rem;background:#0b0a0d}.selected-media img{width:8rem;height:5.5rem;object-fit:cover;border-radius:.55rem;background:#070609}.selected-copy{display:grid;gap:.25rem;min-width:0}.selected-copy strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#f3eff6;font-size:.82rem}.selected-copy span{color:#81798a;font-size:.7rem}.selected-copy .remove{justify-self:start;margin-top:.15rem;color:#df9ca7}.empty-media{display:flex;align-items:center;gap:.85rem;min-height:6rem;padding:1rem;border:1px dashed #41394a;border-radius:.8rem;background:#0b0a0d;cursor:pointer}.empty-media>span{display:grid;width:2.4rem;height:2.4rem;place-items:center;border-radius:.7rem;background:#1b1621;color:#c7b5de;font-size:1.25rem}.empty-media div{display:grid;gap:.2rem}.empty-media strong{color:#ddd7e2;font-size:.82rem}.empty-media small{color:#7f7888;font-size:.72rem}.external{color:#797282;font-size:.72rem}.external summary{cursor:pointer}.external input{width:100%;margin-top:.55rem;border:1px solid #332e39;border-radius:.65rem;padding:.72rem;background:#0b0a0d;color:#f6f3fa}

.picker-backdrop{position:fixed;inset:0;z-index:2000;display:grid;place-items:center;padding:1rem;background:rgba(4,3,6,.78);backdrop-filter:blur(12px)}.picker-modal{width:min(1120px,100%);max-height:calc(100dvh - 2rem);overflow:hidden;border:1px solid #342e3b;border-radius:1.2rem;background:#0d0b10;box-shadow:0 30px 100px rgba(0,0,0,.62)}.picker-header{display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;padding:1.15rem 1.25rem;border-bottom:1px solid #28232d}.picker-header h2{margin:.15rem 0 .25rem;font-size:1.75rem;letter-spacing:-.035em}.picker-header p:last-child{margin:0;color:#81798a;font-size:.8rem}.eyebrow{margin:0;color:#8f8798;font-size:.65rem;font-weight:800;letter-spacing:.12em;text-transform:uppercase}.close{display:grid;width:2.35rem;height:2.35rem;place-items:center;border:1px solid #342e3b;border-radius:.7rem;background:#151119;color:#d4ced9;font-size:1.5rem;cursor:pointer}.picker-toolbar{padding:.85rem 1.25rem;border-bottom:1px solid #242027}.picker-toolbar input{width:100%;border:1px solid #342e3b;border-radius:.7rem;padding:.75rem .85rem;background:#151119;color:#f5f1f7}.picker-body{display:grid;grid-template-columns:minmax(0,1fr) 300px;min-height:28rem;max-height:calc(100dvh - 12rem)}.library{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.7rem;align-content:start;overflow:auto;padding:1rem}.asset{overflow:hidden;padding:0;border:1px solid #2e2934;border-radius:.8rem;background:#111014;color:#fff;text-align:left;cursor:pointer}.asset:hover,.asset.active{border-color:#806f91}.asset img{display:block;width:100%;aspect-ratio:4/3;object-fit:cover;background:#08070a}.asset>span{display:grid;gap:.2rem;padding:.65rem}.asset strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.75rem}.asset small{color:#7f7888;font-size:.66rem}.no-results{grid-column:1/-1;padding:2rem;color:#81798a;text-align:center}.upload-panel{overflow:auto;padding:1rem;border-left:1px solid #28232d;background:#100e14}.upload-panel h3{margin:.25rem 0;font-size:1.15rem}.upload-panel>p:not(.eyebrow):not(.upload-message){margin:.2rem 0 1rem;color:#81798a;font-size:.72rem}.upload-panel>input[type=file]{width:100%;font-size:.72rem}.upload-panel label{display:grid;gap:.35rem;margin-top:.8rem;color:#a9a2b0;font-size:.72rem}.upload-panel input,.upload-panel textarea{width:100%;border:1px solid #342e3b;border-radius:.65rem;padding:.68rem;background:#17131b;color:#fff}.upload-panel .primary{width:100%;margin-top:1rem;border:0;border-radius:.65rem;padding:.72rem;background:#fff;color:#09080b;font-weight:800;cursor:pointer}.upload-panel .primary:disabled{opacity:.45;cursor:not-allowed}.upload-message{color:#b6a5ca;font-size:.72rem}

@media(max-width:800px){.picker-body{grid-template-columns:1fr;overflow:auto}.library{grid-template-columns:repeat(2,minmax(0,1fr));overflow:visible}.upload-panel{border-top:1px solid #28232d;border-left:0}.selected-media{grid-template-columns:6rem minmax(0,1fr)}.selected-media img{width:6rem;height:4.5rem}}
@media(max-width:520px){.picker-backdrop{padding:0}.picker-modal{width:100%;height:100dvh;max-height:none;border:0;border-radius:0}.picker-body{max-height:calc(100dvh - 11rem)}.library{grid-template-columns:1fr 1fr;padding:.75rem}.field-heading{align-items:start;flex-direction:column}.selected-media{grid-template-columns:5rem minmax(0,1fr)}.selected-media img{width:5rem;height:4rem}}
</style>
