<script setup lang="ts">
import { apiErrorMessage } from '~/utils/api-error'
import { createMediaThumbnail } from '~/utils/media-upload'
definePageMeta({ layout: 'admin' })

type Asset = {
  id: string
  originalFilename: string
  mimeType: string
  byteSize: number
  width: number
  height: number
  title: string
  altText: string
  tags: string[]
  gigId: string | null
  venueId: string | null
  gigTitle: string | null
  venueName: string | null
  createdAt: string
  url: string
  thumbnailUrl: string
  hasThumbnail: boolean
}
type MediaData = {
  assets: Asset[]
  options: {
    gigs: Array<{ id: string, title: string }>
    venues: Array<{ id: string, name: string }>
  }
}

const { data, refresh } = await useFetch<MediaData>('/api/admin/media')
const search = ref('')
const selectedId = ref('')
const uploadFile = ref<File | null>(null)
const uploadTitle = ref('')
const uploadAlt = ref('')
const uploadTags = ref('')
const uploadGigId = ref('')
const uploadVenueId = ref('')
const fileInput = ref<HTMLInputElement | null>(null)
const busy = ref('')
const message = ref('')

const filteredAssets = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return data.value?.assets || []
  return (data.value?.assets || []).filter((asset) => [
    asset.title,
    asset.altText,
    asset.originalFilename,
    asset.tags.join(' '),
    asset.gigTitle || '',
    asset.venueName || '',
  ].some(value => value.toLowerCase().includes(q)))
})

const selected = computed(() => data.value?.assets.find(asset => asset.id === selectedId.value) || null)
const edit = reactive({ title: '', altText: '', tags: '', gigId: '', venueId: '' })

watch(selected, (asset) => {
  if (!asset) return
  edit.title = asset.title
  edit.altText = asset.altText
  edit.tags = asset.tags.join(', ')
  edit.gigId = asset.gigId || ''
  edit.venueId = asset.venueId || ''
}, { immediate: true })

function chooseFile(event: Event) {
  uploadFile.value = (event.target as HTMLInputElement).files?.[0] || null
}

async function upload() {
  if (!uploadFile.value) return
  busy.value = 'upload'
  message.value = ''
  try {
    const thumbnail = await createMediaThumbnail(uploadFile.value)
    const form = new FormData()
    form.append('file', uploadFile.value)
    form.append('thumbnail', thumbnail, 'thumbnail.jpg')
    form.append('title', uploadTitle.value)
    form.append('altText', uploadAlt.value)
    form.append('tags', uploadTags.value)
    form.append('gigId', uploadGigId.value)
    form.append('venueId', uploadVenueId.value)
    await $fetch('/api/admin/media', { method: 'POST', body: form })
    uploadFile.value = null
    uploadTitle.value = ''
    uploadAlt.value = ''
    uploadTags.value = ''
    uploadGigId.value = ''
    uploadVenueId.value = ''
    if (fileInput.value) fileInput.value.value = ''
    message.value = 'Image uploaded and thumbnail created.'
    await refresh()
  } catch (error) {
    message.value = apiErrorMessage(error, error instanceof Error ? error.message : 'Upload failed.')
  } finally {
    busy.value = ''
  }
}

async function save() {
  if (!selected.value) return
  busy.value = 'save'
  message.value = ''
  try {
    const path = `/api/admin/media/${selected.value.id}` as `/api/admin/media/${string}`
    await $fetch(path, {
      method: 'PUT',
      body: {
        title: edit.title,
        altText: edit.altText,
        tags: edit.tags,
        gigId: edit.gigId || null,
        venueId: edit.venueId || null,
      },
    })
    message.value = 'Media metadata saved.'
    await refresh()
  } catch (error) {
    message.value = error instanceof Error ? error.message : 'Save failed.'
  } finally {
    busy.value = ''
  }
}

async function remove() {
  if (!selected.value || !confirm(`Delete ${selected.value.title || selected.value.originalFilename}? NightLight will block deletion when the asset is still referenced.`)) return
  busy.value = 'delete'
  message.value = ''
  try {
    const path = `/api/admin/media/${selected.value.id}` as `/api/admin/media/${string}`
    await $fetch(path, { method: 'DELETE' })
    selectedId.value = ''
    message.value = 'Media asset deleted.'
    await refresh()
  } catch (error: unknown) {
    let references: string[] | undefined
    if (typeof error === 'object' && error !== null && 'data' in error) {
      const outer = (error as { data?: unknown }).data
      if (typeof outer === 'object' && outer !== null && 'data' in outer) {
        const inner = (outer as { data?: unknown }).data
        if (typeof inner === 'object' && inner !== null && 'references' in inner) {
          const value = (inner as { references?: unknown }).references
          if (Array.isArray(value) && value.every(item => typeof item === 'string')) references = value
        }
      }
    }
    message.value = references?.length
      ? `Cannot delete: ${references.join(' · ')}`
      : error instanceof Error ? error.message : 'Delete failed.'
  } finally {
    busy.value = ''
  }
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
</script>

<template>
  <div class="page">
    <header class="header">
      <div>
        <p class="eyebrow">Content</p>
        <h1>Media library</h1>
        <p>Persistent originals and generated thumbnails stored outside the application container.</p>
      </div>
    </header>

    <AdminFilterBar
      :has-active-filters="Boolean(search)"
      :results-label="`${filteredAssets.length} images`"
      @clear-all="search = ''"
    >
      <template #primary>
        <input v-model="search" type="search" placeholder="Search title, tag, gig or venue">
      </template>
      <template #chips>
        <AdminFilterChip v-if="search" :label="`Search: ${search}`" @remove="search = ''" />
      </template>
    </AdminFilterBar>

    <p v-if="message" class="message">{{ message }}</p>

    <section class="panel upload">
      <div>
        <h2>Upload image</h2>
        <p>JPEG, PNG or WebP · max 15 MB. File signatures and dimensions are validated server-side.</p>
      </div>
      <input ref="fileInput" type="file" accept="image/jpeg,image/png,image/webp" @change="chooseFile">
      <input v-model="uploadTitle" placeholder="Title">
      <input v-model="uploadAlt" placeholder="Alt text">
      <input v-model="uploadTags" placeholder="Tags, comma separated">
      <select v-model="uploadGigId">
        <option value="">No gig association</option>
        <option v-for="gig in data?.options.gigs" :key="gig.id" :value="gig.id">{{ gig.title }}</option>
      </select>
      <select v-model="uploadVenueId">
        <option value="">No venue association</option>
        <option v-for="venue in data?.options.venues" :key="venue.id" :value="venue.id">{{ venue.name }}</option>
      </select>
      <button class="primary" type="button" :disabled="!uploadFile || busy === 'upload'" @click="upload">
        {{ busy === 'upload' ? 'Uploading…' : 'Upload' }}
      </button>
    </section>

    <div class="content">
      <section class="grid">
        <button
          v-for="asset in filteredAssets"
          :key="asset.id"
          class="card"
          :class="{ active: selectedId === asset.id }"
          type="button"
          @click="selectedId = asset.id"
        >
          <img :src="asset.thumbnailUrl" :alt="asset.altText || asset.title || asset.originalFilename" loading="lazy">
          <span class="card-body">
            <strong>{{ asset.title || asset.originalFilename }}</strong>
            <small>{{ asset.width }}<IconTimes />{{ asset.height }} · {{ formatBytes(asset.byteSize) }}</small>
            <span v-if="asset.tags.length" class="tags">
              <i v-for="tag in asset.tags.slice(0, 4)" :key="tag">{{ tag }}</i>
            </span>
          </span>
        </button>
        <p v-if="!filteredAssets.length" class="empty">No images match this filter.</p>
      </section>

      <aside v-if="selected" class="panel inspector">
        <img :src="selected.url" :alt="selected.altText || selected.title" class="preview">
        <h2>{{ selected.title || selected.originalFilename }}</h2>
        <p>{{ selected.mimeType }} · {{ selected.width }}<IconTimes />{{ selected.height }} · {{ formatBytes(selected.byteSize) }}</p>
        <label><span>Title</span><input v-model="edit.title"></label>
        <label><span>Alt text</span><textarea v-model="edit.altText" rows="3" /></label>
        <label><span>Tags</span><input v-model="edit.tags"></label>
        <label>
          <span>Gig</span>
          <select v-model="edit.gigId">
            <option value="">None</option>
            <option v-for="gig in data?.options.gigs" :key="gig.id" :value="gig.id">{{ gig.title }}</option>
          </select>
        </label>
        <label>
          <span>Venue</span>
          <select v-model="edit.venueId">
            <option value="">None</option>
            <option v-for="venue in data?.options.venues" :key="venue.id" :value="venue.id">{{ venue.name }}</option>
          </select>
        </label>
        <div class="actions">
          <button class="primary" type="button" :disabled="busy === 'save'" @click="save">Save metadata</button>
          <button class="with-icon danger" type="button" :disabled="busy === 'delete'" @click="remove"><Icon name="lucide:trash-2" aria-hidden="true" />Delete</button>
        </div>
        <small>Deletion is blocked when the image is associated with a gig/venue or referenced by website/landing-page content.</small>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.page { max-width: 1280px; margin: 0 auto; }
.header { display: flex; justify-content: space-between; gap: 1rem; align-items: flex-end; }
h1 { margin: .2rem 0; font-size: clamp(2.5rem, 6vw, 4.6rem); letter-spacing: -.05em; }
h2 { margin: 0 0 .35rem; }
p, small { color: #918999; }
.search { max-width: 360px; }
.panel { border: 1px solid #2c2732; border-radius: 1rem; padding: 1.2rem; background: #121016; }
.upload { display: grid; grid-template-columns: 1.5fr repeat(5, minmax(120px, 1fr)) auto; gap: .7rem; align-items: end; margin-top: 1.2rem; }
input, textarea, select, button { border: 1px solid #37313d; border-radius: .65rem; padding: .7rem; background: #18151d; color: #fff; }
button { cursor: pointer; }
button:disabled { opacity: .45; cursor: not-allowed; }
.primary { border-color: #fff; background: #fff; color: #0d0b10; font-weight: 700; }
.content { display: grid; grid-template-columns: minmax(0, 1fr) 360px; gap: 1rem; margin-top: 1rem; align-items: start; }
.grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: .8rem; }
.card { overflow: hidden; padding: 0; text-align: left; background: #121016; }
.card.active { border-color: #80738c; }
.card img { display: block; width: 100%; aspect-ratio: 4 / 3; object-fit: cover; background: #09080b; }
.card-body { display: grid; gap: .35rem; padding: .8rem; }
.tags { display: flex; gap: .3rem; flex-wrap: wrap; }
.tags i { padding: .2rem .4rem; border-radius: 999px; background: #211c27; color: #9e95a6; font-size: .65rem; font-style: normal; }
.inspector { position: sticky; top: 1rem; }
.preview { width: 100%; max-height: 280px; object-fit: contain; border-radius: .7rem; background: #09080b; }
label { display: grid; gap: .35rem; margin-top: .8rem; color: #bcb5c3; font-size: .82rem; }
label input, label textarea, label select { width: 100%; }
.actions { display: flex; gap: .6rem; margin: 1rem 0; }
.danger { color: #f2a1aa; border-color: #633b43; }
.message { padding: .7rem 1rem; border: 1px solid #3c3544; border-radius: .7rem; }
.empty { grid-column: 1 / -1; padding: 2rem; border: 1px dashed #39323f; border-radius: 1rem; text-align: center; }
@media (max-width: 1050px) {
  .upload { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .upload > div { grid-column: 1 / -1; }
  .content { grid-template-columns: 1fr; }
  .inspector { position: static; }
}
@media (max-width: 720px) {
  .header { display: grid; }
  .search { max-width: none; width: 100%; }
  .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 480px) {
  .upload, .grid { grid-template-columns: 1fr; }
}
</style>
