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
  upload: 'Uploaded',
  url: 'From URL',
  generated: 'Generated',
  derived: 'Edited variant',
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
      <button type="button" class="reset" @click="reset">Reset</button>
    </header>
    <div class="grid">
      <label class="mh-field">
        <span>Media type</span>
        <select v-model="filters.kind" class="mh-select">
          <option value="">Any type</option>
          <option value="image">Images</option>
          <option value="video">Videos</option>
          <option value="audio">Audio</option>
        </select>
      </label>
      <label class="mh-field">
        <span>Source</span>
        <select v-model="filters.source" class="mh-select">
          <option value="">Any source</option>
          <option v-for="source in MEDIA_SOURCES" :key="source" :value="source">{{ sourceLabels[source] }}</option>
        </select>
      </label>
      <label class="mh-field">
        <span>Gig</span>
        <select v-model="filters.gigId" class="mh-select">
          <option value="">Any gig</option>
          <option value="none">Not linked to a gig</option>
          <option v-for="gig in gigs" :key="gig.id" :value="gig.id">{{ gig.title }}</option>
        </select>
      </label>
      <label class="mh-field">
        <span>Venue</span>
        <select v-model="filters.venueId" class="mh-select">
          <option value="">Any venue</option>
          <option value="none">Not linked to a venue</option>
          <option v-for="venue in venues" :key="venue.id" :value="venue.id">{{ venue.name }}</option>
        </select>
      </label>
      <label class="mh-field">
        <span>Date added</span>
        <select v-model="filters.added" class="mh-select">
          <option value="">Any time</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="90d">Last 90 days</option>
          <option value="365d">Last year</option>
        </select>
      </label>
      <label class="mh-field">
        <span>Orientation</span>
        <select v-model="filters.orientation" class="mh-select">
          <option value="">Any orientation</option>
          <option value="landscape">Landscape</option>
          <option value="portrait">Portrait</option>
          <option value="square">Square</option>
        </select>
      </label>
      <label class="mh-field">
        <span>Usage</span>
        <select v-model="filters.usage" class="mh-select">
          <option value="">Used or unused</option>
          <option value="used">Used somewhere</option>
          <option value="unused">Not used yet</option>
        </select>
      </label>
      <label class="mh-field">
        <span>Variants</span>
        <select v-model="filters.variants" class="mh-select">
          <option value="">Originals and variants</option>
          <option value="originals">Originals only</option>
          <option value="variants">Variants only</option>
        </select>
      </label>
    </div>
    <div v-if="tags.length" class="mh-field tags">
      <span>Tags <small>(all selected tags must match)</small></span>
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
          {{ showAllTags ? 'Show fewer' : `+${tags.length - 18} more` }}
        </button>
      </div>
    </div>
    <footer>
      <button type="button" class="mh-btn primary" @click="emit('done')">Done</button>
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
