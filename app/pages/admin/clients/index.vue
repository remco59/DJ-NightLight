<script setup lang="ts">
import { apiErrorMessage } from '~/utils/api-error'
import { clientTypeLabels, labelFor } from '~~/shared/labels'

definePageMeta({ layout: 'admin' })

type ClientListItem = {
  id: string
  type: 'person' | 'company'
  firstName: string | null
  lastName: string | null
  companyName: string | null
  email: string | null
  phone: string | null
  gigCount: number
}

const emptyFilters = { search: '', type: '', hasGigs: '', hasEmail: '' }
const typeTabs = [{ value: '', label: 'Alle' }, { value: 'person', label: 'Particulieren' }, { value: 'company', label: 'Bedrijven' }]
const sortOptions = ['name_asc', 'name_desc', 'gigs_desc']
// Filters and sorting are remembered in a cookie so they survive a reload (and work during SSR).
const saved = useCookie<{ filters?: Partial<typeof emptyFilters>; sort?: string }>('admin-client-filters', { maxAge: 60 * 60 * 24 * 365, sameSite: 'lax', default: () => ({}) })
const savedFilters = Object.fromEntries(Object.entries(saved.value?.filters ?? {}).filter(([key, value]) => key in emptyFilters && typeof value === 'string'))
const filters = reactive({ ...emptyFilters, ...savedFilters })
const sort = ref(sortOptions.includes(saved.value?.sort ?? '') ? saved.value!.sort as string : 'name_asc')
const showAdvancedFilters = ref(false)
watch([filters, sort], () => { saved.value = { filters: { ...filters }, sort: sort.value } }, { deep: true })
const activeAdvancedCount = computed(() => [filters.hasGigs, filters.hasEmail].filter(Boolean).length)
const hasActiveFilters = computed(() => Object.values(filters).some(Boolean))
function clearAllFilters() { Object.assign(filters, emptyFilters) }
const showCreate = ref(false)
const saving = ref(false)
const formError = ref('')
const form = reactive({
  type: 'person' as 'person' | 'company',
  firstName: '',
  lastName: '',
  companyName: '',
  email: '',
  phone: '',
  billingAddress: '',
  notes: '',
})

const { data, status, refresh } = await useFetch<{ clients: ClientListItem[] }>('/api/admin/clients', {
  query: computed(() => ({ ...Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== '')), sort: sort.value })),
})

function displayName(client: ClientListItem) {
  return client.companyName || [client.firstName, client.lastName].filter(Boolean).join(' ') || 'Naamloze klant'
}

async function createClient() {
  saving.value = true
  formError.value = ''
  try {
    const result = await $fetch<{ client: ClientListItem }>('/api/admin/clients', {
      method: 'POST',
      body: form,
    })
    await refresh()
    showCreate.value = false
    await navigateTo(`/admin/clients/${result.client.id}`)
  } catch (error: unknown) {
    formError.value = apiErrorMessage(error, 'Klant aanmaken is niet gelukt.')
  } finally {
    saving.value = false
  }
}

useSeoMeta({ title: 'Klanten — DJ NightLight', robots: 'noindex, nofollow' })
</script>

<template>
  <div class="entity-page">
    <header class="page-header">
      <div>
        <p class="eyebrow">Relaties</p>
        <h1>Klanten</h1>
        <p>Personen en bedrijven die NightLight boeken.</p>
      </div>
      <button class="with-icon primary" type="button" @click="showCreate = !showCreate">
        <Icon :name="showCreate ? 'lucide:x' : 'lucide:plus'" aria-hidden="true" />
        {{ showCreate ? 'Sluiten' : 'Nieuwe klant' }}
      </button>
    </header>

    <form v-if="showCreate" class="editor-card" @submit.prevent="createClient">
      <h2>Nieuwe klant</h2>
      <div class="grid">
        <label>Type
          <select v-model="form.type"><option value="person">Particulier</option><option value="company">Bedrijf</option></select>
        </label>
        <label v-if="form.type === 'company'">Bedrijfsnaam<input v-model="form.companyName" required></label>
        <template v-else>
          <label>Voornaam<input v-model="form.firstName"></label>
          <label>Achternaam<input v-model="form.lastName"></label>
        </template>
        <label>E-mail<input v-model="form.email" type="email"></label>
        <label>Telefoon<input v-model="form.phone" type="tel"></label>
        <label class="wide">Factuuradres<textarea v-model="form.billingAddress" rows="2" /></label>
        <label class="wide">Notities<textarea v-model="form.notes" rows="3" /></label>
      </div>
      <p v-if="formError" class="error">{{ formError }}</p>
      <button class="primary" type="submit" :disabled="saving">{{ saving ? 'Opslaan…' : 'Klant aanmaken' }}</button>
    </form>

    <nav class="status-tabs" aria-label="Klanten per type">
      <button v-for="tab in typeTabs" :key="tab.value" type="button" :aria-pressed="filters.type === tab.value" @click="filters.type = tab.value">{{ tab.label }}</button>
    </nav>

    <AdminFilterBar
      has-advanced
      :advanced-open="showAdvancedFilters"
      :active-advanced-count="activeAdvancedCount"
      :has-active-filters="hasActiveFilters"
      :results-label="`${data?.clients.length ?? 0} ${(data?.clients.length ?? 0) === 1 ? 'klant' : 'klanten'}`"
      @toggle-advanced="showAdvancedFilters = !showAdvancedFilters"
      @clear-all="clearAllFilters"
    >
      <template #primary>
        <input v-model="filters.search" type="search" aria-label="Zoek klanten" placeholder="Zoek op naam, bedrijf of e-mail…">
      </template>
      <template #advanced>
        <label>Gigs
          <select v-model="filters.hasGigs"><option value="">Met en zonder gigs</option><option value="true">Met gigs</option><option value="false">Zonder gigs</option></select>
        </label>
        <label>E-mail
          <select v-model="filters.hasEmail"><option value="">Met en zonder e-mail</option><option value="true">Met e-mailadres</option><option value="false">Zonder e-mailadres</option></select>
        </label>
      </template>
      <template #chips>
        <AdminFilterChip v-if="filters.search" :label="`Zoeken: ${filters.search}`" @remove="filters.search = ''" />
        <AdminFilterChip v-if="filters.type" :label="`Type: ${labelFor(clientTypeLabels, filters.type)}`" @remove="filters.type = ''" />
        <AdminFilterChip v-if="filters.hasGigs" :label="filters.hasGigs === 'true' ? 'Met gigs' : 'Zonder gigs'" @remove="filters.hasGigs = ''" />
        <AdminFilterChip v-if="filters.hasEmail" :label="filters.hasEmail === 'true' ? 'Met e-mailadres' : 'Zonder e-mailadres'" @remove="filters.hasEmail = ''" />
      </template>
      <template #toolbar>
        <label class="sort-control">
          <span>Sorteren op</span>
          <select v-model="sort" aria-label="Klanten sorteren">
            <option value="name_asc">Naam (A–Z)</option>
            <option value="name_desc">Naam (Z–A)</option>
            <option value="gigs_desc">Aantal gigs (meeste eerst)</option>
          </select>
        </label>
      </template>
    </AdminFilterBar>

    <div v-if="status === 'pending' && !data" class="empty">Klanten laden…</div>
    <div v-else-if="!data?.clients.length" class="empty">Geen klanten gevonden{{ hasActiveFilters ? ' met deze filters' : '' }}.</div>
    <div v-else class="list">
      <NuxtLink v-for="client in data.clients" :key="client.id" :to="`/admin/clients/${client.id}`" class="row">
        <div class="avatar">{{ displayName(client).slice(0, 2).toUpperCase() }}</div>
        <div class="copy">
          <strong>{{ displayName(client) }}</strong>
          <span>{{ client.email || client.phone || (client.type === 'company' ? 'Bedrijf' : 'Particulier') }}</span>
        </div>
        <span class="count">{{ client.gigCount }} {{ client.gigCount === 1 ? 'gig' : 'gigs' }}</span>
      </NuxtLink>
    </div>
  </div>
</template>

<style scoped>
.entity-page { max-width: 1050px; margin-inline: auto; }
.page-header { display:flex; justify-content:space-between; align-items:end; gap:1rem; margin-bottom:1.5rem; }
h1 { margin:.2rem 0; font-size:clamp(2.5rem,6vw,4rem); letter-spacing:-.04em; }
.page-header p:last-child { margin:0; color:var(--text-subtle); }
.primary { border:0; border-radius:.7rem; padding:.75rem 1rem; background:var(--button-primary-bg); color:var(--button-primary-fg); font-weight:800; cursor:pointer; }
.editor-card { margin-bottom:1.2rem; padding:1.3rem; border:1px solid var(--border); border-radius:1rem; background:var(--surface-card); }
.editor-card h2 { margin-top:0; }
.grid { display:grid; grid-template-columns:repeat(2,1fr); gap:.9rem; margin-bottom:1rem; }
label { display:grid; gap:.4rem; color:var(--text-muted); font-size:.82rem; }
input, select, textarea { width:100%; border:1px solid var(--border-strong); border-radius:.65rem; padding:.75rem; background:var(--surface-input); color:var(--text); }
.wide { grid-column:1/-1; }
.status-tabs { display:flex; gap:.35rem; margin-bottom:.85rem; overflow-x:auto; scrollbar-width:none; }
.status-tabs button { flex:0 0 auto; min-height:2.5rem; border:1px solid var(--border); border-radius:999px; padding:.45rem .95rem; background:transparent; color:#b8b2c1; font:inherit; font-weight:700; font-size:.84rem; cursor:pointer; }
.status-tabs button:hover { color:#fff; border-color:#3d3646; }
.status-tabs button[aria-pressed="true"] { border-color:var(--text); background:var(--text); color:#0b0910; }
.sort-control { display:flex; align-items:center; gap:.55rem; color:var(--text-subtle); font-size:.78rem; }
.sort-control span { white-space:nowrap; }
.toolbar { display:flex; align-items:center; justify-content:space-between; gap:1rem; margin-bottom:.8rem; }
.toolbar input { max-width:28rem; }
.toolbar span { color:var(--text-subtle); font-size:.82rem; }
.list { border:1px solid #292530; border-radius:1rem; overflow:hidden; }
.row { display:grid; grid-template-columns:2.6rem minmax(0,1fr) auto; gap:.9rem; align-items:center; padding:.9rem 1rem; border-bottom:1px solid #242029; text-decoration:none; }
.row:last-child { border-bottom:0; }
.row:hover { background:#141119; }
.avatar { display:grid; width:2.6rem; height:2.6rem; place-items:center; border-radius:.7rem; background:#211b29; font-size:.74rem; font-weight:900; }
.copy { min-width:0; }
.copy strong,.copy span { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.copy span,.count { color:#817a8b; font-size:.8rem; }
.empty { padding:2rem; border:1px dashed #302a38; border-radius:1rem; color:#817a8b; }
.error { color:#ff9c9c; }
@media(max-width:650px){.page-header{align-items:start;flex-direction:column}.grid{grid-template-columns:1fr}.wide{grid-column:auto}.toolbar{align-items:stretch;flex-direction:column}.row{grid-template-columns:2.6rem minmax(0,1fr)}.count{grid-column:2}.primary{width:100%}}
</style>
