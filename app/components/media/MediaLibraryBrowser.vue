<script setup lang="ts">
import type { LibraryEntry, LibraryListing } from '~~/shared/media-library-browse'
import { formatMediaBytes } from '~~/shared/media-library'

// Browses the server media folder. Files are linked into the library in
// place, so picking them costs no upload. Selection survives folder changes.

const props = defineProps<{
  modelValue: string[]
  /** `image` hides video and audio, for image-only pickers. */
  kind: 'image' | 'all'
  disabled?: boolean
}>()
const emit = defineEmits<{ 'update:modelValue': [paths: string[]] }>()

const path = ref('')
const listing = ref<Extract<LibraryListing, { enabled: true }> | null>(null)
const loading = ref(false)
const error = ref('')

async function load(next: string) {
  loading.value = true
  error.value = ''
  try {
    const result = await $fetch<LibraryListing>('/api/admin/media/library/browse', { query: { path: next, kind: props.kind } })
    if (!result.enabled) {
      error.value = 'De servermap is niet ingesteld.'
      return
    }
    listing.value = result
    path.value = result.path
  } catch (caught) {
    error.value = (caught as { statusMessage?: string, data?: { statusMessage?: string } })?.data?.statusMessage
      || (caught as { statusMessage?: string })?.statusMessage
      || 'Deze map openen is niet gelukt.'
  } finally {
    loading.value = false
  }
}

onMounted(() => load(''))

const crumbs = computed(() => {
  const parts = path.value ? path.value.split('/') : []
  return parts.map((name, index) => ({ name, path: parts.slice(0, index + 1).join('/') }))
})
const selectable = computed(() => (listing.value?.entries || []).filter(entry => isSelectable(entry)))
const allSelected = computed(() => selectable.value.length > 0 && selectable.value.every(entry => props.modelValue.includes(entry.path)))

function isSelectable(entry: LibraryEntry) {
  return entry.kind === 'file' && !entry.tooLarge && !entry.assetId
}

function toggle(entry: LibraryEntry) {
  if (!isSelectable(entry) || props.disabled) return
  emit('update:modelValue', props.modelValue.includes(entry.path)
    ? props.modelValue.filter(item => item !== entry.path)
    : [...props.modelValue, entry.path])
}

function toggleAll() {
  const paths = selectable.value.map(entry => entry.path)
  emit('update:modelValue', allSelected.value
    ? props.modelValue.filter(item => !paths.includes(item))
    : [...new Set([...props.modelValue, ...paths])])
}

function icon(entry: LibraryEntry) {
  if (entry.kind === 'directory') return 'lucide:folder'
  return { image: 'lucide:image', video: 'lucide:film', audio: 'lucide:audio-lines' }[entry.mediaKind || 'image']
}
</script>

<template>
  <div class="browser">
    <nav class="crumbs" aria-label="Map in de servermap">
      <button type="button" :disabled="loading" @click="load('')"><Icon name="lucide:house" aria-hidden="true" />Servermap</button>
      <template v-for="crumb in crumbs" :key="crumb.path">
        <Icon name="lucide:chevron-right" class="sep" aria-hidden="true" />
        <button type="button" :disabled="loading" @click="load(crumb.path)">{{ crumb.name }}</button>
      </template>
    </nav>

    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p v-else-if="loading && !listing" class="hint">Laden…</p>

    <template v-else-if="listing">
      <div v-if="selectable.length" class="bar">
        <button type="button" class="link" :disabled="disabled" @click="toggleAll">{{ allSelected ? 'Niets selecteren' : `Alles in deze map selecteren (${selectable.length})` }}</button>
      </div>
      <ul class="entries" :aria-busy="loading">
        <li v-if="listing.parent !== null">
          <button type="button" class="entry" :disabled="loading" @click="load(listing.parent!)"><Icon name="lucide:corner-left-up" aria-hidden="true" /><span class="name">Eén map omhoog</span></button>
        </li>
        <li v-for="entry in listing.entries" :key="entry.path">
          <button v-if="entry.kind === 'directory'" type="button" class="entry" :disabled="loading" @click="load(entry.path)">
            <Icon :name="icon(entry)" aria-hidden="true" /><span class="name">{{ entry.name }}</span><Icon name="lucide:chevron-right" class="sep" aria-hidden="true" />
          </button>
          <button
            v-else
            type="button"
            class="entry file"
            :class="{ on: modelValue.includes(entry.path) }"
            role="checkbox"
            :aria-checked="modelValue.includes(entry.path)"
            :disabled="disabled || !isSelectable(entry)"
            :title="entry.tooLarge ? 'Dit bestand is te groot om te koppelen' : entry.assetId ? 'Staat al in de bibliotheek' : entry.name"
            @click="toggle(entry)"
          >
            <Icon :name="modelValue.includes(entry.path) ? 'lucide:square-check' : icon(entry)" aria-hidden="true" />
            <span class="name">{{ entry.name }}</span>
            <span v-if="entry.assetId" class="badge">In bibliotheek</span>
            <span v-else-if="entry.tooLarge" class="badge bad">Te groot</span>
            <span class="size">{{ formatMediaBytes(entry.size || 0) }}</span>
          </button>
        </li>
        <li v-if="!listing.entries.length" class="hint">Geen ondersteunde bestanden of mappen hier.</li>
      </ul>
      <p v-if="listing.truncated" class="hint">Alleen de eerste items van deze map worden getoond.</p>
    </template>
    <p class="note">Bestanden worden gekoppeld, niet gekopieerd of geüpload. Verplaats of verwijder je ze op de server, dan werkt de media in NightLight niet meer.</p>
  </div>
</template>

<style scoped>
.browser { display: grid; gap: .6rem; }
.crumbs { display: flex; flex-wrap: wrap; align-items: center; gap: .15rem; font-size: .8rem; }
.crumbs button, .link { display: inline-flex; align-items: center; gap: .3rem; border: 0; padding: .2rem .35rem; background: transparent; color: #b69cff; font: inherit; font-weight: 600; cursor: pointer; }
.crumbs button:disabled { cursor: default; opacity: .6; }
.sep { color: var(--text-subtle); font-size: .8rem; }
.bar { display: flex; justify-content: flex-end; }
.entries { display: grid; gap: .25rem; max-height: 22rem; margin: 0; padding: 0; overflow: auto; list-style: none; }
.entry { display: flex; align-items: center; gap: .6rem; width: 100%; border: 1px solid #2c2733; border-radius: .6rem; padding: .55rem .7rem; background: #09080c; color: #efeaf4; font: inherit; font-size: .82rem; text-align: left; cursor: pointer; }
.entry:hover:not(:disabled) { border-color: #5b4a86; }
.entry:disabled { cursor: default; opacity: .55; }
.entry.on { border-color: #7c5ad9; background: #241a3d; }
.entry:focus-visible, .crumbs button:focus-visible, .link:focus-visible { outline: 2px solid #8b5cf6; outline-offset: 2px; }
.name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.size { color: var(--text-subtle); font-size: .74rem; }
.badge { border-radius: 999px; padding: .1rem .5rem; background: #1e2a22; color: #9fe6b4; font-size: .7rem; }
.badge.bad { background: #3a1a21; color: #f6aab5; }
.hint, .note { margin: 0; color: var(--text-subtle); font-size: .76rem; line-height: 1.5; }
.error { margin: 0; color: #f39aa6; font-size: .8rem; }
</style>
