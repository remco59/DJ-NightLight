<script setup lang="ts">
import { usePostEditor, POST_IMAGE_TYPES } from '~/composables/usePostEditor'
import {
  coverImageRect,
  postImageDragDelta,
  POST_PRESETS,
  type PostPreset,
} from '~~/shared/post-generator'
import {
  fitPreviewSize,
  pinchPostZoom,
  resolveSheetSnap,
  sheetSnapHeights,
  type PostEditorSheetSnap,
} from '~~/shared/post-editor-ui'

// Phone layout of the post editor: preview-first canvas with a bottom sheet
// per tool. State lives in the shared post editor (see usePostEditor).
const editor = usePostEditor()
const {
  design,
  sourceAssetId,
  busy,
  message,
  lastRenderedUrl,
  selectedAsset,
  readyToExport,
  templates,
  brands,
  applyTemplate,
  resetImagePosition,
  addGigItem,
  removeGigItem,
} = editor

const router = useRouter()
const sourceSearch = ref('')
const freshFile = ref<File | null>(null)
const freshInput = ref<HTMLInputElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
const previewShellRef = ref<HTMLElement | null>(null)
const openSections = ref<number[]>([1, 2, 3])

type MobileTool = 'photo' | 'template' | 'text' | 'style' | 'export'
type MobileSheetTool = Exclude<MobileTool, 'export'>

const mobileTool = ref<MobileSheetTool>('text')
const mobileTabs: Array<{ key: MobileTool, label: string, title: string, icon: string, step: number }> = [
  { key: 'photo', label: 'Foto', title: 'Foto', icon: 'lucide:image', step: 1 },
  { key: 'template', label: 'Template', title: 'Templates', icon: 'lucide:layout-grid', step: 2 },
  { key: 'text', label: 'Tekst', title: 'Tekst', icon: 'lucide:type', step: 3 },
  { key: 'style', label: 'Stijl', title: 'Stijl', icon: 'lucide:palette', step: 4 },
  { key: 'export', label: 'Export', title: 'Export', icon: 'lucide:share', step: 5 },
]

const isMobile = ref(false)
const workspaceRef = ref<HTMLElement | null>(null)
const previewStageRef = ref<HTMLElement | null>(null)
const previewToolbarRef = ref<HTMLElement | null>(null)
const sheetScrollRef = ref<HTMLElement | null>(null)
const sheetSnap = ref<PostEditorSheetSnap>('closed')
const lastOpenSnap = ref<Exclude<PostEditorSheetSnap, 'closed'>>('normal')
// Height a sheet keeps while sliding away after being dragged closed.
const closedHeight = ref<number | null>(null)
const workspaceHeight = ref(0)
const toolbarHeight = ref(0)
const viewportHeight = ref(0)
const stageSize = reactive({ width: 0, height: 0 })
const templateCategory = ref('all')
const sheetDrag = reactive({
  active: false,
  moved: false,
  pointerId: -1,
  startY: 0,
  startHeight: 0,
  height: 0,
  lastY: 0,
  lastTime: 0,
  velocity: 0,
})
let suppressHandleClick = false
let resizeObserver: ResizeObserver | null = null
let mobileQuery: MediaQueryList | null = null

const sheetOpen = computed(() => sheetSnap.value !== 'closed')
const sheetSnaps = computed(() => sheetSnapHeights({
  viewportHeight: viewportHeight.value,
  // The format controls stay reachable above even an expanded sheet.
  workspaceHeight: workspaceHeight.value - toolbarHeight.value,
}))
const sheetHeight = computed(() => {
  if (sheetDrag.active) return sheetDrag.height
  if (!sheetOpen.value && closedHeight.value !== null) return closedHeight.value
  return sheetSnaps.value[sheetOpen.value ? sheetSnap.value : lastOpenSnap.value]
})
const mobileEditorStyle = computed(() => ({
  '--sheet-height': sheetHeight.value + 'px',
  '--sheet-inset': (sheetOpen.value ? sheetSnaps.value[sheetSnap.value] : 0) + 'px',
}))
const activeToolTitle = computed(() => mobileTabs.find(tab => tab.key === mobileTool.value)?.title || '')
const templateCategories = computed(() => [...new Set(templates.map(template => template.category))])
const canvasFrameStyle = computed(() => {
  if (!isMobile.value) return undefined
  const target = POST_PRESETS[design.preset]
  const fit = fitPreviewSize({
    availableWidth: stageSize.width,
    availableHeight: stageSize.height,
    designWidth: target.width,
    designHeight: target.height,
  })
  return { width: fit.width + 'px', height: fit.height + 'px' }
})

const dragState = reactive({
  active: false,
  pointerId: -1,
  startX: 0,
  startY: 0,
  startImageX: 0,
  startImageY: 0,
})
const pinchState = reactive({
  active: false,
  startDistance: 0,
  startZoom: 1,
})
const activePointers = new Map<number, { x: number, y: number }>()

const presetOptions = Object.entries(POST_PRESETS) as Array<[PostPreset, (typeof POST_PRESETS)[PostPreset]]>

const filteredAssets = computed(() => {
  const q = sourceSearch.value.trim().toLowerCase()
  const assets = editor.assets.value
  if (!q) return assets
  return assets.filter(asset => [
    asset.title,
    asset.altText,
    asset.originalFilename,
  ].some(value => value.toLowerCase().includes(q)))
})

function isSectionOpen(step: number) {
  return openSections.value.includes(step)
}

function toggleSection(step: number) {
  if (!isSectionOpen(step)) openSections.value = [...openSections.value, step]
}

function selectMobileTool(tool: MobileTool, step: number) {
  // Export is an action, not an editing sheet.
  if (tool === 'export') {
    void editor.exportPost()
    return
  }

  if (sheetOpen.value && mobileTool.value === tool) {
    closeSheet()
    return
  }

  if (mobileTool.value !== tool && sheetScrollRef.value) sheetScrollRef.value.scrollTop = 0
  mobileTool.value = tool
  if (!isSectionOpen(step)) openSections.value = [...openSections.value, step]
  if (!sheetOpen.value) sheetSnap.value = 'normal'
}

function setSheetSnap(snap: PostEditorSheetSnap) {
  sheetSnap.value = snap
  if (snap !== 'closed') {
    lastOpenSnap.value = snap
    closedHeight.value = null
  }
}

function closeSheet() {
  setSheetSnap('closed')
}

function toggleSheetSize() {
  if (suppressHandleClick) {
    suppressHandleClick = false
    return
  }
  setSheetSnap(sheetSnap.value === 'expanded' ? 'normal' : 'expanded')
}

function startSheetDrag(event: PointerEvent) {
  if ((event.target as HTMLElement).closest('.sheet-close')) return
  if (event.pointerType === 'mouse' && event.button !== 0) return

  const now = performance.now()
  Object.assign(sheetDrag, {
    active: true,
    moved: false,
    pointerId: event.pointerId,
    startY: event.clientY,
    startHeight: sheetHeight.value,
    height: sheetHeight.value,
    lastY: event.clientY,
    lastTime: now,
    velocity: 0,
  })
  suppressHandleClick = false
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
}

function moveSheetDrag(event: PointerEvent) {
  if (!sheetDrag.active || event.pointerId !== sheetDrag.pointerId) return

  const now = performance.now()
  const deltaY = sheetDrag.startY - event.clientY
  if (Math.abs(deltaY) > 6) sheetDrag.moved = true
  sheetDrag.height = Math.max(0, Math.min(sheetSnaps.value.expanded, sheetDrag.startHeight + deltaY))
  // Positive velocity means the sheet is growing (finger moving up), in px/ms.
  if (now > sheetDrag.lastTime) sheetDrag.velocity = (sheetDrag.lastY - event.clientY) / (now - sheetDrag.lastTime)
  sheetDrag.lastY = event.clientY
  sheetDrag.lastTime = now
}

function endSheetDrag(event: PointerEvent) {
  if (!sheetDrag.active || event.pointerId !== sheetDrag.pointerId) return

  const target = event.currentTarget as HTMLElement
  if (target.hasPointerCapture(event.pointerId)) target.releasePointerCapture(event.pointerId)
  if (sheetDrag.moved) {
    suppressHandleClick = true
    const snap = resolveSheetSnap({
      height: sheetDrag.height,
      velocity: sheetDrag.velocity,
      snaps: sheetSnaps.value,
    })
    if (snap === 'closed') closedHeight.value = sheetDrag.height
    setSheetSnap(snap)
  }
  sheetDrag.active = false
  sheetDrag.pointerId = -1
}

function updateViewportHeight() {
  viewportHeight.value = window.visualViewport?.height || window.innerHeight
}

function updateMobile() {
  isMobile.value = Boolean(mobileQuery?.matches)
}

function measureLayout(entries: ResizeObserverEntry[]) {
  for (const entry of entries) {
    if (entry.target === workspaceRef.value) {
      workspaceHeight.value = entry.contentRect.height
    } else if (entry.target === previewToolbarRef.value) {
      toolbarHeight.value = (entry.target as HTMLElement).offsetHeight
    } else if (entry.target === previewStageRef.value) {
      stageSize.width = entry.contentRect.width
      stageSize.height = entry.contentRect.height
    }
  }
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
  if (!POST_IMAGE_TYPES.includes(file.type)) {
    message.value = 'Choose a JPEG, PNG or WebP image.'
    return
  }
  freshFile.value = file
}

async function uploadFreshSource() {
  if (!freshFile.value) return
  if (await editor.uploadSource(freshFile.value)) {
    freshFile.value = null
    if (freshInput.value) freshInput.value.value = ''
  }
}

function clampCropPosition(value: number) {
  return Math.max(-1, Math.min(1, value))
}

function pointerDistance() {
  const [a, b] = [...activePointers.values()]
  if (!a || !b) return 0
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function beginDrag(pointerId: number, x: number, y: number) {
  dragState.active = true
  dragState.pointerId = pointerId
  dragState.startX = x
  dragState.startY = y
  dragState.startImageX = design.imageX
  dragState.startImageY = design.imageY
}

function startPreviewDrag(event: PointerEvent) {
  if (!canvasRef.value || !editor.sourceSize.width) return
  if (event.pointerType === 'mouse' && event.button !== 0) return

  event.preventDefault()
  activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
  canvasRef.value.setPointerCapture(event.pointerId)

  // A second finger turns the drag into a pinch-to-zoom.
  if (activePointers.size === 2) {
    dragState.active = false
    dragState.pointerId = -1
    pinchState.active = true
    pinchState.startDistance = pointerDistance()
    pinchState.startZoom = design.zoom
    return
  }

  if (activePointers.size === 1) beginDrag(event.pointerId, event.clientX, event.clientY)
}

function movePreviewDrag(event: PointerEvent) {
  const pointer = activePointers.get(event.pointerId)
  if (pointer) {
    pointer.x = event.clientX
    pointer.y = event.clientY
  }

  if (pinchState.active && pointer) {
    event.preventDefault()
    design.zoom = pinchPostZoom(pinchState.startZoom, pinchState.startDistance, pointerDistance())
    return
  }

  if (!dragState.active || event.pointerId !== dragState.pointerId || !canvasRef.value || !editor.sourceSize.width) return

  event.preventDefault()
  const canvasBounds = canvasRef.value.getBoundingClientRect()
  if (!canvasBounds.width || !canvasBounds.height) return

  const target = POST_PRESETS[design.preset]
  const rendered = coverImageRect({
    sourceWidth: editor.sourceSize.width,
    sourceHeight: editor.sourceSize.height,
    targetWidth: target.width,
    targetHeight: target.height,
    zoom: design.zoom,
    imageX: 0,
    imageY: 0,
  })
  const delta = postImageDragDelta({
    deltaX: event.clientX - dragState.startX,
    deltaY: event.clientY - dragState.startY,
    displayWidth: canvasBounds.width,
    displayHeight: canvasBounds.height,
    targetWidth: target.width,
    targetHeight: target.height,
    renderedWidth: rendered.width,
    renderedHeight: rendered.height,
  })

  design.imageX = clampCropPosition(dragState.startImageX + delta.x)
  design.imageY = clampCropPosition(dragState.startImageY + delta.y)
}

function endPreviewDrag(event: PointerEvent) {
  if (!activePointers.delete(event.pointerId)) return
  if (canvasRef.value?.hasPointerCapture(event.pointerId)) {
    canvasRef.value.releasePointerCapture(event.pointerId)
  }

  if (pinchState.active) {
    if (activePointers.size >= 2) return
    pinchState.active = false
    // Continue dragging with the finger that stays down, without a jump.
    const [remaining] = [...activePointers.entries()]
    if (remaining) beginDrag(remaining[0], remaining[1].x, remaining[1].y)
    return
  }

  if (event.pointerId !== dragState.pointerId) return
  dragState.active = false
  dragState.pointerId = -1
}

onMounted(() => {
  if (canvasRef.value) editor.registerCanvas(canvasRef.value)
  mobileQuery = window.matchMedia('(max-width: 720px)')
  updateMobile()
  mobileQuery.addEventListener('change', updateMobile)
  updateViewportHeight()
  window.visualViewport?.addEventListener('resize', updateViewportHeight)
  window.addEventListener('resize', updateViewportHeight)
  resizeObserver = new ResizeObserver(measureLayout)
  if (workspaceRef.value) resizeObserver.observe(workspaceRef.value)
  if (previewStageRef.value) resizeObserver.observe(previewStageRef.value)
  if (previewToolbarRef.value) resizeObserver.observe(previewToolbarRef.value)
})

// The canvas only exists once a photo is selected.
watch(canvasRef, (canvas, previous) => {
  if (previous) editor.unregisterCanvas(previous)
  if (canvas) editor.registerCanvas(canvas)
})

onBeforeUnmount(() => {
  if (canvasRef.value) editor.unregisterCanvas(canvasRef.value)
  resizeObserver?.disconnect()
  mobileQuery?.removeEventListener('change', updateMobile)
  window.visualViewport?.removeEventListener('resize', updateViewportHeight)
  window.removeEventListener('resize', updateViewportHeight)
})

function setPreset(preset: PostPreset) {
  design.preset = preset
}

async function toggleFullscreen() {
  if (!previewShellRef.value || !import.meta.client) return
  if (document.fullscreenElement) {
    await document.exitFullscreen()
    return
  }
  await previewShellRef.value.requestFullscreen()
}
</script>

<template>
  <div class="page" :class="{ 'sheet-open': sheetOpen }" :style="mobileEditorStyle">
    <header class="mobile-editor-header">
      <button class="mobile-back-button" type="button" aria-label="Ga terug" @click="router.back()">←</button>
      <strong>Post editor</strong>
      <button
        class="mobile-export-button"
        type="button"
        :disabled="busy === 'render' || !readyToExport"
        @click="editor.exportPost"
      >
        {{ busy === 'render' ? 'Bezig…' : 'Export' }}
      </button>
    </header>

    <p v-if="message" class="message">
      {{ message }}
      <a v-if="lastRenderedUrl" class="mobile-only message-download" :href="lastRenderedUrl" download="nightlight-post.png">Download PNG</a>
    </p>

    <div ref="workspaceRef" class="workspace">
      <aside
        class="controls"
        :class="['mobile-tool-' + mobileTool, 'sheet-' + sheetSnap, { 'sheet-dragging': sheetDrag.active }]"
        :aria-label="isMobile ? activeToolTitle : undefined"
      >
        <div
          class="mobile-sheet-head"
          @pointerdown="startSheetDrag"
          @pointermove="moveSheetDrag"
          @pointerup="endSheetDrag"
          @pointercancel="endSheetDrag"
        >
          <button
            class="sheet-handle"
            type="button"
            :aria-label="sheetSnap === 'expanded' ? 'Paneel verkleinen' : 'Paneel vergroten'"
            @click="toggleSheetSize"
          >
            <span />
          </button>
          <div class="sheet-title-row">
            <strong>{{ activeToolTitle }}</strong>
            <button class="sheet-close" type="button" aria-label="Paneel sluiten" @click="closeSheet">
              <Icon name="lucide:x" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div ref="sheetScrollRef" class="controls-scroll">
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
            <Icon class="chevron" :name="isSectionOpen(1) ? 'lucide:chevron-up' : 'lucide:chevron-down'" aria-hidden="true" />
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
              <span class="upload-icon"><Icon name="lucide:upload" aria-hidden="true" /></span>
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
              <Icon class="search-icon" name="lucide:search" aria-hidden="true" />
              <input v-model="sourceSearch" type="search" placeholder="Search media library…">
              <button v-if="sourceSearch" type="button" aria-label="Clear search" @click="sourceSearch = ''"><Icon name="lucide:x" aria-hidden="true" /></button>
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
                <span v-if="sourceAssetId === asset.id" class="selected-mark"><Icon name="lucide:check" aria-hidden="true" /></span>
              </button>
            </div>

            <div class="mobile-only photo-adjust">
              <div class="subheading-row">
                <strong>Positie</strong>
                <button class="with-icon reset-position" type="button" @click="resetImagePosition">
                  <Icon name="lucide:rotate-ccw" aria-hidden="true" />Reset
                </button>
              </div>
              <p class="photo-adjust-hint"><Icon name="lucide:move" aria-hidden="true" /> Sleep de foto om te verplaatsen, knijp om te zoomen.</p>
              <label>
                <span class="label-row"><span>Schaal</span><small>{{ design.zoom.toFixed(2) }}<IconTimes /></small></span>
                <input v-model.number="design.zoom" type="range" min="1" max="3" step=".02">
              </label>
              <label>
                <span>Horizontaal</span>
                <input v-model.number="design.imageX" type="range" min="-1" max="1" step=".02">
              </label>
              <label>
                <span>Verticaal</span>
                <input v-model.number="design.imageY" type="range" min="-1" max="1" step=".02">
              </label>
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
            <Icon class="chevron" :name="isSectionOpen(2) ? 'lucide:chevron-up' : 'lucide:chevron-down'" aria-hidden="true" />
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
                  <em>{{ preset.width }}<IconTimes />{{ preset.height }}</em>
                </span>
              </button>
            </div>

            <div class="subheading-row">
              <strong>Templates</strong>
              <small>Visual style</small>
            </div>

            <div class="mobile-only template-chips" role="group" aria-label="Template categorie">
              <button
                type="button"
                class="chip"
                :class="{ active: templateCategory === 'all' }"
                :aria-pressed="templateCategory === 'all'"
                @click="templateCategory = 'all'"
              >
                Alle
              </button>
              <button
                v-for="category in templateCategories"
                :key="category"
                type="button"
                class="chip"
                :class="{ active: templateCategory === category }"
                :aria-pressed="templateCategory === category"
                @click="templateCategory = category"
              >
                {{ category }}
              </button>
            </div>

            <div class="template-grid">
              <button
                v-for="template in templates"
                :key="template.key"
                type="button"
                class="template-card"
                :class="{
                  active: design.templateKey === template.key,
                  'mobile-filtered-out': templateCategory !== 'all' && template.category !== templateCategory,
                }"
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
                    <span class="template-display template-display-gig">DIT<br>WEEKEND</span>
                    <span class="template-pill">DJ NIGHTLIGHT</span>
                    <span class="template-mini-meta">12 DEC · 22:00</span>
                  </template>

                  <template v-else-if="template.key === 'recap'">
                    <span class="template-display template-display-recap">WAT EEN<br>AVOND</span>
                    <span class="template-pill">TERUGBLIK</span>
                  </template>

                  <template v-else-if="template.key === 'upcoming-gigs'">
                    <span class="template-display template-display-planning">DECEMBER</span>
                    <span class="template-pill">PLANNING</span>
                    <span class="template-mini-list">
                      <i v-for="row in 3" :key="row" />
                    </span>
                  </template>

                  <span v-else class="template-headline">JOUW AVOND.<br>JOUW SOUND.</span>
                </span>
                <span class="template-copy">
                  <span class="template-copy-head">
                    <strong>{{ template.label }}</strong>
                    <em>{{ template.category }}</em>
                  </span>
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
              <strong class="mobile-labelable" data-mobile-label="Tekst">Copy</strong>
              <small class="mobile-labelable" data-mobile-label="Bewerk de tekst op je post.">Add text and brand details</small>
            </span>
            <Icon class="chevron" :name="isSectionOpen(3) ? 'lucide:chevron-up' : 'lucide:chevron-down'" aria-hidden="true" />
          </button>

          <div v-if="isSectionOpen(3)" class="section-body form-stack">
            <div class="field">
              <div class="label-row">
                <span class="mobile-only field-icon"><Icon name="lucide:type" aria-hidden="true" /></span>
                <span class="field-name">
                  <span class="field-label mobile-labelable" data-mobile-label="Titel">Headline</span>
                  <small class="mobile-only field-hint">De hoofdtekst op je post.</small>
                </span>
                <span class="field-actions">
                  <small>{{ design.headline.length }}/180</small>
                  <label class="field-toggle">
                    <input v-model="design.visibility.headline" type="checkbox">
                    <span>{{ design.visibility.headline ? 'Shown' : 'Hidden' }}</span>
                  </label>
                </span>
              </div>
              <textarea v-model="design.headline" rows="2" maxlength="180" :disabled="!design.visibility.headline" />
            </div>

            <div class="field">
              <div class="label-row">
                <span class="mobile-only field-icon"><Icon name="lucide:align-left" aria-hidden="true" /></span>
                <span class="field-name">
                  <span class="field-label mobile-labelable" data-mobile-label="Subtitel">Subline</span>
                  <small class="mobile-only field-hint">Een extra regel onder de headline.</small>
                </span>
                <span class="field-actions">
                  <small>{{ design.subline.length }}/260</small>
                  <label class="field-toggle">
                    <input v-model="design.visibility.subline" type="checkbox">
                    <span>{{ design.visibility.subline ? 'Shown' : 'Hidden' }}</span>
                  </label>
                </span>
              </div>
              <textarea v-model="design.subline" rows="2" maxlength="260" :disabled="!design.visibility.subline" />
            </div>

            <div class="two">
              <div class="field">
                <div class="label-row">
                  <span class="mobile-only field-icon"><Icon name="lucide:calendar" aria-hidden="true" /></span>
                  <span class="field-name">
                    <span class="field-label mobile-labelable" data-mobile-label="Datum">Date</span>
                    <small class="mobile-only field-hint">Wanneer het is.</small>
                  </span>
                  <label class="field-toggle">
                    <input v-model="design.visibility.date" type="checkbox">
                    <span>{{ design.visibility.date ? 'Shown' : 'Hidden' }}</span>
                  </label>
                </div>
                <input v-model="design.dateText" maxlength="160" placeholder="12 DEC" :disabled="!design.visibility.date">
              </div>

              <div class="field">
                <div class="label-row">
                  <span class="mobile-only field-icon"><Icon name="lucide:clock" aria-hidden="true" /></span>
                  <span class="field-name">
                    <span class="field-label mobile-labelable" data-mobile-label="Tijd">Time</span>
                    <small class="mobile-only field-hint">Begin- en eindtijd.</small>
                  </span>
                  <label class="field-toggle">
                    <input v-model="design.visibility.time" type="checkbox">
                    <span>{{ design.visibility.time ? 'Shown' : 'Hidden' }}</span>
                  </label>
                </div>
                <input v-model="design.timeText" maxlength="80" placeholder="22:00 – 02:00" :disabled="!design.visibility.time">
              </div>
            </div>

            <div class="field">
              <div class="label-row">
                <span class="mobile-only field-icon"><Icon name="lucide:map-pin" aria-hidden="true" /></span>
                <span class="field-name">
                  <span class="field-label mobile-labelable" data-mobile-label="Locatie">Location</span>
                  <small class="mobile-only field-hint">Laat zien waar het is.</small>
                </span>
                <label class="field-toggle">
                  <input v-model="design.visibility.location" type="checkbox">
                  <span>{{ design.visibility.location ? 'Shown' : 'Hidden' }}</span>
                </label>
              </div>
              <input v-model="design.locationText" maxlength="160" placeholder="Groningen" :disabled="!design.visibility.location">
            </div>

            <div class="field">
              <div class="label-row">
                <span class="mobile-only field-icon"><Icon name="lucide:megaphone" aria-hidden="true" /></span>
                <span class="field-name">
                  <span class="field-label">Call to action</span>
                  <small class="mobile-only field-hint">Een afsluitende oproep.</small>
                </span>
                <label class="field-toggle">
                  <input v-model="design.visibility.cta" type="checkbox">
                  <span>{{ design.visibility.cta ? 'Shown' : 'Hidden' }}</span>
                </label>
              </div>
              <input v-model="design.ctaText" maxlength="180" placeholder="SEE YOU THERE!" :disabled="!design.visibility.cta">
            </div>

            <div v-if="design.templateKey === 'upcoming-gigs'" class="gig-list-editor">
              <div class="gig-list-head">
                <div>
                  <strong>Upcoming gigs</strong>
                  <small>Edit up to six rows for the planning template.</small>
                </div>
                <label class="field-toggle">
                  <input v-model="design.visibility.gigList" type="checkbox">
                  <span>{{ design.visibility.gigList ? 'Shown' : 'Hidden' }}</span>
                </label>
              </div>

              <div class="gig-list-rows" :class="{ disabled: !design.visibility.gigList }">
                <article v-for="(item, index) in design.gigItems" :key="index" class="gig-row">
                  <div class="gig-row-head">
                    <label class="row-toggle">
                      <input v-model="item.enabled" type="checkbox" :disabled="!design.visibility.gigList">
                      <span>Gig {{ index + 1 }}</span>
                    </label>
                    <button type="button" :disabled="design.gigItems.length <= 1" @click="removeGigItem(index)">Remove</button>
                  </div>
                  <div class="gig-row-fields">
                    <input v-model="item.dateText" maxlength="40" placeholder="06 DEC" :disabled="!design.visibility.gigList || !item.enabled">
                    <input v-model="item.title" maxlength="120" placeholder="Eredivisie Dames" :disabled="!design.visibility.gigList || !item.enabled">
                    <input v-model="item.locationText" maxlength="120" placeholder="VC Sneek" :disabled="!design.visibility.gigList || !item.enabled">
                  </div>
                </article>
              </div>

              <button
                class="add-gig"
                type="button"
                :disabled="design.gigItems.length >= 6"
                @click="addGigItem"
              >
                + Add gig
              </button>
            </div>

            <div class="field">
              <div class="label-row">
                <span class="mobile-only field-icon"><Icon name="lucide:tag" aria-hidden="true" /></span>
                <span class="field-name">
                  <span class="field-label">Brand label</span>
                  <small class="mobile-only field-hint">Het merklabel bovenin.</small>
                </span>
                <label class="field-toggle">
                  <input v-model="design.visibility.logo" type="checkbox">
                  <span>{{ design.visibility.logo ? 'Shown' : 'Hidden' }}</span>
                </label>
              </div>
              <input v-model="design.logoText" maxlength="80" :disabled="!design.visibility.logo">
            </div>

            <div class="field brand-field">
              <span>Brand preset</span>
              <select v-model="design.brandPreset">
                <option v-for="brand in brands" :key="brand.key" :value="brand.key">{{ brand.label }} — {{ brand.description }}</option>
              </select>
            </div>
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
            <Icon class="chevron" :name="isSectionOpen(4) ? 'lucide:chevron-up' : 'lucide:chevron-down'" aria-hidden="true" />
          </button>

          <div v-if="isSectionOpen(4)" class="section-body form-stack">
            <label class="crop-control">
              <span class="label-row"><span>Zoom</span><small>{{ design.zoom.toFixed(2) }}<IconTimes /></small></span>
              <input v-model.number="design.zoom" type="range" min="1" max="3" step=".02">
            </label>
            <label class="crop-control">
              <span>Horizontal position</span>
              <input v-model.number="design.imageX" type="range" min="-1" max="1" step=".02">
            </label>
            <label class="crop-control">
              <span>Vertical position</span>
              <input v-model.number="design.imageY" type="range" min="-1" max="1" step=".02">
            </label>
            <label>
              <span class="label-row"><span>Overlay</span><small>{{ Math.round(design.overlayOpacity * 100) }}%</small></span>
              <input v-model.number="design.overlayOpacity" type="range" min="0" max=".9" step=".02">
            </label>
            <div class="mobile-only style-group">
              <span>Merk</span>
              <div class="chip-row">
                <button
                  v-for="brand in brands"
                  :key="brand.key"
                  type="button"
                  class="chip brand-chip"
                  :class="{ active: design.brandPreset === brand.key }"
                  :aria-pressed="design.brandPreset === brand.key"
                  @click="design.brandPreset = brand.key"
                >
                  <i :style="{ background: brand.colors[0] }" />{{ brand.label }}
                </button>
              </div>
            </div>
            <div class="mobile-only style-group">
              <span>Uitlijning</span>
              <div class="chip-row segmented">
                <button
                  v-for="option in [{ key: 'left', label: 'Links', icon: 'lucide:align-left' }, { key: 'center', label: 'Midden', icon: 'lucide:align-center' }, { key: 'right', label: 'Rechts', icon: 'lucide:align-right' }] as const"
                  :key="option.key"
                  type="button"
                  class="chip"
                  :class="{ active: design.textAlign === option.key }"
                  :aria-pressed="design.textAlign === option.key"
                  @click="design.textAlign = option.key"
                >
                  <Icon :name="option.icon" aria-hidden="true" />{{ option.label }}
                </button>
              </div>
            </div>
            <div class="mobile-only style-group">
              <span>Tekstpositie</span>
              <div class="chip-row segmented">
                <button
                  v-for="option in [{ key: 'top', label: 'Boven' }, { key: 'middle', label: 'Midden' }, { key: 'bottom', label: 'Onder' }] as const"
                  :key="option.key"
                  type="button"
                  class="chip"
                  :class="{ active: design.textPosition === option.key }"
                  :aria-pressed="design.textPosition === option.key"
                  @click="design.textPosition = option.key"
                >
                  {{ option.label }}
                </button>
              </div>
            </div>
            <div class="two text-layout">
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

        </div>
      </aside>

      <main class="stage-stack">
        <section ref="previewShellRef" class="preview-shell">
          <div ref="previewToolbarRef" class="preview-toolbar">
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

          <div ref="previewStageRef" class="preview-stage">
            <div v-if="selectedAsset" class="canvas-frame" :data-preset="design.preset" :style="canvasFrameStyle">
              <canvas
                ref="canvasRef"
                class="preview-canvas"
                :class="{ dragging: dragState.active }"
                title="Drag the photo to reposition it"
                @pointerdown="startPreviewDrag"
                @pointermove="movePreviewDrag"
                @pointerup="endPreviewDrag"
                @pointercancel="endPreviewDrag"
                @lostpointercapture="endPreviewDrag"
              />
              <span class="drag-hint" :class="{ active: dragState.active }">
                <Icon name="lucide:move" aria-hidden="true" />
                {{ dragState.active ? 'Repositioning photo' : 'Drag photo to reposition' }}
              </span>
            </div>
            <div v-else class="no-source">
              <span class="empty-icon"><Icon name="lucide:image" aria-hidden="true" /></span>
              <strong>Choose a source photo</strong>
              <small>Select a media-library image or upload a fresh photo.</small>
            </div>
          </div>

        </section>

      </main>

    </div>

    <nav class="mobile-tool-tabs" aria-label="Editor tools">
      <button
        v-for="tab in mobileTabs"
        :key="tab.key"
        class="mobile-tool-tab"
        :class="{ active: sheetOpen && mobileTool === tab.key }"
        type="button"
        :aria-expanded="tab.key === 'export' ? undefined : sheetOpen && mobileTool === tab.key"
        :disabled="tab.key === 'export' && (busy === 'render' || !readyToExport)"
        @click="selectMobileTool(tab.key, tab.step)"
      >
        <span class="mobile-tab-icon" aria-hidden="true"><Icon :name="tab.icon" /></span>
        <span>{{ tab.key === 'export' && busy === 'render' ? 'Bezig…' : tab.label }}</span>
      </button>
    </nav>
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

.mobile-editor-header,
.mobile-tool-tabs {
  display: none;
}

/* Mobile sheet chrome and mobile-only controls; the desktop layout ignores the
   sheet wrapper so the accordion cards stay direct grid items. */
.mobile-sheet-head,
.mobile-only {
  display: none;
}

.controls-scroll {
  display: contents;
}

.preview-toolbar,
.preview-tools,
.media-meta,
.subheading-row,
.label-row {
  display: flex;
  align-items: center;
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
  max-height: calc(100vh - 8rem);
  max-height: calc(100dvh - 8rem);
  display: grid;
  align-content: start;
  gap: .7rem;
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: .25rem;
  scrollbar-gutter: stable;
}

.workspace > * {
  min-width: 0;
}

.workflow-card,
.preview-shell {
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
.template-copy small,
.format-card small,
.format-card em,
.media-meta small,
.preview-toolbar small,
.toggle-control small,
.no-source small {
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

.search-wrap .search-icon {
  color: #776e80;
}

.search-wrap button {
  display: flex;
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
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: .55rem;
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

.template-category {
  position: absolute;
  top: .4rem;
  right: .4rem;
  z-index: 3;
  padding: .16rem .3rem;
  border-radius: 999px;
  background: rgba(8,6,11,.72);
  color: #d9cde4;
  font-size: .42rem;
  font-weight: 800;
  letter-spacing: .04em;
  text-transform: uppercase;
  backdrop-filter: blur(8px);
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

.template-gig-announcement::after,
.template-recap::after,
.template-upcoming-gigs::after {
  background-image:
    url('/post-generator/nightlight-campaign-overlay.svg'),
    linear-gradient(to bottom, rgba(6,2,11,.12), rgba(5,2,9,.9));
  background-position: center;
  background-size: cover;
}

.template-gig-announcement,
.template-recap,
.template-upcoming-gigs {
  box-shadow:
    inset 0 0 0 1px rgba(216,168,255,.46),
    inset 0 0 32px rgba(119,38,190,.24);
}

.template-logo,
.template-headline,
.template-display,
.template-pill,
.template-mini-meta,
.template-mini-list {
  position: absolute;
  z-index: 2;
  color: #fff;
}

.template-logo {
  top: .45rem;
  left: .45rem;
  font-size: .42rem;
  font-weight: 900;
  letter-spacing: .04em;
}

.template-headline {
  left: .45rem;
  bottom: .48rem;
  font-size: .62rem;
  line-height: .92;
  font-weight: 950;
}

.template-display {
  left: .45rem;
  right: .45rem;
  text-align: center;
  font-weight: 950;
  font-style: italic;
  line-height: .88;
  text-shadow: 0 2px 12px rgba(0,0,0,.85);
}

.template-display-gig {
  top: 34%;
  font-size: .8rem;
}

.template-display-recap {
  top: 29%;
  font-size: .72rem;
}

.template-display-planning {
  top: 25%;
  font-size: .72rem;
}

.template-pill {
  left: 16%;
  right: 16%;
  top: 53%;
  padding: .22rem .28rem;
  border-radius: 999px;
  background: linear-gradient(135deg, #7c3aed, #d000ff);
  box-shadow: 0 0 12px rgba(190,40,255,.55);
  text-align: center;
  font-size: .56rem;
  font-weight: 950;
}

.template-recap .template-pill {
  top: 50%;
}

.template-upcoming-gigs .template-pill {
  top: 39%;
}

.template-mini-meta {
  left: .45rem;
  right: .45rem;
  bottom: .5rem;
  text-align: center;
  color: #d9b7ff;
  font-size: .42rem;
  font-weight: 800;
}

.template-mini-list {
  left: .55rem;
  right: .55rem;
  top: 55%;
  display: grid;
  gap: .17rem;
}

.template-mini-list i {
  height: .5rem;
  border: 0;
  border-radius: 0;
  background: url('/post-generator/nightlight-event-card.svg') center / 100% 100% no-repeat;
}

.template-copy {
  display: grid;
  gap: .08rem;
  padding: .45rem .2rem .2rem;
}

.template-copy-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: .3rem;
}

.template-copy-head em {
  color: #9b82ad;
  font-size: .54rem;
  font-style: normal;
  text-transform: uppercase;
  letter-spacing: .05em;
}

.template-copy small {
  display: -webkit-box;
  overflow: hidden;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.form-stack > label,
.form-stack .field {
  display: grid;
  gap: .35rem;
  margin-top: .75rem;
  color: #bcb2c4;
  font-size: .78rem;
}

.field-actions {
  display: flex;
  align-items: center;
  gap: .45rem;
}

.field-toggle,
.row-toggle {
  display: inline-flex;
  align-items: center;
  gap: .3rem;
  margin: 0;
  color: #aaa0b3;
  font-size: .65rem;
  cursor: pointer;
}

.field-toggle input,
.row-toggle input {
  width: auto;
  margin: 0;
  accent-color: #9d5cff;
}

.field input:disabled,
.field textarea:disabled,
.gig-row-fields input:disabled {
  opacity: .45;
}

.gig-list-editor {
  margin-top: .9rem;
  padding: .75rem;
  border: 1px solid #332b39;
  border-radius: .75rem;
  background: #0e0c11;
}

.gig-list-head,
.gig-row-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: .6rem;
}

.gig-list-head > div {
  display: grid;
  gap: .12rem;
}

.gig-list-head small {
  color: #8e8496;
}

.gig-list-rows {
  display: grid;
  gap: .55rem;
  margin-top: .7rem;
}

.gig-list-rows.disabled {
  opacity: .62;
}

.gig-row {
  padding: .58rem;
  border: 1px solid #2e2734;
  border-radius: .65rem;
  background: #141117;
}

.gig-row-head button {
  padding: .28rem .4rem;
  border: 0;
  background: transparent;
  color: #8f8497;
  font-size: .62rem;
}

.gig-row-fields {
  display: grid;
  grid-template-columns: .72fr 1.35fr 1.2fr;
  gap: .35rem;
  margin-top: .45rem;
}

.gig-row-fields input {
  min-width: 0;
  padding: .55rem;
  font-size: .7rem;
}

.add-gig {
  width: 100%;
  margin-top: .6rem;
  padding: .58rem;
  border-style: dashed;
  color: #c4abd8;
  background: #15101b;
}

.two {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: .6rem;
}

.stage-stack {
  min-width: 0;
  max-height: calc(100vh - 8rem);
  max-height: calc(100dvh - 8rem);
  display: grid;
  align-content: start;
  gap: 1rem;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-gutter: stable;
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
  position: relative;
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
  cursor: grab;
  touch-action: none;
  user-select: none;
}

.preview-canvas.dragging {
  cursor: grabbing;
}

.drag-hint {
  position: absolute;
  left: 50%;
  bottom: .85rem;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  gap: .38rem;
  padding: .42rem .62rem;
  border: 1px solid rgba(255,255,255,.14);
  border-radius: 999px;
  background: rgba(10,8,13,.76);
  color: #d9d0df;
  font-size: .68rem;
  font-weight: 700;
  pointer-events: none;
  transform: translateX(-50%);
  backdrop-filter: blur(10px);
  box-shadow: 0 8px 24px rgba(0,0,0,.24);
  transition: opacity .16s ease, background .16s ease;
}

.drag-hint.active {
  background: rgba(94,49,139,.86);
  color: #fff;
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

@media (max-width: 1180px) {
  .workspace {
    grid-template-columns: minmax(300px, 340px) minmax(0, 1fr);
  }
}

@media (max-width: 980px) {

  .workspace {
    grid-template-columns: 1fr;
  }

  .stage-stack {
    order: 1;
    max-height: none;
    overflow: visible;
    scrollbar-gutter: auto;
  }

  .controls {
    order: 2;
    max-height: none;
    overflow: visible;
    padding-right: 0;
    scrollbar-gutter: auto;
  }

  .preview-stage {
    min-height: 500px;
  }
}

@media (max-width: 720px) {
  /* Preview-first canvas with a bottom sheet per tool. The sheet height and
     the space it takes from the preview come from the script as
     --sheet-height and --sheet-inset. */
  .page {
    --mobile-editor-tabs-height: 4.6rem;
    --sheet-ease: cubic-bezier(.22, .8, .24, 1);
    --sheet-duration: .22s;
    width: 100%;
    max-width: 100%;
    height: 100%;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    padding-bottom: 0;
  }

  .mobile-editor-header {
    position: relative;
    z-index: 40;
    flex: 0 0 auto;
    display: grid;
    grid-template-columns: 2.75rem minmax(0, 1fr) auto;
    align-items: center;
    gap: .55rem;
    min-height: 3.7rem;
    margin: 0;
    padding: .35rem .15rem;
    border-bottom: 1px solid rgba(74, 62, 84, .72);
    background: rgba(10, 8, 13, .96);
    backdrop-filter: blur(18px);
  }

  .mobile-editor-header strong {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 1.05rem;
    letter-spacing: -.02em;
  }

  .mobile-back-button,
  .mobile-export-button {
    min-height: 2.75rem;
    border-radius: .78rem;
  }

  .mobile-back-button {
    width: 2.75rem;
    padding: 0;
    border-color: #342d3b;
    background: #151219;
    font-size: 1.2rem;
  }

  .mobile-export-button {
    padding: 0 .9rem;
    border-color: #9d5cff;
    background: linear-gradient(135deg, #7c3aed, #a855f7);
    font-size: .78rem;
    font-weight: 850;
    box-shadow: 0 9px 24px rgba(124, 58, 237, .2);
  }

  .message {
    position: fixed;
    top: .75rem;
    left: .75rem;
    right: .75rem;
    z-index: 70;
    margin: 0;
    box-shadow: 0 16px 42px rgba(0, 0, 0, .42);
  }

  .message-download {
    display: inline-block;
    margin-left: .35rem;
    color: #c9a5ff;
    font-weight: 800;
  }

  .workspace {
    position: relative;
    flex: 1 1 auto;
    width: 100%;
    max-width: 100%;
    min-width: 0;
    min-height: 0;
    display: block;
    overflow: hidden;
  }

  /* Canvas */

  .stage-stack {
    position: absolute;
    inset: 0;
    width: 100%;
    max-width: 100%;
    min-width: 0;
    max-height: none;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    scrollbar-gutter: auto;
  }

  .preview-shell {
    flex: 1 1 auto;
    width: 100%;
    max-width: 100%;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border: 0;
    border-radius: 0;
    background: transparent;
    box-shadow: none;
  }

  .preview-toolbar {
    flex: 0 0 auto;
    gap: .4rem;
    padding: .55rem 0;
    border-bottom: 0;
  }

  .preview-toolbar > div:first-child {
    display: none;
  }

  .preview-tools {
    width: 100%;
    min-width: 0;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto;
    gap: .38rem;
    justify-content: stretch;
    flex-wrap: nowrap;
  }

  .preview-tools select {
    width: 100%;
    min-width: 0;
    min-height: 2.75rem;
    padding: .5rem .62rem;
  }

  .toggle-control {
    min-height: 2.75rem;
    padding: 0 .6rem;
    border: 1px solid #39313f;
    border-radius: .68rem;
    background: #17141b;
  }

  .toggle-control small {
    display: inline;
    white-space: nowrap;
  }

  .icon-button {
    width: 2.75rem;
    height: 2.75rem;
  }

  .preview-stage {
    flex: 1 1 auto;
    width: 100%;
    min-height: 0;
    padding: .35rem 0 calc(var(--sheet-inset, 0px) + .75rem);
    overflow: hidden;
    background: transparent;
    transition: padding-bottom var(--sheet-duration) var(--sheet-ease);
  }

  .page:not(.sheet-open) .preview-stage {
    padding-bottom: 1rem;
  }

  /* Sized by the script so the whole post always fits the free space. */
  .canvas-frame {
    width: 0;
    height: 0;
    max-width: 100%;
    max-height: 100%;
    overflow: hidden;
    border-radius: .55rem;
    box-shadow:
      0 0 0 1px rgba(157, 92, 255, .55),
      0 0 34px rgba(124, 58, 237, .32);
  }

  .preview-canvas {
    width: 100%;
    max-width: none;
    height: 100%;
    max-height: none;
    border-radius: 0;
    box-shadow: none;
  }

  .drag-hint {
    bottom: .45rem;
    max-width: calc(100% - 1rem);
    white-space: nowrap;
    opacity: 0;
  }

  .drag-hint.active {
    opacity: 1;
  }

  /* Bottom sheet */

  .controls {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 30;
    order: initial;
    width: 100%;
    max-width: 100%;
    min-width: 0;
    height: var(--sheet-height, 0px);
    max-height: 100%;
    display: flex;
    flex-direction: column;
    gap: 0;
    padding: 0;
    overflow: hidden;
    border: 1px solid #3a2d4a;
    border-bottom: 0;
    border-radius: 1.35rem 1.35rem 0 0;
    background: linear-gradient(180deg, #1a1422, #121016 5rem);
    box-shadow: 0 -18px 48px rgba(0, 0, 0, .5), 0 -1px 0 rgba(157, 92, 255, .22);
    scrollbar-gutter: auto;
    transform: translateY(0);
    transition:
      height var(--sheet-duration) var(--sheet-ease),
      transform var(--sheet-duration) var(--sheet-ease),
      visibility 0s linear 0s;
  }

  .controls.sheet-closed {
    visibility: hidden;
    transform: translateY(calc(100% + 1rem));
    transition:
      height var(--sheet-duration) var(--sheet-ease),
      transform var(--sheet-duration) var(--sheet-ease),
      visibility 0s linear var(--sheet-duration);
  }

  .controls.sheet-dragging {
    transition: none;
  }

  .mobile-sheet-head {
    flex: 0 0 auto;
    display: grid;
    padding: 0 1rem .35rem 1.15rem;
    touch-action: none;
    user-select: none;
    cursor: grab;
  }

  .sheet-handle {
    justify-self: center;
    width: 4rem;
    min-height: 1.4rem;
    display: grid;
    place-items: center;
    padding: 0;
    border: 0;
    background: transparent;
    cursor: grab;
  }

  .sheet-handle span {
    width: 2.6rem;
    height: .3rem;
    border-radius: 999px;
    background: #4a4252;
  }

  .sheet-title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: .75rem;
  }

  .sheet-title-row strong {
    font-size: 1.35rem;
    letter-spacing: -.03em;
  }

  .sheet-close {
    width: 2.6rem;
    height: 2.6rem;
    display: grid;
    place-items: center;
    padding: 0;
    border-color: #3a3241;
    border-radius: 50%;
    background: transparent;
    color: #e8e1ed;
    font-size: 1.15rem;
  }

  .controls-scroll {
    flex: 1 1 auto;
    min-height: 0;
    display: block;
    overflow-x: hidden;
    overflow-y: auto;
    padding: 0 0 .75rem;
    overscroll-behavior: contain;
    -webkit-overflow-scrolling: touch;
  }

  .controls-scroll > .workflow-card {
    display: none;
  }

  .controls.mobile-tool-photo .workflow-card:nth-child(1),
  .controls.mobile-tool-template .workflow-card:nth-child(2),
  .controls.mobile-tool-text .workflow-card:nth-child(3),
  .controls.mobile-tool-style .workflow-card:nth-child(4) {
    display: block;
  }

  .workflow-card {
    width: 100%;
    max-width: 100%;
    overflow: visible;
    border: 0;
    border-radius: 0;
    background: transparent;
    box-shadow: none;
  }

  /* The sheet has its own title; the accordion headings are desktop-only. */
  .section-heading {
    display: none;
  }

  .section-body {
    padding: .25rem 1rem .5rem;
    border-top: 0;
  }

  .controls input:not([type='checkbox']):not([type='range']),
  .controls textarea,
  .controls select,
  .controls button {
    min-height: 2.75rem;
  }

  .controls .sheet-handle {
    min-height: 1.4rem;
  }

  .mobile-only {
    display: revert;
  }

  .subheading-row {
    justify-content: space-between;
    gap: .6rem;
  }

  .chip-row,
  .template-chips {
    display: flex;
    gap: .45rem;
    max-width: 100%;
    overflow-x: auto;
    padding: .1rem 0;
    scrollbar-width: none;
  }

  .chip {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: .4rem;
    min-height: 2.6rem;
    padding: 0 1.05rem;
    border-color: #3a3241;
    border-radius: 999px;
    background: transparent;
    color: #d8d0de;
    font-size: .82rem;
    font-weight: 700;
    white-space: nowrap;
  }

  .chip.active {
    border-color: #9d5cff;
    background: linear-gradient(135deg, #7c3aed, #a855f7);
    color: #fff;
  }

  /* Foto */

  .upload-zone {
    min-height: 3.4rem;
    margin-top: .15rem;
    padding: .62rem .7rem;
  }

  .upload-icon {
    width: 2.15rem;
    height: 2.15rem;
  }

  .search-wrap {
    min-height: 2.85rem;
    margin-top: .65rem;
  }

  .media-grid {
    display: flex;
    gap: .48rem;
    max-width: 100%;
    max-height: none;
    overflow-x: auto;
    overflow-y: hidden;
    padding: 0 0 .35rem;
    scroll-snap-type: x proximity;
  }

  .media-option {
    flex: 0 0 4.65rem;
    scroll-snap-align: start;
  }

  .photo-adjust {
    display: grid;
    gap: .55rem;
    margin-top: .9rem;
    padding-top: .8rem;
    border-top: 1px solid #29232f;
    color: #bcb2c4;
    font-size: .78rem;
  }

  .photo-adjust label {
    display: grid;
    gap: .3rem;
  }

  .reset-position {
    min-height: 2.3rem !important;
    padding: 0 .75rem;
    font-size: .75rem;
  }

  .photo-adjust-hint {
    display: flex;
    align-items: center;
    gap: .4rem;
    margin: 0;
    color: #8f8797;
    font-size: .72rem;
  }

  /* Template */

  .format-grid,
  .section-body > .subheading-row {
    display: none;
  }

  .template-chips {
    margin-bottom: .85rem;
  }

  .template-grid {
    display: flex;
    gap: .6rem;
    max-width: 100%;
    overflow-x: auto;
    padding-bottom: .35rem;
    scroll-snap-type: x proximity;
  }

  .template-card {
    flex: 0 0 min(30vw, 9.5rem);
    padding: 0;
    border: 0;
    background: transparent;
    scroll-snap-align: start;
  }

  .template-card.mobile-filtered-out {
    display: none;
  }

  .template-card .template-shot {
    border: 2px solid #2f2836;
    border-radius: .8rem;
  }

  .template-card.active .template-shot {
    border-color: #a66bff;
    box-shadow: 0 0 0 2px rgba(166, 107, 255, .25), 0 10px 26px rgba(124, 58, 237, .28);
  }

  .template-card.active {
    background: transparent;
    box-shadow: none;
  }

  .template-category {
    display: none;
  }

  .template-copy {
    padding: .45rem .1rem 0;
  }

  .template-copy-head em,
  .template-copy small {
    display: none;
  }

  .template-copy-head strong {
    color: #cfc7d5;
    font-size: .8rem;
    font-weight: 600;
  }

  /* Tekst */

  .controls.mobile-tool-text .form-stack {
    display: grid;
    gap: .95rem;
  }

  .controls.mobile-tool-text .form-stack > .two {
    display: grid;
    grid-template-columns: 1fr;
    gap: .95rem;
  }

  .form-stack .field {
    margin: 0;
  }

  .controls.mobile-tool-text .field:not(.brand-field) {
    display: grid;
    grid-template-columns: 2.9rem minmax(0, 1fr);
    column-gap: .8rem;
    row-gap: .45rem;
  }

  .controls.mobile-tool-text .field > .label-row {
    display: contents;
  }

  .field-icon {
    grid-column: 1;
    grid-row: 1 / span 2;
    align-self: start;
    width: 2.9rem;
    height: 2.9rem;
    display: grid;
    place-items: center;
    border: 1px solid #3a3241;
    border-radius: .75rem;
    background: #151219;
    color: #e8e1ed;
    font-size: 1.15rem;
  }

  .controls.mobile-tool-text .field-name {
    grid-column: 2;
    grid-row: 1;
    display: grid;
    gap: .1rem;
    min-width: 0;
    padding-right: 7.5rem;
  }

  .field-label {
    color: #f3eef7;
    font-size: .88rem;
    font-weight: 800;
  }

  .field-hint {
    color: #8f8797;
    font-size: .74rem;
  }

  .controls.mobile-tool-text .field > .label-row > .field-toggle,
  .controls.mobile-tool-text .field-actions {
    grid-column: 2;
    grid-row: 1;
    justify-self: end;
    align-self: start;
  }

  .controls.mobile-tool-text .field-actions > small {
    display: none;
  }

  .controls.mobile-tool-text .field > input,
  .controls.mobile-tool-text .field > textarea {
    grid-column: 2;
    grid-row: 2;
    min-width: 0;
    min-height: 2.9rem;
    padding: .6rem .75rem;
    border-color: #3a3241;
    background: #0f0d12;
    font-size: .88rem;
  }

  .controls.mobile-tool-text textarea {
    height: 2.9rem;
    resize: none;
  }

  .brand-field {
    display: none !important;
  }

  .field-toggle {
    gap: .5rem;
    color: #d8d0de;
    font-size: .8rem;
  }

  .field-toggle span {
    display: none;
  }

  .field-toggle::after {
    content: 'Weergeven';
  }

  .field-toggle input,
  .row-toggle input {
    position: relative;
    width: 2.6rem;
    height: 1.45rem;
    min-height: 1.45rem !important;
    margin: 0;
    padding: 0;
    appearance: none;
    border: 0;
    border-radius: 999px;
    background: #39313f;
    cursor: pointer;
    transition: background .16s ease;
  }

  .field-toggle input::after,
  .row-toggle input::after {
    content: '';
    position: absolute;
    top: .2rem;
    left: .2rem;
    width: 1.05rem;
    height: 1.05rem;
    border-radius: 50%;
    background: #fff;
    box-shadow: 0 1px 4px rgba(0, 0, 0, .35);
    transition: transform .16s ease;
  }

  .field-toggle input:checked,
  .row-toggle input:checked {
    background: #8b5cf6;
  }

  .field-toggle input:checked::after,
  .row-toggle input:checked::after {
    transform: translateX(1.15rem);
  }

  .gig-list-editor {
    margin-top: 0;
  }

  .gig-row-fields,
  .two {
    grid-template-columns: 1fr;
  }

  /* Stijl: position moves to Foto, selects become chips. */

  .crop-control,
  .text-layout {
    display: none !important;
  }

  .style-group {
    display: grid;
    gap: .45rem;
    color: #bcb2c4;
    font-size: .78rem;
  }

  .form-stack > .style-group,
  .form-stack > label {
    margin-top: .9rem;
  }

  .form-stack > .crop-control + label:not(.crop-control) {
    margin-top: 0;
  }

  .segmented .chip {
    flex: 1 1 0;
    padding: 0 .6rem;
  }

  .brand-chip i {
    width: .8rem;
    height: .8rem;
    border-radius: 50%;
    box-shadow: 0 0 0 2px rgba(255, 255, 255, .18);
  }

  /* Bottom toolbar */

  .mobile-tool-tabs {
    position: relative;
    inset: auto;
    z-index: 45;
    flex: 0 0 auto;
    width: 100%;
    max-width: 100%;
    min-width: 0;
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: .2rem;
    min-height: calc(var(--mobile-editor-tabs-height) + env(safe-area-inset-bottom));
    padding: .45rem .3rem calc(.45rem + env(safe-area-inset-bottom));
    overflow: hidden;
    border-top: 1px solid rgba(68, 57, 77, .9);
    background: rgba(11, 9, 14, .98);
    backdrop-filter: blur(18px);
    box-shadow: 0 -12px 34px rgba(0, 0, 0, .22);
  }

  .mobile-tool-tab {
    min-width: 0;
    min-height: 3.6rem;
    display: grid;
    grid-template-rows: 1.8rem auto;
    place-items: center;
    gap: .15rem;
    padding: .25rem .05rem;
    overflow: hidden;
    border: 1px solid transparent;
    border-radius: .9rem;
    background: transparent;
    color: #a79dad;
    font-size: .72rem;
    transition: background .16s ease, color .16s ease, border-color .16s ease;
  }

  .mobile-tool-tab > span:last-child {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .mobile-tab-icon {
    display: grid;
    place-items: center;
    color: #d8d0de;
    font-size: 1.35rem;
  }

  .mobile-tool-tab.active {
    border-color: rgba(157, 92, 255, .55);
    background: rgba(124, 58, 237, .18);
    color: #c9a5ff;
  }

  .mobile-tool-tab.active .mobile-tab-icon {
    color: #c9a5ff;
  }
}

@media (max-width: 720px) and (prefers-reduced-motion: reduce) {
  .page {
    --sheet-duration: 0s;
  }
}

@media (max-width: 520px) {
  .drag-hint {
    font-size: .62rem;
  }
}
</style>
