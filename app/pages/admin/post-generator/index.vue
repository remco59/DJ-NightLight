<script setup lang="ts">
import { renderPostCanvas } from '~/utils/post-renderer'
import {
  defaultPostGigItems,
  defaultPostVisibility,
  POST_PRESETS,
  type PostDesign,
  type PostPreset,
  type PostTemplateKey,
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
const previewShellRef = ref<HTMLElement | null>(null)
const busy = ref('')
const message = ref('')
const lastRenderedUrl = ref('')
const openSections = ref<number[]>([1, 2, 3])
let sourceBitmap: ImageBitmap | null = null

const design = reactive<PostDesign>({
  preset: 'square',
  templateKey: 'gradient',
  brandPreset: 'night',
  headline: 'YOUR NIGHT. YOUR SOUND.',
  subline: 'DJ NightLight · allround DJ',
  dateText: '',
  timeText: '',
  locationText: '',
  ctaText: '',
  logoText: 'NIGHTLIGHT',
  visibility: defaultPostVisibility(),
  gigItems: defaultPostGigItems(),
  imageX: 0,
  imageY: 0,
  zoom: 1,
  overlayOpacity: .72,
  textAlign: 'left',
  textPosition: 'bottom',
  showSafeArea: true,
})

const presetOptions = Object.entries(POST_PRESETS) as Array<[PostPreset, (typeof POST_PRESETS)[PostPreset]]>

const templates: Array<{
  key: PostTemplateKey
  label: string
  description: string
  category: string
}> = [
  { key: 'gradient', label: 'Gradient', description: 'Atmospheric photo with cinematic fade.', category: 'Flexible' },
  { key: 'poster', label: 'Poster', description: 'Bold framed event poster.', category: 'Flexible' },
  { key: 'minimal', label: 'Minimal', description: 'Clean editorial panel.', category: 'Flexible' },
  { key: 'gig-announcement', label: 'Gig announcement', description: 'Bold event promo with date, time, location and CTA.', category: 'Gig' },
  { key: 'recap', label: 'Recap', description: 'High-energy post-event recap inspired by Sneekweek.', category: 'Recap' },
  { key: 'upcoming-gigs', label: 'Upcoming gigs', description: 'Planning layout with an editable list of upcoming dates.', category: 'Planning' },
]

const brands = [
  {
    key: 'night' as const,
    label: 'NightLight',
    description: 'Purple nightlife accent.',
    colors: ['#9d5cff', '#17131d', '#858093', '#f7f4fb'],
  },
  {
    key: 'mono' as const,
    label: 'Mono',
    description: 'Black & white.',
    colors: ['#ffffff', '#0d0b10', '#77717d', '#d8d4dc'],
  },
  {
    key: 'warm' as const,
    label: 'Warm',
    description: 'Warm orange accent.',
    colors: ['#ff7a45', '#1c1210', '#9f7465', '#fff3eb'],
  },
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
const readyToGenerate = computed(() => Boolean(
  selectedAsset.value
  && (!design.visibility.headline || design.headline.trim()),
))

function isSectionOpen(step: number) {
  return openSections.value.includes(step)
}

function toggleSection(step: number) {
  openSections.value = isSectionOpen(step)
    ? openSections.value.filter(item => item !== step)
    : [...openSections.value, step]
}

function chooseFreshFile(event: Event) {
  freshFile.value = (event.target as HTMLInputElement).files?.[0] || null
}

function openFilePicker() {
  freshInput.value?.click()
}

function dropFreshFile(event: DragEvent) {
  event.preventDefault()
  const file = event.dataTransfer?.files?.[0]
  if (!file) return
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    message.value = 'Choose a JPEG, PNG or WebP image.'
    return
  }
  freshFile.value = file
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

function setAllVisibility(value: boolean) {
  for (const key of Object.keys(design.visibility) as Array<keyof typeof design.visibility>) {
    design.visibility[key] = value
  }
}

function applyTemplate(templateKey: PostTemplateKey) {
  design.templateKey = templateKey

  if (templateKey === 'gig-announcement') {
    design.preset = 'story'
    design.headline = 'THIS FRIDAY'
    design.subline = 'PARTY DJ'
    design.dateText = '12 DEC'
    design.timeText = '22:00 – 02:00'
    design.locationText = 'Groningen'
    design.ctaText = 'SEE YOU THERE!'
    setAllVisibility(true)
    design.visibility.gigList = false
    design.textAlign = 'center'
    design.textPosition = 'middle'
    return
  }

  if (templateKey === 'recap') {
    design.preset = 'story'
    design.headline = 'LAST NIGHT WAS WILD'
    design.subline = 'RECAP'
    design.dateText = '05 AUG'
    design.timeText = ''
    design.locationText = 'Sneekweek · Sneek'
    design.ctaText = 'SEE YOU AT THE NEXT ONE!'
    setAllVisibility(true)
    design.visibility.time = false
    design.visibility.gigList = false
    design.textAlign = 'center'
    design.textPosition = 'middle'
    return
  }

  if (templateKey === 'upcoming-gigs') {
    design.preset = 'story'
    design.headline = 'DECEMBER'
    design.subline = 'PLANNING'
    design.dateText = ''
    design.timeText = ''
    design.locationText = ''
    design.ctaText = 'SEE YOU ON THE DANCEFLOOR!'
    design.gigItems = defaultPostGigItems()
    setAllVisibility(true)
    design.visibility.date = false
    design.visibility.time = false
    design.visibility.location = false
    design.textAlign = 'center'
    design.textPosition = 'middle'
  }
}

function addGigItem() {
  if (design.gigItems.length >= 6) return
  design.gigItems.push({
    enabled: true,
    dateText: '',
    title: '',
    locationText: '',
  })
}

function removeGigItem(index: number) {
  design.gigItems.splice(index, 1)
}

async function toggleFullscreen() {
  if (!previewShellRef.value || !import.meta.client) return
  if (document.fullscreenElement) {
    await document.exitFullscreen()
    return
  }
  await previewShellRef.value.requestFullscreen()
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
    form.append('file', blob, 'nightlight-' + design.preset + '.png')
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
    const response = await fetch('/api/admin/post-generator/' + post.id, { method: 'DELETE' })
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
    <header class="page-header">
      <div class="header-copy">
        <p class="breadcrumb">Content <span>/</span> Post generator</p>
        <h1>Instagram post generator</h1>
        <p class="subtitle">Create branded NightLight social images independently from a gig.</p>
      </div>

      <div class="header-actions">
        <span class="status-pill"><span class="status-dot" /> Live preview</span>
        <NuxtLink class="secondary-button" to="/admin/post-generator/video">Video generator</NuxtLink>
        <button
          class="primary"
          type="button"
          :disabled="busy === 'render' || !readyToGenerate"
          @click="renderAndSave"
        >
          {{ busy === 'render' ? 'Generating…' : 'Generate post →' }}
        </button>
      </div>
    </header>

    <p v-if="message" class="message">{{ message }}</p>

    <div class="workspace">
      <aside class="controls">
        <section class="workflow-card">
          <button
            class="section-heading"
            type="button"
            :aria-expanded="isSectionOpen(1)"
            @click="toggleSection(1)"
          >
            <span class="step-number">1</span>
            <span class="section-title">
              <strong>Source photo</strong>
              <small>Choose or upload a photo</small>
            </span>
            <span class="chevron">{{ isSectionOpen(1) ? '⌃' : '⌄' }}</span>
          </button>

          <div v-if="isSectionOpen(1)" class="section-body">
            <input
              ref="freshInput"
              class="file-input"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              @change="chooseFreshFile"
            >

            <button
              class="upload-zone"
              type="button"
              @click="openFilePicker"
              @dragover.prevent
              @drop="dropFreshFile"
            >
              <span class="upload-icon">↑</span>
              <span>
                <strong>{{ freshFile ? freshFile.name : 'Upload new' }}</strong>
                <small>{{ freshFile ? 'Ready to add to the media library' : 'Choose file or drag & drop' }}</small>
              </span>
            </button>

            <button
              v-if="freshFile"
              class="upload-confirm"
              type="button"
              :disabled="busy === 'upload'"
              @click="uploadFreshSource"
            >
              {{ busy === 'upload' ? 'Uploading…' : 'Add photo to library' }}
            </button>

            <div class="search-wrap">
              <span aria-hidden="true">⌕</span>
              <input v-model="sourceSearch" type="search" placeholder="Search media library…">
              <button v-if="sourceSearch" type="button" aria-label="Clear search" @click="sourceSearch = ''">×</button>
            </div>

            <div class="media-meta">
              <span>Media library</span>
              <small>{{ filteredAssets.length }} photos</small>
            </div>

            <div class="media-grid">
              <button
                v-for="asset in filteredAssets.slice(0, 12)"
                :key="asset.id"
                type="button"
                class="media-option"
                :class="{ active: sourceAssetId === asset.id }"
                :title="asset.title || asset.originalFilename"
                @click="sourceAssetId = asset.id"
              >
                <img :src="asset.thumbnailUrl" :alt="asset.altText || asset.title">
                <span v-if="sourceAssetId === asset.id" class="selected-mark">✓</span>
              </button>
            </div>
          </div>
        </section>

        <section class="workflow-card">
          <button
            class="section-heading"
            type="button"
            :aria-expanded="isSectionOpen(2)"
            @click="toggleSection(2)"
          >
            <span class="step-number">2</span>
            <span class="section-title">
              <strong>Format & templates</strong>
              <small>Choose a format and visual style</small>
            </span>
            <span class="chevron">{{ isSectionOpen(2) ? '⌃' : '⌄' }}</span>
          </button>

          <div v-if="isSectionOpen(2)" class="section-body">
            <div class="format-grid">
              <button
                v-for="[key, preset] in presetOptions"
                :key="key"
                type="button"
                class="format-card"
                :class="{ active: design.preset === key }"
                @click="setPreset(key)"
              >
                <span class="format-icon" :data-format="key" />
                <span>
                  <strong>{{ preset.label }}</strong>
                  <small>{{ key === 'square' ? 'Square' : key === 'portrait' ? 'Portrait' : 'Story' }}</small>
                  <em>{{ preset.width }}×{{ preset.height }}</em>
                </span>
              </button>
            </div>

            <div class="subheading-row">
              <strong>Templates</strong>
              <small>Visual style</small>
            </div>

            <div class="template-grid">
              <button
                v-for="template in templates"
                :key="template.key"
                type="button"
                class="template-card"
                :class="{ active: design.templateKey === template.key }"
                @click="design.templateKey = template.key"
              >
                <span
                  class="template-shot"
                  :class="'template-' + template.key"
                  :style="selectedAsset ? { backgroundImage: 'url(' + selectedAsset.thumbnailUrl + ')' } : undefined"
                >
                  <span class="template-logo">NIGHTLIGHT</span>
                  <span class="template-headline">YOUR NIGHT.<br>YOUR SOUND.</span>
                </span>
                <span class="template-copy">
                  <strong>{{ template.label }}</strong>
                  <small>{{ template.description }}</small>
                </span>
              </button>
            </div>
          </div>
        </section>

        <section class="workflow-card">
          <button
            class="section-heading"
            type="button"
            :aria-expanded="isSectionOpen(3)"
            @click="toggleSection(3)"
          >
            <span class="step-number">3</span>
            <span class="section-title">
              <strong>Copy</strong>
              <small>Add text and brand details</small>
            </span>
            <span class="chevron">{{ isSectionOpen(3) ? '⌃' : '⌄' }}</span>
          </button>

          <div v-if="isSectionOpen(3)" class="section-body form-stack">
            <label>
              <span class="label-row"><span>Headline</span><small>{{ design.headline.length }}/180</small></span>
              <textarea v-model="design.headline" rows="2" maxlength="180" />
            </label>
            <label>
              <span class="label-row"><span>Subline</span><small>{{ design.subline.length }}/260</small></span>
              <textarea v-model="design.subline" rows="2" maxlength="260" />
            </label>
            <div class="two">
              <label><span>Date text</span><input v-model="design.dateText" maxlength="160" placeholder="12 SEP · 20:00"></label>
              <label><span>Location text</span><input v-model="design.locationText" maxlength="160" placeholder="GRONINGEN"></label>
            </div>
            <label><span>Brand label</span><input v-model="design.logoText" maxlength="80"></label>
            <label>
              <span>Brand preset</span>
              <select v-model="design.brandPreset">
                <option v-for="brand in brands" :key="brand.key" :value="brand.key">{{ brand.label }} — {{ brand.description }}</option>
              </select>
            </label>
          </div>
        </section>

        <section class="workflow-card">
          <button
            class="section-heading"
            type="button"
            :aria-expanded="isSectionOpen(4)"
            @click="toggleSection(4)"
          >
            <span class="step-number">4</span>
            <span class="section-title">
              <strong>Crop & styling</strong>
              <small>Adjust framing, position and visual style</small>
            </span>
            <span class="chevron">{{ isSectionOpen(4) ? '⌃' : '⌄' }}</span>
          </button>

          <div v-if="isSectionOpen(4)" class="section-body form-stack">
            <label>
              <span class="label-row"><span>Zoom</span><small>{{ design.zoom.toFixed(2) }}×</small></span>
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
              <span class="label-row"><span>Overlay</span><small>{{ Math.round(design.overlayOpacity * 100) }}%</small></span>
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
          </div>
        </section>

        <section class="workflow-card">
          <button
            class="section-heading"
            type="button"
            :aria-expanded="isSectionOpen(5)"
            @click="toggleSection(5)"
          >
            <span class="step-number">5</span>
            <span class="section-title">
              <strong>Export</strong>
              <small>Generate, download or reuse</small>
            </span>
            <span class="chevron">{{ isSectionOpen(5) ? '⌃' : '⌄' }}</span>
          </button>

          <div v-if="isSectionOpen(5)" class="section-body export-panel">
            <p>Generate a full-resolution {{ POST_PRESETS[design.preset].width }}×{{ POST_PRESETS[design.preset].height }} PNG and keep it in your reusable output history.</p>
            <button
              class="primary full"
              type="button"
              :disabled="busy === 'render' || !readyToGenerate"
              @click="renderAndSave"
            >
              {{ busy === 'render' ? 'Generating…' : 'Generate post' }}
            </button>
            <a v-if="lastRenderedUrl" class="download-link" :href="lastRenderedUrl" download="nightlight-post.png">Download latest PNG</a>
          </div>
        </section>
      </aside>

      <main class="stage-stack">
        <section ref="previewShellRef" class="preview-shell">
          <div class="preview-toolbar">
            <div>
              <strong>Preview</strong>
              <small>See how your post will look on Instagram.</small>
            </div>

            <div class="preview-tools">
              <select v-model="design.preset" aria-label="Preview format">
                <option v-for="[key, preset] in presetOptions" :key="key" :value="key">
                  Instagram {{ preset.label }}
                </option>
              </select>
              <label class="toggle-control">
                <input v-model="design.showSafeArea" type="checkbox">
                <span class="toggle-track"><span /></span>
                <small>Safe area</small>
              </label>
              <button class="icon-button" type="button" title="Fullscreen preview" @click="toggleFullscreen">⤢</button>
            </div>
          </div>

          <div class="preview-stage">
            <div v-if="selectedAsset" class="canvas-frame" :data-preset="design.preset">
              <canvas ref="canvasRef" class="preview-canvas" />
            </div>
            <div v-else class="no-source">
              <span class="empty-icon">▧</span>
              <strong>Choose a source photo</strong>
              <small>Select a media-library image or upload a fresh photo.</small>
            </div>
          </div>

          <p class="preview-note">Safe-area guides are preview-only and never appear in the exported PNG.</p>
        </section>

        <section class="history">
          <div class="history-head">
            <div>
              <p class="eyebrow">Generated posts</p>
              <h2>Reusable outputs</h2>
              <p>Your recent generations stay ready to download or reuse.</p>
            </div>
            <button class="secondary-button" type="button" @click="refresh()">Refresh</button>
          </div>

          <div v-if="data?.posts.length" class="history-strip">
            <article v-for="post in data.posts" :key="post.id" class="history-card">
              <div class="history-image-wrap">
                <img :src="post.imageUrl" alt="Generated NightLight social post" loading="lazy">
                <span>{{ post.preset }}</span>
              </div>
              <div class="history-card-copy">
                <strong>{{ post.templateKey }}</strong>
                <small>{{ post.width }}×{{ post.height }}</small>
                <small>{{ formatDate(post.createdAt) }}</small>
                <div class="history-actions">
                  <a :href="post.imageUrl" :download="'nightlight-' + post.id + '.png'">Download</a>
                  <button type="button" :disabled="busy === post.id" @click="deletePost(post)">Delete</button>
                </div>
              </div>
            </article>
          </div>

          <div v-else class="empty-history">
            <strong>No generated posts yet</strong>
            <small>Your rendered posts will appear here.</small>
          </div>
        </section>
      </main>

    </div>
  </div>
</template>

<style scoped>
.page {
  width: 100%;
  max-width: 1480px;
  min-width: 0;
  margin: 0 auto;
  padding-bottom: 2rem;
}

.page-header,
.header-actions,
.preview-toolbar,
.preview-tools,
.history-head,
.history-actions,
.media-meta,
.subheading-row,
.label-row,
.side-heading,
.brand-current {
  display: flex;
  align-items: center;
}

.page-header {
  justify-content: space-between;
  gap: 2rem;
  margin-bottom: 1.25rem;
}

.header-copy {
  min-width: 0;
}

.breadcrumb,
.eyebrow {
  margin: 0;
  color: #968aa3;
  font-size: .72rem;
  font-weight: 800;
  letter-spacing: .12em;
  text-transform: uppercase;
}

.breadcrumb span {
  margin: 0 .35rem;
  color: #5d5465;
}

h1 {
  margin: .35rem 0 .3rem;
  font-size: clamp(2.4rem, 4vw, 4rem);
  line-height: .98;
  letter-spacing: -.055em;
}

h2 {
  margin: .12rem 0 .2rem;
  font-size: 1.25rem;
}

.subtitle,
.history-head p,
.preview-note,
.export-panel p {
  margin: 0;
  color: #948b9d;
}

.header-actions {
  gap: .65rem;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.status-pill,
.secondary-button,
.primary,
.download-link {
  border-radius: .72rem;
  min-height: 2.65rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.status-pill {
  gap: .45rem;
  padding: 0 .8rem;
  border: 1px solid #302938;
  background: #121016;
  color: #bbb2c4;
  font-size: .78rem;
}

.status-dot {
  width: .5rem;
  height: .5rem;
  border-radius: 50%;
  background: #45c47b;
  box-shadow: 0 0 0 4px rgba(69,196,123,.08);
}

button,
input,
textarea,
select {
  border: 1px solid #39313f;
  border-radius: .68rem;
  background: #17141b;
  color: #fff;
  font: inherit;
}

button {
  cursor: pointer;
}

button:disabled {
  opacity: .45;
  cursor: not-allowed;
}

input,
textarea,
select {
  width: 100%;
  padding: .72rem .78rem;
  outline: none;
}

input:focus,
textarea:focus,
select:focus {
  border-color: #7651a2;
  box-shadow: 0 0 0 3px rgba(157,92,255,.09);
}

textarea {
  resize: vertical;
}

input[type='range'] {
  accent-color: #a66bff;
  padding: 0;
}

.primary {
  padding: 0 1rem;
  border-color: #9d5cff;
  background: linear-gradient(135deg, #7c3aed, #a855f7);
  color: #fff;
  font-weight: 800;
  box-shadow: 0 10px 28px rgba(124,58,237,.18);
}

.secondary-button,
.download-link {
  padding: 0 .9rem;
  border: 1px solid #39313f;
  background: #151219;
  color: #ded6e5;
  text-decoration: none;
  font-weight: 700;
  font-size: .8rem;
}

.message {
  margin: 0 0 1rem;
  padding: .85rem 1rem;
  border: 1px solid #4a3c58;
  border-radius: .8rem;
  background: #17121d;
  color: #d8ccdf;
}

.workspace {
  display: grid;
  grid-template-columns: minmax(320px, 370px) minmax(0, 1fr);
  gap: 1rem;
  align-items: start;
}

.controls {
  min-width: 0;
  display: grid;
  gap: .7rem;
}

.workspace > * {
  min-width: 0;
}

.workflow-card,
.preview-shell,
.history,
.side-card {
  border: 1px solid #2e2834;
  border-radius: 1rem;
  background: #111014;
  box-shadow: 0 14px 40px rgba(0,0,0,.08);
}

.workflow-card {
  overflow: hidden;
}

.section-heading {
  width: 100%;
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: .72rem;
  padding: .9rem;
  border: 0;
  border-radius: 0;
  background: transparent;
  text-align: left;
}

.step-number {
  width: 2rem;
  height: 2rem;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: linear-gradient(145deg, #c4a3ff, #8b5cf6);
  color: #140d1d;
  font-weight: 900;
}

.section-title {
  display: grid;
  gap: .12rem;
}

.section-title strong {
  font-size: .9rem;
}

.section-title small,
.side-heading small,
.brand-current small,
.template-copy small,
.format-card small,
.format-card em,
.media-meta small,
.preview-toolbar small,
.toggle-control small,
.no-source small,
.history-card small,
.empty-history small {
  color: #8f8797;
  font-size: .72rem;
  font-style: normal;
}

.chevron {
  color: #847a8d;
  font-size: 1rem;
}

.section-body {
  padding: 0 .9rem .9rem;
  border-top: 1px solid #26212b;
}

.file-input {
  display: none;
}

.upload-zone {
  width: 100%;
  display: flex;
  gap: .8rem;
  align-items: center;
  margin-top: .8rem;
  padding: .85rem;
  border: 1px dashed #554661;
  background: #15111a;
  text-align: left;
}

.upload-zone > span:last-child {
  display: grid;
  gap: .12rem;
  min-width: 0;
}

.upload-zone strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.upload-zone small {
  color: #8f8797;
}

.upload-icon {
  flex: 0 0 auto;
  width: 2.35rem;
  height: 2.35rem;
  display: grid;
  place-items: center;
  border-radius: .65rem;
  background: #261a34;
  color: #c5a5ff;
  font-size: 1.15rem;
}

.upload-confirm {
  width: 100%;
  margin-top: .5rem;
  padding: .65rem .8rem;
  border-color: #654889;
  background: #25192f;
  font-weight: 700;
}

.search-wrap {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: .4rem;
  margin-top: .8rem;
  padding: 0 .65rem;
  border: 1px solid #39313f;
  border-radius: .68rem;
  background: #17141b;
}

.search-wrap input {
  border: 0;
  padding-left: .2rem;
  background: transparent;
  box-shadow: none;
}

.search-wrap > span {
  color: #776e80;
}

.search-wrap button {
  border: 0;
  background: transparent;
  color: #a79eae;
  padding: .35rem;
}

.media-meta,
.subheading-row,
.label-row {
  justify-content: space-between;
}

.media-meta {
  margin-top: .75rem;
  color: #c9c0d0;
  font-size: .75rem;
}

.media-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: .38rem;
  margin-top: .55rem;
  max-height: 188px;
  overflow: auto;
}

.media-option {
  position: relative;
  padding: 0;
  overflow: hidden;
  aspect-ratio: 1;
  border-radius: .52rem;
  background: #08070a;
}

.media-option.active {
  border-color: #a66bff;
  box-shadow: 0 0 0 2px rgba(166,107,255,.2);
}

.media-option img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.selected-mark {
  position: absolute;
  top: .25rem;
  right: .25rem;
  width: 1.2rem;
  height: 1.2rem;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: #fff;
  color: #17121d;
  font-size: .7rem;
  font-weight: 900;
}

.format-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: .45rem;
  margin-top: .8rem;
}

.format-card {
  min-width: 0;
  display: flex;
  gap: .55rem;
  align-items: center;
  padding: .65rem;
  text-align: left;
}

.format-card > span:last-child {
  min-width: 0;
  display: grid;
  gap: .04rem;
}

.format-card.active,
.template-card.active {
  border-color: #9b65e4;
  background: #24182f;
  box-shadow: inset 0 0 0 1px rgba(157,92,255,.14);
}

.format-icon {
  width: 1.15rem;
  height: 1.15rem;
  flex: 0 0 auto;
  border: 1.5px solid #9687a3;
  border-radius: .2rem;
}

.format-icon[data-format='portrait'] {
  width: .9rem;
  height: 1.18rem;
}

.format-icon[data-format='story'] {
  width: .68rem;
  height: 1.2rem;
}

.subheading-row {
  margin: .95rem 0 .5rem;
  color: #cfc6d5;
  font-size: .78rem;
}

.template-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: .5rem;
}

.template-card {
  min-width: 0;
  padding: .35rem;
  text-align: left;
  overflow: hidden;
}

.template-shot {
  position: relative;
  display: block;
  aspect-ratio: 4 / 5;
  overflow: hidden;
  border-radius: .45rem;
  background: linear-gradient(145deg, #2d1d3a, #08070a);
  background-size: cover;
  background-position: center;
}

.template-shot::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(to top, rgba(5,4,7,.9), rgba(5,4,7,.08) 62%);
}

.template-poster {
  box-shadow: inset 0 0 0 2px rgba(255,255,255,.55);
}

.template-poster::before {
  content: '';
  position: absolute;
  inset: 8px;
  border: 1px solid rgba(255,255,255,.55);
  z-index: 1;
}

.template-minimal::after {
  background: linear-gradient(to right, rgba(9,8,11,.96) 0 52%, rgba(9,8,11,.2) 100%);
}

.template-logo,
.template-headline {
  position: absolute;
  left: .45rem;
  z-index: 2;
  color: #fff;
}

.template-logo {
  top: .45rem;
  font-size: .42rem;
  font-weight: 900;
  letter-spacing: .04em;
}

.template-headline {
  bottom: .48rem;
  font-size: .62rem;
  line-height: .92;
  font-weight: 950;
}

.template-copy {
  display: grid;
  gap: .08rem;
  padding: .45rem .2rem .2rem;
}

.template-copy small {
  display: -webkit-box;
  overflow: hidden;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.form-stack label {
  display: grid;
  gap: .35rem;
  margin-top: .75rem;
  color: #bcb2c4;
  font-size: .78rem;
}

.two {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: .6rem;
}

.export-panel {
  padding-top: .8rem;
}

.export-panel p {
  font-size: .78rem;
  line-height: 1.55;
}

.full {
  width: 100%;
  margin-top: .75rem;
}

.download-link {
  width: 100%;
  margin-top: .5rem;
}

.stage-stack {
  min-width: 0;
  display: grid;
  gap: 1rem;
}

.preview-shell {
  min-width: 0;
  overflow: hidden;
}

.preview-toolbar {
  justify-content: space-between;
  gap: 1rem;
  padding: .85rem 1rem;
  border-bottom: 1px solid #29232f;
}

.preview-toolbar > div:first-child {
  display: grid;
  gap: .12rem;
}

.preview-tools {
  min-width: 0;
  gap: .45rem;
  justify-content: flex-end;
  flex-wrap: wrap;
}

.preview-tools select {
  width: auto;
  min-width: 150px;
  padding: .55rem .65rem;
  font-size: .75rem;
}

.toggle-control {
  display: flex;
  align-items: center;
  gap: .4rem;
  cursor: pointer;
}

.toggle-control input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.toggle-track {
  width: 2rem;
  height: 1.05rem;
  padding: .15rem;
  border-radius: 999px;
  background: #39313f;
  transition: background .16s ease;
}

.toggle-track span {
  width: .75rem;
  height: .75rem;
  display: block;
  border-radius: 50%;
  background: #fff;
  transition: transform .16s ease;
}

.toggle-control input:checked + .toggle-track {
  background: #8b5cf6;
}

.toggle-control input:checked + .toggle-track span {
  transform: translateX(.95rem);
}

.icon-button {
  width: 2.3rem;
  height: 2.3rem;
  padding: 0;
  display: grid;
  place-items: center;
  font-size: 1rem;
}

.preview-stage {
  min-height: 610px;
  display: grid;
  place-items: center;
  padding: 1.4rem;
  background:
    radial-gradient(circle at 50% 30%, rgba(80,48,103,.24), transparent 45%),
    linear-gradient(145deg, #0b0a0d, #111014);
}

.canvas-frame {
  display: grid;
  place-items: center;
  width: min(100%, 720px);
  max-height: 74vh;
}

.preview-canvas {
  display: block;
  width: auto;
  max-width: 100%;
  max-height: 70vh;
  border-radius: .4rem;
  box-shadow: 0 28px 76px rgba(0,0,0,.55);
}

.no-source {
  display: grid;
  justify-items: center;
  gap: .4rem;
  color: #c9c0d0;
  text-align: center;
}

.empty-icon {
  width: 3rem;
  height: 3rem;
  display: grid;
  place-items: center;
  border-radius: .8rem;
  background: #1c1721;
  color: #a98ac8;
  font-size: 1.25rem;
}

.preview-note {
  padding: .65rem 1rem;
  border-top: 1px solid #29232f;
  text-align: center;
  font-size: .68rem;
}

.preview-shell:fullscreen {
  display: grid;
  grid-template-rows: auto 1fr auto;
  border-radius: 0;
  background: #09080b;
}

.preview-shell:fullscreen .preview-stage {
  min-height: 0;
}

.preview-shell:fullscreen .preview-canvas {
  max-height: calc(100vh - 150px);
}

.history {
  padding: 1rem;
  overflow: hidden;
}

.history-head {
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
}

.history-head > div {
  min-width: 0;
}

.history-head p {
  font-size: .76rem;
}

.history-strip {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(150px, 185px);
  gap: .7rem;
  margin-top: .9rem;
  overflow-x: auto;
  padding-bottom: .2rem;
  scroll-snap-type: x proximity;
}

.history-card {
  overflow: hidden;
  border: 1px solid #302a36;
  border-radius: .8rem;
  background: #0c0a0e;
  scroll-snap-align: start;
}

.history-image-wrap {
  position: relative;
}

.history-image-wrap img {
  width: 100%;
  aspect-ratio: 4 / 5;
  object-fit: cover;
  display: block;
  background: #050406;
}

.history-image-wrap span {
  position: absolute;
  top: .45rem;
  left: .45rem;
  padding: .18rem .38rem;
  border-radius: 999px;
  background: rgba(8,7,10,.76);
  backdrop-filter: blur(8px);
  color: #e8e1ed;
  font-size: .62rem;
  text-transform: capitalize;
}

.history-card-copy {
  display: grid;
  gap: .12rem;
  padding: .65rem;
}

.history-card-copy > strong {
  text-transform: capitalize;
}

.history-actions {
  gap: .35rem;
  margin-top: .45rem;
}

.history-actions a,
.history-actions button {
  flex: 1;
  min-width: 0;
  padding: .45rem .4rem;
  border: 1px solid #39313f;
  border-radius: .52rem;
  background: #151219;
  color: #d8d0de;
  text-align: center;
  text-decoration: none;
  font-size: .68rem;
}

.empty-history {
  display: grid;
  justify-items: center;
  gap: .25rem;
  margin-top: .9rem;
  padding: 2.3rem 1rem;
  border: 1px dashed #3a323f;
  border-radius: .8rem;
  color: #c8bfd0;
}

.inspector {
  display: grid;
  gap: .8rem;
}

.side-card {
  padding: .9rem;
}

.side-heading {
  gap: .6rem;
  align-items: flex-start;
}

.side-heading > div {
  display: grid;
  gap: .15rem;
}

.side-icon {
  width: 1.85rem;
  height: 1.85rem;
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  border-radius: .55rem;
  background: #20172a;
  color: #b58aff;
}

.brand-current {
  gap: .65rem;
  margin-top: .9rem;
  padding: .65rem;
  border: 1px solid #332b39;
  border-radius: .7rem;
  background: #151219;
}

.brand-current > span:last-child {
  display: grid;
  gap: .06rem;
  min-width: 0;
}

.brand-orb {
  width: 2.2rem;
  height: 2.2rem;
  flex: 0 0 auto;
  border-radius: 50%;
  box-shadow: inset 0 0 18px rgba(255,255,255,.2);
}

.swatches {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: .42rem;
  margin-top: .65rem;
}

.swatches span {
  aspect-ratio: 1.25;
  border: 1px solid rgba(255,255,255,.15);
  border-radius: .5rem;
}

.tip-card {
  border-color: #50336a;
  background: linear-gradient(145deg, rgba(75,40,99,.2), #111014);
}

.tip-card .side-heading small {
  line-height: 1.55;
  color: #ad94bd;
}

.checklist {
  display: grid;
  gap: .55rem;
  margin-top: .8rem;
}

.checklist span {
  display: flex;
  align-items: center;
  gap: .48rem;
  color: #8f8797;
  font-size: .76rem;
}

.checklist i {
  width: 1.15rem;
  height: 1.15rem;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: #242027;
  color: #7c727f;
  font-size: .68rem;
  font-style: normal;
}

.checklist span.complete {
  color: #cfc7d5;
}

.checklist span.complete i {
  background: rgba(69,196,123,.16);
  color: #57d889;
}

@media (max-width: 1180px) {
  .workspace {
    grid-template-columns: minmax(300px, 340px) minmax(0, 1fr);
  }
}

@media (max-width: 980px) {
  .page-header {
    align-items: flex-start;
  }

  .workspace {
    grid-template-columns: 1fr;
  }

  .stage-stack {
    order: 1;
  }

  .controls {
    order: 2;
  }

  .preview-stage {
    min-height: 500px;
  }
}

@media (max-width: 720px) {
  .page-header {
    display: grid;
  }

  .header-actions {
    justify-content: flex-start;
  }

  .preview-toolbar {
    align-items: flex-start;
  }

  .preview-tools {
    flex-wrap: wrap;
  }

  .template-grid {
    grid-template-columns: repeat(3, minmax(100px, 1fr));
    overflow-x: auto;
  }

  .format-grid,
  .two {
    grid-template-columns: 1fr;
  }

  .media-grid {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }

  .preview-stage {
    min-height: 420px;
    padding: .8rem;
  }
}

@media (max-width: 520px) {
  h1 {
    font-size: 2.35rem;
  }

  .header-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    width: 100%;
  }

  .status-pill {
    grid-column: 1 / -1;
    justify-self: start;
  }

  .primary,
  .secondary-button {
    width: 100%;
  }

  .preview-toolbar {
    display: grid;
  }

  .preview-tools {
    justify-content: flex-start;
  }

  .preview-tools select {
    flex: 1;
  }

  .media-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .history-strip {
    grid-auto-columns: minmax(145px, 72vw);
  }
}
</style>
