<script setup lang="ts">
import MediaAssetCard from '~/components/media/MediaAssetCard.vue'
import MediaUploadDrawer from '~/components/media/MediaUploadDrawer.vue'
import { useMediaLibrary } from '~/composables/useMediaLibrary'
import { defaultMediaFilters, filterMediaItems, mediaDisplayTitle, sortMediaItems, type MediaLibraryItem } from '~~/shared/media-library'

// The one media picker for the back office (website editor, post generator,
// video editor, landing pages). It browses the same library model as the
// Media page and uploads through the same drawer.

const props = withDefaults(defineProps<{
  modelValue: string | null
  label?: string
  description?: string
  kind?: 'image' | 'all'
  allowExternal?: boolean
  /** Render only the picker dialog; the parent opens it with `v-model:open`. */
  bare?: boolean
  uploadTags?: string
  /** Enables the "This gig" tab. */
  gigId?: string | null
}>(), {
  label: 'Afbeelding',
  description: '',
  kind: 'image',
  allowExternal: true,
  bare: false,
  uploadTags: 'website',
  gigId: null,
})

const emit = defineEmits<{
  'update:modelValue': [value: string | null]
  selected: [asset: MediaLibraryItem]
}>()

const { assets, collections, gigs, venues, refresh, byId } = await useMediaLibrary()

type PickerTab = 'all' | 'recent' | 'gig' | 'generated'
const open = defineModel<boolean>('open', { default: false })
const search = ref('')
const tab = ref<PickerTab>('all')
const collectionId = ref('')
const uploadOpen = ref(false)

function isExternalUrl(value: string | null) {
  return props.allowExternal && Boolean(value && /^https?:\/\//i.test(value))
}

const externalUrl = ref(isExternalUrl(props.modelValue) ? props.modelValue || '' : '')

watch(() => props.modelValue, (value) => {
  externalUrl.value = isExternalUrl(value) ? value || '' : ''
})

function applyExternalUrl() {
  emit('update:modelValue', externalUrl.value.trim() || null)
}

const pool = computed(() => props.kind === 'all' ? assets.value : assets.value.filter(asset => asset.mimeType.startsWith('image/')))
const selectedAsset = computed(() => pool.value.find(asset => asset.url === props.modelValue) || null)
const selectedPreview = computed(() => selectedAsset.value?.thumbnailUrl || props.modelValue)
const mediaNoun = computed(() => props.kind === 'all' ? 'media' : 'afbeelding')
const chooseLabel = computed(() => props.kind === 'all' ? 'Media kiezen' : 'Afbeelding kiezen')
const tabs = computed(() => [
  { value: 'all' as const, label: 'Alles' },
  { value: 'recent' as const, label: 'Recent' },
  ...(props.gigId ? [{ value: 'gig' as const, label: 'Deze gig' }] : []),
  { value: 'generated' as const, label: 'Gegenereerd' },
])

const filteredAssets = computed(() => {
  const filters = {
    ...defaultMediaFilters(),
    query: search.value,
    type: tab.value === 'generated' ? 'generated' as const : 'all' as const,
    gigId: tab.value === 'gig' && props.gigId ? props.gigId : '',
    collectionId: collectionId.value,
  }
  const sorted = sortMediaItems(filterMediaItems(pool.value, filters), 'newest')
  return tab.value === 'recent' ? sorted.slice(0, 48) : sorted
})

function selectAsset(asset: MediaLibraryItem) {
  externalUrl.value = ''
  emit('update:modelValue', asset.url)
  emit('selected', asset)
  open.value = false
  search.value = ''
}

function clearSelection() {
  externalUrl.value = ''
  emit('update:modelValue', null)
}

async function onUploaded(ids: string[]) {
  await refresh()
  // A single upload is what the editor asked for: use it straight away.
  const asset = ids.length === 1 ? byId.value.get(ids[0]!) : null
  if (asset) selectAsset(asset)
}

function onKey(event: KeyboardEvent) {
  if (event.key === 'Escape' && open.value && !uploadOpen.value) open.value = false
}
onMounted(() => document.addEventListener('keydown', onKey))
onBeforeUnmount(() => document.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="media-field" :class="{ bare }">
    <template v-if="!bare">
    <div class="field-heading">
      <div>
        <strong>{{ label }}</strong>
        <span v-if="description">{{ description }}</span>
      </div>
      <button type="button" class="text-button" @click="open = true">
        {{ modelValue ? `Andere ${mediaNoun} kiezen` : chooseLabel }}
      </button>
    </div>

    <div v-if="modelValue" class="selected-media">
      <img v-if="selectedPreview" :src="selectedPreview" :alt="selectedAsset?.altText || selectedAsset?.title || label">
      <div v-else class="media-placeholder"><Icon name="lucide:film" aria-hidden="true" /></div>
      <div class="selected-copy">
        <strong>{{ selectedAsset ? mediaDisplayTitle(selectedAsset) : 'Externe afbeelding' }}</strong>
        <span v-if="selectedAsset">{{ selectedAsset.width }}<IconTimes />{{ selectedAsset.height }} · Mediabibliotheek</span>
        <span v-else>Externe URL</span>
        <button type="button" class="remove" @click="clearSelection">Verwijderen</button>
      </div>
    </div>

    <div v-else class="empty-media" @click="open = true">
      <span>＋</span>
      <div>
        <strong>Kiezen uit Media</strong>
        <small>{{ kind === 'all' ? 'Kies een bestaande afbeelding of video, of upload nieuwe media.' : 'Of upload een nieuwe afbeelding zonder deze editor te verlaten.' }}</small>
      </div>
    </div>

    <details v-if="allowExternal" class="external">
      <summary>Een externe afbeeldings-URL gebruiken</summary>
      <input v-model="externalUrl" type="url" placeholder="https://…" @change="applyExternalUrl">
    </details>
    </template>

    <Teleport to="body">
      <div v-if="open" class="picker-backdrop" @click.self="open = false">
        <section class="picker-modal" role="dialog" aria-modal="true" :aria-label="`${label} kiezen`">
          <header class="picker-header">
            <div>
              <p class="picker-eyebrow">Mediabibliotheek</p>
              <h2>{{ label }} kiezen</h2>
            </div>
            <div class="header-actions">
              <button type="button" class="mh-btn primary" @click="uploadOpen = true"><Icon name="lucide:plus" aria-hidden="true" />Uploaden</button>
              <button type="button" class="mh-icon-btn" aria-label="Sluiten" @click="open = false"><Icon name="lucide:x" aria-hidden="true" /></button>
            </div>
          </header>

          <div class="picker-toolbar">
            <label class="picker-search">
              <Icon name="lucide:search" aria-hidden="true" />
              <input v-model="search" type="search" :placeholder="`Zoek ${kind === 'all' ? 'media' : 'afbeeldingen'} op titel, tag, gig of locatie…`" :aria-label="`${kind === 'all' ? 'Media' : 'Afbeeldingen'} zoeken`">
            </label>
            <div class="picker-tabs" role="tablist">
              <button
                v-for="entry in tabs"
                :key="entry.value"
                type="button"
                role="tab"
                :aria-selected="tab === entry.value"
                :class="{ active: tab === entry.value }"
                @click="tab = entry.value"
              >
                {{ entry.label }}
              </button>
            </div>
            <select v-if="collections.length" v-model="collectionId" class="mh-select picker-collection" aria-label="Collectie">
              <option value="">Alle collecties</option>
              <option v-for="collection in collections" :key="collection.id" :value="collection.id">{{ collection.name }} ({{ collection.itemCount }})</option>
            </select>
          </div>

          <div class="picker-body">
            <MediaAssetCard
              v-for="asset in filteredAssets"
              :key="asset.id"
              :item="asset"
              :interactive="false"
              :active="asset.url === modelValue"
              @open="selectAsset(asset)"
            />
            <div v-if="!filteredAssets.length" class="mh-empty no-results">
              <Icon name="lucide:images" aria-hidden="true" />
              <strong>Nog geen {{ kind === 'all' ? 'media' : 'afbeeldingen' }} hier</strong>
              <button type="button" class="mh-btn" @click="uploadOpen = true"><Icon name="lucide:upload" aria-hidden="true" />{{ kind === 'all' ? 'Media' : 'Afbeelding' }} uploaden</button>
            </div>
          </div>
          <footer class="picker-footer">
            <span>{{ filteredAssets.length }} item{{ filteredAssets.length === 1 ? '' : 's' }}</span>
            <NuxtLink to="/admin/media" target="_blank">Beheren in Mediabibliotheek<Icon name="lucide:arrow-up-right" aria-hidden="true" /></NuxtLink>
          </footer>
        </section>
      </div>
    </Teleport>

    <MediaUploadDrawer
      v-model:open="uploadOpen"
      :assets="assets"
      :collections="collections"
      :gigs="gigs"
      :venues="venues"
      :preset="{ tags: uploadTags, gigId: gigId || '' }"
      :images-only="kind === 'image'"
      @uploaded="onUploaded"
    />
  </div>
</template>

<style scoped>
.media-field{display:grid;gap:.65rem}.media-field.bare{display:contents}.field-heading{display:flex;align-items:end;justify-content:space-between;gap:1rem}.field-heading>div{display:grid;gap:.2rem}.field-heading strong{color:#d8d2de;font-size:.82rem}.field-heading span{color:#81798a;font-size:.72rem;line-height:1.45}.text-button,.remove{border:0;padding:0;background:transparent;color:#b8a5d1;font-size:.75rem;cursor:pointer}.selected-media{display:grid;grid-template-columns:8rem minmax(0,1fr);gap:.8rem;align-items:center;padding:.65rem;border:1px solid #312b37;border-radius:.8rem;background:#0b0a0d}.selected-media img,.media-placeholder{width:8rem;height:5.5rem;border-radius:.55rem;background:#070609}.selected-media img{object-fit:cover}.media-placeholder{display:grid;place-items:center;color:#81798a;font-size:1.3rem}.selected-copy{display:grid;gap:.25rem;min-width:0}.selected-copy strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#f3eff6;font-size:.82rem}.selected-copy span{color:#81798a;font-size:.7rem}.selected-copy .remove{justify-self:start;margin-top:.15rem;color:#df9ca7}.empty-media{display:flex;align-items:center;gap:.85rem;min-height:6rem;padding:1rem;border:1px dashed #41394a;border-radius:.8rem;background:#0b0a0d;cursor:pointer}.empty-media>span{display:grid;width:2.4rem;height:2.4rem;place-items:center;border-radius:.7rem;background:#1b1621;color:#c7b5de;font-size:1.25rem}.empty-media div{display:grid;gap:.2rem}.empty-media strong{color:#ddd7e2;font-size:.82rem}.empty-media small{color:#7f7888;font-size:.72rem}.external{color:#797282;font-size:.72rem}.external summary{cursor:pointer}.external input{width:100%;margin-top:.55rem;border:1px solid #332e39;border-radius:.65rem;padding:.72rem;background:#0b0a0d;color:#f6f3fa}
.picker-backdrop{position:fixed;inset:0;z-index:2000;display:grid;place-items:center;padding:1rem;background:rgba(4,3,6,.78);backdrop-filter:blur(12px)}.picker-modal{display:flex;flex-direction:column;width:min(1180px,100%);height:min(52rem,calc(100dvh - 2rem));overflow:hidden;border:1px solid #342e3b;border-radius:1.2rem;background:#0d0b10;box-shadow:0 30px 100px rgba(0,0,0,.62)}.picker-header{display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:1.1rem 1.25rem .8rem}.picker-header h2{margin:.15rem 0 0;font-size:1.6rem;letter-spacing:-.035em}.picker-eyebrow{margin:0;color:#8f8798;font-size:.65rem;font-weight:800;letter-spacing:.12em;text-transform:uppercase}.header-actions{display:flex;gap:.5rem}.picker-toolbar{display:flex;flex-wrap:wrap;gap:.6rem;padding:0 1.25rem .9rem;border-bottom:1px solid #242027}.picker-search{display:flex;flex:1 1 18rem;align-items:center;gap:.55rem;min-height:2.6rem;border:1px solid #2f2a37;border-radius:.65rem;padding:0 .75rem;background:#0f0d13;color:#8f879a}.picker-search input{flex:1;min-width:0;border:0;background:transparent;color:#f4f1f7;font:inherit;font-size:.86rem;outline:none}.picker-search:focus-within{border-color:#7a57de}.picker-tabs{display:flex;gap:.2rem;border:1px solid #2f2a37;border-radius:.65rem;padding:.2rem;background:#0f0d13}.picker-tabs button{border:1px solid transparent;border-radius:.5rem;padding:.35rem .8rem;background:transparent;color:#a79fb2;font:inherit;font-size:.8rem;font-weight:600;cursor:pointer;white-space:nowrap}.picker-tabs button.active{border-color:#5b3fb0;background:#231a3d;color:#fff}.picker-collection{flex:0 1 13rem;width:auto}.picker-body{display:grid;flex:1;grid-template-columns:repeat(auto-fill,minmax(12.5rem,1fr));gap:.8rem;align-content:start;overflow:auto;padding:1rem 1.25rem}.no-results{grid-column:1/-1}.picker-footer{display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:.7rem 1.25rem;border-top:1px solid #242027;color:#8f879a;font-size:.78rem}.picker-footer a{display:inline-flex;align-items:center;gap:.3rem;color:#b69cff;text-decoration:none}
@media(max-width:800px){.selected-media{grid-template-columns:6rem minmax(0,1fr)}.selected-media img,.media-placeholder{width:6rem;height:4.5rem}.picker-body{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:520px){.picker-backdrop{padding:0}.picker-modal{width:100%;height:100dvh;border:0;border-radius:0}.picker-tabs{flex:1 1 100%;overflow-x:auto}.picker-tabs button{flex:1}.picker-collection{flex:1 1 100%}.picker-body{padding:.75rem;gap:.6rem}.field-heading{align-items:start;flex-direction:column}.selected-media{grid-template-columns:5rem minmax(0,1fr)}.selected-media img,.media-placeholder{width:5rem;height:4rem}}
</style>
