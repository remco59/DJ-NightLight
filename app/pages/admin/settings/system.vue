<script setup lang="ts">
import { RENDER_ENGINE_LABELS, type RenderEngine, type RenderEngineSetting } from '~~/shared/render-engine'
import {
  formatBytes,
  formatLatency,
  formatUptime,
  latencyTone,
  loadTone,
  type ServerMetrics,
  type StatusTone,
} from '~~/shared/system-status'

definePageMeta({ layout: 'admin' })
useSeoMeta({ title: 'Systeemstatus — DJ NightLight', robots: 'noindex, nofollow' })

type StatusData = {
  generatedAt: string
  server: ServerMetrics
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
    instagram: {
      configured: boolean
      source: 'settings' | 'environment' | 'none'
      username: string | null
      level: 'ok' | 'warning' | 'error' | 'inactive'
      title: string
      detail: string
      lastWorkerRunAt: string | null
    }
  }
  renderWorker: {
    online: boolean
    engine: RenderEngineSetting
    activeEngine: RenderEngine | null
    heartbeatAt: string | null
  }
  backup: { name: string, updatedAt: string } | null
}

type RowTone = StatusTone | 'idle'
type IntegrationRow = {
  key: string
  name: string
  description: string
  to: string
  tone: RowTone
  label: string
  note: string
}

const HISTORY_LENGTH = 24
const LIVE_INTERVAL_MS = 15_000

const { data, refresh, pending } = await useFetch<StatusData>('/api/admin/system/status')

const live = ref(true)
const roundTripMs = ref<number | null>(null)
const databaseHistory = ref<number[]>([])
const roundTripHistory = ref<number[]>([])

function remember(history: Ref<number[]>, value: number | null | undefined) {
  if (value == null) return
  history.value = [...history.value, value].slice(-HISTORY_LENGTH)
}

// /api/health is public and tiny, so its timing is the browser-to-server connection without the status queries.
async function measureRoundTrip() {
  const started = performance.now()
  try {
    await $fetch('/api/health', { headers: { 'cache-control': 'no-cache' } })
    roundTripMs.value = Math.round((performance.now() - started) * 10) / 10
    remember(roundTripHistory, roundTripMs.value)
  } catch {
    roundTripMs.value = null
  }
}

async function reload() {
  if (pending.value) return
  await Promise.all([refresh(), measureRoundTrip()])
  remember(databaseHistory, data.value?.server.database.latencyMs)
}

let timer: ReturnType<typeof setInterval> | undefined

function stopTimer() {
  if (timer) clearInterval(timer)
  timer = undefined
}

function startTimer() {
  stopTimer()
  if (live.value && !document.hidden) timer = setInterval(reload, LIVE_INTERVAL_MS)
}

function onVisibility() {
  // Catch up right away when the tab comes back instead of waiting for the next tick.
  if (!document.hidden && live.value) void reload()
  startTimer()
}

onMounted(() => {
  remember(databaseHistory, data.value?.server.database.latencyMs)
  void measureRoundTrip()
  startTimer()
  document.addEventListener('visibilitychange', onVisibility)
})

onBeforeUnmount(() => {
  stopTimer()
  if (import.meta.client) document.removeEventListener('visibilitychange', onVisibility)
})

watch(live, startTimer)

const server = computed(() => data.value?.server)
const databaseDown = computed(() => data.value ? !data.value.server.database.ok : false)

const issues = computed(() => {
  const h = data.value?.health
  if (!h) return 0
  return h.failedEmails + h.failedCalendarSyncs + h.failedPayments + h.staleOutbox + (databaseDown.value ? 1 : 0)
})

const heroTone = computed<StatusTone>(() => (issues.value > 0 ? 'bad' : 'ok'))

const databaseTone = computed(() => latencyTone(server.value?.database.latencyMs, 'database'))
const roundTripTone = computed(() => latencyTone(roundTripMs.value, 'roundtrip'))

const memoryPercent = computed(() => {
  const memory = server.value?.memory
  return memory?.totalBytes ? Math.round((memory.usedBytes / memory.totalBytes) * 100) : 0
})
const cpuPercent = computed(() => server.value?.cpuLoadPercent ?? 0)

const healthTiles = computed(() => [
  { key: 'emails', label: 'Mislukte e-mails', icon: 'lucide:mail', count: data.value?.health.failedEmails, to: '/admin/settings/emails', link: 'E-mailautomatisering' },
  { key: 'calendar', label: 'Agendasyncfouten', icon: 'lucide:calendar-days', count: data.value?.health.failedCalendarSyncs, to: '/admin/calendar', link: 'Agenda openen' },
  { key: 'payments', label: 'Mislukte betalingen', icon: 'lucide:credit-card', count: data.value?.health.failedPayments, to: '/admin/invoices', link: 'Facturen openen' },
  { key: 'outbox', label: 'Vastgelopen outbox', icon: 'lucide:send', count: data.value?.health.staleOutbox, to: null, link: `${data.value?.health.pendingOutbox ?? 0} in wachtrij totaal` },
])

function sourceLabel(source: 'settings' | 'environment' | 'none', none: string) {
  if (source === 'settings') return 'Via Instellingen'
  if (source === 'environment') return 'Via serveromgeving'
  return none
}

const integrationRows = computed<IntegrationRow[]>(() => {
  const d = data.value
  if (!d) return []
  const { integrations, renderWorker } = d

  const instagramTone: Record<typeof integrations.instagram.level, RowTone> = { ok: 'ok', warning: 'warn', error: 'bad', inactive: 'idle' }
  const instagramLabel = integrations.instagram.username ? `${integrations.instagram.title} · @${integrations.instagram.username}` : integrations.instagram.title

  const engine = renderWorker.activeEngine ? RENDER_ENGINE_LABELS[renderWorker.activeEngine] : 'engine niet beschikbaar'
  const renderTone: RowTone = renderWorker.online ? 'ok' : renderWorker.heartbeatAt ? 'bad' : 'idle'
  const renderLabel = renderWorker.online ? `Online · ${engine}` : renderWorker.heartbeatAt ? 'Offline' : 'Niet gemeld'

  const stripe = integrations.stripe
  const stripeLabel = !stripe.configured ? 'Nog niet ingesteld' : stripe.livemode ? 'Live' : 'Testmodus'
  const lastWebhook = stripe.lastEvent ? `Laatste webhook ${formatDate(stripe.lastEvent.processedAt)}` : sourceLabel(stripe.source, 'Geen inloggegevens')

  return [
    {
      key: 'google',
      name: 'Google Agenda',
      description: 'Synchroniseer agenda en evenementen',
      to: '/admin/settings/google-calendar',
      tone: integrations.calendarConfigured ? 'ok' : 'warn',
      label: integrations.calendarConfigured ? 'Verbonden' : 'Niet verbonden',
      note: sourceLabel(integrations.calendarSource, 'Geen inloggegevens'),
    },
    {
      key: 'email',
      name: 'E-mailprovider',
      description: 'Verstuur e-mails en notificaties',
      to: '/admin/settings/resend',
      tone: integrations.emailConfigured ? 'ok' : 'warn',
      label: integrations.emailConfigured ? 'Ingesteld' : 'Ontbreekt',
      note: sourceLabel(integrations.emailSource, 'Geen providerinstellingen'),
    },
    {
      key: 'instagram',
      name: 'Instagram',
      description: 'Publiceer automatisch je posts',
      to: '/admin/settings/instagram',
      tone: instagramTone[integrations.instagram.level],
      label: instagramLabel,
      note: integrations.instagram.detail,
    },
    {
      key: 'render',
      name: 'Video-renderworker',
      description: 'Renders voor video’s en media',
      to: '/admin/settings/rendering',
      tone: renderTone,
      label: renderLabel,
      note: renderWorker.heartbeatAt ? `Laatst gezien ${formatDate(renderWorker.heartbeatAt)}` : 'Nog nooit gemeld',
    },
    {
      key: 'stripe',
      name: 'Stripe-betalingen',
      description: 'Betalingen en checkout',
      to: '/admin/settings/stripe',
      tone: stripe.configured ? 'ok' : 'idle',
      label: stripeLabel,
      note: lastWebhook,
    },
  ]
})

function formatDate(value: string | null | undefined) {
  if (!value) return 'Nooit'
  return new Intl.DateTimeFormat('nl-NL', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

const serverFacts = computed(() => {
  const s = server.value
  if (!s) return []
  return [
    { label: 'Versie', value: s.appVersion },
    { label: 'Hostnaam', value: s.hostname },
    { label: 'Platform', value: s.platform },
    { label: 'Node.js', value: s.nodeVersion },
    { label: 'Processorkernen', value: String(s.cpuCount) },
  ]
})
</script>

<template>
  <div class="status-page">
    <section class="hero" :class="heroTone" aria-live="polite">
      <span class="hero-icon" aria-hidden="true">
        <Icon :name="issues === 0 ? 'lucide:check' : 'lucide:triangle-alert'" />
      </span>
      <div class="hero-text">
        <small>Systeemstatus</small>
        <h2>{{ issues === 0 ? 'Geen actieve storingen' : `${issues} storing${issues === 1 ? '' : 'en'} vragen aandacht` }}</h2>
        <p>
          {{ issues === 0 ? 'Alle systemen werken naar behoren.' : databaseDown ? 'De database antwoordt niet.' : 'Bekijk hieronder wat er misgaat.' }}
          <span>Bijgewerkt {{ formatDate(data?.generatedAt) }}</span>
        </p>
      </div>
      <div class="hero-actions">
        <button type="button" class="live" :class="{ on: live }" :aria-pressed="live" @click="live = !live">
          <span class="live-dot" aria-hidden="true" />
          {{ live ? 'Live' : 'Gepauzeerd' }}
        </button>
        <button type="button" class="refresh" :disabled="pending" @click="reload()">
          <Icon name="lucide:refresh-cw" :class="{ spinning: pending }" aria-hidden="true" />
          {{ pending ? 'Vernieuwen…' : 'Vernieuwen' }}
        </button>
      </div>
    </section>

    <div class="section-head">
      <h3>Server</h3>
      <span v-if="server">{{ server.hostname }}</span>
    </div>
    <section class="metrics">
      <article class="metric">
        <span class="metric-icon" aria-hidden="true"><Icon name="lucide:clock-3" /></span>
        <div>
          <small>Uptime applicatie</small>
          <strong>{{ formatUptime(server?.appUptimeSeconds) }}</strong>
          <span class="sub">Sinds {{ formatDate(server?.startedAt) }}</span>
        </div>
      </article>
      <article class="metric">
        <span class="metric-icon" aria-hidden="true"><Icon name="lucide:server" /></span>
        <div>
          <small>Uptime server</small>
          <strong>{{ formatUptime(server?.hostUptimeSeconds) }}</strong>
          <span class="sub">Zonder herstart</span>
        </div>
      </article>
      <article class="metric">
        <span class="metric-icon" aria-hidden="true"><Icon name="lucide:network" /></span>
        <div>
          <small>IP-adres server</small>
          <strong class="mono">{{ server?.serverIp ?? 'Onbekend' }}</strong>
          <span class="sub">Jouw IP: <span class="mono">{{ server?.clientIp ?? 'onbekend' }}</span></span>
        </div>
      </article>
      <article class="metric">
        <span class="metric-icon" :class="databaseTone" aria-hidden="true"><Icon name="lucide:database" /></span>
        <div>
          <small>Database</small>
          <strong :class="databaseTone">{{ server?.database.ok ? formatLatency(server.database.latencyMs) : 'Offline' }}</strong>
          <span class="sub">{{ server?.database.ok ? 'Verbonden' : 'Geen verbinding' }}</span>
        </div>
      </article>
    </section>

    <div class="duo">
    <section class="panel latency">
      <div class="panel-title">
        <div>
          <h3>Latency</h3>
          <p>Laatste {{ HISTORY_LENGTH }} metingen, zolang deze pagina open staat.</p>
        </div>
      </div>
      <div class="series">
        <div class="series-row">
          <div class="series-meta">
            <small>Verbinding browser → server</small>
            <strong :class="roundTripTone">{{ formatLatency(roundTripMs) }}</strong>
          </div>
          <AdminSparkline :values="roundTripHistory" :tone="roundTripTone" />
        </div>
        <div class="series-row">
          <div class="series-meta">
            <small>Database-query</small>
            <strong :class="databaseTone">{{ formatLatency(server?.database.latencyMs) }}</strong>
          </div>
          <AdminSparkline :values="databaseHistory" :tone="databaseTone" />
        </div>
      </div>
    </section>

    <section class="panel resources">
      <div class="panel-title">
        <div>
          <h3>Resources</h3>
          <p>Belasting van de server waarop NightLight draait.</p>
        </div>
      </div>
      <div class="meters">
        <div class="meter" :class="loadTone(cpuPercent)">
          <div class="meter-head">
            <span><Icon name="lucide:cpu" aria-hidden="true" /> Processor</span>
            <strong>{{ cpuPercent }}%</strong>
          </div>
          <div class="bar" role="progressbar" aria-label="Processorbelasting" :aria-valuenow="Math.min(cpuPercent, 100)" aria-valuemin="0" aria-valuemax="100">
            <span :style="{ width: `${Math.min(cpuPercent, 100)}%` }" />
          </div>
          <small>Gemiddelde belasting laatste minuut · {{ server?.cpuCount ?? '—' }} kernen</small>
        </div>
        <div class="meter" :class="loadTone(memoryPercent)">
          <div class="meter-head">
            <span><Icon name="lucide:memory-stick" aria-hidden="true" /> Geheugen</span>
            <strong>{{ memoryPercent }}%</strong>
          </div>
          <div class="bar" role="progressbar" aria-label="Geheugengebruik" :aria-valuenow="memoryPercent" aria-valuemin="0" aria-valuemax="100">
            <span :style="{ width: `${memoryPercent}%` }" />
          </div>
          <small>{{ formatBytes(server?.memory.usedBytes) }} van {{ formatBytes(server?.memory.totalBytes) }} · NightLight {{ formatBytes(server?.memory.appBytes) }}</small>
        </div>
      </div>
      <dl class="facts">
        <div v-for="fact in serverFacts" :key="fact.label">
          <dt>{{ fact.label }}</dt>
          <dd class="mono">{{ fact.value }}</dd>
        </div>
      </dl>
    </section>
    </div>

    <div class="section-head">
      <h3>Systeemoverzicht</h3>
    </div>
    <section class="tiles">
      <article v-for="tile in healthTiles" :key="tile.key" class="tile" :class="{ bad: (tile.count ?? 0) > 0 }">
        <span class="tile-icon" aria-hidden="true"><Icon :name="tile.icon" /></span>
        <div>
          <small>{{ tile.label }}</small>
          <strong>{{ tile.count ?? '—' }}</strong>
          <NuxtLink v-if="tile.to" :to="tile.to">{{ tile.link }}</NuxtLink>
          <span v-else class="sub">{{ tile.link }}</span>
        </div>
      </article>
    </section>

    <div class="section-head">
      <h3>Koppelingen</h3>
      <NuxtLink to="/admin/settings/integrations">Koppelingen beheren <Icon name="lucide:chevron-right" aria-hidden="true" /></NuxtLink>
    </div>
    <section class="panel list">
      <NuxtLink v-for="row in integrationRows" :key="row.key" :to="row.to" class="row">
        <span class="brand" :class="row.key" aria-hidden="true">
          <template v-if="row.key === 'google'">G</template>
          <Icon v-else-if="row.key === 'email'" name="lucide:mail" />
          <Icon v-else-if="row.key === 'instagram'" name="lucide:instagram" />
          <Icon v-else-if="row.key === 'render'" name="lucide:clapperboard" />
          <template v-else>S</template>
        </span>
        <span class="row-text">
          <strong>{{ row.name }}</strong>
          <small>{{ row.description }}</small>
        </span>
        <span class="row-status">
          <span class="pill" :class="row.tone"><span class="dot" aria-hidden="true" />{{ row.label }}</span>
          <small>{{ row.note }}</small>
        </span>
        <Icon name="lucide:chevron-right" class="chevron" aria-hidden="true" />
      </NuxtLink>
    </section>

    <div class="section-head">
      <h3>Back-ups</h3>
    </div>
    <section class="panel backup">
      <span class="backup-icon" aria-hidden="true"><Icon name="lucide:hard-drive" /></span>
      <div class="backup-text">
        <strong>{{ data?.backup ? data.backup.name : 'Back-up configuratie' }}</strong>
        <p v-if="data?.backup">Laatste back-up op schijf gevonden {{ formatDate(data.backup.updatedAt) }}</p>
        <p v-else>De webcontainer ziet op dit moment geen back-upmap.</p>
        <small>Of een back-up terug te zetten is, wordt ook automatisch in CI gecontroleerd tegen een aparte PostgreSQL-database.</small>
      </div>
      <span class="pill" :class="data?.backup ? 'ok' : 'idle'"><span class="dot" aria-hidden="true" />{{ data?.backup ? 'Back-up aanwezig' : 'Geen back-upmap' }}</span>
    </section>
  </div>
</template>

<style scoped>
.status-page { max-width: 1180px; margin: 0 auto; display: grid; gap: .8rem; --tone: var(--text-subtle); }
h2, h3, p, dl, dd { margin: 0; }
small, .sub, p { color: var(--text-subtle); }
a { color: var(--electric-soft); }
.mono { font-family: SFMono-Regular, 'Roboto Mono', 'Cascadia Mono', Consolas, monospace; letter-spacing: 0; }
.ok { --tone: var(--status-ok); }
.warn { --tone: var(--status-warn); }
.bad { --tone: var(--status-danger); }
strong.ok, strong.warn, strong.bad { color: var(--tone); }

button { display: inline-flex; align-items: center; justify-content: center; gap: .45rem; min-height: 2.5rem; border: 1px solid var(--border-strong); border-radius: .75rem; padding: .5rem .9rem; background: var(--surface-raised); color: var(--text); font: inherit; font-size: .85rem; font-weight: 650; cursor: pointer; }
button:disabled { opacity: .6; cursor: progress; }
button:focus-visible { outline: 2px solid var(--electric-accent); outline-offset: 2px; }

/* Hero */
.hero { display: grid; grid-template-columns: auto 1fr; gap: .9rem 1rem; align-items: center; padding: 1.1rem; border: 1px solid color-mix(in srgb, var(--tone) 40%, transparent); border-radius: 1.1rem; background: radial-gradient(120% 140% at 0% 0%, color-mix(in srgb, var(--tone) 16%, transparent), transparent 60%), var(--surface-card); }
.hero-icon { display: grid; place-items: center; width: 3.6rem; height: 3.6rem; border: 2px solid var(--tone); border-radius: 50%; color: var(--tone); font-size: 1.8rem; box-shadow: 0 0 1.6rem color-mix(in srgb, var(--tone) 35%, transparent), inset 0 0 1rem color-mix(in srgb, var(--tone) 18%, transparent); }
.hero-text small { font-size: .7rem; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; }
.hero-text h2 { margin-top: .15rem; font-size: clamp(1.25rem, 4vw, 1.7rem); letter-spacing: -.03em; }
.hero-text p { margin-top: .25rem; font-size: .85rem; }
.hero-text p span { display: block; font-size: .75rem; }
.hero-actions { grid-column: 1 / -1; display: flex; gap: .6rem; }
.hero-actions .refresh { flex: 1; }
.live { color: var(--text-muted); }
.live-dot { width: .5rem; height: .5rem; border-radius: 50%; background: var(--text-subtle); }
.live.on { color: var(--text); }
.live.on .live-dot { background: var(--status-ok); animation: pulse 2s ease-out infinite; }
.spinning { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(34, 197, 94, .55); } 70%, 100% { box-shadow: 0 0 0 .45rem rgba(34, 197, 94, 0); } }

/* Section headings */
.section-head { display: flex; justify-content: space-between; align-items: baseline; gap: 1rem; margin-top: .6rem; }
.section-head h3 { font-size: 1.15rem; letter-spacing: -.02em; }
.section-head > span { color: var(--text-subtle); font-size: .78rem; }
.section-head a { display: inline-flex; align-items: center; gap: .15rem; font-size: .82rem; text-decoration: none; }

/* Cards */
.metrics, .tiles { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .7rem; }
.metric, .tile, .panel { border: 1px solid var(--border); border-radius: 1rem; background: var(--surface-card); }
.metric, .tile { display: flex; flex-direction: column; gap: .7rem; padding: .9rem; min-width: 0; }
.metric > div, .tile > div { display: grid; gap: .15rem; min-width: 0; }
.metric small, .tile small { font-size: .78rem; }
.metric strong, .tile strong { font-size: 1.5rem; line-height: 1.15; letter-spacing: -.03em; overflow-wrap: anywhere; }
.metric strong.mono { font-size: 1.05rem; letter-spacing: 0; }
.sub { font-size: .74rem; overflow-wrap: anywhere; }
.metric-icon, .tile-icon, .backup-icon { display: grid; place-items: center; flex: none; width: 2.4rem; height: 2.4rem; border-radius: .8rem; background: var(--electric-haze); color: var(--electric-accent); font-size: 1.15rem; }
.metric-icon.ok, .metric-icon.warn, .metric-icon.bad { background: color-mix(in srgb, var(--tone) 14%, transparent); color: var(--tone); }
.tile a { font-size: .8rem; }
.tile.bad { border-color: color-mix(in srgb, var(--status-danger) 45%, transparent); background: color-mix(in srgb, var(--status-danger) 7%, var(--surface-card)); }
.tile.bad strong { color: #ffabb5; }
.tile.bad .tile-icon { background: color-mix(in srgb, var(--status-danger) 16%, transparent); color: var(--status-danger); }

.duo { display: grid; gap: .8rem; }
.panel { padding: 1rem; }
.panel-title h3 { font-size: 1.05rem; }
.panel-title p { margin-top: .2rem; font-size: .8rem; }

/* Latency */
.series { display: grid; gap: 1rem; margin-top: .9rem; }
.series-row { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr); gap: 1rem; align-items: center; }
.series-meta { display: grid; gap: .1rem; }
.series-meta small { font-size: .76rem; }
.series-meta strong { font-size: 1.35rem; letter-spacing: -.03em; }

/* Meters */
.meters { display: grid; gap: 1rem; margin-top: .9rem; }
.meter { display: grid; gap: .45rem; }
.meter-head { display: flex; justify-content: space-between; align-items: center; font-size: .85rem; }
.meter-head span { display: inline-flex; align-items: center; gap: .4rem; color: var(--text-muted); }
.meter-head strong { font-size: 1.05rem; color: var(--text); }
.bar { height: .55rem; border-radius: 99px; background: var(--surface-raised); overflow: hidden; }
.bar span { display: block; height: 100%; border-radius: inherit; background: var(--tone); transition: width .4s ease; }
.meter small { font-size: .74rem; }
.facts { display: grid; grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr)); gap: .6rem 1rem; margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--border); }
.facts dt { color: var(--text-subtle); font-size: .7rem; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
.facts dd { margin-top: .15rem; font-size: .82rem; overflow-wrap: anywhere; }

/* Integrations */
.list { padding: .3rem 1rem; }
.row { display: grid; grid-template-columns: auto 1fr auto; gap: .35rem .85rem; align-items: center; padding: .85rem 0; border-top: 1px solid var(--border); color: inherit; text-decoration: none; }
.row:first-child { border-top: 0; }
.row:hover .row-text strong { text-decoration: underline; }
.row:focus-visible { outline: 2px solid var(--electric-accent); outline-offset: 2px; border-radius: .6rem; }
.brand { display: grid; place-items: center; width: 2.6rem; height: 2.6rem; border-radius: .8rem; background: var(--surface-raised); color: #fff; font-size: 1.2rem; font-weight: 900; }
.brand.google { background: linear-gradient(135deg, #2d6cdf, #34a853 45%, #fbbc05 70%, #ea4335); }
.brand.email { background: #1d4ed8; }
.brand.instagram { background: linear-gradient(135deg, #833ab4, #c13584 50%, #fd1d1d 80%, #fcb045); }
.brand.render { background: #2a2733; }
.brand.stripe { background: #635bff; }
.row-text { display: grid; min-width: 0; }
.row-text small { font-size: .78rem; }
.row-status { grid-column: 2 / 3; display: grid; justify-items: start; gap: .3rem; min-width: 0; }
.row-status small { font-size: .74rem; overflow-wrap: anywhere; }
.chevron { grid-column: 3; grid-row: 1; color: var(--text-subtle); }

.pill { display: inline-flex; align-items: center; gap: .4rem; max-width: 100%; padding: .28rem .7rem; border-radius: 99px; background: color-mix(in srgb, var(--tone) 14%, var(--surface-raised)); border: 1px solid color-mix(in srgb, var(--tone) 35%, transparent); color: var(--text); font-size: .74rem; font-weight: 700; }
.pill.idle { --tone: var(--text-subtle); color: var(--text-muted); }
.pill .dot { flex: none; width: .45rem; height: .45rem; border-radius: 50%; background: var(--tone); }

/* Back-ups */
.backup { display: grid; grid-template-columns: auto 1fr; gap: .8rem 1rem; align-items: start; }
.backup-text { display: grid; gap: .3rem; min-width: 0; }
.backup-text strong { overflow-wrap: anywhere; }
.backup-text p, .backup-text small { font-size: .82rem; }
.backup .pill { grid-column: 1 / -1; justify-self: start; }

@media (min-width: 640px) {
  .hero { grid-template-columns: auto 1fr auto; padding: 1.3rem 1.5rem; }
  .hero-actions { grid-column: auto; flex-direction: column; align-items: stretch; }
  .hero-actions .refresh { flex: none; }
  .hero-text p span { display: inline; margin-left: .4rem; }
  .metrics, .tiles { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  .meters { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1.5rem; }
  .row { grid-template-columns: auto 1fr minmax(0, 18rem) auto; }
  .row-status { grid-column: auto; justify-items: end; text-align: right; }
  .chevron { grid-column: auto; grid-row: auto; }
  .backup { grid-template-columns: auto 1fr auto; align-items: center; }
  .backup .pill { grid-column: auto; }
}

@media (min-width: 900px) {
  .duo { grid-template-columns: minmax(0, 5fr) minmax(0, 6fr); align-items: start; }
  .series-row { grid-template-columns: 1fr; gap: .5rem; }
}

@media (prefers-reduced-motion: reduce) {
  .spinning, .live.on .live-dot { animation: none; }
  .bar span { transition: none; }
}
</style>
