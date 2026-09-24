<script setup lang="ts">
import MediaPopover from '~/components/media/MediaPopover.vue'
import { apiErrorMessage } from '~/utils/api-error'
import { mediaApi, mediaArchiveUrl, mediaDownloadUrl, mediaPublicUrl, startDownload } from '~/composables/useMediaLibrary'
import { mediaKindFromMime } from '~~/shared/media'
import {
  collectMediaTags,
  formatMediaBytes,
  formatMediaDate,
  formatMediaDuration,
  mediaDisplayTitle,
  mediaFamily,
  mediaTypeLabel,
  relatedMediaItems,
  type MediaCollectionSummary,
  type MediaLibraryItem,
} from '~~/shared/media-library'

const props = defineProps<{
  /** The asset being inspected. */
  item: MediaLibraryItem
  /** The filtered, sorted list that next/previous walks through. */
  sequence: MediaLibraryItem[]
  assets: MediaLibraryItem[]
  collections: MediaCollectionSummary[]
  gigs: Array<{ id: string, title: string }>
  venues: Array<{ id: string, name: string }>
  startInEdit?: boolean
}>()

const emit = defineEmits<{
  close: []
  navigate: [id: string]
  changed: []
  notify: [message: string, tone?: 'error']
  uploadVariant: [item: MediaLibraryItem]
  delete: [item: MediaLibraryItem]
}>()

const editing = ref(Boolean(props.startInEdit))
const saving = ref(false)
const addingTag = ref(false)
const newTag = ref('')
const downloadMenu = ref(false)
const form = reactive({
  title: '',
  altText: '',
  tags: '',
  gigId: '',
  venueId: '',
  parentAssetId: '',
  variantLabel: '',
  collectionIds: [] as string[],
})

const kind = computed(() => mediaKindFromMime(props.item.mimeType))
const title = computed(() => mediaDisplayTitle(props.item))
const position = computed(() => props.sequence.findIndex(entry => entry.id === props.item.id))
const family = computed(() => mediaFamily(props.assets, props.item))
const familyItems = computed(() => [family.value.original, ...family.value.variants])
const related = computed(() => relatedMediaItems(props.assets, props.item))
const parent = computed(() => props.item.parentAssetId ? props.assets.find(asset => asset.id === props.item.parentAssetId) || null : null)
const tagSuggestions = computed(() => collectMediaTags(props.assets).filter(tag => !props.item.tags.includes(tag)).slice(0, 30))
const memberCollections = computed(() => props.collections.filter(collection => props.item.collectionIds.includes(collection.id)))
const parentOptions = computed(() => {
  // A variant can hang under any original except itself and its own variants.
  const blocked = new Set([props.item.id, ...props.assets.filter(asset => asset.parentAssetId === props.item.id).map(asset => asset.id)])
  return props.assets
    .filter(asset => !blocked.has(asset.id) && !asset.parentAssetId)
    .map(asset => ({ id: asset.id, label: mediaDisplayTitle(asset) }))
    .sort((a, b) => a.label.localeCompare(b.label, 'nl', { numeric: true }))
})
const sourceLabel = computed(() => ({
  upload: 'Geüpload',
  url: 'Geïmporteerd via URL',
  generated: 'Gegenereerd door NightLight',
  derived: 'Bewerkte variant',
}[props.item.source]))

function fillForm() {
  form.title = props.item.title
  form.altText = props.item.altText
  form.tags = props.item.tags.join(', ')
  form.gigId = props.item.gigId || ''
  form.venueId = props.item.venueId || ''
  form.parentAssetId = props.item.parentAssetId || ''
  form.variantLabel = props.item.variantLabel
  form.collectionIds = [...props.item.collectionIds]
}

watch(() => props.item.id, () => {
  fillForm()
  addingTag.value = false
  if (!props.startInEdit) editing.value = false
}, { immediate: true })

function go(offset: number) {
  const next = props.sequence[position.value + offset]
  if (next) emit('navigate', next.id)
}

async function save() {
  saving.value = true
  try {
    await mediaApi.update(props.item.id, {
      title: form.title,
      altText: form.altText,
      tags: form.tags,
      gigId: form.gigId || null,
      venueId: form.venueId || null,
      parentAssetId: form.parentAssetId || null,
      variantLabel: form.parentAssetId ? form.variantLabel : '',
      collectionIds: form.collectionIds,
    })
    editing.value = false
    emit('changed')
    emit('notify', 'Gegevens opgeslagen.')
  } catch (error) {
    emit('notify', apiErrorMessage(error, 'Gegevens opslaan is niet gelukt.'), 'error')
  } finally {
    saving.value = false
  }
}

async function addTag() {
  const tag = newTag.value.trim()
  if (!tag) {
    addingTag.value = false
    return
  }
  try {
    await mediaApi.update(props.item.id, { tags: [...props.item.tags, tag] })
    newTag.value = ''
    addingTag.value = false
    emit('changed')
  } catch (error) {
    emit('notify', apiErrorMessage(error, 'Tag toevoegen is niet gelukt.'), 'error')
  }
}

async function removeTag(tag: string) {
  try {
    await mediaApi.update(props.item.id, { tags: props.item.tags.filter(existing => existing !== tag) })
    emit('changed')
  } catch (error) {
    emit('notify', apiErrorMessage(error, 'Tag verwijderen is niet gelukt.'), 'error')
  }
}

function toggleCollection(id: string) {
  form.collectionIds = form.collectionIds.includes(id)
    ? form.collectionIds.filter(existing => existing !== id)
    : [...form.collectionIds, id]
}

async function copyLink() {
  try {
    await navigator.clipboard.writeText(mediaPublicUrl(props.item))
    emit('notify', 'Link gekopieerd.')
  } catch {
    emit('notify', 'Geen toegang tot het klembord.', 'error')
  }
}

function download(kindOfDownload: 'original' | 'family') {
  downloadMenu.value = false
  startDownload(kindOfDownload === 'family' ? mediaArchiveUrl(familyItems.value.map(entry => entry.id)) : mediaDownloadUrl(props.item))
}

function onKey(event: KeyboardEvent) {
  const target = event.target as HTMLElement | null
  if (target?.closest('input, textarea, select, [contenteditable="true"]')) {
    if (event.key === 'Escape') target.blur()
    return
  }
  if (event.key === 'Escape') emit('close')
  if (event.key === 'ArrowRight') go(1)
  if (event.key === 'ArrowLeft') go(-1)
}
onMounted(() => document.addEventListener('keydown', onKey))
onBeforeUnmount(() => document.removeEventListener('keydown', onKey))
</script>

<template>
  <Teleport to="body">
    <div class="layer">
      <button type="button" class="mh-backdrop" aria-label="Voorbeeld sluiten" @click="emit('close')" />
      <section class="inspector" role="dialog" aria-modal="true" :aria-label="title">
        <button type="button" class="mh-icon-btn close" aria-label="Sluiten" @click="emit('close')"><Icon name="lucide:x" aria-hidden="true" /></button>

        <div class="stage">
          <div class="preview" :data-kind="kind">
            <img v-if="kind === 'image'" :key="item.id" :src="item.url" :alt="item.altText || title">
            <video v-else-if="kind === 'video'" :key="item.id" :src="item.url" :poster="item.thumbnailUrl || undefined" controls playsinline preload="metadata" />
            <div v-else class="audio">
              <Icon name="lucide:audio-lines" aria-hidden="true" />
              <audio :key="item.id" :src="item.url" controls preload="metadata" />
            </div>
            <button v-if="position > 0" type="button" class="nav prev" aria-label="Vorige" @click="go(-1)"><Icon name="lucide:chevron-left" aria-hidden="true" /></button>
            <button v-if="position >= 0 && position < sequence.length - 1" type="button" class="nav next" aria-label="Volgende" @click="go(1)"><Icon name="lucide:chevron-right" aria-hidden="true" /></button>
            <span v-if="position >= 0" class="counter">{{ position + 1 }} / {{ sequence.length }}</span>
          </div>

          <div v-if="familyItems.length > 1" class="strip">
            <h3>Origineel &amp; varianten <span>{{ familyItems.length }}</span></h3>
            <div class="strip-items">
              <button
                v-for="entry in familyItems"
                :key="entry.id"
                type="button"
                class="strip-item"
                :class="{ current: entry.id === item.id }"
                :title="mediaDisplayTitle(entry)"
                @click="emit('navigate', entry.id)"
              >
                <img v-if="entry.thumbnailUrl" :src="entry.thumbnailUrl" alt="" loading="lazy">
                <span v-else class="strip-placeholder"><Icon name="lucide:film" aria-hidden="true" /></span>
                <span class="strip-label">{{ entry.parentAssetId ? entry.variantLabel || 'Variant' : 'Origineel' }}</span>
                <span v-if="entry.durationMs" class="strip-duration"><Icon name="lucide:play" aria-hidden="true" />{{ formatMediaDuration(entry.durationMs) }}</span>
              </button>
            </div>
          </div>
          <div v-if="related.length" class="strip">
            <h3>Gerelateerde media</h3>
            <div class="strip-items">
              <button
                v-for="entry in related"
                :key="entry.id"
                type="button"
                class="strip-item"
                :title="mediaDisplayTitle(entry)"
                @click="emit('navigate', entry.id)"
              >
                <img v-if="entry.thumbnailUrl" :src="entry.thumbnailUrl" alt="" loading="lazy">
                <span v-else class="strip-placeholder"><Icon name="lucide:film" aria-hidden="true" /></span>
                <span v-if="entry.durationMs" class="strip-duration"><Icon name="lucide:play" aria-hidden="true" />{{ formatMediaDuration(entry.durationMs) }}</span>
              </button>
            </div>
          </div>
        </div>

        <div class="details">
          <template v-if="!editing">
            <h2>{{ title }}</h2>
            <div class="facts">
              <span><Icon name="lucide:file-image" aria-hidden="true" />{{ mediaTypeLabel(item) }}</span>
              <span v-if="item.width && item.height"><Icon name="lucide:scan" aria-hidden="true" />{{ item.width }}<IconTimes />{{ item.height }}</span>
              <span v-if="item.durationMs"><Icon name="lucide:timer" aria-hidden="true" />{{ formatMediaDuration(item.durationMs) }}</span>
              <span><Icon name="lucide:hard-drive" aria-hidden="true" />{{ formatMediaBytes(item.byteSize) }}</span>
            </div>
            <p class="filename" :title="item.originalFilename"><Icon name="lucide:file" aria-hidden="true" />{{ item.originalFilename }}</p>

            <div class="tag-row">
              <button v-for="tag in item.tags" :key="tag" type="button" class="mh-tag removable" :title="`${tag} verwijderen`" @click="removeTag(tag)">{{ tag }}</button>
              <form v-if="addingTag" class="tag-form" @submit.prevent="addTag">
                <input v-model="newTag" class="mh-input" list="inspector-tags" placeholder="Nieuwe tag" autofocus @blur="addTag">
                <datalist id="inspector-tags"><option v-for="tag in tagSuggestions" :key="tag" :value="tag" /></datalist>
              </form>
              <button v-else type="button" class="mh-tag removable add-tag" @click="addingTag = true">+ Tag toevoegen</button>
            </div>

            <dl class="rows">
              <div>
                <dt><Icon name="lucide:calendar-days" aria-hidden="true" />Gekoppelde gig</dt>
                <dd>
                  <NuxtLink v-if="item.gigId" :to="`/admin/gigs/${item.gigId}`">{{ item.gigTitle }}<Icon name="lucide:chevron-right" aria-hidden="true" /></NuxtLink>
                  <span v-else class="muted">Geen</span>
                </dd>
              </div>
              <div>
                <dt><Icon name="lucide:map-pin" aria-hidden="true" />Gekoppelde locatie</dt>
                <dd>
                  <NuxtLink v-if="item.venueId" :to="`/admin/venues/${item.venueId}`">{{ item.venueName }}<Icon name="lucide:chevron-right" aria-hidden="true" /></NuxtLink>
                  <span v-else class="muted">Geen</span>
                </dd>
              </div>
              <div>
                <dt><Icon name="lucide:calendar-plus" aria-hidden="true" />Toegevoegd</dt>
                <dd>{{ formatMediaDate(item.createdAt, true) }}</dd>
              </div>
              <div>
                <dt><Icon name="lucide:inbox" aria-hidden="true" />Bron</dt>
                <dd>{{ sourceLabel }}</dd>
              </div>
              <div v-if="parent">
                <dt><Icon name="lucide:git-branch" aria-hidden="true" />Variant van</dt>
                <dd><button type="button" class="link" @click="emit('navigate', parent.id)">{{ mediaDisplayTitle(parent) }}<Icon name="lucide:chevron-right" aria-hidden="true" /></button></dd>
              </div>
              <div v-if="memberCollections.length">
                <dt><Icon name="lucide:folder" aria-hidden="true" />Collecties</dt>
                <dd>{{ memberCollections.map(collection => collection.name).join(', ') }}</dd>
              </div>
            </dl>

            <div class="usage">
              <h3>Gebruikt in</h3>
              <ul v-if="item.usage.length">
                <li v-for="entry in item.usage" :key="`${entry.kind}-${entry.label}`">
                  <NuxtLink v-if="entry.to" :to="entry.to">
                    <Icon :name="entry.kind === 'website' ? 'lucide:globe' : entry.kind === 'landing_page' ? 'lucide:panels-top-left' : entry.kind === 'post_generator' ? 'lucide:image' : 'lucide:clapperboard'" aria-hidden="true" />
                    <span>{{ entry.label }}</span>
                    <Icon name="lucide:circle-check" class="ok" aria-hidden="true" />
                    <Icon name="lucide:chevron-right" aria-hidden="true" />
                  </NuxtLink>
                </li>
              </ul>
              <p v-else class="muted">Nog nergens gebruikt.</p>
            </div>

            <div class="actions">
              <button type="button" class="mh-btn primary block" @click="editing = true"><Icon name="lucide:pencil" aria-hidden="true" />Gegevens bewerken</button>
              <div class="action-pair">
                <button type="button" class="mh-btn" @click="copyLink"><Icon name="lucide:link" aria-hidden="true" />Link kopiëren</button>
                <div class="split">
                  <button type="button" class="mh-btn" @click="download('original')"><Icon name="lucide:download" aria-hidden="true" />Downloaden</button>
                  <MediaPopover v-model:open="downloadMenu" align="end" placement="top">
                    <template #trigger="{ toggle }">
                      <button type="button" class="mh-btn caret" aria-label="Meer downloadopties" @click="toggle"><Icon name="lucide:chevron-down" aria-hidden="true" /></button>
                    </template>
                    <button type="button" class="mh-menu-item" @click="download('original')"><Icon name="lucide:file-down" aria-hidden="true" />Origineel bestand</button>
                    <button type="button" class="mh-menu-item" :disabled="familyItems.length < 2" @click="download('family')"><Icon name="lucide:folder-down" aria-hidden="true" />Origineel + {{ family.variants.length }} variant{{ family.variants.length === 1 ? '' : 'en' }} (ZIP)</button>
                  </MediaPopover>
                </div>
              </div>
              <div class="action-pair">
                <button type="button" class="mh-btn ghost" @click="emit('uploadVariant', item)"><Icon name="lucide:layers" aria-hidden="true" />Variant uploaden</button>
                <button type="button" class="mh-btn ghost danger-text" @click="emit('delete', item)"><Icon name="lucide:trash-2" aria-hidden="true" />Verwijderen</button>
              </div>
            </div>
          </template>

          <form v-else class="edit" @submit.prevent="save">
            <h2>Gegevens bewerken</h2>
            <p class="filename"><Icon name="lucide:file" aria-hidden="true" />{{ item.originalFilename }}</p>
            <label class="mh-field"><span>Titel</span><input v-model="form.title" class="mh-input" maxlength="240" :placeholder="title"></label>
            <label class="mh-field"><span>Alt-tekst</span><textarea v-model="form.altText" class="mh-textarea" rows="2" maxlength="500" placeholder="Beschrijf de media voor toegankelijkheid" /></label>
            <label class="mh-field"><span>Tags</span><input v-model="form.tags" class="mh-input" placeholder="Gescheiden door komma’s"></label>
            <div class="two">
              <label class="mh-field">
                <span>Gig</span>
                <select v-model="form.gigId" class="mh-select">
                  <option value="">Geen</option>
                  <option v-for="gig in gigs" :key="gig.id" :value="gig.id">{{ gig.title }}</option>
                </select>
              </label>
              <label class="mh-field">
                <span>Locatie</span>
                <select v-model="form.venueId" class="mh-select">
                  <option value="">Geen</option>
                  <option v-for="venue in venues" :key="venue.id" :value="venue.id">{{ venue.name }}</option>
                </select>
              </label>
            </div>
            <div v-if="collections.length" class="mh-field">
              <span>Collecties</span>
              <div class="chips">
                <button
                  v-for="collection in collections"
                  :key="collection.id"
                  type="button"
                  class="mh-tag removable"
                  :class="{ on: form.collectionIds.includes(collection.id) }"
                  :aria-pressed="form.collectionIds.includes(collection.id)"
                  @click="toggleCollection(collection.id)"
                >
                  <Icon :name="form.collectionIds.includes(collection.id) ? 'lucide:check' : 'lucide:plus'" aria-hidden="true" />{{ collection.name }}
                </button>
              </div>
            </div>
            <label class="mh-field">
              <span>Variant van</span>
              <select v-model="form.parentAssetId" class="mh-select">
                <option value="">Geen variant (origineel)</option>
                <option v-for="option in parentOptions" :key="option.id" :value="option.id">{{ option.label }}</option>
              </select>
            </label>
            <label v-if="form.parentAssetId" class="mh-field">
              <span>Variantlabel</span>
              <input v-model="form.variantLabel" class="mh-input" maxlength="80" placeholder="bijv. Story 9:16-uitsnede">
            </label>
            <div class="action-pair">
              <button type="button" class="mh-btn" :disabled="saving" @click="editing = false; fillForm()">Annuleren</button>
              <button type="submit" class="mh-btn primary" :disabled="saving">{{ saving ? 'Opslaan…' : 'Opslaan' }}</button>
            </div>
          </form>
        </div>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.layer { position: fixed; inset: 0; z-index: 1050; display: grid; place-items: center; padding: 1.25rem; }
.layer .mh-backdrop { border: 0; cursor: default; }
.inspector {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1.55fr) minmax(19rem, 1fr);
  gap: 1.75rem;
  width: min(1060px, 100%);
  max-height: calc(100dvh - 2.5rem);
  overflow: auto;
  border: 1px solid #2c2733;
  border-radius: 1.2rem;
  padding: 1.75rem;
  background: #0f0d13;
  box-shadow: 0 2rem 6rem rgba(0, 0, 0, .65), 0 0 0 1px rgba(157, 92, 255, .05);
}
.close { position: absolute; top: 1rem; right: 1rem; z-index: 2; border-color: transparent; background: transparent; }
.stage { display: grid; align-content: start; gap: 1.25rem; min-width: 0; }
.preview { position: relative; display: grid; place-items: center; overflow: hidden; min-height: 18rem; max-height: 62dvh; border-radius: .9rem; background: #07060a; }
.preview img, .preview video { display: block; width: 100%; max-height: 62dvh; object-fit: contain; }
.audio { display: grid; justify-items: center; gap: 1rem; width: 100%; padding: 3rem 1.5rem; color: #a78bfa; }
.audio > .iconify { width: 3rem; height: 3rem; }
.audio audio { width: 100%; }
.nav {
  position: absolute;
  top: 50%;
  display: grid;
  width: 2.6rem;
  height: 2.6rem;
  place-items: center;
  transform: translateY(-50%);
  border: 1px solid rgba(255, 255, 255, .14);
  border-radius: 50%;
  background: rgba(10, 9, 13, .6);
  color: #fff;
  font-size: 1.2rem;
  cursor: pointer;
  backdrop-filter: blur(6px);
}
.nav:hover { background: rgba(32, 27, 40, .9); }
.prev { left: .9rem; }
.next { right: .9rem; }
.counter { position: absolute; right: .9rem; bottom: .9rem; border-radius: .45rem; padding: .25rem .5rem; background: rgba(10, 9, 13, .7); color: #fff; font-size: .74rem; font-weight: 700; }
.strip h3 { margin: 0 0 .65rem; font-size: .95rem; }
.strip h3 span { margin-left: .3rem; color: #8f879a; font-weight: 500; }
.strip-items { display: grid; grid-auto-columns: max(7rem, calc((100% - 2.4rem) / 5)); grid-auto-flow: column; gap: .6rem; overflow-x: auto; padding-bottom: .25rem; }
.strip-item { position: relative; overflow: hidden; aspect-ratio: 16 / 10; border: 1px solid #2a2530; border-radius: .6rem; padding: 0; background: #09080c; cursor: pointer; }
.strip-item img { display: block; width: 100%; height: 100%; object-fit: cover; }
.strip-item.current { border-color: #a78bfa; box-shadow: 0 0 0 1px #a78bfa, 0 0 1rem rgba(139, 92, 246, .35); }
.strip-placeholder { display: grid; width: 100%; height: 100%; place-items: center; color: #6f6878; }
.strip-label { position: absolute; right: .3rem; bottom: .3rem; left: .3rem; overflow: hidden; border-radius: .35rem; padding: .15rem .35rem; background: rgba(8, 7, 11, .75); color: #efeaf4; font-size: .66rem; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
.strip-duration { position: absolute; right: .3rem; bottom: .3rem; display: inline-flex; align-items: center; gap: .2rem; border-radius: .35rem; padding: .15rem .35rem; background: rgba(8, 7, 11, .75); color: #fff; font-size: .66rem; font-weight: 700; }
.strip-label + .strip-duration { bottom: auto; top: .3rem; }

.details { display: grid; align-content: start; gap: 1.1rem; min-width: 0; }
.details h2 { margin: 0; padding-right: 2.5rem; font-size: 1.6rem; letter-spacing: -.03em; overflow-wrap: anywhere; }
.facts { display: flex; flex-wrap: wrap; gap: .45rem 1.1rem; color: #b3abbd; font-size: .8rem; }
.facts span { display: inline-flex; align-items: center; gap: .4rem; }
.facts .iconify { color: #8f879a; }
.filename { display: flex; align-items: center; gap: .45rem; margin: -.35rem 0 0; overflow: hidden; color: #7d7686; font-size: .76rem; text-overflow: ellipsis; white-space: nowrap; }
.tag-row { display: flex; flex-wrap: wrap; gap: .4rem; }
.tag-row .mh-tag { font: inherit; font-size: .76rem; padding: .3rem .75rem; }
.add-tag { border-style: dashed; color: #a79fb2; }
.tag-form .mh-input { width: 8rem; min-height: 1.9rem; padding: .25rem .6rem; border-radius: 999px; font-size: .76rem; }
.rows { display: grid; gap: .1rem; margin: 0; border-top: 1px solid #221e28; padding-top: .6rem; }
.rows > div { display: flex; align-items: center; justify-content: space-between; gap: 1rem; min-height: 2.2rem; }
.rows dt { display: inline-flex; align-items: center; gap: .6rem; color: #a79fb2; font-size: .82rem; }
.rows dt .iconify { color: #7d7686; }
.rows dd { overflow: hidden; margin: 0; color: #f1edf5; font-size: .84rem; font-weight: 600; text-align: right; text-overflow: ellipsis; white-space: nowrap; }
.rows a, .link { display: inline-flex; align-items: center; gap: .3rem; border: 0; padding: 0; background: none; color: #f1edf5; font: inherit; text-decoration: none; cursor: pointer; }
.rows a:hover, .link:hover { color: #c4b1f5; }
.muted { color: #7d7686; font-weight: 400; }
.usage h3 { margin: 0 0 .45rem; font-size: .88rem; }
.usage ul { display: grid; gap: .1rem; margin: 0; padding: 0; list-style: none; }
.usage a { display: grid; grid-template-columns: 1.2rem minmax(0, 1fr) auto auto; align-items: center; gap: .6rem; border-radius: .5rem; padding: .45rem .3rem; color: #e6e1eb; font-size: .84rem; text-decoration: none; }
.usage a:hover { background: #17141c; }
.usage a span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.usage .ok { color: #4ade80; }
.usage p { margin: 0; font-size: .82rem; }
.actions { display: grid; gap: .6rem; margin-top: .3rem; }
.actions .mh-btn.primary { min-height: 2.9rem; }
.action-pair { display: grid; grid-template-columns: 1fr 1fr; gap: .6rem; }
.split { display: flex; min-width: 0; }
.split > .mh-btn { flex: 1; border-radius: .65rem 0 0 .65rem; }
.split .caret { border-left: 0; border-radius: 0 .65rem .65rem 0; padding-inline: .6rem; }
.split :deep(.popover-panel) { min-width: 16rem; }
.danger-text { color: #f39aa6; }
.danger-text:hover { color: #ffc0c8; }
.edit { display: grid; gap: .85rem; }
.two { display: grid; grid-template-columns: 1fr 1fr; gap: .7rem; }
.chips { display: flex; flex-wrap: wrap; gap: .4rem; }
.chips .mh-tag { font: inherit; font-size: .76rem; }
.chips .mh-tag.on { border-color: #7c5ad9; background: #241a3d; color: #fff; }

@media (max-width: 900px) {
  .layer { padding: 0; }
  .inspector { width: 100%; grid-template-columns: minmax(0, 1fr); gap: 1.25rem; max-height: 100dvh; height: 100dvh; border: 0; border-radius: 0; padding: 1rem 1rem calc(1.5rem + env(safe-area-inset-bottom)); }
  .close { top: .75rem; right: .75rem; background: rgba(10, 9, 13, .7); }
  .preview { min-height: 12rem; max-height: 50dvh; }
  .preview img, .preview video { max-height: 50dvh; }
  .stage { display: contents; }
  .strip { order: 2; }
}
@media (max-width: 460px) {
  .two, .action-pair { grid-template-columns: 1fr; }
}
</style>
