<script setup lang="ts">
import { apiErrorMessage } from '~/utils/api-error'
import {
  coverImageRect,
  postImageDragDelta,
} from '~~/shared/post-generator'
import {
  VIDEO_BRAND_PRESETS,
  VIDEO_MOTION_PRESETS,
  VIDEO_OUTPUT,
  VIDEO_TEMPLATES,
  defaultVideoGigItems,
  defaultVideoVisibility,
  type VideoBrandPreset,
  type VideoDesign,
  type VideoMotionPreset,
  type VideoTemplateKey,
} from '~~/shared/video-generator'

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

type VideoJob = {
  id: string
  sourceMediaAssetId: string
  templateKey: VideoTemplateKey
  motionPreset: VideoMotionPreset
  brandPreset: VideoBrandPreset
  design: VideoDesign
  width: number
  height: number
  fps: number
  durationSeconds: number
  status: 'queued' | 'rendering' | 'completed' | 'failed'
  progress: number
  error: string | null
  videoUrl: string | null
  sourceTitle: string | null
  sourceFilename: string | null
  createdAt: string
  updatedAt: string
}

const { data: generatorData, refresh: refreshGenerator } = await useFetch<{ assets: MediaAsset[] }>('/api/admin/post-generator')
const { data: queueData, refresh: refreshQueue } = await useFetch<{ jobs: VideoJob[] }>('/api/admin/post-generator/video')

const sourceMediaAssetId = ref(generatorData.value?.assets[0]?.id || '')
const sourceSearch = ref('')
const freshFile = ref<File | null>(null)
const freshInput = ref<HTMLInputElement | null>(null)
const audioFile = ref<File | null>(null)
const audioInput = ref<HTMLInputElement | null>(null)
const previewFrameRef = ref<HTMLElement | null>(null)
const previewShellRef = ref<HTMLElement | null>(null)
const openSections = ref<number[]>([1, 2, 3])
const busy = ref('')
const message = ref('')
const dragState = reactive({
  active: false,
  pointerId: -1,
  startX: 0,
  startY: 0,
  startImageX: 0,
  startImageY: 0,
})
let pollTimer: ReturnType<typeof setInterval> | null = null

const design = reactive<VideoDesign>({
  templateKey: 'spotlight',
  motionPreset: 'smooth',
  brandPreset: 'night',
  headline: 'JOUW AVOND. JOUW SOUND.',
  subline: 'DJ NightLight · allround DJ',
  dateText: '',
  timeText: '',
  locationText: '',
  ctaText: '',
  logoText: 'NIGHTLIGHT',
  visibility: defaultVideoVisibility(),
  gigItems: defaultVideoGigItems(),
  imageX: 0,
  imageY: 0,
  zoom: 1,
  overlayOpacity: .72,
  textAlign: 'left',
  textPosition: 'bottom',
})

const templates: Array<{
  key: VideoTemplateKey
  label: string
  description: string
  category: string
}> = [
  { key: 'spotlight', label: 'Spotlight', description: 'Clean cinematic reveal with flexible copy.', category: 'Flexible' },
  { key: 'pulse', label: 'Pulse', description: 'Framed copy with a subtle rhythmic pulse.', category: 'Flexible' },
  { key: 'slide', label: 'Slide', description: 'Editorial copy that slides into the frame.', category: 'Flexible' },
  { key: 'gig-announcement', label: 'Gig announcement', description: 'Event promo with date, time, location and CTA.', category: 'Gig' },
  { key: 'recap', label: 'Recap', description: 'High-energy aftermovie-style recap.', category: 'Recap' },
  { key: 'upcoming-gigs', label: 'Upcoming gigs', description: 'Animated planning with editable gig rows.', category: 'Planning' },
]

const motions: Array<{
  key: VideoMotionPreset
  label: string
  description: string
}> = [
  { key: 'smooth', label: 'Smooth', description: 'Slow cinematic drift and zoom.' },
  { key: 'energy', label: 'Energy', description: 'Faster movement for club content.' },
  { key: 'minimal', label: 'Minimal', description: 'Very subtle movement and calmer pacing.' },
]

const brands = [
  { key: 'night' as const, label: 'NightLight', description: 'Purple nightlife accent.' },
  { key: 'mono' as const, label: 'Mono', description: 'Black & white.' },
  { key: 'warm' as const, label: 'Warm', description: 'Warm orange accent.' },
]

const templateLabels = Object.fromEntries(templates.map(item => [item.key, item.label])) as Record<VideoTemplateKey, string>
const motionLabels = Object.fromEntries(motions.map(item => [item.key, item.label])) as Record<VideoMotionPreset, string>

const selectedAsset = computed(() => generatorData.value?.assets.find(asset => asset.id === sourceMediaAssetId.value) || null)
const filteredAssets = computed(() => {
  const query = sourceSearch.value.trim().toLowerCase()
  const assets = generatorData.value?.assets || []
  if (!query) return assets
  return assets.filter(asset => [
    asset.title,
    asset.altText,
    asset.originalFilename,
  ].some(value => value.toLowerCase().includes(query)))
})
const activeJobs = computed(() => queueData.value?.jobs.some(job => job.status === 'queued' || job.status === 'rendering') ?? false)
const readyToGenerate = computed(() => Boolean(
  selectedAsset.value
  && (!design.visibility.headline || design.headline.trim()),
))
const visibleGigItems = computed(() => design.gigItems.filter(item => item.enabled).slice(0, 6))
const isCampaignTemplate = computed(() => ['gig-announcement', 'recap', 'upcoming-gigs'].includes(design.templateKey))
const previewImageStyle = computed(() => ({
  objectPosition: `${50 + design.imageX * 50}% ${50 + design.imageY * 50}%`,
  transform: `scale(${design.zoom})`,
}))
const previewOverlayStyle = computed(() => ({
  opacity: Math.max(.3, design.overlayOpacity),
}))

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
    form.append('tags', 'video-generator')
    form.append('gigId', '')
    form.append('venueId', '')
    const result = await $fetch<{ asset: { id: string } }>('/api/admin/media', { method: 'POST', body: form })
    await refreshGenerator()
    sourceMediaAssetId.value = result.asset.id
    freshFile.value = null
    if (freshInput.value) freshInput.value.value = ''
    message.value = 'Photo uploaded to the media library and selected.'
  } catch (error: unknown) {
    message.value = apiErrorMessage(error, 'Upload failed.')
  } finally {
    busy.value = ''
  }
}

function setAllVisibility(value: boolean) {
  for (const key of Object.keys(design.visibility) as Array<keyof typeof design.visibility>) {
    design.visibility[key] = value
  }
}

function applyTemplate(templateKey: VideoTemplateKey) {
  design.templateKey = templateKey

  if (templateKey === 'gig-announcement') {
    design.headline = 'DIT WEEKEND'
    design.subline = 'DJ NIGHTLIGHT'
    design.dateText = '12 DEC'
    design.timeText = '22:00 – 02:00'
    design.locationText = 'Groningen'
    design.ctaText = 'TOT DAN!'
    setAllVisibility(true)
    design.visibility.gigList = false
    design.textAlign = 'center'
    design.textPosition = 'middle'
    return
  }

  if (templateKey === 'recap') {
    design.headline = 'WAT EEN AVOND'
    design.subline = 'TERUGBLIK'
    design.dateText = '05 AUG'
    design.timeText = ''
    design.locationText = 'Sneekweek · Sneek'
    design.ctaText = 'TOT DE VOLGENDE!'
    setAllVisibility(true)
    design.visibility.time = false
    design.visibility.gigList = false
    design.textAlign = 'center'
    design.textPosition = 'middle'
    return
  }

  if (templateKey === 'upcoming-gigs') {
    design.headline = 'DECEMBER'
    design.subline = 'PLANNING'
    design.dateText = ''
    design.timeText = ''
    design.locationText = ''
    design.ctaText = 'TOT OP DE DANSVLOER!'
    design.gigItems = defaultVideoGigItems()
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
  design.gigItems.push({ enabled: true, dateText: '', title: '', locationText: '' })
}

function removeGigItem(index: number) {
  if (design.gigItems.length <= 1) return
  design.gigItems.splice(index, 1)
}

function chooseAudio(event: Event) {
  audioFile.value = (event.target as HTMLInputElement).files?.[0] || null
}

function clampCropPosition(value: number) {
  return Math.max(-1, Math.min(1, value))
}

function startPreviewDrag(event: PointerEvent) {
  if (!previewFrameRef.value || !selectedAsset.value) return
  if (event.pointerType === 'mouse' && event.button !== 0) return

  event.preventDefault()
  dragState.active = true
  dragState.pointerId = event.pointerId
  dragState.startX = event.clientX
  dragState.startY = event.clientY
  dragState.startImageX = design.imageX
  dragState.startImageY = design.imageY
  previewFrameRef.value.setPointerCapture(event.pointerId)
}

function movePreviewDrag(event: PointerEvent) {
  if (!dragState.active || event.pointerId !== dragState.pointerId || !previewFrameRef.value || !selectedAsset.value) return

  event.preventDefault()
  const bounds = previewFrameRef.value.getBoundingClientRect()
  if (!bounds.width || !bounds.height) return

  const rendered = coverImageRect({
    sourceWidth: selectedAsset.value.width,
    sourceHeight: selectedAsset.value.height,
    targetWidth: VIDEO_OUTPUT.width,
    targetHeight: VIDEO_OUTPUT.height,
    zoom: design.zoom,
    imageX: 0,
    imageY: 0,
  })
  const delta = postImageDragDelta({
    deltaX: event.clientX - dragState.startX,
    deltaY: event.clientY - dragState.startY,
    displayWidth: bounds.width,
    displayHeight: bounds.height,
    targetWidth: VIDEO_OUTPUT.width,
    targetHeight: VIDEO_OUTPUT.height,
    renderedWidth: rendered.width,
    renderedHeight: rendered.height,
  })

  design.imageX = clampCropPosition(dragState.startImageX + delta.x)
  design.imageY = clampCropPosition(dragState.startImageY + delta.y)
}

function endPreviewDrag(event: PointerEvent) {
  if (event.pointerId !== dragState.pointerId) return
  if (previewFrameRef.value?.hasPointerCapture(event.pointerId)) {
    previewFrameRef.value.releasePointerCapture(event.pointerId)
  }
  dragState.active = false
  dragState.pointerId = -1
}

async function toggleFullscreen() {
  if (!previewShellRef.value || !import.meta.client) return
  if (document.fullscreenElement) {
    await document.exitFullscreen()
    return
  }
  await previewShellRef.value.requestFullscreen()
}

async function enqueue() {
  if (!sourceMediaAssetId.value) {
    message.value = 'Select a source photo first.'
    return
  }
  if (!readyToGenerate.value) {
    message.value = 'Add a headline or hide the headline field before rendering.'
    return
  }

  busy.value = 'render'
  message.value = ''
  try {
    const form = new FormData()
    form.append('sourceMediaAssetId', sourceMediaAssetId.value)
    form.append('design', JSON.stringify(design))
    if (audioFile.value) form.append('audio', audioFile.value, audioFile.value.name)
    await $fetch('/api/admin/post-generator/video', { method: 'POST', body: form })
    audioFile.value = null
    if (audioInput.value) audioInput.value.value = ''
    message.value = 'Video queued. The render worker will process it automatically.'
    await refreshQueue()
  } catch (error: unknown) {
    message.value = apiErrorMessage(error, 'Could not queue video render.')
  } finally {
    busy.value = ''
  }
}

async function retry(job: VideoJob) {
  try {
    await $fetch(`/api/admin/post-generator/video/${job.id}/retry`, { method: 'POST' })
    await refreshQueue()
  } catch (error: unknown) {
    message.value = apiErrorMessage(error, 'Could not retry render.')
  }
}

async function remove(job: VideoJob) {
  if (!confirm('Delete this video render and its stored files?')) return
  try {
    await $fetch(`/api/admin/post-generator/video/${job.id}`, { method: 'DELETE' })
    await refreshQueue()
  } catch (error: unknown) {
    message.value = apiErrorMessage(error, 'Could not delete render.')
  }
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('nl-NL', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function startPolling() {
  if (pollTimer) return
  pollTimer = setInterval(() => {
    if (activeJobs.value) void refreshQueue()
  }, 2000)
}

onMounted(() => {
  if (!sourceMediaAssetId.value && generatorData.value?.assets[0]) {
    sourceMediaAssetId.value = generatorData.value.assets[0].id
  }
  startPolling()
})

onBeforeUnmount(() => {
  if (pollTimer) clearInterval(pollTimer)
})

useSeoMeta({ title: 'Video generator — DJ NightLight', robots: 'noindex, nofollow' })
</script>

<template>
  <div class="page">
    <header class="page-header">
      <div class="header-copy">
        <p class="breadcrumb">Content <span>/</span> Video generator</p>
        <h1>Instagram video generator</h1>
        <p class="subtitle">Create branded 9:16 Reels and Stories with the same workflow as the image editor.</p>
      </div>

      <div class="header-actions">
        <span class="status-pill"><span class="status-dot" /> Live preview</span>
        <NuxtLink class="secondary-button" to="/admin/post-generator">Image generator</NuxtLink>
        <button class="primary" type="button" :disabled="busy === 'render' || !readyToGenerate" @click="enqueue">
          {{ busy === 'render' ? 'Queueing…' : 'Generate video →' }}
        </button>
      </div>
    </header>

    <p v-if="message" class="page-message">{{ message }}</p>

    <div class="workspace">
      <aside class="controls">
        <section class="workflow-card">
          <button class="section-heading" type="button" :aria-expanded="isSectionOpen(1)" @click="toggleSection(1)">
            <span class="step-number">1</span>
            <span class="section-title">
              <strong>Source photo</strong>
              <small>Choose or upload a photo</small>
            </span>
            <span class="chevron">{{ isSectionOpen(1) ? '⌃' : '⌄' }}</span>
          </button>

          <div v-if="isSectionOpen(1)" class="section-body">
            <input ref="freshInput" class="file-input" type="file" accept="image/jpeg,image/png,image/webp" @change="chooseFreshFile">

            <button class="upload-zone" type="button" @click="openFilePicker" @dragover.prevent @drop="dropFreshFile">
              <span class="upload-icon">↑</span>
              <span>
                <strong>{{ freshFile ? freshFile.name : 'Upload new' }}</strong>
                <small>{{ freshFile ? 'Ready to add to the media library' : 'Choose file or drag & drop' }}</small>
              </span>
            </button>

            <button v-if="freshFile" class="upload-confirm" type="button" :disabled="busy === 'upload'" @click="uploadFreshSource">
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
                :class="{ active: sourceMediaAssetId === asset.id }"
                :title="asset.title || asset.originalFilename"
                @click="sourceMediaAssetId = asset.id"
              >
                <img :src="asset.thumbnailUrl" :alt="asset.altText || asset.title">
                <span v-if="sourceMediaAssetId === asset.id" class="selected-mark">✓</span>
              </button>
            </div>
          </div>
        </section>

        <section class="workflow-card">
          <button class="section-heading" type="button" :aria-expanded="isSectionOpen(2)" @click="toggleSection(2)">
            <span class="step-number">2</span>
            <span class="section-title">
              <strong>Template</strong>
              <small>Choose the visual story</small>
            </span>
            <span class="chevron">{{ isSectionOpen(2) ? '⌃' : '⌄' }}</span>
          </button>

          <div v-if="isSectionOpen(2)" class="section-body">
            <div class="format-card active-format">
              <span class="format-icon" />
              <span>
                <strong>Reel / Story</strong>
                <small>Vertical video</small>
                <em>{{ VIDEO_OUTPUT.width }}×{{ VIDEO_OUTPUT.height }}</em>
              </span>
            </div>

            <div class="subheading-row">
              <strong>Templates</strong>
              <small>Editable starting points</small>
            </div>

            <div class="template-grid">
              <button
                v-for="template in templates"
                :key="template.key"
                type="button"
                class="template-card"
                :class="{ active: design.templateKey === template.key }"
                @click="applyTemplate(template.key)"
              >
                <span
                  class="template-shot"
                  :class="'template-' + template.key"
                  :style="selectedAsset ? { backgroundImage: 'url(' + selectedAsset.thumbnailUrl + ')' } : undefined"
                >
                  <span class="template-category">{{ template.category }}</span>
                  <span class="template-logo">NIGHTLIGHT</span>
                  <template v-if="template.key === 'gig-announcement'">
                    <span class="template-display">DIT<br>WEEKEND</span>
                    <span class="template-pill">DJ NIGHTLIGHT</span>
                  </template>
                  <template v-else-if="template.key === 'recap'">
                    <span class="template-display">WAT EEN<br>AVOND</span>
                    <span class="template-pill">TERUGBLIK</span>
                  </template>
                  <template v-else-if="template.key === 'upcoming-gigs'">
                    <span class="template-display template-planning">DECEMBER</span>
                    <span class="template-pill">PLANNING</span>
                    <span class="template-lines"><i /><i /><i /></span>
                  </template>
                  <span v-else class="template-headline">JOUW AVOND.<br>JOUW SOUND.</span>
                </span>
                <span class="template-copy">
                  <span class="template-copy-head"><strong>{{ template.label }}</strong><em>{{ template.category }}</em></span>
                  <small>{{ template.description }}</small>
                </span>
              </button>
            </div>
          </div>
        </section>

        <section class="workflow-card">
          <button class="section-heading" type="button" :aria-expanded="isSectionOpen(3)" @click="toggleSection(3)">
            <span class="step-number">3</span>
            <span class="section-title">
              <strong>Copy</strong>
              <small>Edit and show/hide fields</small>
            </span>
            <span class="chevron">{{ isSectionOpen(3) ? '⌃' : '⌄' }}</span>
          </button>

          <div v-if="isSectionOpen(3)" class="section-body form-stack">
            <div class="field">
              <div class="label-row">
                <span>Headline</span>
                <span class="field-actions">
                  <small>{{ design.headline.length }}/180</small>
                  <label class="field-toggle"><input v-model="design.visibility.headline" type="checkbox"><span>{{ design.visibility.headline ? 'Shown' : 'Hidden' }}</span></label>
                </span>
              </div>
              <textarea v-model="design.headline" rows="2" maxlength="180" :disabled="!design.visibility.headline" />
            </div>

            <div class="field">
              <div class="label-row">
                <span>Subline</span>
                <span class="field-actions">
                  <small>{{ design.subline.length }}/260</small>
                  <label class="field-toggle"><input v-model="design.visibility.subline" type="checkbox"><span>{{ design.visibility.subline ? 'Shown' : 'Hidden' }}</span></label>
                </span>
              </div>
              <textarea v-model="design.subline" rows="2" maxlength="260" :disabled="!design.visibility.subline" />
            </div>

            <div class="two">
              <div class="field">
                <div class="label-row"><span>Date</span><label class="field-toggle"><input v-model="design.visibility.date" type="checkbox"><span>{{ design.visibility.date ? 'Shown' : 'Hidden' }}</span></label></div>
                <input v-model="design.dateText" maxlength="160" placeholder="12 DEC" :disabled="!design.visibility.date">
              </div>
              <div class="field">
                <div class="label-row"><span>Time</span><label class="field-toggle"><input v-model="design.visibility.time" type="checkbox"><span>{{ design.visibility.time ? 'Shown' : 'Hidden' }}</span></label></div>
                <input v-model="design.timeText" maxlength="80" placeholder="22:00 – 02:00" :disabled="!design.visibility.time">
              </div>
            </div>

            <div class="field">
              <div class="label-row"><span>Location</span><label class="field-toggle"><input v-model="design.visibility.location" type="checkbox"><span>{{ design.visibility.location ? 'Shown' : 'Hidden' }}</span></label></div>
              <input v-model="design.locationText" maxlength="160" placeholder="Groningen" :disabled="!design.visibility.location">
            </div>

            <div class="field">
              <div class="label-row"><span>Call to action</span><label class="field-toggle"><input v-model="design.visibility.cta" type="checkbox"><span>{{ design.visibility.cta ? 'Shown' : 'Hidden' }}</span></label></div>
              <input v-model="design.ctaText" maxlength="180" placeholder="TOT DAN!" :disabled="!design.visibility.cta">
            </div>

            <div v-if="design.templateKey === 'upcoming-gigs'" class="gig-list-editor">
              <div class="gig-list-head">
                <div><strong>Upcoming gigs</strong><small>Edit up to six rows.</small></div>
                <label class="field-toggle"><input v-model="design.visibility.gigList" type="checkbox"><span>{{ design.visibility.gigList ? 'Shown' : 'Hidden' }}</span></label>
              </div>
              <div class="gig-list-rows" :class="{ disabled: !design.visibility.gigList }">
                <article v-for="(item, index) in design.gigItems" :key="index" class="gig-row">
                  <div class="gig-row-head">
                    <label class="row-toggle"><input v-model="item.enabled" type="checkbox" :disabled="!design.visibility.gigList"><span>Gig {{ index + 1 }}</span></label>
                    <button type="button" :disabled="design.gigItems.length <= 1" @click="removeGigItem(index)">Remove</button>
                  </div>
                  <div class="gig-row-fields">
                    <input v-model="item.dateText" maxlength="40" placeholder="06 DEC" :disabled="!design.visibility.gigList || !item.enabled">
                    <input v-model="item.title" maxlength="120" placeholder="Event" :disabled="!design.visibility.gigList || !item.enabled">
                    <input v-model="item.locationText" maxlength="120" placeholder="Location" :disabled="!design.visibility.gigList || !item.enabled">
                  </div>
                </article>
              </div>
              <button class="add-gig" type="button" :disabled="design.gigItems.length >= 6" @click="addGigItem">+ Add gig</button>
            </div>

            <div class="field">
              <div class="label-row"><span>Brand label</span><label class="field-toggle"><input v-model="design.visibility.logo" type="checkbox"><span>{{ design.visibility.logo ? 'Shown' : 'Hidden' }}</span></label></div>
              <input v-model="design.logoText" maxlength="80" :disabled="!design.visibility.logo">
            </div>

            <div class="field">
              <span>Brand preset</span>
              <select v-model="design.brandPreset">
                <option v-for="brand in brands" :key="brand.key" :value="brand.key">{{ brand.label }} — {{ brand.description }}</option>
              </select>
            </div>
          </div>
        </section>

        <section class="workflow-card">
          <button class="section-heading" type="button" :aria-expanded="isSectionOpen(4)" @click="toggleSection(4)">
            <span class="step-number">4</span>
            <span class="section-title">
              <strong>Motion & framing</strong>
              <small>Movement, crop and layout</small>
            </span>
            <span class="chevron">{{ isSectionOpen(4) ? '⌃' : '⌄' }}</span>
          </button>

          <div v-if="isSectionOpen(4)" class="section-body form-stack">
            <div class="motion-grid">
              <button v-for="motion in motions" :key="motion.key" type="button" :class="{ active: design.motionPreset === motion.key }" @click="design.motionPreset = motion.key">
                <span class="motion-icon" :data-motion="motion.key"><i /></span>
                <strong>{{ motion.label }}</strong>
                <small>{{ motion.description }}</small>
              </button>
            </div>

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
                <select v-model="design.textAlign"><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select>
              </label>
              <label>
                <span>Text position</span>
                <select v-model="design.textPosition"><option value="top">Top</option><option value="middle">Middle</option><option value="bottom">Bottom</option></select>
              </label>
            </div>
          </div>
        </section>

        <section class="workflow-card">
          <button class="section-heading" type="button" :aria-expanded="isSectionOpen(5)" @click="toggleSection(5)">
            <span class="step-number">5</span>
            <span class="section-title">
              <strong>Audio & render</strong>
              <small>Add optional audio and generate</small>
            </span>
            <span class="chevron">{{ isSectionOpen(5) ? '⌃' : '⌄' }}</span>
          </button>

          <div v-if="isSectionOpen(5)" class="section-body export-panel">
            <label class="audio-upload">
              <span>Optional audio</span>
              <input ref="audioInput" type="file" accept="audio/mpeg,audio/mp4,audio/wav,audio/ogg" @change="chooseAudio">
              <small>MP3, M4A, WAV or OGG · max 12 MB</small>
            </label>
            <p v-if="audioFile" class="selected-file">{{ audioFile.name }}</p>
            <p>{{ VIDEO_OUTPUT.width }}×{{ VIDEO_OUTPUT.height }} · {{ VIDEO_OUTPUT.fps }} fps · {{ VIDEO_OUTPUT.durationSeconds }} sec</p>
            <button class="primary full" type="button" :disabled="busy === 'render' || !readyToGenerate" @click="enqueue">
              {{ busy === 'render' ? 'Queueing…' : 'Generate 9:16 video' }}
            </button>
          </div>
        </section>
      </aside>

      <main class="stage-stack">
        <section ref="previewShellRef" class="preview-shell">
          <div class="preview-toolbar">
            <div><strong>Preview</strong><small>Approximate live preview of the rendered Reel.</small></div>
            <div class="preview-tools">
              <span class="output-badge">9:16 · 10 sec</span>
              <button class="icon-button" type="button" title="Fullscreen preview" @click="toggleFullscreen">⤢</button>
            </div>
          </div>

          <div class="preview-stage">
            <div
              v-if="selectedAsset"
              ref="previewFrameRef"
              class="phone-preview"
              :class="{ dragging: dragState.active }"
              :data-template="design.templateKey"
              :data-motion="design.motionPreset"
              :data-brand="design.brandPreset"
              @pointerdown="startPreviewDrag"
              @pointermove="movePreviewDrag"
              @pointerup="endPreviewDrag"
              @pointercancel="endPreviewDrag"
              @lostpointercapture="endPreviewDrag"
            >
              <div class="preview-media">
                <img :src="selectedAsset.url" :alt="selectedAsset.altText || selectedAsset.title" :style="previewImageStyle">
              </div>
              <div class="wash" :style="previewOverlayStyle" />
              <div v-if="isCampaignTemplate" class="campaign-texture"><i /><i /></div>

              <strong v-if="design.visibility.logo && design.logoText" class="preview-logo">{{ design.logoText }}</strong>

              <div
                v-if="!isCampaignTemplate"
                class="regular-copy"
                :data-align="design.textAlign"
                :data-position="design.textPosition"
              >
                <div class="regular-copy-inner">
                  <h2 v-if="design.visibility.headline && design.headline">{{ design.headline }}</h2>
                  <p v-if="design.visibility.subline && design.subline">{{ design.subline }}</p>
                  <div class="chips">
                    <span v-if="design.visibility.date && design.dateText">{{ design.dateText }}</span>
                    <span v-if="design.visibility.time && design.timeText">{{ design.timeText }}</span>
                    <span v-if="design.visibility.location && design.locationText">{{ design.locationText }}</span>
                  </div>
                  <b v-if="design.visibility.cta && design.ctaText" class="preview-cta">{{ design.ctaText }}</b>
                </div>
              </div>

              <div v-else-if="design.templateKey === 'gig-announcement'" class="campaign-preview gig-preview">
                <h2 v-if="design.visibility.headline">{{ design.headline }}</h2>
                <i class="brush" />
                <b v-if="design.visibility.subline" class="campaign-pill">{{ design.subline }}</b>
                <div class="campaign-meta">
                  <span v-if="design.visibility.date && design.dateText">{{ design.dateText }}</span>
                  <span v-if="design.visibility.time && design.timeText">{{ design.timeText }}</span>
                  <span v-if="design.visibility.location && design.locationText">{{ design.locationText }}</span>
                </div>
                <strong v-if="design.visibility.cta && design.ctaText" class="campaign-cta">{{ design.ctaText }}</strong>
              </div>

              <div v-else-if="design.templateKey === 'recap'" class="campaign-preview recap-preview">
                <b v-if="design.visibility.subline" class="campaign-pill">{{ design.subline }}</b>
                <h2 v-if="design.visibility.headline">{{ design.headline }}</h2>
                <div class="campaign-meta">
                  <span v-if="design.visibility.date && design.dateText">{{ design.dateText }}</span>
                  <span v-if="design.visibility.location && design.locationText">{{ design.locationText }}</span>
                </div>
                <strong v-if="design.visibility.cta && design.ctaText" class="campaign-cta">{{ design.ctaText }}</strong>
              </div>

              <div v-else class="campaign-preview planning-preview">
                <h2 v-if="design.visibility.headline">{{ design.headline }}</h2>
                <b v-if="design.visibility.subline" class="campaign-pill">{{ design.subline }}</b>
                <div v-if="design.visibility.gigList" class="planning-list">
                  <div v-for="(item, index) in visibleGigItems" :key="index">
                    <strong>{{ item.dateText }}</strong>
                    <span><b>{{ item.title }}</b><small>{{ item.locationText }}</small></span>
                  </div>
                </div>
                <strong v-if="design.visibility.cta && design.ctaText" class="campaign-cta">{{ design.ctaText }}</strong>
              </div>

              <span class="drag-hint" :class="{ active: dragState.active }">
                <span aria-hidden="true">✥</span>
                {{ dragState.active ? 'Repositioning photo' : 'Drag photo to reposition' }}
              </span>
            </div>

            <div v-else class="no-source">
              <span>▧</span>
              <strong>Choose a source photo</strong>
              <small>Select a media-library image or upload a fresh photo.</small>
            </div>
          </div>

          <p class="preview-note">Motion is simulated in the editor; the final MP4 is rendered by Remotion.</p>
        </section>

        <section class="history">
          <div class="history-head">
            <div><p class="eyebrow">Render queue</p><h2>Generated videos</h2><p>Queued, rendering and completed outputs stay visible here.</p></div>
            <button class="secondary-button" type="button" @click="refreshQueue()">Refresh</button>
          </div>

          <div v-if="queueData?.jobs.length" class="job-list">
            <article v-for="job in queueData.jobs" :key="job.id" class="job">
              <div class="job-main">
                <div class="thumb">
                  <video v-if="job.videoUrl" :src="job.videoUrl" muted playsinline preload="metadata" />
                  <img v-else-if="generatorData?.assets.find(asset => asset.id === job.sourceMediaAssetId)" :src="generatorData.assets.find(asset => asset.id === job.sourceMediaAssetId)?.thumbnailUrl" alt="">
                </div>
                <div class="job-copy">
                  <div class="job-title"><strong>{{ job.sourceTitle || job.sourceFilename || 'Video render' }}</strong><span :data-status="job.status">{{ job.status }}</span></div>
                  <p>{{ templateLabels[job.templateKey] || job.templateKey }} · {{ motionLabels[job.motionPreset] || job.motionPreset }} · {{ formatDate(job.createdAt) }}</p>
                  <p v-if="job.error" class="error">{{ job.error }}</p>
                </div>
              </div>

              <div v-if="job.status === 'queued' || job.status === 'rendering'" class="progress">
                <div :style="{ width: job.progress + '%' }" />
                <span>{{ job.progress }}%</span>
              </div>

              <div class="job-actions">
                <a v-if="job.videoUrl" class="primary small" :href="job.videoUrl" target="_blank" rel="noreferrer">Open MP4</a>
                <button v-if="job.status === 'failed'" class="secondary-button" type="button" @click="retry(job)">Retry</button>
                <button v-if="job.status !== 'rendering'" class="secondary-button danger" type="button" @click="remove(job)">Delete</button>
              </div>
            </article>
          </div>

          <div v-else class="empty-history"><strong>No video renders yet</strong><small>Your queued and completed videos will appear here.</small></div>
        </section>
      </main>
    </div>
  </div>
</template>

<style scoped>
.page{width:100%;max-width:1480px;min-width:0;margin:0 auto;padding-bottom:2rem;overflow-x:hidden}
.page-header,.header-actions,.preview-toolbar,.preview-tools,.history-head,.job-actions,.media-meta,.subheading-row,.label-row,.field-actions,.gig-list-head,.gig-row-head{display:flex;align-items:center}
.page-header{justify-content:space-between;gap:1.5rem;margin-bottom:1.25rem}
.header-copy{min-width:0}.breadcrumb,.eyebrow{margin:0;color:#77717d;font-size:.7rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase}.breadcrumb span{margin:0 .35rem;color:#4f4955}
.page-header h1{margin:.28rem 0 .38rem;font-size:clamp(2.35rem,4vw,4.1rem);line-height:.94;letter-spacing:-.055em}.subtitle{max-width:48rem;margin:0;color:#918a98;font-size:.92rem;line-height:1.55}
.header-actions{flex-wrap:wrap;justify-content:flex-end;gap:.6rem}.status-pill,.output-badge{display:inline-flex;align-items:center;gap:.42rem;padding:.52rem .68rem;border:1px solid #2d2832;border-radius:999px;background:#0e0c11;color:#9c95a2;font-size:.7rem;font-weight:700}.status-dot{width:.42rem;height:.42rem;border-radius:50%;background:#7dd7a1;box-shadow:0 0 12px rgba(125,215,161,.55)}
.primary,.secondary-button,.icon-button,.upload-confirm,.add-gig{border:0;cursor:pointer;font:inherit}.primary{display:inline-flex;align-items:center;justify-content:center;border-radius:.68rem;padding:.74rem 1rem;background:#fff;color:#09080b;font-weight:850;text-decoration:none}.primary:disabled{cursor:not-allowed;opacity:.45}.primary.small{padding:.58rem .72rem;font-size:.76rem}.secondary-button{display:inline-flex;align-items:center;justify-content:center;border:1px solid #332e39;border-radius:.68rem;padding:.68rem .82rem;background:#151219;color:#bdb6c6;text-decoration:none}.secondary-button:hover{border-color:#4a4053;color:#fff}.danger{color:#e7a2ad}
.page-message{margin:0 0 1rem;padding:.72rem .85rem;border:1px solid #342d3b;border-radius:.72rem;background:#121016;color:#bdb6c6;font-size:.8rem}
.workspace{display:grid;grid-template-columns:minmax(320px,460px) minmax(0,1fr);gap:1rem;align-items:start;min-width:0}.controls,.stage-stack{display:grid;gap:.8rem;min-width:0}
.workflow-card,.preview-shell,.history{min-width:0;border:1px solid #29242f;border-radius:.9rem;background:#0f0d12;box-shadow:0 16px 44px rgba(0,0,0,.12)}
.section-heading{width:100%;display:grid;grid-template-columns:2rem minmax(0,1fr) auto;gap:.72rem;align-items:center;padding:1rem;border:0;background:transparent;color:#fff;text-align:left;cursor:pointer}.step-number{display:grid;place-items:center;width:2rem;height:2rem;border:1px solid #39323f;border-radius:.62rem;background:#17131b;color:#b98cff;font-size:.75rem;font-weight:900}.section-title{display:grid;gap:.14rem;min-width:0}.section-title strong{font-size:.9rem}.section-title small{color:#746d7b;font-size:.7rem}.chevron{color:#665f6c}
.section-body{padding:0 1rem 1rem;border-top:1px solid #201c25}.file-input{display:none}.upload-zone{width:100%;display:flex;align-items:center;gap:.75rem;margin-top:.9rem;padding:.82rem;border:1px dashed #3a3342;border-radius:.72rem;background:#0b0a0d;color:#aaa4b1;text-align:left;cursor:pointer}.upload-zone:hover{border-color:#6c4a88}.upload-zone>span:last-child{display:grid;gap:.1rem;min-width:0}.upload-zone strong{overflow:hidden;color:#d8d2dd;font-size:.8rem;text-overflow:ellipsis;white-space:nowrap}.upload-zone small{color:#716a78;font-size:.68rem}.upload-icon{display:grid;place-items:center;flex:0 0 2.1rem;width:2.1rem;height:2.1rem;border-radius:.58rem;background:#19141f;color:#b785eb;font-size:1.1rem}.upload-confirm{width:100%;margin-top:.45rem;padding:.62rem;border-radius:.62rem;background:#24192d;color:#e6d6f5;font-weight:800}
.search-wrap{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:.45rem;margin-top:.8rem;padding:0 .72rem;border:1px solid #302a36;border-radius:.68rem;background:#0a090c;color:#6f6875}.search-wrap input{min-width:0;border:0;padding:.68rem 0;background:transparent}.search-wrap button{border:0;background:transparent;color:#807887;cursor:pointer}.media-meta,.subheading-row{justify-content:space-between;gap:1rem;margin:.85rem 0 .48rem;color:#b0a9b7;font-size:.72rem}.media-meta small,.subheading-row small{color:#6e6775}
.media-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:.42rem;max-height:260px;overflow:auto}.media-option{position:relative;overflow:hidden;aspect-ratio:1;border:1px solid #25212a;border-radius:.58rem;padding:0;background:#09080b;cursor:pointer}.media-option img{display:block;width:100%;height:100%;object-fit:cover}.media-option.active{border-color:#ad73e2;box-shadow:0 0 0 1px #ad73e2}.selected-mark{position:absolute;right:.35rem;top:.35rem;display:grid;place-items:center;width:1.25rem;height:1.25rem;border-radius:50%;background:#fff;color:#160d1d;font-size:.68rem;font-weight:900}
.format-card{display:flex;align-items:center;gap:.72rem;margin-top:.9rem;padding:.76rem;border:1px solid #332c3a;border-radius:.7rem;background:#121017}.format-icon{width:1.9rem;height:3rem;border:2px solid #8b619e;border-radius:.3rem;box-shadow:inset 0 0 0 1px #2c2132}.format-card>span:last-child{display:grid;grid-template-columns:1fr auto;gap:.1rem .7rem;flex:1}.format-card strong{grid-column:1;color:#e7e1ec;font-size:.8rem}.format-card small{grid-column:1;color:#746d7b;font-size:.68rem}.format-card em{grid-column:2;grid-row:1/3;align-self:center;color:#8d8493;font-size:.66rem;font-style:normal}.active-format{border-color:#5b406c;background:#16111c}
.template-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.6rem}.template-card{overflow:hidden;border:1px solid #2d2733;border-radius:.75rem;padding:0;background:#0b090e;color:#fff;text-align:left;cursor:pointer}.template-card.active{border-color:#a366d5;box-shadow:0 0 0 1px #a366d5}.template-shot{position:relative;display:block;overflow:hidden;aspect-ratio:9/12;background:#16111c center/cover}.template-shot::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(20,8,28,.28),rgba(7,4,10,.88))}.template-category,.template-logo,.template-headline,.template-display,.template-pill,.template-lines{position:absolute;z-index:1}.template-category{top:.45rem;right:.45rem;padding:.2rem .3rem;border-radius:.25rem;background:rgba(0,0,0,.55);font-size:.43rem;text-transform:uppercase}.template-logo{top:.5rem;left:.5rem;color:#d9b6ff;font-size:.4rem;font-weight:900;letter-spacing:.12em}.template-headline{left:.55rem;right:.4rem;bottom:.65rem;font-size:.88rem;font-weight:950;line-height:.88;letter-spacing:-.05em}.template-display{left:.5rem;right:.5rem;top:31%;text-align:center;font-size:1.05rem;font-style:italic;font-weight:950;line-height:.82;letter-spacing:-.07em;text-shadow:0 0 14px #9e58ff}.template-planning{top:24%;font-size:.86rem}.template-pill{left:50%;top:57%;transform:translateX(-50%);padding:.22rem .42rem;border-radius:999px;background:#8a4bc0;font-size:.43rem;font-weight:900;white-space:nowrap}.template-lines{left:.7rem;right:.7rem;top:66%;display:grid;gap:.25rem}.template-lines i{height:.23rem;border:1px solid rgba(198,144,255,.55);background:rgba(5,3,8,.72)}.template-gig-announcement::after,.template-recap::after,.template-upcoming-gigs::after{background:linear-gradient(128deg,transparent 0 17%,rgba(198,145,255,.55) 17.5% 18%,transparent 18.5%),linear-gradient(180deg,rgba(6,2,11,.22),rgba(5,2,9,.93))}.template-copy{display:grid;gap:.28rem;padding:.62rem}.template-copy-head{display:flex;justify-content:space-between;gap:.4rem}.template-copy strong{font-size:.72rem}.template-copy em{color:#8258a4;font-size:.54rem;font-style:normal;text-transform:uppercase}.template-copy small{color:#716a78;font-size:.6rem;line-height:1.35}
.form-stack{display:grid;gap:.78rem;padding-top:.9rem}.field,label{display:grid;gap:.35rem;color:#aaa4b1;font-size:.76rem}.field>span{color:#aaa4b1}.label-row{justify-content:space-between;gap:.6rem}.label-row small{color:#706978}.field-actions{gap:.55rem}.field-toggle,.row-toggle{display:inline-flex;align-items:center;gap:.3rem;margin:0;color:#817989;font-size:.63rem}.field-toggle input,.row-toggle input{width:auto;margin:0;accent-color:#9b64c7}.field-toggle span{min-width:2.8rem}
input,textarea,select{width:100%;min-width:0;border:1px solid #312b37;border-radius:.62rem;padding:.68rem;background:#0a090c;color:#f4eff8;font:inherit;outline:none}textarea{resize:vertical;line-height:1.4}input:focus,textarea:focus,select:focus{border-color:#744d91}input:disabled,textarea:disabled{opacity:.42}.two{display:grid;grid-template-columns:1fr 1fr;gap:.6rem}
.gig-list-editor{display:grid;gap:.55rem;padding:.72rem;border:1px solid #29232e;border-radius:.68rem;background:#0b090d}.gig-list-head{justify-content:space-between;gap:1rem}.gig-list-head>div{display:grid;gap:.1rem}.gig-list-head strong{font-size:.76rem}.gig-list-head small{color:#6e6774;font-size:.64rem}.gig-list-rows{display:grid;gap:.46rem}.gig-list-rows.disabled{opacity:.5}.gig-row{padding:.55rem;border:1px solid #252029;border-radius:.58rem;background:#100d13}.gig-row-head{justify-content:space-between;margin-bottom:.45rem}.gig-row-head button{border:0;background:transparent;color:#7d7382;font-size:.62rem;cursor:pointer}.gig-row-fields{display:grid;grid-template-columns:.7fr 1.2fr 1fr;gap:.38rem}.gig-row-fields input{padding:.5rem;font-size:.67rem}.add-gig{justify-self:start;padding:.48rem .62rem;border-radius:.55rem;background:#1c1522;color:#c8b5d8;font-size:.68rem}
.motion-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:.46rem}.motion-grid button{display:grid;gap:.35rem;padding:.62rem;border:1px solid #2d2733;border-radius:.62rem;background:#0b0a0d;color:#a9a1af;text-align:left;cursor:pointer}.motion-grid button.active{border-color:#8b56b2;background:#17101d;color:#fff}.motion-grid strong{font-size:.7rem}.motion-grid small{color:#706979;font-size:.58rem;line-height:1.3}.motion-icon{position:relative;display:block;overflow:hidden;height:1.5rem;border-radius:.4rem;background:#16111b}.motion-icon i{position:absolute;top:50%;left:18%;width:42%;height:.16rem;border-radius:999px;background:#a867d5;transform:translateY(-50%)}.motion-icon[data-motion=energy] i{width:66%;box-shadow:0 -.35rem 0 rgba(168,103,213,.35),0 .35rem 0 rgba(168,103,213,.35)}.motion-icon[data-motion=minimal] i{width:24%;opacity:.65}
input[type=range]{padding:0;border:0;background:transparent;accent-color:#9c67c7}.export-panel>p{margin:0;color:#7f7886;font-size:.7rem;line-height:1.5}.audio-upload input{padding:.55rem}.audio-upload small{color:#706979}.selected-file{padding:.5rem .6rem;border-radius:.5rem;background:#151119;color:#bfb4c8!important}.full{width:100%}
.preview-shell{position:sticky;top:1rem;overflow:hidden}.preview-toolbar{justify-content:space-between;gap:1rem;padding:.85rem 1rem;border-bottom:1px solid #25202a}.preview-toolbar>div:first-child{display:grid;gap:.14rem}.preview-toolbar strong{font-size:.82rem}.preview-toolbar small{color:#716a77;font-size:.68rem}.preview-tools{gap:.45rem}.icon-button{display:grid;place-items:center;width:2rem;height:2rem;border:1px solid #302a36;border-radius:.55rem;background:#151119;color:#a9a0b1}
.preview-stage{display:grid;place-items:center;min-height:620px;padding:1.1rem;background:radial-gradient(circle at 50% 35%,rgba(108,63,147,.12),transparent 38%),#09080b}.phone-preview{position:relative;overflow:hidden;width:min(100%,390px);aspect-ratio:9/16;border:1px solid #302a38;border-radius:.7rem;background:#09080b;box-shadow:0 30px 80px rgba(0,0,0,.48);cursor:grab;touch-action:none;user-select:none}.phone-preview.dragging{cursor:grabbing}.preview-media{position:absolute;inset:-3%;animation:slowDrift 10s ease-in-out infinite alternate}.phone-preview[data-motion=energy] .preview-media{animation-duration:4.8s}.phone-preview[data-motion=minimal] .preview-media{animation-duration:18s}.preview-media img{display:block;width:100%;height:100%;object-fit:cover;transition:transform .16s ease,object-position .16s ease}.phone-preview.dragging .preview-media img{transition:none}.wash{position:absolute;inset:0;background:linear-gradient(180deg,rgba(71,34,105,.58),rgba(5,4,7,.06) 38%,rgba(5,4,7,.88));pointer-events:none}.phone-preview[data-brand=mono] .wash{background:linear-gradient(180deg,rgba(0,0,0,.46),rgba(5,4,7,.08) 38%,rgba(0,0,0,.9))}.phone-preview[data-brand=warm] .wash{background:linear-gradient(180deg,rgba(112,45,16,.55),rgba(5,4,7,.06) 38%,rgba(15,6,3,.9))}.campaign-texture{position:absolute;inset:0;pointer-events:none}.campaign-texture::before,.campaign-texture::after{content:"";position:absolute;width:42%;height:7px;background:#a55fe1;opacity:.42;transform:rotate(-10deg);box-shadow:0 0 20px rgba(165,95,225,.4)}.campaign-texture::before{left:-10%;top:19%}.campaign-texture::after{right:-12%;bottom:17%}.preview-logo{position:absolute;z-index:2;top:6%;left:7%;right:7%;color:#d1a5f7;font-size:.6rem;letter-spacing:.18em}.regular-copy{position:absolute;z-index:2;inset:10% 7% 9%;display:flex}.regular-copy[data-position=top]{align-items:flex-start}.regular-copy[data-position=middle]{align-items:center}.regular-copy[data-position=bottom]{align-items:flex-end}.regular-copy[data-align=left]{justify-content:flex-start;text-align:left}.regular-copy[data-align=center]{justify-content:center;text-align:center}.regular-copy[data-align=right]{justify-content:flex-end;text-align:right}.regular-copy-inner{width:100%;max-width:100%;padding:.72rem}.phone-preview[data-template=pulse] .regular-copy-inner{border:1px solid rgba(170,99,217,.65);border-radius:.8rem;background:rgba(10,8,15,.72)}.regular-copy h2,.campaign-preview h2{margin:0;color:#fff;font-size:clamp(1.5rem,4vw,2.4rem);line-height:.88;letter-spacing:-.06em;text-transform:uppercase}.regular-copy p{margin:.6rem 0 0;color:#d0cad6;font-size:.72rem}.chips,.campaign-meta{display:flex;gap:.3rem;flex-wrap:wrap;margin-top:.72rem}.regular-copy[data-align=center] .chips{justify-content:center}.regular-copy[data-align=right] .chips{justify-content:flex-end}.chips span,.campaign-meta span{padding:.3rem .42rem;border:1px solid rgba(184,116,232,.35);border-radius:999px;background:rgba(10,8,15,.78);color:#fff;font-size:.54rem}.preview-cta{display:block;margin-top:.65rem;color:#d3aafa;font-size:.58rem;letter-spacing:.05em}
.campaign-preview{position:absolute;z-index:2;inset:13% 7% 10%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}.campaign-preview h2{font-size:clamp(1.9rem,5vw,3rem);font-style:italic;text-shadow:0 0 18px rgba(167,90,226,.7)}.brush{width:45%;height:6px;margin:.55rem 0;background:#9e58d5;transform:rotate(-2deg)}.campaign-pill{display:inline-block;margin-top:.55rem;padding:.34rem .72rem;border-radius:999px;background:#8c4fb8;color:#fff;font-size:.6rem;letter-spacing:.04em;text-transform:uppercase}.campaign-meta{justify-content:center}.campaign-cta{margin-top:.85rem;color:#ddb7ff;font-size:.62rem;letter-spacing:.06em}.recap-preview .campaign-pill{margin:0 0 .6rem}.planning-preview{justify-content:flex-start;padding-top:8%}.planning-preview h2{font-size:2rem}.planning-list{width:100%;display:grid;margin-top:.8rem;border:1px solid rgba(177,102,225,.52);background:rgba(5,3,8,.82);text-align:left}.planning-list>div{display:grid;grid-template-columns:4.2rem 1fr;gap:.5rem;align-items:center;padding:.48rem .55rem;border-bottom:1px solid rgba(255,255,255,.1)}.planning-list>div:last-child{border-bottom:0}.planning-list>div>strong{color:#dab0fa;font-size:.54rem}.planning-list span{display:grid;gap:.08rem}.planning-list b{font-size:.58rem}.planning-list small{color:#908795;font-size:.48rem}
.drag-hint{position:absolute;left:50%;bottom:.65rem;z-index:5;display:inline-flex;align-items:center;gap:.3rem;padding:.36rem .5rem;border:1px solid rgba(255,255,255,.14);border-radius:999px;background:rgba(10,8,13,.76);color:#d9d0df;font-size:.55rem;font-weight:700;pointer-events:none;transform:translateX(-50%);backdrop-filter:blur(8px)}.drag-hint.active{background:rgba(94,49,139,.88);color:#fff}.preview-note{margin:.65rem 1rem .85rem;color:#6f6875;font-size:.66rem;text-align:center}.no-source{display:grid;place-items:center;gap:.35rem;color:#81798a;text-align:center}.no-source>span{font-size:2rem}.no-source strong{color:#bdb5c5}.no-source small{max-width:17rem}
.history{padding:1rem}.history-head{justify-content:space-between;gap:1rem;margin-bottom:.7rem}.history-head>div{display:grid;gap:.16rem}.history-head h2{margin:0;font-size:1.2rem}.history-head p:last-child{margin:0;color:#716a78;font-size:.7rem}.job-list{display:grid}.job{display:grid;grid-template-columns:minmax(0,1fr) minmax(120px,210px) auto;gap:.8rem;align-items:center;padding:.78rem 0;border-top:1px solid #29242f}.job-main{display:flex;align-items:center;gap:.75rem;min-width:0}.thumb{overflow:hidden;flex:0 0 50px;width:50px;aspect-ratio:9/16;border-radius:.42rem;background:#18141d}.thumb img,.thumb video{width:100%;height:100%;object-fit:cover}.job-copy{min-width:0}.job-title{display:flex;align-items:center;gap:.45rem;min-width:0}.job-title strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.job-title span{padding:.18rem .38rem;border-radius:999px;background:#27222e;color:#b8afc2;font-size:.56rem;text-transform:uppercase}.job-title span[data-status=completed]{background:#14251d;color:#9be6ba}.job-title span[data-status=failed]{background:#2a181c;color:#e7a2ad}.job-copy p{margin:.25rem 0 0;color:#817a8b;font-size:.65rem}.job-copy .error{color:#e7a2ad}.progress{position:relative;height:9px;border-radius:999px;background:#242029}.progress div{height:100%;border-radius:inherit;background:#fff}.progress span{position:absolute;right:0;top:-1.15rem;color:#817a8b;font-size:.6rem}.job-actions{justify-content:flex-end;gap:.35rem}.empty-history{display:grid;gap:.25rem;padding:1.5rem;color:#817a8b;text-align:center}.empty-history strong{color:#aaa2b1}.empty-history small{font-size:.7rem}
.preview-shell:fullscreen{display:grid;place-items:center;background:#09080b}.preview-shell:fullscreen .preview-toolbar{position:absolute;z-index:10;top:0;left:0;right:0;background:rgba(9,8,11,.92)}.preview-shell:fullscreen .preview-stage{min-height:100vh;width:100%}.preview-shell:fullscreen .phone-preview{height:min(88vh,900px);width:auto}.preview-shell:fullscreen .preview-note{display:none}
@keyframes slowDrift{from{transform:translateX(-1.3%) scale(1.015)}to{transform:translateX(1.3%) scale(1.045)}}
@media(max-width:1100px){.workspace{grid-template-columns:minmax(300px,410px) minmax(0,1fr)}.media-grid{grid-template-columns:repeat(3,1fr)}.preview-stage{min-height:560px}.job{grid-template-columns:1fr auto}.progress{grid-column:1/-1;grid-row:2}}
@media(max-width:850px){.page-header{align-items:flex-start;flex-direction:column}.header-actions{justify-content:flex-start}.workspace{grid-template-columns:1fr}.preview-shell{position:static;order:-1}.preview-stage{min-height:auto;padding:1rem}.phone-preview{width:min(100%,340px)}.media-grid{grid-template-columns:repeat(4,1fr)}.job{grid-template-columns:1fr}.progress{grid-column:auto;grid-row:auto}.job-actions{justify-content:flex-start}}
@media(max-width:600px){.header-actions{width:100%}.header-actions .primary,.header-actions .secondary-button{flex:1}.status-pill{width:100%;justify-content:center}.template-grid{grid-template-columns:1fr 1fr}.media-grid{grid-template-columns:repeat(3,1fr)}.two,.gig-row-fields,.motion-grid{grid-template-columns:1fr}.preview-toolbar,.history-head{align-items:flex-start;flex-direction:column}.preview-tools{width:100%;justify-content:space-between}.job-actions{flex-wrap:wrap}.page-header h1{font-size:2.45rem}}
</style>
