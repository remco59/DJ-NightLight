<script setup lang="ts">
definePageMeta({ layout: 'admin' })
const {user}=useUserSession()
const canManageGigs=computed(()=>user.value?.role==='owner'||user.value?.role==='manager')

type DashboardData = {
  summary: {
    upcoming: number
    leads: number
    unpaidInvoices: number | null
    attention: number
  }
  upcoming: Array<{
    id: string
    title: string
    eventType: string | null
    startsAt: string | Date | null
    venueName: string | null
  }>
  planned: {
    clientPortal: boolean
    finance: boolean
    calendarSync: boolean
    payments: boolean
  }
}

const { data, status, refresh } = await useFetch<DashboardData>('/api/admin/dashboard')

const stats = computed(() => [
  {
    label: 'Aankomende gigs',
    value: data.value?.summary.upcoming ?? 0,
    detail: 'Geboekt, toekomstige datums',
  },
  {
    label: 'Leads',
    value: data.value?.summary.leads ?? 0,
    detail: 'Opvolging nodig',
  },
  {
    label: 'Openstaande facturen',
    value: data.value?.summary.unpaidInvoices ?? '—',
    detail: 'Concept of wacht op betaling',
  },
  {
    label: 'Aandacht nodig',
    value: data.value?.summary.attention ?? 0,
    detail: 'Openstaande actiepunten',
  },
])

function formatDate(value: string | Date | null) {
  if (!value) return 'Datum niet ingesteld'
  return new Intl.DateTimeFormat('nl-NL', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function dayOfMonth(value: string | Date | null) {
  return value ? new Date(value).getDate() : '—'
}

function shortMonth(value: string | Date | null) {
  return value
    ? new Date(value).toLocaleDateString('nl-NL', { month: 'short' })
    : ''
}

useSeoMeta({
  title: 'Dashboard — DJ NightLight',
  robots: 'noindex, nofollow',
})
</script>

<template>
  <div class="dashboard">
    <header class="page-header">
      <div>
        <p class="eyebrow">Overzicht</p>
        <h1>Dashboard</h1>
        <p>Wat je aandacht nodig heeft, zonder ruis.</p>
      </div>
      <div class="actions">
        <button type="button" class="secondary" @click="() => refresh()">Vernieuwen</button>
        <NuxtLink v-if="canManageGigs" to="/admin/gigs?new=1" class="with-icon primary"><Icon name="lucide:plus" aria-hidden="true" />Nieuwe gig</NuxtLink>
      </div>
    </header>

    <div v-if="status === 'pending'" class="state">Dashboard laden…</div>

    <template v-else>
      <section class="stats" aria-label="Dashboardstatistieken">
        <AdminStatCard
          v-for="stat in stats"
          :key="stat.label"
          v-bind="stat"
        />
      </section>

      <section class="panel">
        <div class="panel-heading">
          <div>
            <p class="eyebrow">Planning</p>
            <h2>Aankomende gigs</h2>
          </div>
          <NuxtLink to="/admin/gigs">Alles bekijken</NuxtLink>
        </div>

        <div v-if="!data?.upcoming.length" class="empty">
          <strong>Nog geen aankomende gigs.</strong>
          <span>Nieuw geboekte gigs verschijnen hier automatisch.</span>
        </div>

        <NuxtLink
          v-for="gig in data?.upcoming || []"
          v-else
          :key="gig.id"
          :to="`/admin/gigs/${gig.id}`"
          class="gig-row"
        >
          <div class="date-block">
            <strong>{{ dayOfMonth(gig.startsAt) }}</strong>
            <span>{{ shortMonth(gig.startsAt) }}</span>
          </div>
          <div class="gig-copy">
            <strong>{{ gig.title }}</strong>
            <span>{{ gig.venueName || gig.eventType || 'Locatie niet ingesteld' }}</span>
          </div>
          <time>{{ formatDate(gig.startsAt) }}</time>
        </NuxtLink>
      </section>

      <section class="system-strip">
        <div>
          <strong>Klantportaal</strong>
          <span>Actief</span>
        </div>
        <div>
          <strong>Agendasynchronisatie</strong>
          <span>Gepland voor fase 5</span>
        </div>
        <div>
          <strong>Betalingen</strong>
          <span>Stripe Checkout actief</span>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.dashboard { max-width: 1180px; margin-inline: auto; }
.page-header {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 1.5rem;
  margin-bottom: 2rem;
}
.page-header h1 { margin: .25rem 0 .35rem; font-size: clamp(2.2rem, 5vw, 4rem); letter-spacing: -.05em; }
.page-header p:last-child { margin: 0; color: #938d9d; }
.actions { display: flex; gap: .6rem; }
.actions a, .actions button {
  border-radius: .7rem;
  padding: .7rem .9rem;
  text-decoration: none;
  font-weight: 700;
  font-size: .88rem;
}
.primary { background: #fff; color: #09080b; }
.secondary { border: 1px solid #2f2b35; background: transparent; color: #c8c2ce; cursor: pointer; }
.stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: .8rem; }
.panel {
  margin-top: 1.5rem;
  overflow: hidden;
  border: 1px solid #292530;
  border-radius: 1.2rem;
  background: #100e14;
}
.panel-heading { display: flex; align-items: end; justify-content: space-between; padding: 1.2rem 1.3rem; }
.panel-heading h2 { margin: .2rem 0 0; }
.panel-heading a { color: #aaa3b4; font-size: .85rem; }
.gig-row {
  display: grid;
  grid-template-columns: 3rem minmax(0, 1fr) auto;
  gap: 1rem;
  align-items: center;
  padding: 1rem 1.3rem;
  border-top: 1px solid #242029;
  text-decoration: none;
}
.gig-row:hover { background: #151119; }
.date-block {
  display: grid;
  place-items: center;
  border-radius: .7rem;
  padding: .45rem;
  background: #1c1822;
}
.date-block strong { font-size: 1.05rem; }
.date-block span { color: #8d8696; font-size: .65rem; text-transform: uppercase; }
.gig-copy { min-width: 0; }
.gig-copy strong, .gig-copy span { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gig-copy span, time { color: #817a8b; font-size: .8rem; }
.empty { display: grid; gap: .3rem; padding: 2.3rem 1.3rem; border-top: 1px solid #242029; color: #aaa3b4; }
.empty span { color: #716b79; }
.system-strip { display: grid; grid-template-columns: repeat(3, 1fr); gap: .8rem; margin-top: 1.5rem; }
.system-strip div { padding: 1rem 1.1rem; border: 1px dashed #2c2733; border-radius: .9rem; }
.system-strip strong, .system-strip span { display: block; }
.system-strip span { margin-top: .25rem; color: #716b79; font-size: .78rem; }
.state { padding: 3rem 0; color: #8f8998; }

@media (max-width: 980px) {
  .stats { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 620px) {
  .page-header { align-items: start; flex-direction: column; }
  .stats, .system-strip { grid-template-columns: 1fr; }
  .actions { width: 100%; }
  .actions a, .actions button { flex: 1; text-align: center; }
  .gig-row { grid-template-columns: 3rem minmax(0, 1fr); }
  .gig-row time { display: none; }
}
</style>
