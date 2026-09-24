<script setup lang="ts">
import MediaPopover from '~/components/media/MediaPopover.vue'
import type { MediaBulkAction } from '~/composables/useMediaLibrary'
import type { MediaCollectionSummary } from '~~/shared/media-library'

const props = defineProps<{
  count: number
  visibleCount: number
  collections: MediaCollectionSummary[]
  gigs: Array<{ id: string, title: string }>
  venues: Array<{ id: string, name: string }>
  /** The collection being browsed, which enables Move and Remove. */
  activeCollectionId: string
  busy: boolean
  tagSuggestions: string[]
}>()

const emit = defineEmits<{
  action: [action: MediaBulkAction]
  createCollection: [name: string]
  download: []
  delete: []
  selectAll: []
  clear: []
}>()

const openMenu = ref<'' | 'tags' | 'gig' | 'collection' | 'move'>('')
const tagInput = ref('')
const gigId = ref('')
const venueId = ref('')
const newCollection = ref('')
const activeCollection = computed(() => props.collections.find(collection => collection.id === props.activeCollectionId) || null)
const moveTargets = computed(() => props.collections.filter(collection => collection.id !== props.activeCollectionId))

function menu(name: typeof openMenu.value) {
  return computed({
    get: () => openMenu.value === name,
    set: (value: boolean) => { openMenu.value = value ? name : '' },
  })
}
const tagsOpen = menu('tags')
const gigOpen = menu('gig')
const collectionOpen = menu('collection')
const moveOpen = menu('move')

function applyTags(action: 'addTags' | 'removeTags') {
  if (!tagInput.value.trim()) return
  emit('action', { action, tags: tagInput.value })
  tagInput.value = ''
  openMenu.value = ''
}

function applyLinks() {
  if (gigId.value) emit('action', { action: 'setGig', gigId: gigId.value === 'none' ? null : gigId.value })
  if (venueId.value) emit('action', { action: 'setVenue', venueId: venueId.value === 'none' ? null : venueId.value })
  gigId.value = ''
  venueId.value = ''
  openMenu.value = ''
}

function addTo(collectionId: string) {
  emit('action', { action: 'addToCollection', collectionId })
  openMenu.value = ''
}

function moveTo(collectionId: string) {
  emit('action', { action: 'moveToCollection', fromCollectionId: props.activeCollectionId, collectionId })
  openMenu.value = ''
}

function create() {
  if (!newCollection.value.trim()) return
  emit('createCollection', newCollection.value.trim())
  newCollection.value = ''
  openMenu.value = ''
}
</script>

<template>
  <div class="bulk" role="toolbar" aria-label="Bulk actions">
    <div class="count">
      <span class="mh-check checked"><Icon name="lucide:check" aria-hidden="true" /></span>
      <strong>{{ count }} selected</strong>
      <button v-if="count < visibleCount" type="button" class="link" @click="emit('selectAll')">Select all {{ visibleCount }}</button>
    </div>

    <div class="actions">
      <MediaPopover v-model:open="tagsOpen" placement="bottom" sheet-on-mobile>
        <template #trigger="{ toggle }">
          <button type="button" class="mh-btn" :disabled="busy" @click="toggle"><Icon name="lucide:tag" aria-hidden="true" />Add tags</button>
        </template>
        <form class="pop" @submit.prevent="applyTags('addTags')">
          <label class="mh-field">
            <span>Tags for {{ count }} item{{ count === 1 ? '' : 's' }}</span>
            <input v-model="tagInput" class="mh-input" list="bulk-tag-suggestions" placeholder="promo, crowd" autofocus>
            <datalist id="bulk-tag-suggestions"><option v-for="tag in tagSuggestions" :key="tag" :value="tag" /></datalist>
          </label>
          <div class="pair">
            <button type="button" class="mh-btn" :disabled="!tagInput.trim()" @click="applyTags('removeTags')">Remove</button>
            <button type="submit" class="mh-btn primary" :disabled="!tagInput.trim()">Add</button>
          </div>
        </form>
      </MediaPopover>

      <MediaPopover v-model:open="gigOpen" sheet-on-mobile>
        <template #trigger="{ toggle }">
          <button type="button" class="mh-btn" :disabled="busy" @click="toggle"><Icon name="lucide:calendar-days" aria-hidden="true" />Link to gig</button>
        </template>
        <div class="pop">
          <label class="mh-field">
            <span>Gig</span>
            <select v-model="gigId" class="mh-select">
              <option value="">Keep current gig</option>
              <option value="none">Remove gig link</option>
              <option v-for="gig in gigs" :key="gig.id" :value="gig.id">{{ gig.title }}</option>
            </select>
          </label>
          <label class="mh-field">
            <span>Venue</span>
            <select v-model="venueId" class="mh-select">
              <option value="">Keep current venue</option>
              <option value="none">Remove venue link</option>
              <option v-for="venue in venues" :key="venue.id" :value="venue.id">{{ venue.name }}</option>
            </select>
          </label>
          <button type="button" class="mh-btn primary" :disabled="!gigId && !venueId" @click="applyLinks">Apply to {{ count }}</button>
        </div>
      </MediaPopover>

      <MediaPopover v-model:open="collectionOpen" sheet-on-mobile>
        <template #trigger="{ toggle }">
          <button type="button" class="mh-btn" :disabled="busy" @click="toggle"><Icon name="lucide:folder-plus" aria-hidden="true" />Add to collection</button>
        </template>
        <div class="pop list">
          <button v-for="collection in collections" :key="collection.id" type="button" class="mh-menu-item" @click="addTo(collection.id)">
            <Icon name="lucide:folder" aria-hidden="true" />{{ collection.name }}<small>{{ collection.itemCount }}</small>
          </button>
          <div class="mh-menu-sep" />
          <form class="new" @submit.prevent="create">
            <input v-model="newCollection" class="mh-input" maxlength="80" placeholder="New collection name">
            <button type="submit" class="mh-btn" :disabled="!newCollection.trim()">Create</button>
          </form>
        </div>
      </MediaPopover>

      <MediaPopover v-if="activeCollection" v-model:open="moveOpen" sheet-on-mobile>
        <template #trigger="{ toggle }">
          <button type="button" class="mh-btn" :disabled="busy || !moveTargets.length" @click="toggle"><Icon name="lucide:folder-input" aria-hidden="true" />Move</button>
        </template>
        <div class="pop list">
          <p class="hint">Move from <strong>{{ activeCollection.name }}</strong> to…</p>
          <button v-for="collection in moveTargets" :key="collection.id" type="button" class="mh-menu-item" @click="moveTo(collection.id)">
            <Icon name="lucide:folder" aria-hidden="true" />{{ collection.name }}
          </button>
        </div>
      </MediaPopover>
      <button
        v-if="activeCollection"
        type="button"
        class="mh-btn"
        :disabled="busy"
        @click="emit('action', { action: 'removeFromCollection', collectionId: activeCollectionId })"
      >
        <Icon name="lucide:folder-minus" aria-hidden="true" />Remove from {{ activeCollection.name }}
      </button>

      <button type="button" class="mh-btn" :disabled="busy" @click="emit('download')"><Icon name="lucide:download" aria-hidden="true" />Download</button>
      <span class="divider" aria-hidden="true" />
      <button type="button" class="mh-btn danger" :disabled="busy" @click="emit('delete')"><Icon name="lucide:trash-2" aria-hidden="true" />Delete</button>
    </div>

    <button type="button" class="mh-btn ghost clear" @click="emit('clear')"><Icon name="lucide:x" aria-hidden="true" />Clear selection</button>
  </div>
</template>

<style scoped>
.bulk {
  position: sticky;
  top: .75rem;
  z-index: 40;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: .75rem 1rem;
  margin: 0 0 1.1rem;
  border: 1px solid #4a3780;
  border-radius: .9rem;
  padding: .6rem .75rem;
  background: rgba(27, 20, 45, .92);
  box-shadow: 0 1rem 2.5rem rgba(0, 0, 0, .45), 0 0 1.5rem rgba(109, 40, 217, .18);
  backdrop-filter: blur(12px);
}
.count { display: flex; align-items: center; gap: .6rem; padding-right: .4rem; }
.count strong { white-space: nowrap; }
.link { border: 0; padding: 0; background: none; color: #c4b1f5; font: inherit; font-size: .8rem; cursor: pointer; white-space: nowrap; }
.actions { display: flex; flex: 1; flex-wrap: wrap; align-items: center; gap: .5rem; }
.actions .mh-btn { min-height: 2.35rem; padding-block: .4rem; background: rgba(15, 12, 22, .7); }
.actions .mh-btn.danger { background: #1b0f13; }
.divider { width: 1px; height: 1.6rem; background: #3d3350; }
.clear { margin-left: auto; color: #c9c2d1; }
.pop { display: grid; gap: .8rem; width: 18rem; padding: .5rem; }
.pop.list { gap: .1rem; padding: .2rem; }
.pop.list small { margin-left: auto; color: #7d7686; }
.pair { display: grid; grid-template-columns: 1fr 1fr; gap: .5rem; }
.new { display: flex; gap: .4rem; padding: .3rem; }
.new .mh-input { min-height: 2.3rem; }
.hint { margin: .35rem .6rem .4rem; color: #a79fb2; font-size: .78rem; }
.hint strong { color: #fff; }
@media (max-width: 720px) {
  .bulk {
    position: fixed;
    inset: auto .6rem calc(.6rem + env(safe-area-inset-bottom)) .6rem;
    flex-wrap: nowrap;
    overflow-x: auto;
    margin: 0;
    background: #1b142d;
    /* A backdrop filter would trap the fixed bottom sheets inside the bar. */
    backdrop-filter: none;
  }
  .actions { flex-wrap: nowrap; }
  .count .link { display: none; }
  .clear { margin-left: 0; }
  .pop { width: 100%; }
}
</style>
