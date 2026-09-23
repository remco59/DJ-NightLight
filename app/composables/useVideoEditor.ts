import type { InjectionKey } from 'vue'
import { apiErrorMessage } from '~/utils/api-error'
import type { MediaAssetMetadata } from '~~/shared/media'
import {
  MAX_PROJECT_SECONDS,
  MIN_ITEM_FRAMES,
  VIDEO_ASPECTS,
  createGraphicItem,
  createMediaItem,
  createTrack,
  findItem,
  mediaKind,
  projectDurationFrames,
  trackAccepts,
  type ProjectAssetMap,
  type TimelineItem,
  type TimelineItemType,
  type TrackKind,
  type VideoAspect,
  type VideoProject,
} from '~~/shared/video-project'
import {
  addItem,
  createHistory,
  deleteItem,
  duplicateItem,
  moveItem,
  recordHistory,
  redoHistory,
  replaceItemAsset,
  splitItem,
  trimItem,
  undoHistory,
  updateItem,
} from '~~/shared/video-timeline'
import type { VideoRenderStatus } from '~~/shared/video-generator'
import type { MotionTemplateKey } from '~~/shared/video-templates'

export type EditorMediaAsset = {
  id: string
  title: string
  originalFilename: string
  mimeType: string
  width: number
  height: number
  durationMs: number | null
  metadata: MediaAssetMetadata
  url: string
  thumbnailUrl: string | null
}

export type EditorRender = {
  id: string
  status: VideoRenderStatus
  progress: number
  error: string | null
  renderEngine: string | null
  width: number
  height: number
  durationSeconds: number
  videoUrl: string | null
  createdAt: string
}

export type SaveState = 'saved' | 'dirty' | 'saving' | 'error'

const AUTOSAVE_DELAY = 1200
const COALESCE_MS = 700

export function createVideoEditor(initial: { id: string, name: string, revision: number, project: VideoProject }) {
  const state = reactive({
    id: initial.id,
    name: initial.name,
    revision: initial.revision,
    project: initial.project as VideoProject,
    selectedId: null as string | null,
    frame: 0,
    playing: false,
    /** Timeline zoom in pixels per second. */
    zoom: 80,
    snap: true,
    /** Snapping also catches the beat grid of the audio clips. */
    beatSnap: 'beats' as 'beats' | 'bars' | 'off',
    saveState: 'saved' as SaveState,
    saveError: '',
    lastSavedAt: Date.now(),
    media: [] as EditorMediaAsset[],
    renders: [] as EditorRender[],
    /** One-off message for the user (e.g. why an add was shortened or refused); the page shows and clears it. */
    notice: '',
  })

  let history = createHistory<VideoProject>()
  const canUndo = ref(false)
  const canRedo = ref(false)
  let lastCoalesceKey = ''
  let lastCoalesceAt = 0
  let transientBase: VideoProject | null = null
  let saveTimer: ReturnType<typeof setTimeout> | null = null
  let saving: Promise<void> | null = null

  function syncHistoryFlags() {
    canUndo.value = history.past.length > 0
    canRedo.value = history.future.length > 0
  }

  function snapshot(): VideoProject {
    return JSON.parse(JSON.stringify(toRaw(state.project)))
  }

  function scheduleSave() {
    state.saveState = 'dirty'
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => void save(), AUTOSAVE_DELAY)
  }

  /**
   * Replaces the project and records undo history. Repeated edits with the same
   * `coalesce` key (slider drags, typing) collapse into one undo step.
   */
  function commit(next: VideoProject, coalesce = '') {
    if (next === state.project) return
    const now = Date.now()
    const merge = coalesce && coalesce === lastCoalesceKey && now - lastCoalesceAt < COALESCE_MS
    if (!merge) history = recordHistory(history, snapshot())
    lastCoalesceKey = coalesce
    lastCoalesceAt = now
    state.project = next
    if (state.selectedId && !findItem(next, state.selectedId)) state.selectedId = null
    syncHistoryFlags()
    scheduleSave()
  }

  // Drags update the project live without flooding history; the whole drag
  // becomes a single undo step when it ends.
  function beginTransient() {
    transientBase = snapshot()
  }
  function transient(next: VideoProject) {
    state.project = next
  }
  function endTransient() {
    if (!transientBase) return
    const changed = JSON.stringify(transientBase) !== JSON.stringify(toRaw(state.project))
    if (changed) {
      history = recordHistory(history, transientBase)
      lastCoalesceKey = ''
      syncHistoryFlags()
      scheduleSave()
    }
    transientBase = null
  }
  function cancelTransient() {
    if (transientBase) state.project = transientBase
    transientBase = null
  }

  function undo() {
    const result = undoHistory(history, snapshot())
    if (!result) return
    history = result.history
    state.project = result.value
    lastCoalesceKey = ''
    syncHistoryFlags()
    scheduleSave()
  }

  function redo() {
    const result = redoHistory(history, snapshot())
    if (!result) return
    history = result.history
    state.project = result.value
    lastCoalesceKey = ''
    syncHistoryFlags()
    scheduleSave()
  }

  async function save() {
    if (saveTimer) {
      clearTimeout(saveTimer)
      saveTimer = null
    }
    if (saving) await saving
    if (state.saveState !== 'dirty' && state.saveState !== 'error') return
    state.saveState = 'saving'
    const body = { name: state.name, project: snapshot(), revision: state.revision }
    saving = (async () => {
      try {
        const result = await $fetch<{ project: { revision: number } }>(`/api/admin/video-projects/${state.id}`, { method: 'PUT', body })
        state.revision = result.project.revision
        state.lastSavedAt = Date.now()
        state.saveError = ''
        // Edits made while the request was in flight keep the project dirty.
        const unchanged = JSON.stringify(body.project) === JSON.stringify(toRaw(state.project)) && body.name === state.name
        state.saveState = unchanged ? 'saved' : 'dirty'
        if (!unchanged) scheduleSave()
      } catch (error) {
        state.saveState = 'error'
        state.saveError = apiErrorMessage(error, 'Autosave failed. Your changes are kept in this tab.')
      }
    })()
    await saving
    saving = null
  }

  function rename(name: string) {
    const trimmed = name.trim().slice(0, 160)
    if (!trimmed || trimmed === state.name) return
    state.name = trimmed
    scheduleSave()
  }

  // --- Derived data ----------------------------------------------------------

  const duration = computed(() => projectDurationFrames(state.project))
  const selection = computed(() => state.selectedId ? findItem(state.project, state.selectedId) : null)
  const mediaById = computed(() => new Map(state.media.map(asset => [asset.id, asset])))
  const assetMap = computed<ProjectAssetMap>(() => {
    const map: ProjectAssetMap = {}
    for (const asset of state.media) {
      map[asset.id] = { src: asset.url, mimeType: asset.mimeType, width: asset.width, height: asset.height, durationMs: asset.durationMs }
    }
    return map
  })

  function sourceFrames(item: TimelineItem) {
    if (item.type !== 'video' && item.type !== 'audio') return null
    const asset = mediaById.value.get(item.assetId)
    return asset?.durationMs ? Math.floor(asset.durationMs / 1000 * state.project.fps) : null
  }

  function firstTrack(kind: TrackKind) {
    return state.project.tracks.find(track => track.kind === kind) || null
  }

  function trackFor(type: TimelineItemType, preferredTrackId?: string) {
    const preferred = preferredTrackId ? state.project.tracks.find(track => track.id === preferredTrackId) : null
    if (preferred && trackAccepts(preferred.kind, type)) return { project: state.project, track: preferred }
    const kind: TrackKind = type === 'audio' ? 'audio' : type === 'graphic' ? 'graphics' : 'video'
    const existing = firstTrack(kind)
    if (existing) return { project: state.project, track: existing }
    const created = createTrack(kind)
    return { project: { ...state.project, tracks: [...state.project.tracks, created] }, track: created }
  }

  // --- Actions ---------------------------------------------------------------

  function insertItem(item: TimelineItem, trackId?: string) {
    const { project, track } = trackFor(item.type, trackId)
    const next = addItem(project, track.id, item)
    if (next === project) {
      state.notice = `There is no room for this clip: videos can be at most ${MAX_PROJECT_SECONDS / 60} minutes long.`
      return
    }
    commit(next)
    state.selectedId = item.id
    const placed = findItem(next, item.id)?.item
    if (placed && placed.duration < item.duration) {
      state.notice = `The clip was shortened to fit the ${MAX_PROJECT_SECONDS / 60}-minute limit. Drag its end handle after moving it earlier to get the rest back.`
    }
  }

  function addMedia(asset: EditorMediaAsset, trackId?: string, start = state.frame) {
    insertItem(createMediaItem(asset, start, state.project.fps), trackId)
  }

  function addTemplate(key: MotionTemplateKey, trackId?: string, start = state.frame) {
    insertItem(createGraphicItem(key, start, state.project.fps), trackId)
  }

  function move(itemId: string, start: number, trackId?: string) {
    return moveItem(state.project, itemId, start, trackId)
  }

  function trim(base: VideoProject, itemId: string, edge: 'start' | 'end', delta: number) {
    return trimItem(base, itemId, edge, delta, sourceFrames)
  }

  function splitSelected() {
    const target = state.selectedId || itemAtPlayhead()
    if (!target) return
    const result = splitItem(state.project, target, state.frame)
    if (!result.newItemId) return
    commit(result.project)
    state.selectedId = result.newItemId
  }

  function duplicateSelected() {
    if (!state.selectedId) return
    const result = duplicateItem(state.project, state.selectedId)
    if (!result.newItemId) return
    commit(result.project)
    state.selectedId = result.newItemId
  }

  function deleteSelected() {
    if (!state.selectedId) return
    commit(deleteItem(state.project, state.selectedId))
    state.selectedId = null
  }

  function replaceSelectedAsset(asset: EditorMediaAsset) {
    if (!state.selectedId) return false
    const next = replaceItemAsset(state.project, state.selectedId, asset)
    if (next === state.project) return false
    commit(next)
    return true
  }

  function patchItem(itemId: string, patch: (item: TimelineItem) => void, coalesce = '') {
    commit(updateItem(state.project, itemId, patch), coalesce || `item:${itemId}`)
  }

  function patchProject(patch: (project: VideoProject) => void, coalesce = '') {
    const next = snapshot()
    patch(next)
    commit(next, coalesce || 'project')
  }

  function setAspect(aspect: VideoAspect) {
    patchProject((project) => {
      project.aspect = aspect
      project.width = VIDEO_ASPECTS[aspect].width
      project.height = VIDEO_ASPECTS[aspect].height
    })
  }

  function addTrack(kind: TrackKind) {
    if (state.project.tracks.length >= 12) return
    const next = snapshot()
    const track = createTrack(kind, `${kind === 'video' ? 'Video' : kind === 'graphics' ? 'Graphics' : 'Audio'} ${next.tracks.filter(entry => entry.kind === kind).length + 1}`)
    // Keep audio tracks at the bottom; visual tracks stack above earlier ones.
    const firstAudio = next.tracks.findIndex(entry => entry.kind === 'audio')
    if (kind !== 'audio' && firstAudio >= 0) next.tracks.splice(firstAudio, 0, track)
    else next.tracks.push(track)
    commit(next)
  }

  function removeTrack(trackId: string) {
    const next = snapshot()
    if (next.tracks.length <= 1) return
    next.tracks = next.tracks.filter(track => track.id !== trackId)
    commit(next)
  }

  function toggleTrack(trackId: string, key: 'hidden' | 'muted') {
    patchProject((project) => {
      const track = project.tracks.find(entry => entry.id === trackId)
      if (track) track[key] = !track[key]
    }, `track:${trackId}:${key}:${Date.now()}`)
  }

  function itemAtPlayhead() {
    for (const track of state.project.tracks) {
      const item = track.items.find(entry => entry.start <= state.frame && entry.start + entry.duration > state.frame + MIN_ITEM_FRAMES - 1)
      if (item) return item.id
    }
    return null
  }

  function isVisualMedia(asset: EditorMediaAsset) {
    return mediaKind(asset.mimeType) !== 'audio'
  }

  return {
    state,
    canUndo,
    canRedo,
    duration,
    selection,
    mediaById,
    assetMap,
    commit,
    beginTransient,
    transient,
    endTransient,
    cancelTransient,
    undo,
    redo,
    save,
    rename,
    sourceFrames,
    addMedia,
    addTemplate,
    move,
    trim,
    splitSelected,
    duplicateSelected,
    deleteSelected,
    replaceSelectedAsset,
    patchItem,
    patchProject,
    setAspect,
    addTrack,
    removeTrack,
    toggleTrack,
    isVisualMedia,
  }
}

export type VideoEditor = ReturnType<typeof createVideoEditor>
export const videoEditorKey: InjectionKey<VideoEditor> = Symbol('video-editor')

export function useVideoEditor() {
  const editor = inject(videoEditorKey)
  if (!editor) throw new Error('useVideoEditor() must be used inside the video editor')
  return editor
}
