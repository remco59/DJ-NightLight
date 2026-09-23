<script setup lang="ts">
import AdminNav from '~/components/admin/AdminNav.vue'
import CanvasGhost from '~/components/video/CanvasGhost.vue'
import CanvasTransformOverlay from '~/components/video/CanvasTransformOverlay.vue'
import MobileVideoEditorHeader from '~/components/video/MobileVideoEditorHeader.vue'
import MobileVideoQuickActions from '~/components/video/MobileVideoQuickActions.vue'
import MobileVideoToolbar from '~/components/video/MobileVideoToolbar.vue'
import MobileVideoTransport from '~/components/video/MobileVideoTransport.vue'
import PanelSplitter from '~/components/video/PanelSplitter.vue'
import RemotionPreview from '~/components/video/RemotionPreview.vue'
import VideoInspector from '~/components/video/VideoInspector.vue'
import VideoMediaPanel from '~/components/video/VideoMediaPanel.vue'
import VideoTimeline from '~/components/video/VideoTimeline.vue'
import { apiErrorMessage } from '~/utils/api-error'
import {
  createVideoEditor,
  videoEditorKey,
  type EditorMediaAsset,
  type EditorRender,
} from '~/composables/useVideoEditor'
import { VIDEO_ASPECTS, formatTimecode, type MediaKind, type VideoProject } from '~~/shared/video-project'
import {
  PANEL_LIMITS,
  clampPanelSizes,
  defaultPanelSizes,
  parsePanelSizes,
  type MobileVideoTool,
  type PanelKey,
  type PanelSizes,
} from '~~/shared/video-editor-ui'

definePageMeta({ layout: false })

type ProjectResponse = {
  project: { id: string, name: string, revision: number, project: VideoProject }
  renders: EditorRender[]
}

const route = useRoute()
const id = String(route.params.id)
const { data, error } = await useFetch<ProjectResponse>(`/api/admin/video-projects/${id}`)
if (error.value || !data.value) {
  throw createError({ statusCode: error.value?.statusCode || 404, statusMessage: 'Video project not found', fatal: true })
}

const editor = createVideoEditor({
  id,
  name: data.value.project.name,
  revision: data.value.project.revision,
  project: data.value.project.project,
})
editor.state.renders = data.value.renders
provide(videoEditorKey, editor)
const { state } = editor

const tab = ref<'media' | 'templates' | 'exports'>('media')
// The editor opts out of the admin layout for a full-screen workspace; the
// back-office navigation opens as a drawer from the top bar instead.
const navOpen = ref(false)
const menuButton = ref<HTMLButtonElement | null>(null)
const navDrawer = ref<HTMLElement | null>(null)

watch(navOpen, async (open) => {
  await nextTick()
  if (open) navDrawer.value?.querySelector<HTMLElement>('a, button')?.focus()
  else menuButton.value?.focus()
})
const nameDraft = ref(state.name)
const exporting = ref(false)
const message = ref('')
const volume = ref(1)
const preview = ref<InstanceType<typeof RemotionPreview> | null>(null)
const timeline = ref<InstanceType<typeof VideoTimeline> | null>(null)
const stage = ref<HTMLElement | null>(null)
const stageSize = reactive({ width: 0, height: 0 })

// --- Mobile workspace -------------------------------------------------------------
// Below 760px the editor switches to a dedicated touch layout: compact header,
// persistent preview + mini timeline, and one tool panel picked from bottom tabs.
// The CSS media query uses the same breakpoint so the first paint already fits.

const MOBILE_QUERY = '(max-width: 760px)'
const isMobile = ref(false)
const mobileTool = ref<MobileVideoTool>('media')
const replaceKind = ref<MediaKind | null>(null)
const mobilePanelTab = computed(() => mobileTool.value === 'export' ? 'exports' : mobileTool.value === 'edit' ? 'media' : mobileTool.value)
const rendering = computed(() => state.renders.some(render => render.status === 'queued' || render.status === 'rendering'))

function startReplace() {
  const item = editor.selection.value?.item
  if (!item || item.type === 'graphic') return
  replaceKind.value = item.type
  mobileTool.value = 'media'
}

function openEdit() {
  replaceKind.value = null
  mobileTool.value = 'edit'
}

// Editor actions report refusals and adjustments through state.notice.
watch(() => state.notice, (notice) => {
  if (!notice) return
  message.value = notice
  state.notice = ''
})

// A clip and a marker are never selected at the same time.
watch(() => state.selectedId, (id) => {
  if (id) state.selectedMarkerId = null
})

watch(() => state.selectedId, () => {
  replaceKind.value = null
})
watch(mobileTool, (tool) => {
  if (tool !== 'media') replaceKind.value = null
})

let mobileQuery: MediaQueryList | null = null
function syncMobile() {
  isMobile.value = Boolean(mobileQuery?.matches)
}

async function refreshMedia() {
  try {
    const result = await $fetch<{ assets: EditorMediaAsset[] }>('/api/admin/media', { query: { kind: 'all' } })
    state.media = result.assets
  } catch (fetchError) {
    message.value = apiErrorMessage(fetchError, 'Media library could not be loaded.')
  }
}

async function refreshRenders() {
  try {
    const result = await $fetch<{ renders: EditorRender[] }>(`/api/admin/video-projects/${id}/renders`)
    state.renders = result.renders
  } catch {
    // Keep the last known list; the next poll retries.
  }
}

// --- Resizable panels (desktop) ----------------------------------------------------
// Sizes live in CSS variables on the root; limits keep the preview usable.
// Remembered per browser; storage can be unavailable, so every access is guarded.

const PANEL_STORAGE_KEY = 'nightlight:video-editor-panels'
const COMPACT_QUERY = '(max-width: 1100px)'
const panels = reactive<PanelSizes>(defaultPanelSizes(900))
const viewport = reactive({ width: 1440, height: 900, compact: false })
let panelDragBase: PanelSizes | null = null

function panelViewport() {
  return { width: viewport.width, height: viewport.height, rail: viewport.compact ? 64 : 76, inspectorVisible: !viewport.compact }
}

function applyPanels(next: PanelSizes, priority: PanelKey = 'side') {
  Object.assign(panels, clampPanelSizes(next, panelViewport(), priority))
}

const panelMax = computed(() => clampPanelSizes(
  { side: Infinity, inspector: Infinity, timeline: Infinity },
  panelViewport(),
))

function savePanels() {
  try {
    localStorage.setItem(PANEL_STORAGE_KEY, JSON.stringify(panels))
  } catch {
    // Private mode or blocked storage: sizes last for this visit only.
  }
}

function loadPanels() {
  let stored: Partial<PanelSizes> = {}
  try {
    stored = parsePanelSizes(localStorage.getItem(PANEL_STORAGE_KEY))
  } catch {
    stored = {}
  }
  applyPanels({ ...defaultPanelSizes(viewport.height), ...stored })
}

function syncViewport() {
  viewport.width = window.innerWidth
  viewport.height = window.innerHeight
  viewport.compact = window.matchMedia(COMPACT_QUERY).matches
  applyPanels({ ...panels })
}

// Dragging right grows the side panel but shrinks the inspector; dragging up grows the timeline.
const PANEL_DIRECTION: Record<PanelKey, 1 | -1> = { side: 1, inspector: -1, timeline: -1 }

function resizePanel(key: PanelKey, delta: number) {
  const base = panelDragBase || { ...panels }
  applyPanels({ ...base, [key]: base[key] + PANEL_DIRECTION[key] * delta }, key)
}

function startPanelDrag() {
  panelDragBase = { ...panels }
}

function endPanelDrag() {
  panelDragBase = null
  savePanels()
}

function stepPanel(key: PanelKey, delta: number) {
  resizePanel(key, delta)
  savePanels()
}

function resetPanel(key: PanelKey) {
  applyPanels({ ...panels, [key]: defaultPanelSizes(viewport.height)[key] }, key)
  savePanels()
}

const panelStyle = computed(() => ({
  '--side-w': `${panels.side}px`,
  '--inspector-w': `${panels.inspector}px`,
  '--timeline-h': `${panels.timeline}px`,
}))

// --- Preview sizing and transport ----------------------------------------------

const previewSize = computed(() => {
  const { width, height } = state.project
  const maxWidth = Math.max(120, stageSize.width - 32)
  const maxHeight = Math.max(160, stageSize.height - 24)
  const scale = Math.min(maxWidth / width, maxHeight / height)
  return { width: Math.floor(width * scale), height: Math.floor(height * scale), scale }
})

// Instagram Reels / Stories keep-clear areas at 1080×1920.
const safeZone = computed(() => {
  if (!state.project.showSafeZones || state.project.aspect !== '9:16') return null
  const scale = previewSize.value.scale
  return { top: 250 * scale, bottom: 420 * scale, left: 60 * scale, right: 130 * scale }
})

function seek(frame: number) {
  const clamped = Math.max(0, Math.min(editor.duration.value - 1, Math.round(frame)))
  state.frame = clamped
  preview.value?.seek(clamped)
}

function togglePlay() {
  preview.value?.toggle()
}

watch(volume, value => preview.value?.setVolume(value))
watch(() => editor.duration.value, (duration) => {
  if (state.frame >= duration) seek(duration - 1)
})

// --- Keyboard shortcuts ---------------------------------------------------------

function isTyping(target: EventTarget | null) {
  const element = target as HTMLElement | null
  return Boolean(element?.closest('input, textarea, select, [contenteditable="true"]'))
}

/**
 * With the preview focused (clicked) and a visual clip selected, the arrow keys
 * move the clip 1px (Shift: 10px); elsewhere they keep moving the playhead.
 * Repeated nudges on one clip become one undo step.
 */
function nudgeSelected(key: string, large: boolean) {
  const item = editor.selection.value?.item
  if (!item || !('transform' in item) || !document.activeElement?.closest('.canvas-layer')) return false
  const step = large ? 10 : 1
  const dx = key === 'arrowleft' ? -step : key === 'arrowright' ? step : 0
  const dy = key === 'arrowup' ? -step : key === 'arrowdown' ? step : 0
  editor.patchItem(item.id, (target) => {
    if (!('transform' in target)) return
    target.transform.x = Math.max(-5000, Math.min(5000, target.transform.x + dx))
    target.transform.y = Math.max(-5000, Math.min(5000, target.transform.y + dy))
  }, `nudge:${item.id}`)
  return true
}

function onKey(event: KeyboardEvent) {
  if (navOpen.value) {
    if (event.key === 'Escape') navOpen.value = false
    return
  }
  if (isTyping(event.target)) return
  const mod = event.metaKey || event.ctrlKey
  const key = event.key.toLowerCase()
  if (key === ' ') {
    event.preventDefault()
    togglePlay()
  } else if (mod && key === 'z') {
    event.preventDefault()
    if (event.shiftKey) editor.redo()
    else editor.undo()
  } else if (mod && key === 'y') {
    event.preventDefault()
    editor.redo()
  } else if (mod && key === 'd') {
    event.preventDefault()
    editor.duplicateSelected()
  } else if (mod && key === 's') {
    event.preventDefault()
    void editor.save()
  } else if (!mod && key === 's') {
    event.preventDefault()
    editor.splitSelected()
  } else if (!mod && (key === '\\' || key === '|')) {
    // Shift+\ arrives as | on most layouts.
    event.preventDefault()
    if (event.shiftKey || key === '|') timeline.value?.zoomToSelection()
    else timeline.value?.zoomToFit()
  } else if (!mod && key === 'm') {
    event.preventDefault()
    editor.addMarkerAtPlayhead()
  } else if (!mod && (key === '[' || key === ']')) {
    event.preventDefault()
    const target = editor.markerFrom(state.frame, key === '[' ? -1 : 1)
    if (target !== null) seek(target)
  } else if (key === 'delete' || key === 'backspace') {
    if (state.selectedMarkerId) {
      event.preventDefault()
      editor.deleteSelectedMarker()
      return
    }
    if (!state.selectedId) return
    event.preventDefault()
    if (event.shiftKey) editor.rippleDeleteSelected()
    else editor.deleteSelected()
  } else if (key.startsWith('arrow') && nudgeSelected(key, event.shiftKey)) {
    event.preventDefault()
  } else if (key === 'arrowleft' || key === 'arrowright') {
    event.preventDefault()
    const step = event.shiftKey ? state.project.fps : 1
    seek(state.frame + (key === 'arrowleft' ? -step : step))
  } else if (key === 'home') {
    seek(0)
  } else if (key === 'end') {
    seek(editor.duration.value - 1)
  } else if (key === 'escape') {
    state.selectedId = null
    state.selectedMarkerId = null
  }
}

// --- Save / export --------------------------------------------------------------

function commitName() {
  editor.rename(nameDraft.value)
  nameDraft.value = state.name
}

const saveLabel = computed(() => {
  if (state.saveState === 'saving') return 'Saving…'
  if (state.saveState === 'dirty') return 'Unsaved changes'
  if (state.saveState === 'error') return state.saveError
  return 'All changes saved'
})

async function exportVideo() {
  exporting.value = true
  message.value = ''
  try {
    await editor.save()
    if (state.saveState === 'error') throw new Error(state.saveError)
    await $fetch(`/api/admin/video-projects/${id}/render`, { method: 'POST' })
    tab.value = 'exports'
    mobileTool.value = 'export'
    await refreshRenders()
  } catch (exportError) {
    message.value = apiErrorMessage(exportError, exportError instanceof Error ? exportError.message : 'Export could not be queued.')
  } finally {
    exporting.value = false
  }
}

function beforeUnload(event: BeforeUnloadEvent) {
  if (state.saveState === 'saved') return
  void editor.save()
  event.preventDefault()
}

onBeforeRouteLeave(async () => {
  if (state.saveState !== 'saved') await editor.save()
})

let resizeObserver: ResizeObserver | null = null
let pollTimer: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  void refreshMedia()
  window.addEventListener('keydown', onKey)
  window.addEventListener('beforeunload', beforeUnload)
  resizeObserver = new ResizeObserver(([entry]) => {
    if (!entry) return
    stageSize.width = entry.contentRect.width
    stageSize.height = entry.contentRect.height
  })
  if (stage.value) resizeObserver.observe(stage.value)
  syncViewport()
  loadPanels()
  window.addEventListener('resize', syncViewport)
  mobileQuery = window.matchMedia(MOBILE_QUERY)
  syncMobile()
  mobileQuery.addEventListener('change', syncMobile)
  pollTimer = setInterval(() => {
    if (state.renders.some(render => render.status === 'queued' || render.status === 'rendering')) void refreshRenders()
  }, 3000)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  window.removeEventListener('beforeunload', beforeUnload)
  window.removeEventListener('resize', syncViewport)
  resizeObserver?.disconnect()
  mobileQuery?.removeEventListener('change', syncMobile)
  if (pollTimer) clearInterval(pollTimer)
})

useSeoMeta({ title: () => `${state.name} — Video editor`, robots: 'noindex, nofollow' })
</script>

<template>
  <div class="video-editor" :class="{ mobile: isMobile }" :style="isMobile ? undefined : panelStyle">
    <MobileVideoEditorHeader
      v-if="isMobile"
      v-model:name="nameDraft"
      :save-label="saveLabel"
      :exporting="exporting"
      @commit-name="commitName"
      @export="exportVideo"
    />
    <header v-else class="topbar">
      <button
        ref="menuButton"
        class="menu-button"
        type="button"
        title="Menu"
        aria-label="Open menu"
        aria-controls="editor-nav"
        :aria-expanded="navOpen"
        @click="navOpen = true"
      >
        <Icon name="lucide:menu" aria-hidden="true" />
      </button>
      <input v-model="nameDraft" class="name" type="text" maxlength="160" aria-label="Project name" @blur="commitName" @keydown.enter="($event.target as HTMLInputElement).blur()">
      <span class="format"><Icon name="lucide:rectangle-vertical" aria-hidden="true" /> {{ VIDEO_ASPECTS[state.project.aspect].label }}</span>
      <span class="save" :class="state.saveState" :title="state.saveError">
        <i />{{ saveLabel }}
        <button v-if="state.saveState === 'error'" class="with-icon" type="button" @click="editor.save()"><Icon name="lucide:rotate-ccw" aria-hidden="true" />Retry</button>
      </span>
      <button class="export" type="button" :disabled="exporting" @click="exportVideo"><Icon name="lucide:download" aria-hidden="true" /> {{ exporting ? 'Queueing…' : 'Export MP4' }}</button>
    </header>

    <template v-if="!isMobile">
      <aside id="editor-nav" ref="navDrawer" class="nav-drawer" :class="{ open: navOpen }" :inert="!navOpen" aria-label="Back office">
        <AdminNav />
      </aside>
      <button v-if="navOpen" class="nav-backdrop" type="button" aria-label="Close menu" @click="navOpen = false" />
    </template>

    <p v-if="message" class="banner">{{ message }} <button type="button" aria-label="Dismiss" @click="message = ''"><Icon name="lucide:x" aria-hidden="true" /></button></p>

    <div class="workspace">
      <nav v-if="!isMobile" class="rail" aria-label="Editor panels">
        <button type="button" :class="{ active: tab === 'media' }" @click="tab = 'media'"><Icon name="lucide:images" aria-hidden="true" />Media</button>
        <button type="button" :class="{ active: tab === 'templates' }" @click="tab = 'templates'"><Icon name="lucide:layout-template" aria-hidden="true" />Templates</button>
        <button type="button" :class="{ active: tab === 'exports' }" @click="tab = 'exports'"><Icon name="lucide:clapperboard" aria-hidden="true" />Exports</button>
        <NuxtLink to="/admin/post-generator/video"><Icon name="lucide:folder-open" aria-hidden="true" />Projects</NuxtLink>
      </nav>

      <VideoMediaPanel v-if="!isMobile" class="side" :tab="tab" @refresh-media="refreshMedia" @refresh-renders="refreshRenders" />

      <main class="stage-column">
        <div v-if="!isMobile" class="stage-title">Preview</div>
        <div ref="stage" class="stage" @pointerdown.self="state.selectedId = null">
          <div class="preview-wrap" :style="{ width: `${previewSize.width}px`, height: `${previewSize.height}px` }">
            <CanvasGhost v-if="!state.playing" :scale="previewSize.scale" />
            <ClientOnly>
              <RemotionPreview
                ref="preview"
                :project="state.project"
                :assets="editor.assetMap.value"
                :width="previewSize.width"
                :height="previewSize.height"
                @frame="state.frame = $event"
                @playing="state.playing = $event"
              />
            </ClientOnly>
            <CanvasTransformOverlay v-if="!state.playing" :scale="previewSize.scale" />
            <div
              v-if="safeZone"
              class="safe-zone"
              :style="{ top: `${safeZone.top}px`, bottom: `${safeZone.bottom}px`, left: `${safeZone.left}px`, right: `${safeZone.right}px` }"
              title="Keep text inside this area so Instagram UI does not cover it"
            />
          </div>
        </div>
        <MobileVideoTransport
          v-if="isMobile"
          v-model:volume="volume"
          @seek="seek"
          @toggle="togglePlay"
          @fullscreen="preview?.requestFullscreen()"
        />
        <div v-else class="transport">
          <button type="button" :title="state.playing ? 'Pause (Space)' : 'Play (Space)'" @click="togglePlay"><Icon :name="state.playing ? 'lucide:pause' : 'lucide:play'" aria-hidden="true" /></button>
          <span class="time">{{ formatTimecode(state.frame, state.project.fps) }} / {{ formatTimecode(editor.duration.value, state.project.fps) }}</span>
          <input
            class="scrub"
            type="range"
            min="0"
            :max="editor.duration.value - 1"
            :value="state.frame"
            aria-label="Playhead"
            @input="seek(Number(($event.target as HTMLInputElement).value))"
          >
          <label class="volume" title="Preview volume"><Icon :name="volume > 0 ? 'lucide:volume-2' : 'lucide:volume-x'" aria-hidden="true" /> <input v-model.number="volume" type="range" min="0" max="1" step="0.05"></label>
          <button type="button" title="Fullscreen" aria-label="Fullscreen" @click="preview?.requestFullscreen()"><Icon name="lucide:maximize" aria-hidden="true" /></button>
        </div>
      </main>

      <VideoInspector v-if="!isMobile" class="inspector-column" />

      <template v-if="!isMobile">
        <PanelSplitter
          class="split-side"
          orientation="vertical"
          label="Resize media panel"
          :value="panels.side"
          :min="PANEL_LIMITS.side.min"
          :max="panelMax.side"
          @start="startPanelDrag"
          @move="resizePanel('side', $event)"
          @end="endPanelDrag"
          @step="stepPanel('side', $event)"
          @reset="resetPanel('side')"
        />
        <PanelSplitter
          v-if="!viewport.compact"
          class="split-inspector"
          orientation="vertical"
          label="Resize inspector"
          :value="panels.inspector"
          :min="PANEL_LIMITS.inspector.min"
          :max="panelMax.inspector"
          @start="startPanelDrag"
          @move="resizePanel('inspector', $event)"
          @end="endPanelDrag"
          @step="stepPanel('inspector', $event)"
          @reset="resetPanel('inspector')"
        />
        <PanelSplitter
          class="split-timeline"
          orientation="horizontal"
          label="Resize timeline"
          :value="panels.timeline"
          :min="PANEL_LIMITS.timeline.min"
          :max="panelMax.timeline"
          @start="startPanelDrag"
          @move="resizePanel('timeline', $event)"
          @end="endPanelDrag"
          @step="stepPanel('timeline', $event)"
          @reset="resetPanel('timeline')"
        />
      </template>
    </div>

    <VideoTimeline ref="timeline" class="timeline-row" :compact="isMobile" @seek="seek" />

    <template v-if="isMobile">
      <MobileVideoQuickActions @replace="startReplace" />
      <div class="tool-panel">
        <VideoInspector v-if="mobileTool === 'edit'" mobile />
        <VideoMediaPanel
          v-else
          mobile
          :tab="mobilePanelTab"
          :replace-kind="replaceKind"
          @refresh-media="refreshMedia"
          @refresh-renders="refreshRenders"
          @template-added="openEdit"
          @replaced="openEdit"
          @cancel-replace="openEdit"
          @open-edit="openEdit"
        />
      </div>
      <MobileVideoToolbar v-model="mobileTool" :has-selection="Boolean(state.selectedId)" :rendering="rendering" />
    </template>
  </div>
</template>

<style scoped>
.video-editor {
  --ve-bg: #09080d;
  --ve-panel: #111018;
  --ve-raised: #1a1824;
  --ve-border: rgba(255, 255, 255, .08);
  --ve-text: #f4f2f8;
  --ve-muted: #9a95a8;
  --ve-accent: #7c3aed;

  display: grid;
  grid-template-columns: minmax(0, 1fr);
  grid-template-rows: 58px minmax(0, 1fr) var(--timeline-h, minmax(220px, 34vh));
  height: 100vh;
  overflow: hidden;
  background: var(--ve-bg);
  color: var(--ve-text);
}

.topbar {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0 1rem;
  border-bottom: 1px solid var(--ve-border);
  background: var(--ve-panel);
}

.menu-button {
  display: grid;
  width: 38px;
  height: 38px;
  flex: none;
  place-items: center;
  border: 1px solid var(--ve-border);
  border-radius: 9px;
  background: none;
  color: var(--ve-text);
  font-size: 1.15rem;
  cursor: pointer;
}

.menu-button:hover, .menu-button[aria-expanded="true"] { background: var(--ve-raised); }

.nav-drawer {
  position: fixed;
  inset: 0 auto 0 0;
  z-index: 40;
  display: flex;
  flex-direction: column;
  width: 17rem;
  border-right: 1px solid #26222c;
  background: #0e0c12;
  box-shadow: 18px 0 40px rgba(0, 0, 0, .45);
  transform: translateX(-105%);
  transition: transform .2s ease, visibility 0s linear .2s;
  visibility: hidden;
}

.nav-drawer.open {
  transform: translateX(0);
  visibility: visible;
  transition-delay: 0s;
}

.nav-backdrop {
  position: fixed;
  inset: 0;
  z-index: 35;
  border: 0;
  background: rgba(0, 0, 0, .58);
}

.name {
  width: min(260px, 30vw);
  padding: .4rem .6rem;
  border: 1px solid transparent;
  border-radius: 7px;
  background: transparent;
  color: var(--ve-text);
  font-weight: 700;
}

.name:hover, .name:focus { border-color: var(--ve-border); background: var(--ve-bg); }

.format {
  margin-left: auto;
  padding: .4rem .8rem;
  border: 1px solid var(--ve-border);
  border-radius: 8px;
  font-size: .82rem;
}

.save {
  display: flex;
  align-items: center;
  gap: .45rem;
  max-width: 280px;
  overflow: hidden;
  color: var(--ve-muted);
  font-size: .8rem;
  white-space: nowrap;
}

.save i {
  width: 9px;
  height: 9px;
  flex: none;
  border-radius: 50%;
  background: #22c55e;
}

.save.dirty i, .save.saving i { background: #eab308; }
.save.error { color: #fca5a5; }
.save.error i { background: #ef4444; }

.save button {
  border: 0;
  background: none;
  color: #c4b5fd;
  cursor: pointer;
}

.export {
  padding: .6rem 1.1rem;
  border: 0;
  border-radius: 9px;
  background: var(--ve-accent);
  color: #fff;
  font-weight: 800;
  cursor: pointer;
  box-shadow: 0 0 22px rgba(124, 58, 237, .45);
}

.export:disabled { opacity: .7; cursor: progress; }

.banner {
  position: fixed;
  top: 66px;
  left: 50%;
  z-index: 20;
  display: flex;
  gap: 1rem;
  justify-content: space-between;
  max-width: min(640px, calc(100vw - 32px));
  margin: 0;
  padding: .6rem 1rem;
  border-radius: 10px;
  transform: translateX(-50%);
  background: #3b0d17;
  box-shadow: 0 12px 30px rgba(0, 0, 0, .45);
  color: #fecaca;
  font-size: .85rem;
}

.banner button {
  display: flex;
  border: 0;
  background: none;
  color: inherit;
  cursor: pointer;
}

.workspace {
  --rail-w: 76px;

  position: relative;
  display: grid;
  grid-template-columns: var(--rail-w) var(--side-w, 300px) minmax(0, 1fr) var(--inspector-w, 320px);
  min-height: 0;
}

.split-side { left: calc(var(--rail-w) + var(--side-w, 300px)); }
/* Handles are 9px wide and centred on the panel borders. */
.split-inspector { right: calc(var(--inspector-w, 320px) - 4.5px); }
.split-timeline { bottom: -4.5px; }

.rail {
  display: flex;
  flex-direction: column;
  gap: .3rem;
  padding: .6rem .4rem;
  border-right: 1px solid var(--ve-border);
  background: var(--ve-panel);
}

.rail button, .rail a {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: .25rem;
  padding: .6rem .2rem;
  border: 0;
  border-radius: 9px;
  background: none;
  color: var(--ve-muted);
  font-size: .72rem;
  text-decoration: none;
  cursor: pointer;
}

.rail svg { width: 20px; height: 20px; }

.rail .active {
  background: rgba(124, 58, 237, .22);
  color: var(--ve-text);
}

.side {
  border-right: 1px solid var(--ve-border);
  background: var(--ve-panel);
}

.stage-column {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

.stage-title {
  padding: .7rem 1rem 0;
  font-size: .85rem;
  font-weight: 700;
}

.stage {
  display: grid;
  flex: 1;
  min-height: 0;
  place-items: center;
  overflow: hidden;
}

.preview-wrap {
  position: relative;
}

.safe-zone {
  position: absolute;
  border: 1px dashed rgba(250, 204, 21, .55);
  pointer-events: none;
}

.transport {
  display: flex;
  align-items: center;
  gap: .8rem;
  padding: .5rem 1rem .8rem;
}

.transport button {
  display: grid;
  place-items: center;
  font-size: 1.1rem;
  width: 34px;
  height: 34px;
  border: 0;
  border-radius: 8px;
  background: none;
  color: var(--ve-text);
  cursor: pointer;
}

.transport button:hover { background: var(--ve-raised); }

.time {
  font-size: .85rem;
  font-variant-numeric: tabular-nums;
}

.scrub {
  flex: 1;
  accent-color: var(--ve-accent);
}

.volume {
  display: flex;
  align-items: center;
  gap: .3rem;
}

.volume input {
  width: 70px;
  accent-color: var(--ve-accent);
}

@media (max-width: 1100px) {
  .workspace {
    --rail-w: 64px;

    grid-template-columns: var(--rail-w) var(--side-w, 240px) minmax(0, 1fr);
  }

  .inspector-column { display: none; }
}

/* --- Mobile workspace ------------------------------------------------------------ */
/* Media query (not the .mobile class) so the server-rendered first paint already
   uses the viewport-sized layout before the mobile components mount. */

@media (max-width: 760px) {
  .video-editor {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100vh;
    height: 100dvh;
    overflow: hidden;
    overscroll-behavior: none;
  }

  .topbar, .rail, .side, .inspector-column, .stage-title { display: none; }

  .workspace {
    display: block;
    flex: none;
  }

  .stage-column { display: block; }

  /* Persistent preview: roughly a third of the viewport, never scrolls away. */
  .stage {
    height: clamp(150px, 32dvh, 440px);
  }

  .timeline-row {
    flex: none;
    height: 126px;
  }

  .tool-panel {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    min-height: 0;
    background: var(--ve-bg);
  }

  .tool-panel > * {
    flex: 1;
    min-height: 0;
    background: var(--ve-bg);
  }

  .banner { top: calc(env(safe-area-inset-top) + 96px); }
}

/* Short landscape phones: give the tool panel room by shrinking the preview. */
@media (max-width: 760px) and (max-height: 560px) {
  .stage { height: 30dvh; }
  .timeline-row { height: 106px; }
}
</style>
