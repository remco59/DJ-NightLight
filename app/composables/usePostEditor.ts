import type { InjectionKey, Ref } from 'vue'
import { apiErrorMessage } from '~/utils/api-error'
import { createMediaThumbnail } from '~/utils/media-upload'
import { renderPostCanvas, type PostTextBox } from '~/utils/post-renderer'
import {
  applyPostTemplate,
  coverImageRect,
  defaultPostDesign,
  POST_PRESETS,
  POST_TEMPLATES,
  restorePostDesign,
  type PostDesign,
  type PostTemplateKey,
} from '~~/shared/post-generator'
import {
  createHistory,
  recordHistory,
  redoHistory,
  undoHistory,
} from '~~/shared/video-timeline'

export type PostMediaAsset = {
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

export type GeneratedPost = {
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

export type PostGeneratorData = {
  assets: PostMediaAsset[]
  posts: GeneratedPost[]
}

export type PostEditorTool = 'media' | 'template' | 'text' | 'design' | 'effects'
export type PostCanvasSelection = 'none' | 'image' | 'text'

export const POST_BRANDS = [
  { key: 'night' as const, label: 'NightLight', description: 'Purple nightlife accent.', colors: ['#9d5cff', '#17131d', '#858093', '#f7f4fb'] },
  { key: 'mono' as const, label: 'Mono', description: 'Black & white.', colors: ['#ffffff', '#0d0b10', '#77717d', '#d8d4dc'] },
  { key: 'warm' as const, label: 'Warm', description: 'Warm orange accent.', colors: ['#ff7a45', '#1c1210', '#9f7465', '#fff3eb'] },
]

export const POST_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

const COALESCE_MS = 800

export function createPostEditor(options: {
  data: Ref<PostGeneratorData | null | undefined>
  refresh: () => Promise<void>
}) {
  const { data, refresh } = options

  const design = reactive<PostDesign>(defaultPostDesign())
  const sourceAssetId = ref('')
  const busy = ref('')
  const message = ref('')
  const lastRenderedUrl = ref('')
  /** Natural size of the loaded source photo, for canvas overlays. */
  const sourceSize = reactive({ width: 0, height: 0 })
  /** Bumped whenever a new source bitmap is ready. */
  const sourceVersion = ref(0)
  /** Text bounds from the latest preview render, in export pixels. */
  const textBoxes = shallowRef<PostTextBox[]>([])

  const assets = computed(() => data.value?.assets || [])
  const posts = computed(() => data.value?.posts || [])
  const selectedAsset = computed(() => assets.value.find(asset => asset.id === sourceAssetId.value) || null)
  const readyToExport = computed(() => Boolean(
    selectedAsset.value
    && (!design.visibility.headline || design.headline.trim()),
  ))
  /** Media used by earlier exports, newest first. */
  const recentAssets = computed(() => {
    const seen = new Set<string>()
    const recent: PostMediaAsset[] = []
    for (const post of posts.value) {
      const asset = post.sourceMediaAssetId && !seen.has(post.sourceMediaAssetId)
        ? assets.value.find(item => item.id === post.sourceMediaAssetId)
        : null
      if (post.sourceMediaAssetId) seen.add(post.sourceMediaAssetId)
      if (asset) recent.push(asset)
    }
    return recent
  })

  // --- Rendering ----------------------------------------------------------------

  const canvases = new Set<HTMLCanvasElement>()
  let sourceBitmap: ImageBitmap | null = null
  let loadToken = 0
  let rendering: Promise<void> | null = null
  let renderQueued = false

  function registerCanvas(canvas: HTMLCanvasElement) {
    canvases.add(canvas)
    void renderPreview()
  }

  function unregisterCanvas(canvas: HTMLCanvasElement) {
    canvases.delete(canvas)
  }

  async function drawPreviews() {
    await nextTick()
    if (!sourceBitmap) return
    for (const canvas of canvases) {
      const boxes: PostTextBox[] = []
      await renderPostCanvas(canvas, sourceBitmap, design, true, boxes)
      textBoxes.value = boxes
    }
  }

  /** Render the preview canvases; overlapping requests collapse into one extra pass. */
  function renderPreview() {
    if (rendering) {
      renderQueued = true
      return rendering
    }
    rendering = (async () => {
      do {
        renderQueued = false
        try {
          await drawPreviews()
        } catch {
          // A bitmap swapped mid-render; the queued pass draws the new one.
        }
      } while (renderQueued)
    })().finally(() => {
      rendering = null
    })
    return rendering
  }

  async function loadSelectedSource() {
    const token = ++loadToken
    const asset = selectedAsset.value
    if (!asset || !import.meta.client) {
      sourceBitmap?.close()
      sourceBitmap = null
      sourceSize.width = 0
      sourceSize.height = 0
      return
    }
    const response = await fetch(asset.url)
    if (!response.ok) throw new Error('Could not load selected media')
    const bitmap = await createImageBitmap(await response.blob())
    if (token !== loadToken) {
      bitmap.close()
      return
    }
    await rendering
    sourceBitmap?.close()
    sourceBitmap = bitmap
    sourceSize.width = bitmap.width
    sourceSize.height = bitmap.height
    sourceVersion.value += 1
    await renderPreview()
  }

  /** The photo's full drawn rectangle in export pixels (it may extend past the canvas). */
  const imageRect = computed(() => {
    if (!sourceSize.width || !sourceSize.height) return null
    const target = POST_PRESETS[design.preset]
    return coverImageRect({
      sourceWidth: sourceSize.width,
      sourceHeight: sourceSize.height,
      targetWidth: target.width,
      targetHeight: target.height,
      zoom: design.zoom,
      imageX: design.imageX,
      imageY: design.imageY,
    })
  })

  /** Render the post without guides, exactly as it is exported. */
  async function renderExportBlob() {
    if (!sourceBitmap) throw new Error('Select a photo first.')
    const canvas = document.createElement('canvas')
    await renderPostCanvas(canvas, sourceBitmap, design, false)
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(result => result ? resolve(result) : reject(new Error('PNG export failed')), 'image/png')
    })
  }

  /** Small preview of the post with another template applied, for template cards. */
  async function renderTemplateThumbnail(templateKey: PostTemplateKey, maxSize = 360) {
    if (!sourceBitmap) return null
    const full = document.createElement('canvas')
    await renderPostCanvas(full, sourceBitmap, applyPostTemplate(design, templateKey), false)
    const scale = Math.min(1, maxSize / full.width, maxSize / full.height)
    const thumb = document.createElement('canvas')
    thumb.width = Math.round(full.width * scale)
    thumb.height = Math.round(full.height * scale)
    const context = thumb.getContext('2d')
    if (!context) return null
    context.imageSmoothingQuality = 'high'
    context.drawImage(full, 0, 0, thumb.width, thumb.height)
    return thumb.toDataURL('image/jpeg', .82)
  }

  // --- Undo / redo ----------------------------------------------------------------
  // Every change to the design or source photo is recorded by watching a
  // serialised snapshot, so v-model bindings anywhere in the editor are
  // undoable. Safe-area guides are a view setting and are not recorded.

  type Snapshot = { design: Omit<PostDesign, 'showSafeArea'>, sourceAssetId: string }

  let history = createHistory<string>()
  const canUndo = ref(false)
  const canRedo = ref(false)
  let current = ''
  let lastKey = ''
  let lastAt = 0
  let transientBase: string | null = null

  function historySource() {
    const { showSafeArea: _view, ...rest } = design
    return JSON.stringify({ design: rest, sourceAssetId: sourceAssetId.value } satisfies Snapshot)
  }

  function syncHistoryFlags() {
    canUndo.value = history.past.length > 0
    canRedo.value = history.future.length > 0
  }

  function changedKeys(previous: string, next: string) {
    const a = JSON.parse(previous) as Snapshot
    const b = JSON.parse(next) as Snapshot
    const keys = (Object.keys(b.design) as Array<keyof Snapshot['design']>)
      .filter(key => JSON.stringify(a.design[key]) !== JSON.stringify(b.design[key]))
    if (a.sourceAssetId !== b.sourceAssetId) keys.push('source' as never)
    return keys.join(',')
  }

  watch(historySource, (next) => {
    if (next === current || transientBase !== null) return
    const key = changedKeys(current, next)
    const now = Date.now()
    // Typing and slider drags on the same field collapse into one step.
    if (key === lastKey && now - lastAt < COALESCE_MS && history.past.length) {
      history = { past: history.past, future: [] }
    } else {
      history = recordHistory(history, current)
    }
    lastKey = key
    lastAt = now
    current = next
    syncHistoryFlags()
  })

  function applySnapshot(value: string) {
    const snapshot = JSON.parse(value) as Snapshot
    Object.assign(design, snapshot.design)
    sourceAssetId.value = snapshot.sourceAssetId
    current = historySource()
    lastKey = ''
    syncHistoryFlags()
  }

  function undo() {
    const result = undoHistory(history, current)
    if (!result) return
    history = result.history
    applySnapshot(result.value)
  }

  function redo() {
    const result = redoHistory(history, current)
    if (!result) return
    history = result.history
    applySnapshot(result.value)
  }

  function resetHistory() {
    history = createHistory<string>()
    current = historySource()
    lastKey = ''
    transientBase = null
    syncHistoryFlags()
  }

  /** Canvas drags update live and become a single undo step when they end. */
  function beginTransient() {
    transientBase = current
  }

  function endTransient() {
    if (transientBase === null) return
    const next = historySource()
    if (next !== transientBase) history = recordHistory(history, transientBase)
    current = next
    transientBase = null
    lastKey = ''
    syncHistoryFlags()
  }

  // --- Editing actions --------------------------------------------------------------

  function applyTemplate(templateKey: PostTemplateKey) {
    Object.assign(design, applyPostTemplate(design, templateKey))
  }

  function resetImagePosition() {
    design.imageX = 0
    design.imageY = 0
    design.zoom = 1
  }

  function addGigItem() {
    if (design.gigItems.length >= 6) return
    design.gigItems.push({ enabled: true, dateText: '', title: '', locationText: '' })
  }

  function removeGigItem(index: number) {
    design.gigItems.splice(index, 1)
  }

  /** Load an earlier export's design (and photo, if it still exists) back into the editor. */
  function reuseExport(post: GeneratedPost) {
    Object.assign(design, restorePostDesign(design, post.design))
    if (post.sourceMediaAssetId && assets.value.some(asset => asset.id === post.sourceMediaAssetId)) {
      sourceAssetId.value = post.sourceMediaAssetId
      message.value = 'Loaded the design from this export.'
    } else {
      message.value = 'Loaded the design; its photo is no longer in the media library.'
    }
  }

  async function uploadSource(file: File) {
    if (!POST_IMAGE_TYPES.includes(file.type)) {
      message.value = 'Choose a JPEG, PNG or WebP image.'
      return false
    }
    busy.value = 'upload'
    message.value = ''
    try {
      const thumbnail = await createMediaThumbnail(file)
      const form = new FormData()
      form.append('file', file)
      form.append('thumbnail', thumbnail, 'thumbnail.jpg')
      form.append('title', file.name.replace(/\.[^.]+$/, ''))
      form.append('altText', '')
      form.append('tags', 'post-generator')
      form.append('gigId', '')
      form.append('venueId', '')
      const result = await $fetch<{ asset: { id: string } }>('/api/admin/media', { method: 'POST', body: form })
      await refresh()
      sourceAssetId.value = result.asset.id
      message.value = 'Photo uploaded to the media library and selected.'
      return true
    } catch (error) {
      message.value = apiErrorMessage(error, error instanceof Error ? error.message : 'Upload failed.')
      return false
    } finally {
      busy.value = ''
    }
  }

  /** Select a media-library asset, refreshing the list when it is new (e.g. uploaded in the full picker). */
  async function selectAsset(id: string) {
    if (!assets.value.some(asset => asset.id === id)) await refresh()
    sourceAssetId.value = id
  }

  async function exportPost() {
    if (!sourceBitmap || !selectedAsset.value) {
      message.value = 'Select a photo first.'
      return
    }
    busy.value = 'render'
    message.value = ''
    try {
      const blob = await renderExportBlob()
      const form = new FormData()
      form.append('file', blob, 'nightlight-' + design.preset + '.png')
      form.append('design', JSON.stringify(design))
      form.append('sourceMediaAssetId', selectedAsset.value.id)
      const result = await $fetch<{ post: { id: string, imageUrl: string } }>('/api/admin/post-generator/render', {
        method: 'POST',
        body: form,
      })
      lastRenderedUrl.value = result.post.imageUrl
      message.value = 'Post exported. The PNG is saved in Recent exports.'
      await refresh()
    } catch (error) {
      message.value = apiErrorMessage(error, error instanceof Error ? error.message : 'Export failed.')
    } finally {
      busy.value = ''
    }
  }

  async function deletePost(post: GeneratedPost) {
    if (!confirm('Delete this exported post?')) return
    busy.value = post.id
    try {
      const response = await fetch('/api/admin/post-generator/' + post.id, { method: 'DELETE' })
      if (!response.ok) throw new Error('Could not delete exported post')
      if (lastRenderedUrl.value === post.imageUrl) lastRenderedUrl.value = ''
      await refresh()
    } catch (error) {
      message.value = error instanceof Error ? error.message : 'Delete failed.'
    } finally {
      busy.value = ''
    }
  }

  watch(sourceAssetId, () => {
    void loadSelectedSource().catch((error) => {
      message.value = error instanceof Error ? error.message : 'Could not load photo.'
    })
  })
  watch(design, () => void renderPreview(), { deep: true })

  onMounted(() => {
    if (!sourceAssetId.value && assets.value[0]) sourceAssetId.value = assets.value[0].id
    else void loadSelectedSource()
    // Picking the initial photo is not an edit.
    resetHistory()
  })

  onBeforeUnmount(() => {
    loadToken += 1
    sourceBitmap?.close()
    sourceBitmap = null
    canvases.clear()
  })

  return {
    design,
    sourceAssetId,
    busy,
    message,
    lastRenderedUrl,
    sourceSize,
    sourceVersion,
    textBoxes,
    assets,
    posts,
    recentAssets,
    selectedAsset,
    readyToExport,
    imageRect,
    templates: POST_TEMPLATES,
    brands: POST_BRANDS,
    canUndo,
    canRedo,
    registerCanvas,
    unregisterCanvas,
    renderPreview,
    renderExportBlob,
    renderTemplateThumbnail,
    undo,
    redo,
    beginTransient,
    endTransient,
    applyTemplate,
    resetImagePosition,
    addGigItem,
    removeGigItem,
    reuseExport,
    uploadSource,
    selectAsset,
    exportPost,
    deletePost,
    refresh,
  }
}

export type PostEditor = ReturnType<typeof createPostEditor>
export const postEditorKey: InjectionKey<PostEditor> = Symbol('post-editor')

export function usePostEditor() {
  const editor = inject(postEditorKey)
  if (!editor) throw new Error('usePostEditor() must be used inside the post editor')
  return editor
}
