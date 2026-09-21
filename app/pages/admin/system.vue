<script setup lang="ts">
definePageMeta({ layout: 'admin' })

type StatusData = {
  generatedAt: string
  health: {
    failedEmails: number
    failedCalendarSyncs: number
    failedPayments: number
    pendingOutbox: number
    staleOutbox: number
  }
  integrations: {
    stripe: {
      lastEvent: {
        eventId: string
        eventType: string
        livemode: boolean
        processedAt: string
      } | null
    }
    calendarConfigured: boolean
    calendarSource: 'settings' | 'environment' | 'none'
    emailConfigured: boolean
    emailSource: 'settings' | 'environment' | 'none'
  }
  backup: { name: string, updatedAt: string } | null
}

const { data, refresh, pending } = await useFetch<StatusData>('/api/admin/system/status')

const issues = computed(() => {
  const h = data.value?.health
  if (!h) return 0
  return h.failedEmails + h.failedCalendarSyncs + h.failedPayments + h.staleOutbox
})

function formatDate(value: string | null | undefined) {
  if (!value) return 'Never'
  return new Intl.DateTimeFormat('nl-NL', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}
</script>

<template>
  <div class="page">
    <header class="header">
      <div>
        <p class="eyebrow">System</p>
        <h1>Production status</h1>
        <p>Operational failures, integration state and backup visibility in one place.</p>
      </div>
      <button type="button" :disabled="pending" @click="refresh()">
        {{ pending ? 'Refreshing…' : 'Refresh' }}
      </button>
    </header>

    <section class="summary" :class="{ alert: issues > 0 }">
      <strong>{{ issues === 0 ? 'No active production failures' : `${issues} production issue(s) need attention` }}</strong>
      <span>Generated {{ formatDate(data?.generatedAt) }}</span>
    </section>

    <section class="cards">
      <article>
        <span>Email failures</span>
        <strong>{{ data?.health.failedEmails ?? '—' }}</strong>
        <NuxtLink to="/admin/email">Open email automation</NuxtLink>
      </article>
      <article>
        <span>Calendar failures</span>
        <strong>{{ data?.health.failedCalendarSyncs ?? '—' }}</strong>
        <NuxtLink to="/admin/calendar">Open Calendar</NuxtLink>
      </article>
      <article>
        <span>Failed payments</span>
        <strong>{{ data?.health.failedPayments ?? '—' }}</strong>
        <NuxtLink to="/admin/invoices">Open invoices</NuxtLink>
      </article>
      <article>
        <span>Stale outbox</span>
        <strong>{{ data?.health.staleOutbox ?? '—' }}</strong>
        <small>{{ data?.health.pendingOutbox ?? 0 }} pending total</small>
      </article>
    </section>

    <section class="panel">
      <div class="panel-title">
        <div>
          <h2>Integrations</h2>
          <p>Connection health reflects the effective configuration from Settings or the server environment.</p>
        </div>
        <NuxtLink to="/admin/settings#integrations">Manage integrations</NuxtLink>
      </div>
      <div class="rows">
        <div>
          <span>Google Calendar credentials</span>
          <strong :class="{ ok: data?.integrations.calendarConfigured }">
            {{ data?.integrations.calendarConfigured ? 'Configured' : 'Missing' }}
          </strong>
          <small>{{ data?.integrations.calendarSource === 'settings' ? 'Settings' : data?.integrations.calendarSource === 'environment' ? 'Server environment' : 'No credentials' }}</small>
        </div>
        <div>
          <span>Email provider</span>
          <strong :class="{ ok: data?.integrations.emailConfigured }">
            {{ data?.integrations.emailConfigured ? 'Configured' : 'Missing' }}
          </strong>
          <small>{{ data?.integrations.emailSource === 'settings' ? 'Settings' : data?.integrations.emailSource === 'environment' ? 'Server environment' : 'No provider settings' }}</small>
        </div>
        <div>
          <span>Last Stripe webhook</span>
          <strong>{{ data?.integrations.stripe.lastEvent?.eventType || 'No event recorded' }}</strong>
          <small v-if="data?.integrations.stripe.lastEvent">
            {{ formatDate(data.integrations.stripe.lastEvent.processedAt) }}
            · {{ data.integrations.stripe.lastEvent.livemode ? 'live' : 'test' }}
          </small>
        </div>
      </div>
    </section>

    <section class="panel">
      <h2>Backups</h2>
      <div v-if="data?.backup" class="backup">
        <strong>{{ data.backup.name }}</strong>
        <span>Last filesystem backup detected {{ formatDate(data.backup.updatedAt) }}</span>
      </div>
      <p v-else>No backup directory is currently visible to the web container.</p>
      <small>Restore validity is also checked automatically in CI against a separate PostgreSQL database.</small>
    </section>
  </div>
</template>

<style scoped>
.page { max-width: 1180px; margin: 0 auto; }
.header { display: flex; justify-content: space-between; gap: 1rem; align-items: flex-start; }
h1 { margin: .2rem 0; font-size: clamp(2.5rem, 6vw, 4.6rem); letter-spacing: -.05em; }
h2 { margin: 0 0 .9rem; }
.panel-title { display: flex; justify-content: space-between; gap: 1rem; align-items: flex-start; margin-bottom: .3rem; }
.panel-title h2 { margin-bottom: .25rem; }
.panel-title p { margin: 0; font-size: .85rem; }
.panel-title a { flex: none; }
p, span, small { color: #918999; }
button { border: 1px solid #39323f; border-radius: .65rem; padding: .65rem .85rem; background: #18151d; color: #fff; cursor: pointer; }
.summary { display: flex; justify-content: space-between; gap: 1rem; margin-top: 1.2rem; padding: 1rem 1.2rem; border: 1px solid #2e4939; border-radius: .9rem; background: #111a15; }
.summary.alert { border-color: #6d3e46; background: #211216; }
.cards { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: .8rem; margin-top: .8rem; }
.cards article, .panel { border: 1px solid #2c2732; border-radius: .9rem; padding: 1rem; background: #121016; }
.cards article { display: grid; gap: .35rem; }
.cards article > strong { font-size: 2.4rem; }
a { color: #c9b2df; }
.panel { margin-top: .8rem; }
.rows { display: grid; }
.rows > div { display: grid; grid-template-columns: 1fr auto; gap: .35rem 1rem; padding: .8rem 0; border-top: 1px solid #29242f; }
.rows > div:first-child { border-top: 0; }
.rows small { grid-column: 2; }
.ok { color: #90c9a7; }
.backup { display: grid; gap: .35rem; }
@media (max-width: 800px) {
  .header, .summary, .panel-title { display: grid; }
  .cards { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 480px) {
  .cards { grid-template-columns: 1fr; }
}
</style>
