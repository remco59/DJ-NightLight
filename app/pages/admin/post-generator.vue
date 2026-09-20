<script setup lang="ts">
import { renderPostCanvas } from '~/utils/post-renderer'
import {
  POST_PRESETS,
  type PostDesign,
  type PostPreset,
} from '~~/shared/post-generator'

definePageMeta({ layout: 'admin' })

type MediaAsset = {
  id: string
  title: string
  altText: string
  originalFilename: string
  width: number
  height: number
  createdAt: string
  url: string
  thumbnailUrl: string
}

type GeneratedPost = {
  id: string
  sourceMediaAssetId: string | null
  templateKey: string
  preset: string
  width: number
  height: number
  design: Record<string, unknown>
  createdAt: string
  imageUrl: string
}

type GeneratorData = {
  assets: MediaAsset[]
  posts: GeneratedPost[]
}

const { data, refresh } = await useFetch<GeneratorData>('/api/admin/post-generator')
const sourceAssetId = ref('')
const sourceSearch = ref('')
const freshFile = ref<File | null>(null)
const freshInput = ref<HTMLInputElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
const busy = ref('')
const message = ref('')
const lastRenderedUrl = ref('')
let sourceBitmap: ImageBitmap | null = null

const design = reactive<PostDesign>({
  preset: 'square',
  templateKey: 'gradient',
  brandPreset: 'night',
  headline: 'YOUR NIGHT. YOUR SOUND.',
  subline: 'DJ NightLight · allround DJ',
  dateText: '',
  locationText: '',
  logoText: 'NIGHTLIGHT',
  imageX: 0,
  imageY: 0,
  zoom: 1,
  overlayOpacity: .72,
  textAlign: 'left',
  textPosition: 'bottom',
  showSafeArea: true,
})

const presetOptions = Object.entries(POST_PRESETS) as Array<[PostPreset, (typeof POST_PRESETS)[PostPreset]]>

const templates = [
  { key: 'gradient' as const, label: 'Gradient', description: 'Atmospheric photo with cinematic fade.' },
  { key: 'poster' as const, label: 'Poster', description: 'Bold framed event poster.' },
  { key: 'minimal' as const, label: 'Minimal', description: 'Clean editorial panel.' },
]
const brands = [
  { key: 'night' as const, label: 'NightLight', description: 'Purple nightlife accent.' },
  { key: 'mono' as const, label: 'Mono', description: 'Black & white.' },
  { key: 'warm' as const, label: 'Warm', description: 'Warm orange accent.' },
]

const selectedAsset = computed(() => data.value?.assets.find(asset => asset.id === sourceAssetId.value) || null)
const filteredAssets = computed(() => {
  const q = sourceSearch.value.trim().toLowerCase()
  const assets = data.value?.assets || []
  if (!q) return assets
  return assets.filter(asset => [
    asset.title,
    asset.altText,
    asset.originalFilename,
  ].some(value => value.toLowerCase().includes(q)))
})

function chooseFreshFile(event: Event) {
  freshFile.value = (event.target as HTMLInputElement).files?.[0] || null
}

async function createThumbnail(file: File) {
  const bitmap = await createImageBitmap(file)
  const max = 480
  const scale = Math.min(1, max / bitmap.width, max / bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bitmap.width * scale))
  canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  const context = canvas.getContext('2d')
  if (!context) {
    bitmap.close()
    throw new Error('Could not create thumbnail')
  }
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not encode thumbnail')), 'image/jpeg', .82)
  })
}

async function uploadFreshSource() {
  if (!freshFile.value) return
  busy.value = 'upload'
  message.value = ''
  try {
    const thumbnail = await createThumbnail(freshFile.value)
    const form = new FormData()
    form.append('file', freshFile.value)
    form.append('thumbnail', thumbnail, 'thumbnail.jpg')
    form.append('title', freshFile.value.name.replace(/\.[^.]+$/, ''))
    form.append('altText', '')
    form.append('tags', 'post-generator')
    form.append('gigId', '')
    form.append('venueId', '')
    const result = await $fetch<{ asset: { id: string } }>('/api/admin/media', { method: 'POST', body: form })
    await refresh()
    sourceAssetId.value = result.asset.id
    freshFile.value = null
    if (freshInput.value) freshInput.value.value = ''
    message.value = 'Photo uploaded to the media library and selected.'
  } catch (error) {
    message.value = error instanceof Error ? error.message : 'Upload failed.'
  } finally {
    busy.value = ''
  }
}

async function loadSelectedSource() {
  const asset = selectedAsset.value
  if (!asset || !import.meta.client) {
    sourceBitmap?.close()
    sourceBitmap = null
    return
  }
  const response = await fetch(asset.url)
  if (!response.ok) throw new Error('Could not load selected media')
  const blob = await response.blob()
  const bitmap = await createImageBitmap(blob)
  sourceBitmap?.close()
  sourceBitmap = bitmap
  await renderPreview()
}

async function renderPreview() {
  await nextTick()
  if (!canvasRef.value || !sourceBitmap) return
  renderPostCanvas(canvasRef.value, sourceBitmap, design, true)
}

watch(sourceAssetId, () => {
  void loadSelectedSource().catch((error) => {
    message.value = error instanceof Error ? error.message : 'Could not load photo.'
  })
})
watch(design, () => void renderPreview(), { deep: true })

onMounted(() => {
  if (!sourceAssetId.value && data.value?.assets[0]) sourceAssetId.value = data.value.assets[0].id
  else void loadSelectedSource()
})
onBeforeUnmount(() => sourceBitmap?.close())

function setPreset(preset: PostPreset) {
  design.preset = preset
}

async function renderAndSave() {
  if (!sourceBitmap || !selectedAsset.value) {
    message.value = 'Select a photo first.'
    return
  }

  busy.value = 'render'
  message.value = ''
  try {
    const exportCanvas = document.createElement('canvas')
    renderPostCanvas(exportCanvas, sourceBitmap, design, false)
    const blob = await new Promise<Blob>((resolve, reject) => {
      exportCanvas.toBlob(result => result ? resolve(result) : reject(new Error('PNG export failed')), 'image/png')
    })
    const form = new FormData()
    form.append('file', blob, `nightlight-${design.preset}.png`)
    form.append('design', JSON.stringify(design))
    form.append('sourceMediaAssetId', selectedAsset.value.id)
    const result = await $fetch<{ post: { id: string, imageUrl: string } }>('/api/admin/post-generator/render', {
      method: 'POST',
      body: form,
    })
    lastRenderedUrl.value = result.post.imageUrl
    message.value = 'Post rendered and saved. The PNG is now reusable from generated history.'
    await refresh()
    await renderPreview()
  } catch (error) {
    message.value = error instanceof Error ? error.message : 'Render failed.'
  } finally {
    busy.value = ''
  }
}

async function deletePost(post: GeneratedPost) {
  if (!confirm('Delete this generated output?')) return
  busy.value = post.id
  try {
    const response = await fetch(`/api/admin/post-generator/${post.id}`, { method: 'DELETE' })
    if (!response.ok) throw new Error('Could not delete generated post')
    if (lastRenderedUrl.value === post.imageUrl) lastRenderedUrl.value = ''
    await refresh()
  } catch (error) {
    message.value = error instanceof Error ? error.message : 'Delete failed.'
  } finally {
    busy.value = ''
  }
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('nl-NL', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}
</script>

<template>
  <div class="page">
    <header class="header">
      <div>
        <p class="eyebrow">Content</p>
        <h1>Post generator</h1>
        <p>Create branded NightLight social images independently from a gig.</p>
      </div>
      <div class="export-actions">
        <a v-if="lastRenderedUrl" :href="lastRenderedUrl" download="nightlight-post.png">Export last PNG</a>
        <button class="primary" type="button" :disabled="busy === 'render' || !selectedAsset" @click="renderAndSave">
          {{ busy === 'render' ? 'Rendering…' : 'Render & save' }}
        </button>
      </div>
    </header>

    <p v-if="message" class="message">{{ message }}</p>

    <div class="workspace">
      <aside class="controls">
        <section class="panel">
          <p class="step">1 · Photo</p>
          <div class="fresh-upload">
            <input ref="freshInput" type="file" accept="image/jpeg,image/png,image/webp" @change="chooseFreshFile">
            <button type="button" :disabled="!freshFile || busy === 'upload'" @click="uploadFreshSource">
              {{ busy === 'upload' ? 'Uploading…' : 'Upload new photo' }}
            </button>
          </div>
          <input v-model="sourceSearch" type="search" placeholder="Search media library">
          <div class="media-grid">
            <button
              v-for="asset in filteredAssets.slice(0, 40)"
              :key="asset.id"
              type="button"
              class="media-option"
              :class="{ active: sourceAssetId === asset.id }"
              :title="asset.title || asset.originalFilename"
              @click="sourceAssetId = asset.id"
            >
              <img :src="asset.thumbnailUrl" :alt="asset.altText || asset.title">
            </button>
          </div>
        </section>

        <section class="panel">
          <p class="step">2 · Format & template</p>
          <div class="segmented">
            <button
              v-for="[key, preset] in presetOptions"
              :key="key"
              type="button"
              :class="{ active: design.preset === key }"
              @click="setPreset(key)"
            >
              <strong>{{ preset.label }}</strong>
              <span>{{ preset.width }}×{{ preset.height }}</span>
            </button>
          </div>

          <div class="choice-grid">
            <button
              v-for="template in templates"
              :key="template.key"
              type="button"
              :class="{ active: design.templateKey === template.key }"
              @click="design.templateKey = template.key"
            >
              <strong>{{ template.label }}</strong>
              <span>{{ template.description }}</span>
            </button>
          </div>

          <label>
            <span>Brand preset</span>
            <select v-model="design.brandPreset">
              <option v-for="brand in brands" :key="brand.key" :value="brand.key">{{ brand.label }} — {{ brand.description }}</option>
            </select>
          </label>
        </section>

        <section class="panel">
          <p class="step">3 · Copy</p>
          <label><span>Headline</span><textarea v-model="design.headline" rows="2" maxlength="180" /></label>
          <label><span>Subline</span><textarea v-model="design.subline" rows="2" maxlength="260" /></label>
          <div class="two">
            <label><span>Date text</span><input v-model="design.dateText" maxlength="160" placeholder="12 SEP · 20:00"></label>
            <label><span>Location text</span><input v-model="design.locationText" maxlength="160" placeholder="GRONINGEN"></label>
          </div>
          <label><span>Brand label</span><input v-model="design.logoText" maxlength="80"></label>
        </section>

        <section class="panel">
          <p class="step">4 · Crop & style</p>
          <label>
            <span>Zoom · {{ design.zoom.toFixed(2) }}×</span>
            <input v-model.number="design.zoom" type="range" min="1" max="3" step=".02">
          </label>
          <label>
            <span>Horizontal position</span>
            <input v-model.number="design.imageX" type="range" min="-1" max="1" step=".02">
          </label>
          <label>
            <span>Vertical position</span>
            <input v-model.number="design.imageY" type="range" min="-1" max="1" step=".02">
          </label>
          <label>
            <span>Overlay · {{ Math.round(design.overlayOpacity * 100) }}%</span>
            <input v-model.number="design.overlayOpacity" type="range" min="0" max=".9" step=".02">
          </label>
          <div class="two">
            <label>
              <span>Text alignment</span>
              <select v-model="design.textAlign">
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
              </select>
            </label>
            <label>
              <span>Text position</span>
              <select v-model="design.textPosition">
                <option value="top">Top</option>
                <option value="middle">Middle</option>
                <option value="bottom">Bottom</option>
              </select>
            </label>
          </div>
          <label class="check"><input v-model="design.showSafeArea" type="checkbox"> Show safe-area guides in preview</label>
        </section>
      </aside>

      <main class="preview-column">
        <section class="preview-shell">
          <div v-if="selectedAsset" class="canvas-frame" :data-preset="design.preset">
            <canvas ref="canvasRef" class="preview-canvas" />
          </div>
          <div v-else class="no-source">Choose a media-library image or upload a fresh photo.</div>
          <p class="preview-note">Safe-area guides are preview-only and never appear in the exported PNG.</p>
        </section>

        <section class="panel history">
          <div class="history-head">
            <div>
              <p class="step">Generated posts</p>
              <h2>Reusable outputs</h2>
            </div>
            <button type="button" @click="refresh()">Refresh</button>
          </div>
          <div v-if="data?.posts.length" class="history-grid">
            <article v-for="post in data.posts" :key="post.id">
              <img :src="post.imageUrl" alt="Generated NightLight social post" loading="lazy">
              <div>
                <strong>{{ post.preset }} · {{ post.templateKey }}</strong>
                <small>{{ post.width }}×{{ post.height }} · {{ formatDate(post.createdAt) }}</small>
                <span class="history-actions">
                  <a :href="post.imageUrl" :download="`nightlight-${post.id}.png`">Export PNG</a>
                  <button type="button" :disabled="busy === post.id" @click="deletePost(post)">Delete</button>
                </span>
              </div>
            </article>
          </div>
          <p v-else>No generated posts yet.</p>
        </section>
      </main>
    </div>
  </div>
</template>

<style scoped>
.page { max-width: 1480px; margin: 0 auto; }
.header, .export-actions, .history-head, .history-actions, .fresh-upload { display: flex; gap: .7rem; align-items: center; }
.header, .history-head { justify-content: space-between; align-items: flex-start; }
h1 { margin: .2rem 0; font-size: clamp(2.5rem, 6vw, 4.8rem); letter-spacing: -.055em; }
h2 { margin: .15rem 0; }
p, small, .choice-grid span, .segmented span { color: #918999; }
.export-actions a, .history-actions a { color: #d8cdea; text-decoration: none; border: 1px solid #3d3547; border-radius: .65rem; padding: .65rem .8rem; }
button, input, textarea, select { border: 1px solid #37313d; border-radius: .65rem; background: #18151d; color: #fff; }
button { padding: .68rem .85rem; cursor: pointer; }
button:disabled { opacity: .45; cursor: not-allowed; }
input, textarea, select { width: 100%; padding: .7rem; }
textarea { resize: vertical; }
.primary { background: #fff; color: #0d0b10; border-color: #fff; font-weight: 800; }
.message { padding: .8rem 1rem; border: 1px solid #403748; border-radius: .8rem; }
.workspace { display: grid; grid-template-columns: 390px minmax(0, 1fr); gap: 1rem; margin-top: 1.2rem; align-items: start; }
.controls { display: grid; gap: .8rem; }
.panel { border: 1px solid #2b2631; border-radius: 1rem; padding: 1rem; background: #121016; }
.step { margin: 0 0 .75rem; color: #a997b7; font-size: .72rem; font-weight: 800; letter-spacing: .13em; text-transform: uppercase; }
label { display: grid; gap: .35rem; margin-top: .75rem; color: #bbb3c2; font-size: .8rem; }
.two { display: grid; grid-template-columns: 1fr 1fr; gap: .65rem; }
.check { display: flex; align-items: center; }
.check input { width: auto; }
.fresh-upload { align-items: stretch; margin-bottom: .65rem; }
.fresh-upload input { min-width: 0; }
.media-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: .35rem; margin-top: .65rem; max-height: 235px; overflow: auto; }
.media-option { padding: 0; overflow: hidden; aspect-ratio: 1; background: #09080b; }
.media-option.active { border-color: #b18cff; box-shadow: 0 0 0 2px rgba(177,140,255,.25); }
.media-option img { width: 100%; height: 100%; object-fit: cover; display: block; }
.segmented, .choice-grid { display: grid; gap: .5rem; }
.segmented { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.choice-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); margin-top: .7rem; }
.segmented button, .choice-grid button { display: grid; gap: .2rem; text-align: left; }
.segmented button.active, .choice-grid button.active { border-color: #8f74a3; background: #211b29; }
.preview-column { min-width: 0; display: grid; gap: 1rem; }
.preview-shell { min-height: 640px; display: grid; place-items: center; padding: 1.4rem; border: 1px solid #2b2631; border-radius: 1rem; background: radial-gradient(circle at 50% 30%, #231d2b, #0d0b10 70%); }
.canvas-frame { display: grid; place-items: center; width: min(100%, 720px); max-height: 78vh; }
.preview-canvas { display: block; width: auto; max-width: 100%; max-height: 74vh; border-radius: .35rem; box-shadow: 0 24px 70px rgba(0,0,0,.5); }
.no-source { color: #8d8595; }
.preview-note { margin: .8rem 0 0; align-self: end; text-align: center; font-size: .75rem; }
.history { overflow: hidden; }
.history-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: .7rem; margin-top: 1rem; }
.history-grid article { overflow: hidden; border: 1px solid #302a36; border-radius: .8rem; background: #0d0b10; }
.history-grid img { width: 100%; aspect-ratio: 4 / 5; object-fit: cover; background: #050406; display: block; }
.history-grid article > div { display: grid; gap: .35rem; padding: .7rem; }
.history-actions { justify-content: space-between; margin-top: .35rem; }
.history-actions a, .history-actions button { padding: .45rem .55rem; font-size: .72rem; }
@media (max-width: 1150px) {
  .workspace { grid-template-columns: 340px minmax(0, 1fr); }
  .history-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .choice-grid { grid-template-columns: 1fr; }
}
@media (max-width: 900px) {
  .workspace { grid-template-columns: 1fr; }
  .controls { order: 2; }
  .preview-column { order: 1; }
  .preview-shell { min-height: 460px; }
}
@media (max-width: 620px) {
  .header, .export-actions { display: grid; }
  .two, .segmented { grid-template-columns: 1fr; }
  .media-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  .history-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
</style>
