<script setup lang="ts">
definePageMeta({ layout: 'admin' })

const { data, status, refresh } = await useFetch('/api/admin/dashboard')

const stats = computed(() => [
  {
    label: 'Upcoming gigs',
    value: data.value?.summary.upcoming ?? 0,
    detail: 'Booked, future dates',
  },
  {
    label: 'Leads',
    value: data.value?.summary.leads ?? 0,
    detail: 'Need follow-up',
  },
  {
    label: 'Open invoices',
    value: data.value?.summary.unpaidInvoices ?? '—',
    detail: 'Available when finance ships',
    muted: data.value?.summary.unpaidInvoices === null,
  },
  {
    label: 'Needs attention',
    value: data.value?.summary.attention ?? 0,
    detail: 'Current actionable items',
  },
])

function formatDate(value: string | Date | null) {
  if (!value) return 'Date not set'
  return new Intl.DateTimeFormat('nl-NL', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
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
        <p class="eyebrow">Overview</p>
        <h1>Dashboard</h1>
        <p>What needs your attention, without the noise.</p>
      </div>
      <div class="actions">
        <button type="button" class="secondary" @click="refresh">Refresh</button>
        <NuxtLink to="/admin/gigs?new=1" class="primary">New gig</NuxtLink>
      </div>
    </header>

    <div v-if="status === 'pending'" class="state">Loading dashboard…</div>

    <template v-else>
      <section class="stats" aria-label="Dashboard statistics">
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
            <h2>Upcoming gigs</h2>
          </div>
          <NuxtLink to="/admin/gigs">View all</NuxtLink>
        </div>

        <div v-if="!data?.upcoming.length" class="empty">
          <strong>No upcoming gigs yet.</strong>
          <span>New booked gigs will appear here automatically.</span>
        </div>

        <NuxtLink
          v-for="gig in data?.upcoming"
          v-else
          :key="gig.id"
          :to="`/admin/gigs/${gig.id}`"
          class="gig-row"
        >
          <div class="date-block">
            <strong>{{ new Date(gig.startsAt!).getDate() }}</strong>
            <span>{{ new Date(gig.startsAt!).toLocaleDateString('en', { month: 'short' }) }}</span>
          </div>
          <div class="gig-copy">
            <strong>{{ gig.title }}</strong>
            <span>{{ gig.venueName || gig.eventType || 'Location not set' }}</span>
          </div>
          <time>{{ formatDate(gig.startsAt) }}</time>
        </NuxtLink>
      </section>

      <section class="system-strip">
        <div>
          <strong>Client portal</strong>
          <span>Planned for phase 3</span>
        </div>
        <div>
          <strong>Calendar sync</strong>
          <span>Planned for phase 5</span>
        </div>
        <div>
          <strong>Payments</strong>
          <span>Planned for phase 4</span>
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
