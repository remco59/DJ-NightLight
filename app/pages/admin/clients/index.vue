<script setup lang="ts">
import { apiErrorMessage } from '../../../../shared/errors'

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

const search = ref('')
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
  query: computed(() => ({ search: search.value || undefined })),
})

function displayName(client: ClientListItem) {
  return client.companyName || [client.firstName, client.lastName].filter(Boolean).join(' ') || 'Unnamed client'
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
    formError.value = apiErrorMessage(error, 'Could not create client.')
  } finally {
    saving.value = false
  }
}

useSeoMeta({ title: 'Clients — DJ NightLight', robots: 'noindex, nofollow' })
</script>

<template>
  <div class="entity-page">
    <header class="page-header">
      <div>
        <p class="eyebrow">Operations</p>
        <h1>Clients</h1>
        <p>People and companies that book NightLight.</p>
      </div>
      <button class="primary" type="button" @click="showCreate = !showCreate">
        {{ showCreate ? 'Close' : 'New client' }}
      </button>
    </header>

    <form v-if="showCreate" class="editor-card" @submit.prevent="createClient">
      <h2>New client</h2>
      <div class="grid">
        <label>Type
          <select v-model="form.type"><option value="person">Person</option><option value="company">Company</option></select>
        </label>
        <label v-if="form.type === 'company'">Company name<input v-model="form.companyName" required></label>
        <template v-else>
          <label>First name<input v-model="form.firstName"></label>
          <label>Last name<input v-model="form.lastName"></label>
        </template>
        <label>Email<input v-model="form.email" type="email"></label>
        <label>Phone<input v-model="form.phone" type="tel"></label>
        <label class="wide">Billing address<textarea v-model="form.billingAddress" rows="2" /></label>
        <label class="wide">Notes<textarea v-model="form.notes" rows="3" /></label>
      </div>
      <p v-if="formError" class="error">{{ formError }}</p>
      <button class="primary" type="submit" :disabled="saving">{{ saving ? 'Saving…' : 'Create client' }}</button>
    </form>

    <div class="toolbar">
      <input v-model="search" type="search" placeholder="Search name, company or email…">
      <span>{{ data?.clients.length ?? 0 }} clients</span>
    </div>

    <div v-if="status === 'pending'" class="empty">Loading clients…</div>
    <div v-else-if="!data?.clients.length" class="empty">No clients found.</div>
    <div v-else class="list">
      <NuxtLink v-for="client in data.clients" :key="client.id" :to="`/admin/clients/${client.id}`" class="row">
        <div class="avatar">{{ displayName(client).slice(0, 2).toUpperCase() }}</div>
        <div class="copy">
          <strong>{{ displayName(client) }}</strong>
          <span>{{ client.email || client.phone || (client.type === 'company' ? 'Company' : 'Person') }}</span>
        </div>
        <span class="count">{{ client.gigCount }} {{ client.gigCount === 1 ? 'gig' : 'gigs' }}</span>
      </NuxtLink>
    </div>
  </div>
</template>

<style scoped>
.entity-page { max-width: 1050px; margin-inline: auto; }
.page-header { display:flex; justify-content:space-between; align-items:end; gap:1rem; margin-bottom:1.5rem; }
h1 { margin:.2rem 0; font-size:clamp(2.5rem,6vw,4rem); letter-spacing:-.05em; }
.page-header p:last-child { margin:0; color:#8e8797; }
.primary { border:0; border-radius:.7rem; padding:.75rem 1rem; background:#fff; color:#09080b; font-weight:800; cursor:pointer; }
.editor-card { margin-bottom:1.2rem; padding:1.3rem; border:1px solid #2b2631; border-radius:1rem; background:#100e14; }
.editor-card h2 { margin-top:0; }
.grid { display:grid; grid-template-columns:repeat(2,1fr); gap:.9rem; margin-bottom:1rem; }
label { display:grid; gap:.4rem; color:#aaa4b1; font-size:.82rem; }
input, select, textarea { width:100%; border:1px solid #332e39; border-radius:.65rem; padding:.75rem; background:#0b0a0d; color:#f6f3fa; }
.wide { grid-column:1/-1; }
.toolbar { display:flex; align-items:center; justify-content:space-between; gap:1rem; margin-bottom:.8rem; }
.toolbar input { max-width:28rem; }
.toolbar span { color:#777080; font-size:.82rem; }
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
