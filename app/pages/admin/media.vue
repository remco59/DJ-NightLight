<script setup lang="ts">
import MediaAssetCard, { type MediaCardAction } from '~/components/media/MediaAssetCard.vue'
import MediaBulkBar from '~/components/media/MediaBulkBar.vue'
import MediaCollectionsDialog from '~/components/media/MediaCollectionsDialog.vue'
import MediaCollectionsRow from '~/components/media/MediaCollectionsRow.vue'
import MediaFiltersPanel from '~/components/media/MediaFiltersPanel.vue'
import MediaInspector from '~/components/media/MediaInspector.vue'
import MediaPopover from '~/components/media/MediaPopover.vue'
import MediaUploadDrawer, { type MediaUploadPreset } from '~/components/media/MediaUploadDrawer.vue'
import { apiErrorMessage } from '~/utils/api-error'
import {
  mediaApi,
  mediaArchiveUrl,
  mediaDownloadUrl,
  mediaPublicUrl,
  startDownload,
  useMediaLibrary,
  type MediaBulkAction,
  type MediaDeleteResult,
} from '~/composables/useMediaLibrary'
import {
  MEDIA_SORT_OPTIONS,
  activeAdvancedFilterCount,
  collectMediaTags,
  defaultMediaFilters,
  filterMediaItems,
  mediaDisplayTitle,
  sortMediaItems,
  type MediaLibraryFilters,
  type MediaLibraryItem,
  type MediaSort,
  type MediaTypeTab,
} from '~~/shared/media-library'

definePageMeta({ layout: 'admin' })

const route = useRoute()
const router = useRouter()
const { assets, collections, gigs, venues, byId, refresh, status } = await useMediaLibrary()

const PAGE_SIZE = 60
const tabs: Array<{ value: MediaTypeTab, label: string, icon?: string }> = [
  { value: 'all', label: 'All' },
  { value: 'photo', label: 'Photos', icon: 'lucide:image' },
  { value: 'video', label: 'Videos', icon: 'lucide:clapperboard' },
  { value: 'generated', label: 'Generated', icon: 'lucide:sparkles' },
]

const filters = ref<MediaLibraryFilters>({
  ...defaultMediaFilters(),
  collectionId: typeof route.query.collection === 'string' ? route.query.collection : '',
  query: typeof route.query.q === 'string' ? route.query.q : '',
})
const sort = ref<MediaSort>('newest')
const view = ref<'grid' | 'row'>('grid')
const selected = ref<string[]>([])
const anchorId = ref('')
const inspectId = ref(typeof route.query.asset === 'string' ? route.query.asset : '')
const inspectEdit = ref(false)
const uploadOpen = ref(false)
const uploadPreset = ref<MediaUploadPreset | null>(null)
const filtersOpen = ref(false)
const sortOpen = ref(false)
const collectionsOpen = ref(false)
const busy = ref(false)
const renderLimit = ref(PAGE_SIZE)
const searchInput = ref<HTMLInputElement | null>(null)
const sentinel = ref<HTMLElement | null>(null)
const toast = ref<{ message: string, tone?: 'error' } | null>(null)
let toastTimer: ReturnType<typeof setTimeout> | undefined

const visible = computed(() => sortMediaItems(filterMediaItems(assets.value, filters.value), sort.value))
const shown = computed(() => visible.value.slice(0, renderLimit.value))
const allTags = computed(() => collectMediaTags(assets.value))
const advancedCount = computed(() => activeAdvancedFilterCount(filters.value))
const selectedSet = computed(() => new Set(selected.value))
const inspected = computed(() => inspectId.value ? byId.value.get(inspectId.value) || null : null)
const sortLabel = computed(() => MEDIA_SORT_OPTIONS.find(option => option.value === sort.value)?.label || 'Newest')
const activeCollection = computed(() => collections.value.find(collection => collection.id === filters.value.collectionId) || null)
const hasAnyFilter = computed(() => Boolean(filters.value.query || filters.value.collectionId || filters.value.type !== 'all' || advancedCount.value))

const activeChips = computed(() => {
  const f = filters.value
  const chips: Array<{ key: string, label: string, clear: () => void }> = []
  const gigName = (id: string) => id === 'none' ? 'No gig' : gigs.value.find(gig => gig.id === id)?.title || 'Gig'
  const venueName = (id: string) => id === 'none' ? 'No venue' : venues.value.find(venue => venue.id === id)?.name || 'Venue'
  if (activeCollection.value) chips.push({ key: 'collection', label: `Collection: ${activeCollection.value.name}`, clear: () => { f.collectionId = '' } })
  if (f.kind) chips.push({ key: 'kind', label: `Type: ${f.kind}`, clear: () => { f.kind = '' } })
  if (f.gigId) chips.push({ key: 'gig', label: `Gig: ${gigName(f.gigId)}`, clear: () => { f.gigId = '' } })
  if (f.venueId) chips.push({ key: 'venue', label: `Venue: ${venueName(f.venueId)}`, clear: () => { f.venueId = '' } })
  for (const tag of f.tags) chips.push({ key: `tag-${tag}`, label: `Tag: ${tag}`, clear: () => { f.tags = f.tags.filter(existing => existing !== tag) } })
  if (f.source) chips.push({ key: 'source', label: `Source: ${f.source}`, clear: () => { f.source = '' } })
  if (f.orientation) chips.push({ key: 'orientation', label: f.orientation, clear: () => { f.orientation = '' } })
  if (f.added) chips.push({ key: 'added', label: `Added: last ${f.added.replace('d', ' days').replace('365 days', 'year')}`, clear: () => { f.added = '' } })
  if (f.usage) chips.push({ key: 'usage', label: f.usage === 'used' ? 'Used' : 'Unused', clear: () => { f.usage = '' } })
  if (f.variants) chips.push({ key: 'variants', label: f.variants === 'originals' ? 'Originals only' : 'Variants only', clear: () => { f.variants = '' } })
  return chips
})

function clearFilters() {
  filters.value = defaultMediaFilters()
}

watch([filters, sort], () => { renderLimit.value = PAGE_SIZE }, { deep: true })

// Keep the open asset and collection in the URL so views can be shared and
// other pages can link straight to an asset.
watch([inspectId, () => filters.value.collectionId], ([asset, collection]) => {
  const query = { ...route.query, asset: asset || undefined, collection: collection || undefined }
  if (query.asset !== route.query.asset || query.collection !== route.query.collection) router.replace({ query })
})

// Drop selections that disappeared (deleted elsewhere or after refresh).
watch(assets, () => {
  selected.value = selected.value.filter(id => byId.value.has(id))
})

function notify(message: string, tone?: 'error') {
  toast.value = { message, tone }
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toast.value = null }, tone === 'error' ? 7000 : 3500)
}

function toggle(item: MediaLibraryItem, event?: MouseEvent | KeyboardEvent) {
  const ids = visible.value.map(entry => entry.id)
  if (event?.shiftKey && anchorId.value && ids.includes(anchorId.value)) {
    const from = Math.min(ids.indexOf(anchorId.value), ids.indexOf(item.id))
    const to = Math.max(ids.indexOf(anchorId.value), ids.indexOf(item.id))
    selected.value = [...new Set([...selected.value, ...ids.slice(from, to + 1)])]
  } else {
    selected.value = selectedSet.value.has(item.id)
      ? selected.value.filter(id => id !== item.id)
      : [...selected.value, item.id]
  }
  anchorId.value = item.id
}

function inspect(item: MediaLibraryItem, edit = false) {
  inspectEdit.value = edit
  inspectId.value = item.id
}

function openUpload(preset: MediaUploadPreset | null = null) {
  uploadPreset.value = preset || (filters.value.collectionId ? { collectionIds: [filters.value.collectionId] } : null)
  uploadOpen.value = true
}

function uploadVariant(item: MediaLibraryItem) {
  const original = item.parentAssetId ? byId.value.get(item.parentAssetId) || item : item
  inspectId.value = ''
  openUpload({
    parentAssetId: original.id,
    gigId: original.gigId || '',
    venueId: original.venueId || '',
    tags: original.tags.join(', '),
  })
}

async function onUploaded(ids: string[]) {
  await refresh()
  notify(`${ids.length} file${ids.length === 1 ? '' : 's'} added to the library.`)
}

async function copyLink(item: MediaLibraryItem) {
  try {
    await navigator.clipboard.writeText(mediaPublicUrl(item))
    notify('Link copied to clipboard.')
  } catch {
    notify('Could not access the clipboard.', 'error')
  }
}

async function removeAssets(ids: string[]) {
  const names = ids.map(id => byId.value.get(id)).filter(Boolean).map(item => mediaDisplayTitle(item!))
  const question = ids.length === 1
    ? `Delete “${names[0]}”? This removes the file permanently.`
    : `Delete ${ids.length} items? This removes the files permanently.`
  if (!confirm(`${question} Items that are still used on the website, landing pages or in videos are kept.`)) return
  busy.value = true
  try {
    const result = await mediaApi.bulk<MediaDeleteResult>(ids, { action: 'delete' })
    selected.value = selected.value.filter(id => !result.deleted.includes(id))
    if (result.deleted.includes(inspectId.value)) inspectId.value = ''
    await refresh()
    if (result.blocked.length) {
      const first = result.blocked[0]!
      const name = byId.value.get(first.id) ? mediaDisplayTitle(byId.value.get(first.id)!) : 'An item'
      notify(
        `${result.deleted.length ? `Deleted ${result.deleted.length}. ` : ''}${result.blocked.length} still in use and kept — ${name}: ${first.references.join(', ')}.`,
        'error',
      )
    } else {
      notify(`Deleted ${result.deleted.length} item${result.deleted.length === 1 ? '' : 's'}.`)
    }
  } catch (error) {
    notify(apiErrorMessage(error, 'Delete failed.'), 'error')
  } finally {
    busy.value = false
  }
}

async function runBulk(action: MediaBulkAction, ids = selected.value) {
  busy.value = true
  try {
    const result = await mediaApi.bulk(ids, action)
    await refresh()
    const verb = {
      addTags: 'Tagged',
      removeTags: 'Updated tags on',
      setGig: 'Linked',
      setVenue: 'Linked',
      addToCollection: 'Added',
      removeFromCollection: 'Removed',
      moveToCollection: 'Moved',
      delete: 'Deleted',
    }[action.action]
    notify(`${verb} ${result.updated} item${result.updated === 1 ? '' : 's'}.`)
  } catch (error) {
    notify(apiErrorMessage(error, 'That did not work. Try again.'), 'error')
  } finally {
    busy.value = false
  }
}

async function createCollection(name: string, ids = selected.value) {
  busy.value = true
  try {
    await mediaApi.createCollection(name, ids)
    await refresh()
    notify(`Created “${name}” with ${ids.length} item${ids.length === 1 ? '' : 's'}.`)
  } catch (error) {
    notify(apiErrorMessage(error, 'Could not create the collection.'), 'error')
  } finally {
    busy.value = false
  }
}

function downloadSelection() {
  const ids = selected.value
  if (ids.length === 1) startDownload(mediaDownloadUrl({ id: ids[0]! }))
  else startDownload(mediaArchiveUrl(ids))
}

function onCardAction(item: MediaLibraryItem, action: MediaCardAction) {
  if (action === 'open') inspect(item)
  if (action === 'edit') inspect(item, true)
  if (action === 'copy') copyLink(item)
  if (action === 'download') startDownload(mediaDownloadUrl(item))
  if (action === 'variant') uploadVariant(item)
  if (action === 'delete') removeAssets([item.id])
}

function onCardCollection(item: MediaLibraryItem, collectionId: string, member: boolean) {
  runBulk({ action: member ? 'addToCollection' : 'removeFromCollection', collectionId }, [item.id])
}

function selectCollection(id: string) {
  filters.value.collectionId = filters.value.collectionId === id ? '' : id
}

function onKey(event: KeyboardEvent) {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault()
    searchInput.value?.focus()
    return
  }
  const overlayOpen = inspectId.value || uploadOpen.value || collectionsOpen.value
  const inField = (event.target as HTMLElement | null)?.closest('input, textarea, select')
  if (event.key === 'Escape' && !overlayOpen && !inField && selected.value.length) selected.value = []
}

let observer: IntersectionObserver | undefined
onMounted(() => {
  document.addEventListener('keydown', onKey)
  try {
    const saved = localStorage.getItem('nightlight.media.view')
    if (saved === 'grid' || saved === 'row') view.value = saved
  } catch {
    // Storage can be unavailable (private mode); grid is the default.
  }
  observer = new IntersectionObserver((entries) => {
    if (entries.some(entry => entry.isIntersecting) && renderLimit.value < visible.value.length) renderLimit.value += PAGE_SIZE
  }, { rootMargin: '600px' })
  watch(sentinel, (element, previous) => {
    if (previous) observer?.unobserve(previous)
    if (element) observer?.observe(element)
  }, { immediate: true })
})
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKey)
  observer?.disconnect()
  clearTimeout(toastTimer)
})

watch(view, (value) => {
  try {
    localStorage.setItem('nightlight.media.view', value)
  } catch {
    // Ignore: the choice just is not remembered.
  }
})

function closeInspector() {
  inspectId.value = ''
  inspectEdit.value = false
}
</script>

<template>
  <div class="page" :class="{ 'has-selection': selected.length }">
    <header class="header">
      <div>
        <p class="eyebrow">Content</p>
        <h1>Media library</h1>
        <p class="lead">All your photos, videos and generated content in one place. Organize, search and use them across your website, socials and promos.</p>
      </div>
      <button type="button" class="mh-btn primary upload-button" @click="openUpload()">
        <Icon name="lucide:plus" aria-hidden="true" />Upload media
      </button>
    </header>

    <div class="toolbar">
      <label class="search">
        <Icon name="lucide:search" aria-hidden="true" />
        <span class="visually-hidden">Search media</span>
        <input ref="searchInput" v-model="filters.query" type="search" placeholder="Search media by title, tag, gig or venue…">
        <kbd aria-hidden="true">⌘ K</kbd>
      </label>

      <div class="tabs" role="tablist" aria-label="Media type">
        <button
          v-for="tab in tabs"
          :key="tab.value"
          type="button"
          role="tab"
          :aria-selected="filters.type === tab.value"
          :class="{ active: filters.type === tab.value }"
          @click="filters.type = tab.value"
        >
          <Icon v-if="tab.icon" :name="tab.icon" aria-hidden="true" />{{ tab.label }}
        </button>
      </div>

      <div class="controls">
        <MediaPopover v-model:open="filtersOpen" align="end" sheet-on-mobile>
          <template #trigger="{ toggle: toggleFilters }">
            <button type="button" class="mh-btn" :class="{ on: advancedCount }" :aria-expanded="filtersOpen" @click="toggleFilters">
              <Icon name="lucide:filter" aria-hidden="true" />Filters<span v-if="advancedCount" class="badge">{{ advancedCount }}</span>
            </button>
          </template>
          <MediaFiltersPanel v-model:filters="filters" :tags="allTags" :gigs="gigs" :venues="venues" @done="filtersOpen = false" />
        </MediaPopover>

        <MediaPopover v-model:open="sortOpen" align="end">
          <template #trigger="{ toggle: toggleSort }">
            <button type="button" class="mh-btn" :aria-expanded="sortOpen" @click="toggleSort">
              <Icon name="lucide:arrow-up-down" aria-hidden="true" /><span class="sort-prefix">Sort: </span>{{ sortLabel }}<Icon name="lucide:chevron-down" aria-hidden="true" />
            </button>
          </template>
          <button
            v-for="option in MEDIA_SORT_OPTIONS"
            :key="option.value"
            type="button"
            class="mh-menu-item"
            @click="sort = option.value; sortOpen = false"
          >
            <Icon :name="sort === option.value ? 'lucide:check' : 'lucide:dot'" aria-hidden="true" />{{ option.label }}
          </button>
        </MediaPopover>

        <div class="view-toggle" role="group" aria-label="View">
          <button type="button" class="mh-icon-btn" :class="{ active: view === 'grid' }" :aria-pressed="view === 'grid'" aria-label="Grid view" @click="view = 'grid'">
            <Icon name="lucide:layout-grid" aria-hidden="true" />
          </button>
          <button type="button" class="mh-icon-btn" :class="{ active: view === 'row' }" :aria-pressed="view === 'row'" aria-label="List view" @click="view = 'row'">
            <Icon name="lucide:list" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>

    <div v-if="activeChips.length" class="chips">
      <AdminFilterChip v-for="chip in activeChips" :key="chip.key" :label="chip.label" @remove="chip.clear()" />
      <button type="button" class="clear-all" @click="clearFilters">Clear all</button>
    </div>

    <MediaCollectionsRow :collections="collections" :active-id="filters.collectionId" @select="selectCollection" @manage="collectionsOpen = true" />

    <MediaBulkBar
      v-if="selected.length"
      :count="selected.length"
      :visible-count="visible.length"
      :collections="collections"
      :gigs="gigs"
      :venues="venues"
      :active-collection-id="filters.collectionId"
      :busy="busy"
      :tag-suggestions="allTags"
      @action="runBulk"
      @create-collection="createCollection"
      @download="downloadSelection"
      @delete="removeAssets(selected)"
      @select-all="selected = visible.map(item => item.id)"
      @clear="selected = []"
    />

    <div class="results-head">
      <h2>
        <template v-if="hasAnyFilter">{{ visible.length }} of {{ assets.length }} items</template>
        <template v-else>{{ assets.length }} item{{ assets.length === 1 ? '' : 's' }}</template>
      </h2>
      <span v-if="activeCollection?.description" class="collection-note">{{ activeCollection.description }}</span>
    </div>

    <div v-if="status === 'pending' && !assets.length" class="grid" aria-busy="true">
      <div v-for="index in 10" :key="index" class="skeleton" />
    </div>

    <div v-else-if="!assets.length" class="mh-empty">
      <Icon name="lucide:images" aria-hidden="true" />
      <strong>Your media library is empty</strong>
      <span>Upload photos and videos from your gigs to use them on the website, in posts and in videos.</span>
      <button type="button" class="mh-btn primary" @click="openUpload()"><Icon name="lucide:plus" aria-hidden="true" />Upload media</button>
    </div>

    <div v-else-if="!visible.length" class="mh-empty">
      <Icon name="lucide:search-x" aria-hidden="true" />
      <strong>Nothing matches these filters</strong>
      <span>Try another search or remove a filter.</span>
      <button type="button" class="mh-btn" @click="clearFilters">Clear filters</button>
    </div>

    <div v-else :class="view === 'grid' ? 'grid' : 'list'">
      <MediaAssetCard
        v-for="item in shown"
        :key="item.id"
        :item="item"
        :layout="view"
        :selected="selectedSet.has(item.id)"
        :selecting="selected.length > 0"
        :collections="collections"
        @open="inspect(item)"
        @toggle="toggle(item, $event)"
        @action="onCardAction(item, $event)"
        @collection="(collectionId, member) => onCardCollection(item, collectionId, member)"
      />
    </div>
    <div v-if="shown.length < visible.length" ref="sentinel" class="sentinel">
      <button type="button" class="mh-btn" @click="renderLimit += PAGE_SIZE">Show more ({{ visible.length - shown.length }} left)</button>
    </div>

    <MediaInspector
      v-if="inspected"
      :item="inspected"
      :sequence="visible.some(entry => entry.id === inspected!.id) ? visible : [inspected]"
      :assets="assets"
      :collections="collections"
      :gigs="gigs"
      :venues="venues"
      :start-in-edit="inspectEdit"
      @close="closeInspector"
      @navigate="(id) => { inspectEdit = false; inspectId = id }"
      @changed="refresh()"
      @notify="notify"
      @upload-variant="uploadVariant"
      @delete="(item) => removeAssets([item.id])"
    />

    <MediaUploadDrawer
      v-model:open="uploadOpen"
      :assets="assets"
      :collections="collections"
      :gigs="gigs"
      :venues="venues"
      :preset="uploadPreset"
      @uploaded="onUploaded"
    />

    <MediaCollectionsDialog
      v-if="collectionsOpen"
      :collections="collections"
      @close="collectionsOpen = false"
      @changed="refresh()"
      @notify="notify"
      @open="(id) => { filters.collectionId = id; collectionsOpen = false }"
    />

    <Transition name="toast">
      <div v-if="toast" class="mh-toast" :class="toast.tone" role="status">
        <Icon :name="toast.tone === 'error' ? 'lucide:circle-alert' : 'lucide:circle-check'" aria-hidden="true" />{{ toast.message }}
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.page { max-width: 1480px; margin: 0 auto; }
.header { display: flex; align-items: flex-end; justify-content: space-between; gap: 1.5rem; margin-bottom: 1.6rem; }
h1 { margin: .35rem 0 .3rem; font-size: clamp(2.4rem, 4.8vw, 3.6rem); line-height: 1; letter-spacing: -.045em; }
.lead { max-width: 52rem; margin: 0; color: #918999; font-size: .92rem; line-height: 1.55; }
.upload-button { min-height: 3rem; padding-inline: 1.4rem; font-size: .92rem; }

.toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: .75rem; margin-bottom: 1rem; }
.search {
  position: relative;
  display: flex;
  flex: 1 1 22rem;
  align-items: center;
  gap: .6rem;
  min-width: 0;
  min-height: 3rem;
  border: 1px solid #2a2530;
  border-radius: .8rem;
  padding: 0 .6rem 0 .95rem;
  background: #0f0d13;
  color: #8f879a;
}
.search:focus-within { border-color: #7a57de; box-shadow: 0 0 0 3px rgba(122, 87, 222, .18); }
.search input { flex: 1; min-width: 0; border: 0; padding: .75rem 0; background: transparent; color: #f4f1f7; font: inherit; font-size: .88rem; outline: none; }
.search input::placeholder { color: #6f6878; }
.search kbd { border: 1px solid #332d3b; border-radius: .4rem; padding: .15rem .4rem; background: #17141c; color: #8f879a; font: inherit; font-size: .7rem; white-space: nowrap; }
.visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.tabs { display: flex; gap: .25rem; border: 1px solid #2a2530; border-radius: .8rem; padding: .3rem; background: #0f0d13; }
.tabs button { display: inline-flex; align-items: center; gap: .45rem; min-height: 2.35rem; border: 1px solid transparent; border-radius: .55rem; padding: .4rem .9rem; background: transparent; color: #a79fb2; font: inherit; font-size: .84rem; font-weight: 600; cursor: pointer; white-space: nowrap; }
.tabs button:hover { color: #fff; }
.tabs button.active { border-color: #5b3fb0; background: #231a3d; color: #fff; box-shadow: 0 0 1rem rgba(109, 40, 217, .25); }
.controls { display: flex; align-items: center; gap: .6rem; }
.controls .mh-btn { min-height: 3rem; }
.controls .mh-btn.on { border-color: #5b3fb0; }
.badge { display: grid; min-width: 1.3rem; height: 1.3rem; place-items: center; border-radius: 999px; background: #7c3aed; color: #fff; font-size: .7rem; }
.view-toggle { display: flex; gap: .2rem; border: 1px solid #2a2530; border-radius: .8rem; padding: .3rem; background: #0f0d13; }
.view-toggle .mh-icon-btn { border-color: transparent; background: transparent; }
.view-toggle .mh-icon-btn.active { border-color: #5b3fb0; background: #231a3d; }

.chips { display: flex; flex-wrap: wrap; align-items: center; gap: .45rem; margin: -.2rem 0 1.1rem; }
.clear-all { border: 0; padding: .3rem; background: none; color: #b69cff; font: inherit; font-size: .8rem; cursor: pointer; }

.results-head { display: flex; align-items: baseline; gap: 1rem; margin-bottom: .8rem; }
.results-head h2 { margin: 0; font-size: 1.05rem; }
.collection-note { color: #8f879a; font-size: .82rem; }

.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(14.5rem, 1fr)); gap: 1rem; }
.list { display: grid; gap: .4rem; }
.skeleton { aspect-ratio: 4 / 3.3; border-radius: .9rem; background: linear-gradient(100deg, #111016 40%, #1a1720 50%, #111016 60%) 0 0 / 200% 100%; animation: shimmer 1.4s linear infinite; }
@keyframes shimmer { to { background-position: -200% 0; } }
.sentinel { display: flex; justify-content: center; padding: 1.5rem 0; }

.toast-enter-active, .toast-leave-active { transition: opacity .2s ease, transform .2s ease; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translate(-50%, .5rem); }

@media (max-width: 1180px) {
  .search { flex-basis: 100%; }
}
@media (max-width: 720px) {
  .header { flex-direction: column; align-items: stretch; }
  .upload-button { width: 100%; }
  .toolbar { gap: .6rem; }
  .search kbd { display: none; }
  .tabs { overflow-x: auto; flex: 1 1 100%; }
  .tabs button { flex: 1; justify-content: center; padding-inline: .6rem; }
  .controls { flex: 1 1 100%; min-width: 0; }
  .controls > :first-child, .controls > :nth-child(2) { flex: 1; min-width: 0; }
  .controls > :first-child .mh-btn, .controls > :nth-child(2) .mh-btn { width: 100%; min-width: 0; padding-inline: .7rem; }
  .sort-prefix { display: none; }
  .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .7rem; }
  /* Room for the fixed bulk bar at the bottom. */
  .page.has-selection { padding-bottom: 5rem; }
}
@media (max-width: 420px) {
  .grid { grid-template-columns: 1fr; }
  .tabs button .iconify { display: none; }
}
@media (prefers-reduced-motion: reduce) {
  .skeleton { animation: none; }
}
</style>
