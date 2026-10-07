<script setup lang="ts">
import { gigDateLabel, gigListRow, type TemplateGig } from '~~/shared/template-gigs'
import { parseGigRow } from '~~/shared/video-templates'

// `single` picks one gig to link a template to; otherwise gigs are added as rows up to `max`.
const props = defineProps<{ upcoming: TemplateGig[], max?: number, taken?: number, single?: boolean, selectedId?: string }>()
const emit = defineEmits<{ pick: [gig: TemplateGig], close: [] }>()

const query = ref('')
const past = ref<TemplateGig[]>([])
const pastLoaded = ref(false)
const pastLoading = ref(false)
const searchInput = ref<HTMLInputElement | null>(null)

const needle = computed(() => query.value.trim().toLowerCase())
const searching = computed(() => needle.value.length > 0)

// Earlier gigs load the first time someone searches; the default view stays instant.
watch(searching, async (active) => {
  if (!active || pastLoaded.value) return
  pastLoading.value = true
  try {
    past.value = (await $fetch<{ gigs: TemplateGig[] }>('/api/admin/video-projects/gigs', { query: { past: '1' } })).gigs
    pastLoaded.value = true
  } catch {
    // Searching still works on the upcoming gigs.
  } finally {
    pastLoading.value = false
  }
})

function haystack(gig: TemplateGig) {
  return [gigDateLabel(gig), gig.title, gig.venueName, gig.venueCity].filter(Boolean).join(' ').toLowerCase()
}

const upcomingShown = computed(() => searching.value
  ? props.upcoming.filter(gig => haystack(gig).includes(needle.value))
  : props.upcoming.slice(0, 4))
const pastShown = computed(() => past.value.filter(gig => haystack(gig).includes(needle.value)))
const full = computed(() => !props.single && (props.taken ?? 0) >= (props.max ?? Infinity))

function rowParts(gig: TemplateGig) {
  const { day, date, time } = parseGigRow(gigListRow(gig))
  return { day, date, time }
}

function close() { emit('close') }
onMounted(() => searchInput.value?.focus())
</script>

<template>
  <div class="backdrop" @mousedown.self="close" @keydown.esc="close">
    <div class="dialog" role="dialog" aria-modal="true" aria-label="Gig uit de agenda kiezen">
      <header>
        <h3>Gig uit de agenda</h3>
        <button type="button" class="ghost" aria-label="Sluiten" @click="close"><Icon name="lucide:x" aria-hidden="true" /></button>
      </header>
      <label class="search">
        <Icon name="lucide:search" aria-hidden="true" />
        <input ref="searchInput" v-model="query" type="search" placeholder="Zoek op titel, plaats of datum…">
      </label>
      <p v-if="full" class="note">Maximaal aantal regels bereikt. Verwijder eerst een regel.</p>
      <div class="results">
        <p class="group">{{ searching ? 'Aankomend' : 'Eerstvolgende gigs' }}</p>
        <button v-for="gig in upcomingShown" :key="gig.id" type="button" class="gig" :class="{ selected: gig.id === selectedId }" :disabled="full" @click="emit('pick', gig)">
          <span class="when"><b>{{ rowParts(gig).day }}</b> {{ rowParts(gig).date }}</span>
          <span class="what">{{ gig.title }}<small>{{ [gig.venueName, gig.venueCity].filter(Boolean).join(', ') }}</small></span>
          <span class="time">{{ rowParts(gig).time }}</span>
          <span v-if="!gig.publicVisibility" class="badge">Niet publiek</span>
        </button>
        <p v-if="!upcomingShown.length" class="empty">Geen aankomende gigs gevonden.</p>
        <template v-if="searching">
          <p class="group">Eerdere gigs</p>
          <p v-if="pastLoading" class="empty">Laden…</p>
          <button v-for="gig in pastShown" :key="gig.id" type="button" class="gig past" :class="{ selected: gig.id === selectedId }" :disabled="full" @click="emit('pick', gig)">
            <span class="when"><b>{{ rowParts(gig).day }}</b> {{ rowParts(gig).date }}</span>
            <span class="what">{{ gig.title }}<small>{{ [gig.venueName, gig.venueCity].filter(Boolean).join(', ') }}</small></span>
            <span class="time">{{ rowParts(gig).time }}</span>
          </button>
          <p v-if="!pastLoading && !pastShown.length" class="empty">Geen eerdere gigs gevonden.</p>
        </template>
        <p v-else class="hint">Zoek om ook eerdere gigs te vinden.</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: grid;
  place-items: center;
  padding: 1rem;
  background: rgb(0 0 0 / .6);
}

.dialog {
  display: flex;
  flex-direction: column;
  gap: .6rem;
  width: min(30rem, 100%);
  max-height: min(34rem, 90vh);
  padding: 1rem;
  border: 1px solid var(--ve-border);
  border-radius: 14px;
  background: var(--ve-panel);
  color: var(--ve-text);
  box-shadow: 0 20px 60px rgb(0 0 0 / .5);
}

header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

h3 { margin: 0; font-size: 1rem; }

.search {
  display: flex;
  align-items: center;
  gap: .5rem;
  padding: 0 .6rem;
  border: 1px solid var(--ve-border);
  border-radius: 8px;
  background: var(--ve-bg);
}

.search input {
  flex: 1;
  min-width: 0;
  padding: .55rem 0;
  border: 0;
  outline: 0;
  background: none;
  color: inherit;
}

.results {
  display: flex;
  flex-direction: column;
  gap: .35rem;
  min-height: 0;
  overflow-y: auto;
}

.group {
  margin: .4rem 0 .1rem;
  color: var(--ve-muted);
  font-size: .7rem;
  letter-spacing: .06em;
  text-transform: uppercase;
}

.gig {
  display: grid;
  grid-template-columns: 5.5rem 1fr auto;
  align-items: center;
  gap: .6rem;
  padding: .55rem .65rem;
  border: 1px solid var(--ve-border);
  border-radius: 10px;
  background: var(--ve-bg);
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.gig:hover:not(:disabled) { border-color: var(--ve-accent, #8b5cf6); }
.gig:disabled { opacity: .45; cursor: not-allowed; }
.gig.selected { border-color: var(--ve-accent, #8b5cf6); }
.gig.past { opacity: .8; }
.when { font-size: .8rem; }
.when b { color: var(--ve-muted); font-weight: 600; margin-right: .2rem; }
.what { display: flex; flex-direction: column; min-width: 0; font-size: .85rem; }
.what small { color: var(--ve-muted); font-size: .72rem; }
.time { color: var(--ve-muted); font-size: .75rem; }
.badge { grid-column: 2 / -1; color: var(--ve-muted); font-size: .68rem; }
.empty, .hint, .note { margin: 0; color: var(--ve-muted); font-size: .75rem; }
.ghost {
  display: inline-flex;
  padding: .3rem;
  border: 1px solid var(--ve-border);
  border-radius: 6px;
  background: none;
  color: inherit;
  cursor: pointer;
}
</style>
