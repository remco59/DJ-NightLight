<script setup lang="ts">
import { RENDER_ENGINE_LABELS, type RenderEngine, type RenderEngineSetting } from '~~/shared/render-engine'

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
      configured: boolean
      source: 'settings' | 'environment' | 'none'
      livemode: boolean | null
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
  renderWorker: {
    online: boolean
    engine: RenderEngineSetting
    activeEngine: RenderEngine | null
    heartbeatAt: string | null
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
  if (!value) return 'Nooit'
  return new Intl.DateTimeFormat('nl-NL', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}
</script>

<template>
  <div class="page">
    <header class="header">
      <div>
        <p class="eyebrow">Systeem</p>
        <h1>Systeemstatus</h1>
        <p>Storingen, de status van koppelingen en back-ups op één plek.</p>
      </div>
      <button type="button" :disabled="pending" @click="refresh()">
        {{ pending ? 'Vernieuwen…' : 'Vernieuwen' }}
      </button>
    </header>

    <section class="summary" :class="{ alert: issues > 0 }">
      <strong>{{ issues === 0 ? 'Geen actieve storingen' : `${issues} storing(en) vragen aandacht` }}</strong>
      <span>Bijgewerkt {{ formatDate(data?.generatedAt) }}</span>
    </section>

    <section class="cards">
      <article>
        <span>Mislukte e-mails</span>
        <strong>{{ data?.health.failedEmails ?? '—' }}</strong>
        <NuxtLink to="/admin/email">E-mailautomatisering openen</NuxtLink>
      </article>
      <article>
        <span>Mislukte agendasynchronisaties</span>
        <strong>{{ data?.health.failedCalendarSyncs ?? '—' }}</strong>
        <NuxtLink to="/admin/calendar">Agenda openen</NuxtLink>
      </article>
      <article>
        <span>Mislukte betalingen</span>
        <strong>{{ data?.health.failedPayments ?? '—' }}</strong>
        <NuxtLink to="/admin/invoices">Facturen openen</NuxtLink>
      </article>
      <article>
        <span>Vastgelopen outbox</span>
        <strong>{{ data?.health.staleOutbox ?? '—' }}</strong>
        <small>{{ data?.health.pendingOutbox ?? 0 }} in wachtrij totaal</small>
      </article>
    </section>

    <section class="panel">
      <div class="panel-title">
        <div>
          <h2>Koppelingen</h2>
          <p>De status toont de configuratie die echt gebruikt wordt, uit Instellingen of uit de serveromgeving.</p>
        </div>
        <NuxtLink to="/admin/settings#integrations">Koppelingen beheren</NuxtLink>
      </div>
      <div class="rows">
        <div>
          <span>Inloggegevens Google Calendar</span>
          <strong :class="{ ok: data?.integrations.calendarConfigured }">
            {{ data?.integrations.calendarConfigured ? 'Ingesteld' : 'Ontbreekt' }}
          </strong>
          <small>{{ data?.integrations.calendarSource === 'settings' ? 'Instellingen' : data?.integrations.calendarSource === 'environment' ? 'Serveromgeving' : 'Geen inloggegevens' }}</small>
        </div>
        <div>
          <span>E-mailprovider</span>
          <strong :class="{ ok: data?.integrations.emailConfigured }">
            {{ data?.integrations.emailConfigured ? 'Ingesteld' : 'Ontbreekt' }}
          </strong>
          <small>{{ data?.integrations.emailSource === 'settings' ? 'Instellingen' : data?.integrations.emailSource === 'environment' ? 'Serveromgeving' : 'Geen providerinstellingen' }}</small>
        </div>
        <div>
          <span>Video-renderworker</span>
          <strong :class="{ ok: data?.renderWorker.online }">
            {{ data?.renderWorker.online ? `Online · ${data.renderWorker.activeEngine ? RENDER_ENGINE_LABELS[data.renderWorker.activeEngine] : 'engine niet beschikbaar'}` : 'Offline' }}
          </strong>
          <small>
            {{ data?.renderWorker.heartbeatAt ? `Laatst gezien ${formatDate(data.renderWorker.heartbeatAt)}` : 'Nog nooit gemeld' }}
            · <NuxtLink to="/admin/settings#rendering">Renderinstellingen</NuxtLink>
          </small>
        </div>
        <div>
          <span>Stripe-betalingen</span>
          <strong :class="{ ok: data?.integrations.stripe.configured }">
            {{ data?.integrations.stripe.configured ? (data.integrations.stripe.livemode ? 'Ingesteld · live' : 'Ingesteld · test') : 'Nog niet ingesteld' }}
          </strong>
          <small>
            {{ data?.integrations.stripe.source === 'settings' ? 'Instellingen' : data?.integrations.stripe.source === 'environment' ? 'Serveromgeving' : 'Geen inloggegevens' }}
            <template v-if="data?.integrations.stripe.lastEvent">
              · Laatste webhook {{ data.integrations.stripe.lastEvent.eventType }} · {{ formatDate(data.integrations.stripe.lastEvent.processedAt) }}
            </template>
          </small>
        </div>
      </div>
    </section>

    <section class="panel">
      <h2>Back-ups</h2>
      <div v-if="data?.backup" class="backup">
        <strong>{{ data.backup.name }}</strong>
        <span>Laatste back-up op schijf gevonden {{ formatDate(data.backup.updatedAt) }}</span>
      </div>
      <p v-else>De webcontainer ziet op dit moment geen back-upmap.</p>
      <small>Of een back-up terug te zetten is, wordt ook automatisch in CI gecontroleerd tegen een aparte PostgreSQL-database.</small>
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
