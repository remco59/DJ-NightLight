<script setup lang="ts">
definePageMeta({ layout: 'admin' })

const { user } = useUserSession()
const canManageGigs = computed(() => user.value?.role === 'owner' || user.value?.role === 'manager')

type DashboardData = {
  summary: {
    upcoming: number
    leads: number
    unpaidInvoices: number
    unpaidAmountCents: number
    bookedRevenueThisMonthCents: number
    attention: number
  }
  upcoming: Array<{
    id: string
    title: string
    eventType: string | null
    startsAt: string | Date | null
    endsAt: string | Date | null
    venueName: string | null
  }>
  attention: Array<{
    id: string
    kind: 'invoice' | 'contract' | 'lead'
    title: string
    description: string
    meta: string | Date | null
    href: string
  }>
  week: {
    gigs: number
    bookedRevenueCents: number
    invoicesDue: number
    contractsOpen: number
  }
  system: {
    issues: number
  }
}

const { data, status, refresh } = await useFetch<DashboardData>('/api/admin/dashboard')

const nextGig = computed(() => data.value?.upcoming[0] ?? null)
const systemHealthy = computed(() => (data.value?.system.issues ?? 0) === 0)

function asDate(value: string | Date | null) {
  return value ? new Date(value) : null
}

function dayOfMonth(value: string | Date | null) {
  return asDate(value)?.getDate() ?? '—'
}

function weekday(value: string | Date | null) {
  return asDate(value)?.toLocaleDateString('nl-NL', { weekday: 'short' }).replace('.', '').toUpperCase() ?? ''
}

function shortMonth(value: string | Date | null) {
  return asDate(value)?.toLocaleDateString('nl-NL', { month: 'short' }).replace('.', '').toUpperCase() ?? ''
}

function formatTime(value: string | Date | null) {
  return asDate(value)?.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }) ?? '—'
}

function formatRange(start: string | Date | null, end: string | Date | null) {
  if (!start) return 'Tijd niet ingesteld'
  return `${formatTime(start)}${end ? ` – ${formatTime(end)}` : ''}`
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(cents / 100)
}

function formatMeta(value: string | Date | null) {
  const date = asDate(value)
  if (!date) return ''
  return date.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
}

function attentionIcon(kind: DashboardData['attention'][number]['kind']) {
  if (kind === 'invoice') return 'lucide:receipt-text'
  if (kind === 'contract') return 'lucide:file-signature'
  return 'lucide:user-round-plus'
}


function weekRange() {
  const now = new Date()
  const day = now.getDay() || 7
  const start = new Date(now)
  start.setDate(now.getDate() - day + 1)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  const sameMonth = start.getMonth() === end.getMonth()
  const startText = start.toLocaleDateString('nl-NL', sameMonth ? { day: 'numeric' } : { day: 'numeric', month: 'short' })
  const endText = end.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
  return `${startText} – ${endText}`
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
        <p>Wat nu aandacht nodig heeft, zonder ruis.</p>
      </div>
      <div class="actions">
        <NuxtLink
          to="/admin/system"
          class="system-status"
          :class="{ problem: !systemHealthy }"
          :aria-label="systemHealthy ? 'Alles actief' : `${data?.system.issues ?? 0} systeemproblemen`"
        >
          <span class="status-dot" />
          <span>{{ systemHealthy ? 'Alles actief' : 'Systeemprobleem' }}</span>
        </NuxtLink>
        <button type="button" class="secondary with-icon" @click="() => refresh()">
          <Icon name="lucide:refresh-cw" aria-hidden="true" />
          Vernieuwen
        </button>
        <NuxtLink v-if="canManageGigs" to="/admin/gigs?new=1" class="with-icon primary">
          <Icon name="lucide:plus" aria-hidden="true" />
          Nieuwe gig
        </NuxtLink>
      </div>
    </header>

    <div v-if="status === 'pending'" class="state">Dashboard laden…</div>

    <template v-else>
      <section class="summary-grid" aria-label="Dashboardstatistieken">
        <NuxtLink class="summary-card next-gig" :to="nextGig ? `/admin/gigs/${nextGig.id}` : '/admin/gigs'">
          <span class="summary-icon"><Icon name="lucide:calendar-days" /></span>
          <div class="summary-body">
            <div class="summary-label">
              <span>Volgende gig</span>
              <Icon name="lucide:chevron-right" aria-hidden="true" />
            </div>
            <template v-if="nextGig">
              <div class="next-gig-content">
                <div class="date-tile">
                  <span>{{ weekday(nextGig.startsAt) }}</span>
                  <strong>{{ dayOfMonth(nextGig.startsAt) }}</strong>
                  <span>{{ shortMonth(nextGig.startsAt) }}</span>
                </div>
                <div class="next-copy">
                  <strong class="truncate">{{ nextGig.title }}</strong>
                  <span class="with-icon muted"><Icon name="lucide:clock-3" />{{ formatRange(nextGig.startsAt, nextGig.endsAt) }}</span>
                </div>
              </div>
            </template>
            <div v-else class="summary-empty">Nog geen aankomende gig gepland.</div>
          </div>
        </NuxtLink>

        <NuxtLink class="summary-card" to="/admin/gigs?status=lead">
          <span class="summary-icon"><Icon name="lucide:users-round" /></span>
          <div class="summary-body">
            <div class="summary-label"><span>Open leads</span><Icon name="lucide:chevron-right" /></div>
            <strong class="summary-value">{{ data?.summary.leads ?? 0 }}</strong>
            <span class="summary-detail">Aanvragen die opvolging nodig hebben</span>
          </div>
        </NuxtLink>

        <NuxtLink class="summary-card" to="/admin/gigs">
          <span class="summary-icon"><Icon name="lucide:file-text" /></span>
          <div class="summary-body">
            <div class="summary-label"><span>Openstaand</span><Icon name="lucide:chevron-right" /></div>
            <strong class="summary-value">{{ formatCurrency(data?.summary.unpaidAmountCents ?? 0) }}</strong>
            <span class="summary-detail">{{ data?.summary.unpaidInvoices ?? 0 }} facturen niet betaald</span>
          </div>
        </NuxtLink>

        <NuxtLink class="summary-card" to="/admin/agenda">
          <span class="summary-icon"><Icon name="lucide:chart-no-axes-combined" /></span>
          <div class="summary-body">
            <div class="summary-label"><span>Omzet deze maand</span><Icon name="lucide:chevron-right" /></div>
            <strong class="summary-value">{{ formatCurrency(data?.summary.bookedRevenueThisMonthCents ?? 0) }}</strong>
            <span class="summary-detail">{{ (data?.summary.bookedRevenueThisMonthCents ?? 0) > 0 ? 'geboekt deze kalendermaand' : 'nog niets geboekt' }}</span>
          </div>
        </NuxtLink>
      </section>

      <section class="dashboard-grid">
        <div id="attention" class="panel attention-panel">
          <div class="panel-heading">
            <div class="heading-title">
              <span class="heading-icon"><Icon name="lucide:square-pen" /></span>
              <h2>Aandacht nodig</h2>
            </div>
            <NuxtLink to="/admin/gigs">Alles bekijken <Icon name="lucide:arrow-right" /></NuxtLink>
          </div>

          <div v-if="!data?.attention.length" class="empty compact">
            <Icon name="lucide:circle-check-big" />
            <div>
              <strong>Alles bijgewerkt.</strong>
              <span>Er zijn momenteel geen urgente actiepunten.</span>
            </div>
          </div>

          <div v-else class="attention-list">
            <NuxtLink
              v-for="item in data.attention"
              :key="item.id"
              :to="item.href"
              class="attention-row"
            >
              <div class="attention-icon" :class="item.kind">
                <Icon :name="attentionIcon(item.kind)" />
              </div>
              <div class="attention-copy">
                <strong>{{ item.title }}</strong>
                <span>{{ item.description }}</span>
              </div>
              <span class="attention-meta with-icon"><Icon name="lucide:calendar-days" />{{ formatMeta(item.meta) }}</span>
              <Icon class="row-chevron" name="lucide:chevron-right" />
            </NuxtLink>
          </div>
        </div>

        <aside class="panel week-panel">
          <div class="panel-heading">
            <div class="heading-title">
              <span class="heading-icon"><Icon name="lucide:chart-no-axes-combined" /></span>
              <h2>Deze week</h2>
            </div>
          </div>
          <div class="week-list">
            <NuxtLink to="/admin/agenda" class="week-row">
              <span class="week-icon"><Icon name="lucide:calendar-days" /></span>
              <strong>{{ data?.week.gigs ?? 0 }} gigs</strong>
              <Icon name="lucide:chevron-right" />
            </NuxtLink>
            <div class="week-row">
              <span class="week-icon cyan"><Icon name="lucide:chart-no-axes-combined" /></span>
              <strong>{{ formatCurrency(data?.week.bookedRevenueCents ?? 0) }} geboekt</strong>
              <span />
            </div>
            <div class="week-row">
              <span class="week-icon cyan"><Icon name="lucide:file-text" /></span>
              <strong>{{ data?.week.invoicesDue ?? 0 }} facturen</strong>
              <span />
            </div>
            <div class="week-row">
              <span class="week-icon"><Icon name="lucide:file-signature" /></span>
              <strong>{{ data?.week.contractsOpen ?? 0 }} contracten open</strong>
              <span />
            </div>
          </div>
        </aside>
      </section>

      <section class="panel upcoming-panel">
        <div class="panel-heading">
          <div class="heading-title">
            <span class="heading-icon"><Icon name="lucide:calendar-days" /></span>
            <h2>Komende gigs</h2>
          </div>
          <NuxtLink to="/admin/agenda">Volledige agenda <Icon name="lucide:arrow-right" /></NuxtLink>
        </div>

        <div v-if="!data?.upcoming.length" class="empty">
          <strong>Nog geen aankomende gigs.</strong>
          <span>Nieuw geboekte gigs verschijnen hier automatisch.</span>
        </div>

        <div v-else class="gig-table">
          <div class="gig-table-head" aria-hidden="true">
            <span>Datum</span>
            <span>Gig</span>
            <span>Locatie</span>
            <span>Tijd</span>
            <span />
          </div>
          <NuxtLink
            v-for="gig in data.upcoming"
            :key="gig.id"
            :to="`/admin/gigs/${gig.id}`"
            class="gig-row"
          >
            <div class="gig-date">
              <span>{{ weekday(gig.startsAt) }}</span>
              <strong>{{ dayOfMonth(gig.startsAt) }} {{ shortMonth(gig.startsAt) }}</strong>
            </div>
            <strong class="gig-title truncate">{{ gig.title }}</strong>
            <span class="gig-detail with-icon"><Icon name="lucide:map-pin" />{{ gig.venueName || 'Locatie niet ingesteld' }}</span>
            <span class="gig-detail with-icon"><Icon name="lucide:clock-3" />{{ formatRange(gig.startsAt, gig.endsAt) }}</span>
            <Icon class="row-chevron" name="lucide:chevron-right" />
          </NuxtLink>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.dashboard { max-width: 1540px; margin-inline: auto; }
.page-header { display:flex; align-items:center; justify-content:space-between; gap:1.5rem; margin-bottom:1.5rem; }
.page-header h1 { margin:.2rem 0 .2rem; font-size:clamp(2.35rem,4vw,3.7rem); line-height:1; letter-spacing:-.05em; }
.page-header p:last-child { margin:0; color:#9a93a6; }
.actions { display:flex; align-items:center; gap:.65rem; }
.actions a,.actions button { min-height:42px; border-radius:.72rem; padding:.68rem .9rem; text-decoration:none; font-weight:700; font-size:.82rem; }
.primary { background:linear-gradient(135deg,#7c3aed,#9d4edd); color:white; box-shadow:0 0 24px rgba(124,58,237,.24); }
.secondary { border:1px solid #2f2b35; background:#0d0b10; color:#d0c9d8; cursor:pointer; }
.with-icon { display:inline-flex; align-items:center; gap:.45rem; }
.with-icon :deep(svg) { width:1rem; height:1rem; }
.system-status { display:inline-flex; align-items:center; gap:.55rem; border:1px solid #27342e; background:#0d1210; color:#a7c9b5; }
.system-status.problem { border-color:#4d2931; background:#160e11; color:#f0a5b0; }
.status-dot { width:.58rem; height:.58rem; border-radius:50%; background:#22c55e; box-shadow:0 0 11px rgba(34,197,94,.55); }
.system-status.problem .status-dot { background:#ef4444; box-shadow:0 0 11px rgba(239,68,68,.5); }

.summary-grid { display:grid; grid-template-columns:1.35fr repeat(3,1fr); gap:.85rem; }
.summary-card { min-width:0; min-height:132px; display:grid; grid-template-columns:48px minmax(0,1fr); gap:1rem; padding:1rem 1.05rem; border:1px solid #292530; border-radius:.9rem; background:linear-gradient(145deg,#100e14,#0d0b10); color:inherit; text-decoration:none; }
.summary-card:hover { border-color:#3c334a; background:#121017; }
.summary-icon,.heading-icon { display:grid; place-items:center; width:46px; height:46px; border-radius:.7rem; background:#211439; color:#a66cff; }
.summary-icon :deep(svg),.heading-icon :deep(svg) { width:1.25rem; height:1.25rem; }
.summary-body { min-width:0; }
.summary-label { display:flex; align-items:center; justify-content:space-between; gap:.75rem; color:#e4deea; font-size:.82rem; font-weight:800; }
.summary-label :deep(svg) { width:1rem; height:1rem; color:#b9a8d4; }
.summary-value { display:block; margin-top:1rem; font-size:2rem; line-height:1; letter-spacing:-.04em; }
.summary-detail { display:block; margin-top:.55rem; color:#8a8296; font-size:.76rem; }
.next-gig-content { display:grid; grid-template-columns:56px minmax(0,1fr); gap:.8rem; margin-top:.65rem; align-items:center; }
.date-tile { display:grid; place-items:center; align-content:center; min-height:62px; border:1px solid #2e2840; border-radius:.72rem; background:#1b1624; }
.date-tile strong { font-size:1.3rem; line-height:1.05; }
.date-tile span { color:#aaa0bb; font-size:.6rem; font-weight:800; letter-spacing:.05em; }
.next-copy { min-width:0; display:grid; gap:.45rem; align-content:center; }
.next-copy > strong { font-size:.92rem; }
.muted { color:#a59cad; font-size:.74rem; }
.summary-empty { margin-top:1rem; color:#756e7e; font-size:.8rem; }
.truncate { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }

.dashboard-grid { display:grid; grid-template-columns:minmax(0,2.15fr) minmax(300px,.85fr); gap:.85rem; margin-top:.85rem; }
.panel { overflow:hidden; border:1px solid #292530; border-radius:.9rem; background:#100e14; }
.panel-heading { display:flex; align-items:center; justify-content:space-between; gap:1rem; min-height:64px; padding:.85rem 1rem; border-bottom:1px solid #26212d; }
.heading-title { display:flex; align-items:center; gap:.75rem; min-width:0; }
.heading-icon { width:38px; height:38px; border-radius:.62rem; }
.heading-icon :deep(svg) { width:1.08rem; height:1.08rem; }
.panel-heading h2 { margin:0; font-size:1.12rem; }
.panel-heading a { display:inline-flex; align-items:center; gap:.35rem; color:#b45cff; font-size:.76rem; text-decoration:none; font-weight:800; white-space:nowrap; }
.panel-heading a :deep(svg) { width:.9rem; }

.attention-list { padding:0 1rem; }
.attention-row { display:grid; grid-template-columns:42px minmax(0,1fr) auto 18px; gap:.8rem; align-items:center; min-height:66px; padding:.55rem .25rem; border-bottom:1px solid #29242f; color:inherit; text-decoration:none; }
.attention-row:last-child { border-bottom:0; }
.attention-row:hover { background:rgba(255,255,255,.012); }
.attention-icon { display:grid; place-items:center; width:38px; height:38px; border-radius:.7rem; background:#26131b; color:#fb7185; }
.attention-icon.contract { background:#26131b; color:#fb7185; }
.attention-icon.lead { background:#2a1b0d; color:#fbbf24; }
.attention-copy { min-width:0; }
.attention-copy strong,.attention-copy span { display:block; }
.attention-copy strong { font-size:.84rem; }
.attention-copy span { margin-top:.18rem; color:#9a91a6; font-size:.74rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.attention-meta { color:#9f96ac; font-size:.7rem; white-space:nowrap; }
.row-chevron { width:1rem; height:1rem; color:#c3b5d4; }

.week-list { padding:0 1rem; }
.week-row { display:grid; grid-template-columns:38px minmax(0,1fr) 18px; align-items:center; gap:.7rem; min-height:57px; border-bottom:1px solid #29242f; color:inherit; text-decoration:none; }
.week-row:last-child { border-bottom:0; }
.week-row strong { font-size:.82rem; font-weight:750; }
.week-icon { display:grid; place-items:center; width:32px; height:32px; color:#b45cff; }
.week-icon.cyan { color:#62d6f7; }
.week-icon :deep(svg) { width:1.1rem; height:1.1rem; }
.week-row > :deep(svg) { width:.95rem; height:.95rem; color:#b7aacb; }

.upcoming-panel { margin-top:.85rem; }
.gig-table { padding:0 1rem .35rem; }
.gig-table-head,.gig-row { display:grid; grid-template-columns:130px minmax(180px,1.15fr) minmax(190px,1fr) minmax(140px,.75fr) 20px; gap:1rem; align-items:center; }
.gig-table-head { min-height:38px; color:#a29aaa; font-size:.7rem; font-weight:700; border-bottom:1px solid #29242f; }
.gig-row { min-height:62px; border-bottom:1px solid #29242f; color:inherit; text-decoration:none; }
.gig-row:last-child { border-bottom:0; }
.gig-row:hover { background:rgba(255,255,255,.012); }
.gig-date { display:grid; gap:.08rem; }
.gig-date span { color:#a49aaa; font-size:.62rem; font-weight:800; }
.gig-date strong { font-size:.86rem; }
.gig-title { font-size:.82rem; }
.gig-detail { min-width:0; color:#9c93aa; font-size:.74rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }

.empty { display:grid; gap:.3rem; padding:2rem 1.2rem; color:#aaa3b4; }
.empty span { color:#716b79; }
.empty.compact { grid-template-columns:auto 1fr; align-items:center; padding:1.4rem 1.2rem; }
.empty.compact :deep(svg) { width:1.4rem; height:1.4rem; color:#34d399; }
.state { padding:3rem 0; color:#8f8998; }

@media (max-width: 1180px) {
  .summary-grid { grid-template-columns:repeat(2,minmax(0,1fr)); }
  .dashboard-grid { grid-template-columns:1fr; }
  .gig-table-head,.gig-row { grid-template-columns:110px minmax(160px,1fr) minmax(150px,.8fr) minmax(125px,.7fr) 18px; }
}
@media (max-width: 780px) {
  .page-header { align-items:flex-start; flex-direction:column; }
  .actions { width:100%; flex-wrap:wrap; }
  .actions .primary,.actions .secondary { flex:1; justify-content:center; }
  .summary-grid { grid-template-columns:1fr; }
  .attention-row { grid-template-columns:42px minmax(0,1fr) 18px; }
  .attention-meta { display:none; }
  .gig-table-head { display:none; }
  .gig-table { padding-top:.3rem; }
  .gig-row { grid-template-columns:84px minmax(0,1fr) auto; gap:.7rem; padding:.65rem 0; }
  .gig-title { grid-column:2; }
  .gig-detail { grid-column:2; }
  .gig-detail:nth-of-type(2) { display:none; }
  .gig-row > .row-chevron { grid-column:3; grid-row:1 / span 3; }
  .gig-date { grid-row:1 / span 3; }
}
@media (max-width: 520px) {
  .page-header h1 { font-size:2.45rem; }
  .actions { display:grid; grid-template-columns:1fr 1fr; }
  .system-status { grid-column:1 / -1; justify-content:center; }
  .summary-card { grid-template-columns:42px minmax(0,1fr); }
  .summary-icon { width:42px; height:42px; }
  .panel-heading { align-items:center; }
  .panel-heading a { font-size:.72rem; }
}
</style>
