<script setup lang="ts">
import MediaPicker from '~/components/admin/MediaPicker.vue'
import PostCanvasStage from '~/components/post-editor/PostCanvasStage.vue'
import PostInspector from '~/components/post-editor/PostInspector.vue'
import PostRecentExports from '~/components/post-editor/PostRecentExports.vue'
import PostTemplateBrowser from '~/components/post-editor/PostTemplateBrowser.vue'
import { usePostEditor, type PostCanvasSelection, type PostEditorTool } from '~/composables/usePostEditor'

// Desktop layout of the post editor: tool tabs + contextual inspector on the
// left, a large persistent canvas on the right, all within the viewport.
const editor = usePostEditor()
const { design, busy, message, lastRenderedUrl, canUndo, canRedo } = editor

const tool = ref<PostEditorTool>('media')
const inspectorCollapsed = ref(false)
const selection = ref<PostCanvasSelection>('none')
const exportsOpen = ref(false)
const templatesOpen = ref(false)
const mediaPickerOpen = ref(false)
const previewUrl = ref('')
const previewBusy = ref(false)
const previewCloseRef = ref<HTMLButtonElement | null>(null)
const stageRef = ref<InstanceType<typeof PostCanvasStage> | null>(null)
const modKey = ref('Ctrl')

const selectionTool = computed<PostEditorTool | null>(() => {
  if (selection.value === 'image') return 'media'
  if (selection.value === 'text') return 'text'
  return null
})
const selectedAssetUrl = computed(() => editor.selectedAsset.value?.url ?? null)
const anyDialogOpen = computed(() => exportsOpen.value || templatesOpen.value || mediaPickerOpen.value || Boolean(previewUrl.value))

function activateTool(next: PostEditorTool) {
  tool.value = next
  inspectorCollapsed.value = false
}

// --- Template thumbnails ---------------------------------------------------------
// Rendered from the current photo and copy so each card shows the real result.

const thumbnails = ref<Record<string, string>>({})
let thumbnailTimer: ReturnType<typeof setTimeout> | null = null
let thumbnailRun = 0
let thumbnailsFor = ''

const thumbnailInputs = computed(() => {
  const { showSafeArea: _view, ...rest } = design
  return JSON.stringify({ rest, source: editor.sourceVersion.value })
})
const thumbnailsNeeded = computed(() => tool.value === 'template' || templatesOpen.value)

async function renderThumbnails(inputs: string) {
  const run = ++thumbnailRun
  const next: Record<string, string> = {}
  for (const template of editor.templates) {
    const url = await editor.renderTemplateThumbnail(template.key)
    if (run !== thumbnailRun) return
    if (url) next[template.key] = url
  }
  thumbnails.value = next
  if (Object.keys(next).length) thumbnailsFor = inputs
}

watch([thumbnailInputs, thumbnailsNeeded], ([inputs, needed]) => {
  if (!needed || !import.meta.client || inputs === thumbnailsFor) return
  if (thumbnailTimer) clearTimeout(thumbnailTimer)
  // Render straight away the first time; let typing settle before re-rendering six posts.
  const delay = Object.keys(thumbnails.value).length ? 450 : 0
  thumbnailTimer = setTimeout(() => void renderThumbnails(inputs).catch(() => {}), delay)
}, { immediate: true })

// --- Preview --------------------------------------------------------------------

async function openPreview() {
  if (!editor.selectedAsset.value) {
    message.value = 'Kies eerst een foto.'
    return
  }
  previewBusy.value = true
  try {
    const blob = await editor.renderExportBlob()
    previewUrl.value = URL.createObjectURL(blob)
    await nextTick()
    previewCloseRef.value?.focus()
  } catch (error) {
    message.value = error instanceof Error ? error.message : 'Voorbeeld maken is niet gelukt.'
  } finally {
    previewBusy.value = false
  }
}

function closePreview() {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  previewUrl.value = ''
}

async function exportFromPreview() {
  closePreview()
  await editor.exportPost()
}

// --- Messages --------------------------------------------------------------------

let messageTimer: ReturnType<typeof setTimeout> | null = null
watch(message, (value) => {
  if (messageTimer) clearTimeout(messageTimer)
  if (value) messageTimer = setTimeout(() => { message.value = '' }, 8000)
})

// --- Keyboard shortcuts ------------------------------------------------------------

function isTyping(target: EventTarget | null) {
  const element = target as HTMLElement | null
  return Boolean(element?.closest('input, textarea, select, [contenteditable="true"]'))
}

function onKey(event: KeyboardEvent) {
  if (anyDialogOpen.value) {
    if (event.key === 'Escape' && previewUrl.value) closePreview()
    return
  }
  const mod = event.metaKey || event.ctrlKey
  const key = event.key.toLowerCase()

  // Undo/redo work everywhere except inside text fields, which keep their own undo.
  if (mod && key === 'z' && !isTyping(event.target)) {
    event.preventDefault()
    if (event.shiftKey) editor.redo()
    else editor.undo()
    return
  }
  if (mod && key === 'y' && !isTyping(event.target)) {
    event.preventDefault()
    editor.redo()
    return
  }
  if (isTyping(event.target)) return

  if (mod && (key === '=' || key === '+')) {
    event.preventDefault()
    stageRef.value?.zoomBy(1)
  } else if (mod && key === '-') {
    event.preventDefault()
    stageRef.value?.zoomBy(-1)
  } else if (mod && key === '0') {
    event.preventDefault()
    stageRef.value?.fit()
  } else if (event.shiftKey && event.code === 'Digit1') {
    event.preventDefault()
    stageRef.value?.fit()
  } else if (event.key === 'Escape') {
    selection.value = 'none'
  }
}

onMounted(() => {
  if (/Mac|iPhone|iPad/.test(navigator.platform)) modKey.value = '⌘'
  window.addEventListener('keydown', onKey)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  if (thumbnailTimer) clearTimeout(thumbnailTimer)
  if (messageTimer) clearTimeout(messageTimer)
  thumbnailRun += 1
  closePreview()
})
</script>

<template>
  <div class="desktop-editor">
    <header class="editor-header">
      <div class="editor-title">
        <p class="breadcrumb">Content <Icon name="lucide:chevron-right" aria-hidden="true" /> Post generator</p>
        <h1>Postgenerator</h1>
        <p class="subtitle">Maak social-afbeeldingen in NightLight-huisstijl, los van een gig.</p>
      </div>

      <div class="editor-actions">
        <div class="action-group" role="group" aria-label="Geschiedenis">
          <button
            type="button"
            class="icon-action"
            aria-label="Ongedaan maken"
            :title="`Ongedaan maken (${modKey}+Z)`"
            aria-keyshortcuts="Control+Z Meta+Z"
            :disabled="!canUndo"
            @click="editor.undo()"
          >
            <Icon name="lucide:undo-2" aria-hidden="true" />
          </button>
          <button
            type="button"
            class="icon-action"
            aria-label="Opnieuw"
            :title="`Opnieuw (${modKey}+Shift+Z)`"
            aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z"
            :disabled="!canRedo"
            @click="editor.redo()"
          >
            <Icon name="lucide:redo-2" aria-hidden="true" />
          </button>
        </div>

        <nav class="mode-switch" aria-label="Editormodus">
          <span class="mode active" aria-current="page"><Icon name="lucide:image" aria-hidden="true" /> Afbeelding</span>
          <NuxtLink class="mode" to="/admin/post-generator/video"><Icon name="lucide:film" aria-hidden="true" /> Video</NuxtLink>
        </nav>

        <button type="button" class="action" aria-label="Voorbeeld" :disabled="previewBusy || !editor.selectedAsset.value" title="Bekijk de post zonder hulplijnen" @click="openPreview">
          <Icon name="lucide:eye" aria-hidden="true" />
          <span class="action-label">{{ previewBusy ? 'Renderen…' : 'Voorbeeld' }}</span>
        </button>
        <button
          type="button"
          class="action primary"
          :disabled="busy === 'render' || !editor.readyToExport.value"
          @click="editor.exportPost()"
        >
          {{ busy === 'render' ? 'Exporteren…' : 'Post exporteren' }}
          <Icon v-if="busy !== 'render'" name="lucide:arrow-right" aria-hidden="true" />
        </button>
        <button type="button" class="action" aria-label="Recente exports" aria-haspopup="dialog" :aria-expanded="exportsOpen" title="Recente exports" @click="exportsOpen = true">
          <Icon name="lucide:history" aria-hidden="true" />
          <span class="action-label">Recente exports</span>
          <span v-if="editor.posts.value.length" class="count">{{ editor.posts.value.length }}</span>
        </button>
      </div>
    </header>

    <div class="workspace" :class="{ 'inspector-collapsed': inspectorCollapsed }">
      <PostInspector
        v-model:tool="tool"
        v-model:collapsed="inspectorCollapsed"
        :thumbnails="thumbnails"
        :hint="selectionTool"
        @browse-templates="templatesOpen = true"
        @browse-media="mediaPickerOpen = true"
      />
      <PostCanvasStage
        ref="stageRef"
        v-model:selection="selection"
        v-model:inspector-collapsed="inspectorCollapsed"
        @activate-tool="activateTool"
      />
    </div>

    <div class="toast-region" role="status" aria-live="polite">
      <div v-if="message" class="toast">
        <span>{{ message }}</span>
        <a v-if="lastRenderedUrl && busy !== 'render'" :href="lastRenderedUrl" download="nightlight-post.png">PNG downloaden</a>
        <button type="button" aria-label="Sluiten" @click="message = ''"><Icon name="lucide:x" aria-hidden="true" /></button>
      </div>
    </div>

    <PostRecentExports v-model:open="exportsOpen" />
    <PostTemplateBrowser v-model:open="templatesOpen" :thumbnails="thumbnails" />
    <MediaPicker
      v-model:open="mediaPickerOpen"
      :model-value="selectedAssetUrl"
      label="Bronfoto"
      bare
      :allow-external="false"
      upload-tags="post-generator"
      @selected="asset => editor.selectAsset(asset.id)"
    />

    <Teleport to="body">
      <div v-if="previewUrl" class="preview-backdrop" @click.self="closePreview">
        <section class="preview-dialog" role="dialog" aria-modal="true" aria-label="Voorbeeld van de post">
          <img :src="previewUrl" alt="Voorbeeld van de geëxporteerde post">
          <footer class="preview-footer">
            <span>Precies zoals geëxporteerd · zonder hulplijnen · {{ design.preset === 'story' ? '9:16' : design.preset === 'portrait' ? '4:5' : '1:1' }}</span>
            <div>
              <button ref="previewCloseRef" type="button" class="action" @click="closePreview">Sluiten</button>
              <button type="button" class="action primary" :disabled="busy === 'render' || !editor.readyToExport.value" @click="exportFromPreview">
                Post exporteren <Icon name="lucide:arrow-right" aria-hidden="true" />
              </button>
            </div>
          </footer>
        </section>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.desktop-editor {
  container: post-editor / inline-size;
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
}

.editor-header {
  flex: 0 0 auto;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: .75rem 1.5rem;
  min-width: 0;
}

.editor-title {
  min-width: 0;
}

.editor-title h1,
.subtitle {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.breadcrumb {
  display: flex;
  align-items: center;
  gap: .35rem;
  margin: 0 0 .35rem;
  color: #b18cff;
  font-size: .66rem;
  font-weight: 750;
  letter-spacing: .14em;
  text-transform: uppercase;
}

h1 {
  margin: 0;
  font-size: clamp(1.35rem, 2.2cqi, 2rem);
  line-height: 1.1;
  letter-spacing: -.03em;
}

.subtitle {
  margin: .35rem 0 0;
  color: #8f8798;
  font-size: .82rem;
}

.editor-actions {
  display: flex;
  flex: 0 0 auto;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: .6rem;
}

.action-group,
.mode-switch {
  display: inline-flex;
  align-items: center;
  gap: .15rem;
  padding: .2rem;
  border: 1px solid #2a2530;
  border-radius: .7rem;
  background: #111015;
}

.icon-action {
  display: grid;
  width: 2.2rem;
  height: 2.2rem;
  place-items: center;
  border: 0;
  border-radius: .5rem;
  background: transparent;
  color: #d9d2e1;
  font-size: 1.05rem;
  cursor: pointer;
}

.icon-action:hover:not(:disabled) {
  background: #1f1b25;
  color: #fff;
}

.icon-action:disabled {
  cursor: not-allowed;
  opacity: .35;
}

.mode {
  display: inline-flex;
  align-items: center;
  gap: .45rem;
  padding: .5rem .8rem;
  border: 1px solid transparent;
  border-radius: .5rem;
  color: #a89fb2;
  font-size: .8rem;
  text-decoration: none;
}

.mode:hover {
  color: #fff;
}

.mode.active {
  border-color: #6d4bb0;
  background: rgba(124, 58, 237, .18);
  color: #fff;
}

.action {
  display: inline-flex;
  align-items: center;
  gap: .45rem;
  min-height: 2.65rem;
  padding: 0 .95rem;
  border: 1px solid #2a2530;
  border-radius: .7rem;
  background: #111015;
  color: #ece7f1;
  font-size: .82rem;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
  transition: border-color .15s ease, background .15s ease;
}

.action:hover:not(:disabled) {
  border-color: #3f3748;
  background: #17141c;
}

.action:disabled {
  cursor: not-allowed;
  opacity: .5;
}

.action.primary {
  border-color: #8b5cf6;
  background: #7c3aed;
  color: #fff;
  box-shadow: 0 10px 28px rgba(124, 58, 237, .28);
}

.action.primary:hover:not(:disabled) {
  border-color: #a47bff;
  background: #8b4cf6;
}

.count {
  min-width: 1.3rem;
  padding: .05rem .35rem;
  border-radius: 999px;
  background: #221d29;
  color: #b8afc2;
  font-size: .68rem;
  text-align: center;
}

.workspace {
  flex: 1 1 auto;
  display: grid;
  grid-template-columns: clamp(300px, 25cqi, 340px) minmax(0, 1fr);
  gap: 1rem;
  min-width: 0;
  min-height: 0;
}

.workspace.inspector-collapsed {
  grid-template-columns: 3.4rem minmax(0, 1fr);
}

.toast {
  position: absolute;
  right: 1rem;
  bottom: 4.5rem;
  z-index: 30;
  display: flex;
  align-items: center;
  gap: .8rem;
  max-width: min(32rem, calc(100% - 2rem));
  padding: .7rem .7rem .7rem 1rem;
  border: 1px solid #3a2f4a;
  border-radius: .8rem;
  background: rgba(20, 16, 26, .96);
  color: #e8e3ee;
  font-size: .8rem;
  box-shadow: 0 18px 44px rgba(0, 0, 0, .45);
}

.toast a {
  color: #c9a5ff;
  font-weight: 700;
  white-space: nowrap;
}

.toast button {
  display: grid;
  width: 1.8rem;
  height: 1.8rem;
  place-items: center;
  border: 0;
  border-radius: .45rem;
  background: transparent;
  color: #8f8798;
  cursor: pointer;
}

.toast button:hover {
  background: #221d29;
  color: #fff;
}

.preview-backdrop {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: grid;
  place-items: center;
  padding: 1.5rem;
  background: rgba(4, 3, 6, .88);
  backdrop-filter: blur(10px);
}

.preview-dialog {
  display: grid;
  justify-items: center;
  gap: .9rem;
  max-width: 100%;
  max-height: 100%;
}

.preview-dialog img {
  max-width: min(100%, 1080px);
  max-height: calc(100dvh - 7rem);
  object-fit: contain;
  box-shadow: 0 30px 100px rgba(0, 0, 0, .6);
}

.preview-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  width: 100%;
  color: #8f8798;
  font-size: .76rem;
}

.preview-footer div {
  display: flex;
  gap: .5rem;
}

@container post-editor (max-width: 1100px) {
  .action-label {
    display: none;
  }

  .subtitle {
    display: none;
  }
}

/* Too narrow for title and actions side by side: actions go below the title. */
@container post-editor (max-width: 900px) {
  .editor-header {
    flex-wrap: wrap;
  }

  .editor-actions {
    justify-content: flex-start;
  }
}
</style>
