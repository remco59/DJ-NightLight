<script setup lang="ts">
import { MEDIA_SOURCES } from '~~/shared/media'
import { defaultMediaFilters, type MediaLibraryFilters } from '~~/shared/media-library'

// The filters object is shared with the page and edited in place.
const filters = defineModel<MediaLibraryFilters>('filters', { required: true })
const props = defineProps<{
  tags: string[]
  gigs: Array<{ id: string, title: string }>
  venues: Array<{ id: string, name: string }>
}>()

const emit = defineEmits<{ done: [] }>()

const sourceLabels: Record<typeof MEDIA_SOURCES[number], string> = {
  upload: 'Geüpload',
  url: 'Via URL',
  generated: 'Gegenereerd',
  derived: 'Bewerkte variant',
}
const showAllTags = ref(false)
const visibleTags = computed(() => showAllTags.value ? props.tags : props.tags.slice(0, 18))

function toggleTag(tag: string) {
  filters.value.tags = filters.value.tags.includes(tag)
    ? filters.value.tags.filter(existing => existing !== tag)
    : [...filters.value.tags, tag]
}

function reset() {
  const clean = defaultMediaFilters()
  Object.assign(filters.value, {
    kind: clean.kind,
    gigId: clean.gigId,
    venueId: clean.venueId,
    tags: clean.tags,
    source: clean.source,
    orientation: clean.orientation,
    added: clean.added,
    usage: clean.usage,
    variants: clean.variants,
  })
}
</script>

<template>
  <div class="filters">
    <header>
      <strong>Filters</strong>
      <button type="button" class="reset" @click="reset">Herstellen</button>
    </header>
    <div class="grid">
      <label class="mh-field">
        <span>Mediatype</span>
        <select v-model="filters.kind" class="mh-select">
          <option value="">Elk type</option>
          <option value="image">Afbeeldingen</option>
          <option value="video">Video’s</option>
          <option value="audio">Audio</option>
        </select>
      </label>
      <label class="mh-field">
        <span>Bron</span>
        <select v-model="filters.source" class="mh-select">
          <option value="">Elke bron</option>
          <option v-for="source in MEDIA_SOURCES" :key="source" :value="source">{{ sourceLabels[source] }}</option>
        </select>
      </label>
      <label class="mh-field">
        <span>Gig</span>
        <select v-model="filters.gigId" class="mh-select">
          <option value="">Elke gig</option>
          <option value="none">Niet gekoppeld aan een gig</option>
          <option v-for="gig in gigs" :key="gig.id" :value="gig.id">{{ gig.title }}</option>
        </select>
      </label>
      <label class="mh-field">
        <span>Locatie</span>
        <select v-model="filters.venueId" class="mh-select">
          <option value="">Elke locatie</option>
          <option value="none">Niet gekoppeld aan een locatie</option>
          <option v-for="venue in venues" :key="venue.id" :value="venue.id">{{ venue.name }}</option>
        </select>
      </label>
      <label class="mh-field">
        <span>Toegevoegd</span>
        <select v-model="filters.added" class="mh-select">
          <option value="">Altijd</option>
          <option value="7d">Afgelopen 7 dagen</option>
          <option value="30d">Afgelopen 30 dagen</option>
          <option value="90d">Afgelopen 90 dagen</option>
          <option value="365d">Afgelopen jaar</option>
        </select>
      </label>
      <label class="mh-field">
        <span>Oriëntatie</span>
        <select v-model="filters.orientation" class="mh-select">
          <option value="">Elke oriëntatie</option>
          <option value="landscape">Liggend</option>
          <option value="portrait">Staand</option>
          <option value="square">Vierkant</option>
        </select>
      </label>
      <label class="mh-field">
        <span>Gebruik</span>
        <select v-model="filters.usage" class="mh-select">
          <option value="">Gebruikt of ongebruikt</option>
          <option value="used">Ergens gebruikt</option>
          <option value="unused">Nog niet gebruikt</option>
        </select>
      </label>
      <label class="mh-field">
        <span>Varianten</span>
        <select v-model="filters.variants" class="mh-select">
          <option value="">Originelen en varianten</option>
          <option value="originals">Alleen originelen</option>
          <option value="variants">Alleen varianten</option>
        </select>
      </label>
    </div>
    <div v-if="tags.length" class="mh-field tags">
      <span>Tags <small>(alle gekozen tags moeten kloppen)</small></span>
      <div class="chips">
        <button
          v-for="tag in visibleTags"
          :key="tag"
          type="button"
          class="mh-tag removable"
          :class="{ on: filters.tags.includes(tag) }"
          :aria-pressed="filters.tags.includes(tag)"
          @click="toggleTag(tag)"
        >
          {{ tag }}
        </button>
        <button v-if="tags.length > 18" type="button" class="more" @click="showAllTags = !showAllTags">
          {{ showAllTags ? 'Minder tonen' : `+${tags.length - 18} meer` }}
        </button>
      </div>
    </div>
    <footer>
      <button type="button" class="mh-btn primary" @click="emit('done')">Klaar</button>
    </footer>
  </div>
</template>

<style scoped>
.filters { display: grid; gap: 1rem; width: min(34rem, calc(100vw - 2rem)); padding: .6rem; }
header { display: flex; align-items: center; justify-content: space-between; }
header strong { font-size: .95rem; }
.reset, .more { border: 0; padding: 0; background: none; color: #b69cff; font: inherit; font-size: .8rem; cursor: pointer; }
.grid { display: grid; grid-template-columns: 1fr 1fr; gap: .8rem; }
.chips { display: flex; flex-wrap: wrap; gap: .4rem; }
.chips .mh-tag { font: inherit; font-size: .76rem; padding: .3rem .7rem; }
.chips .mh-tag.on { border-color: #7c5ad9; background: #241a3d; color: #fff; }
footer { display: flex; justify-content: flex-end; }
@media (max-width: 720px) {
  .filters { width: 100%; padding: 0; }
  .grid { grid-template-columns: 1fr; }
  footer .mh-btn { width: 100%; }
}
</style>
