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
  planned: {
    clientPortal: boolean
    finance: boolean
    calendarSync: boolean
    payments: boolean
  }
}

const { data, status, refresh } = await useFetch<DashboardData>('/api/admin/dashboard')

const nextGig = computed(() => data.value?.upcoming[0] ?? null)

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

function attentionAction(kind: DashboardData['attention'][number]['kind']) {
  if (kind === 'invoice') return 'Factuur bekijken'
  if (kind === 'contract') return 'Contract bekijken'
  return 'Naar lead'
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
        <p>Wat je aandacht nodig heeft, zonder ruis.</p>
      </div>
      <div class="actions">
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
                <div class="title-line">
                  <strong>{{ nextGig.title }}</strong>
                  <span v-if="nextGig.eventType" class="pill">{{ nextGig.eventType }}</span>
                </div>
                <span class="with-icon muted"><Icon name="lucide:map-pin" />{{ nextGig.venueName || 'Locatie niet ingesteld' }}</span>
                <span class="with-icon muted"><Icon name="lucide:clock-3" />{{ formatRange(nextGig.startsAt, nextGig.endsAt) }}</span>
              </div>
            </div>
          </template>
          <div v-else class="summary-empty">Nog geen aankomende gig gepland.</div>
        </NuxtLink>

        <NuxtLink class="summary-card" to="/admin/gigs?status=lead">
          <div class="summary-label"><span>Open leads</span><Icon name="lucide:users-round" /></div>
          <strong class="summary-value">{{ data?.summary.leads ?? 0 }}</strong>
          <span class="summary-detail">Aanvragen die opvolging nodig hebben</span>
        </NuxtLink>

        <NuxtLink class="summary-card" to="/admin/gigs">
          <div class="summary-label"><span>Openstaande facturen</span><Icon name="lucide:receipt-text" /></div>
          <strong class="summary-value">{{ formatCurrency(data?.summary.unpaidAmountCents ?? 0) }}</strong>
          <span class="summary-detail">{{ data?.summary.unpaidInvoices ?? 0 }} facturen niet betaald</span>
        </NuxtLink>

        <a class="summary-card attention-card" href="#attention">
          <div class="summary-label"><span>Aandacht nodig</span><Icon name="lucide:triangle-alert" /></div>
          <strong class="summary-value">{{ data?.summary.attention ?? 0 }}</strong>
          <span class="summary-detail">Openstaande actiepunten</span>
        </a>
      </section>

      <section class="dashboard-grid">
        <div id="attention" class="panel attention-panel">
          <div class="panel-heading">
            <div>
              <p class="eyebrow">Prioriteit</p>
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
            <div v-for="item in data.attention" :key="item.id" class="attention-row">
              <div class="attention-icon" :class="item.kind">
                <Icon :name="attentionIcon(item.kind)" />
              </div>
              <div class="attention-copy">
                <strong>{{ item.title }}</strong>
                <span>{{ item.description }}</span>
              </div>
              <span class="attention-meta">{{ formatMeta(item.meta) }}</span>
              <NuxtLink :to="item.href" class="row-action">{{ attentionAction(item.kind) }}</NuxtLink>
            </div>
          </div>
        </div>

        <aside class="panel week-panel">
          <div class="panel-heading">
            <div>
              <p class="eyebrow">Deze week</p>
              <h2>Overzicht</h2>
            </div>
            <span class="week-range">{{ weekRange() }}</span>
          </div>
          <div class="week-list">
            <NuxtLink to="/admin/agenda" class="week-row">
              <span class="week-icon"><Icon name="lucide:calendar-days" /></span>
              <span>Gigs deze week</span>
              <strong>{{ data?.week.gigs ?? 0 }}</strong>
              <Icon name="lucide:chevron-right" />
            </NuxtLink>
            <div class="week-row">
              <span class="week-icon"><Icon name="lucide:chart-no-axes-combined" /></span>
              <span>Omzet (geboekt)</span>
              <strong>{{ formatCurrency(data?.week.bookedRevenueCents ?? 0) }}</strong>
            </div>
            <div class="week-row">
              <span class="week-icon"><Icon name="lucide:receipt" /></span>
              <span>Facturen te voldoen</span>
              <strong>{{ data?.week.invoicesDue ?? 0 }}</strong>
            </div>
            <div class="week-row">
              <span class="week-icon"><Icon name="lucide:file-signature" /></span>
              <span>Contracten openstaand</span>
              <strong>{{ data?.week.contractsOpen ?? 0 }}</strong>
            </div>
          </div>
        </aside>
      </section>

      <section class="panel upcoming-panel">
        <div class="panel-heading">
          <div>
            <p class="eyebrow">Planning</p>
            <h2>Komende gigs</h2>
          </div>
          <NuxtLink to="/admin/agenda">Volledige agenda <Icon name="lucide:arrow-right" /></NuxtLink>
        </div>

        <div v-if="!data?.upcoming.length" class="empty">
          <strong>Nog geen aankomende gigs.</strong>
          <span>Nieuw geboekte gigs verschijnen hier automatisch.</span>
        </div>

        <div v-else class="gig-list">
          <NuxtLink
            v-for="gig in data.upcoming"
            :key="gig.id"
            :to="`/admin/gigs/${gig.id}`"
            class="gig-row"
          >
            <div class="date-tile compact-date">
              <span>{{ weekday(gig.startsAt) }}</span>
              <strong>{{ dayOfMonth(gig.startsAt) }}</strong>
              <span>{{ shortMonth(gig.startsAt) }}</span>
            </div>
            <div class="gig-copy">
              <div class="title-line">
                <strong>{{ gig.title }}</strong>
                <span v-if="gig.eventType" class="pill">{{ gig.eventType }}</span>
              </div>
            </div>
            <span class="gig-detail with-icon"><Icon name="lucide:map-pin" />{{ gig.venueName || 'Locatie niet ingesteld' }}</span>
            <span class="gig-detail with-icon"><Icon name="lucide:clock-3" />{{ formatRange(gig.startsAt, gig.endsAt) }}</span>
            <span class="details-button">Details bekijken</span>
          </NuxtLink>
        </div>
      </section>

      <section class="system-strip" aria-label="Systeemstatus">
        <NuxtLink to="/admin/client-portal">
          <span class="status-dot" />
          <div><strong>Klantportaal</strong><span>{{ data?.planned.clientPortal ? 'Actief' : 'Niet actief' }}</span></div>
          <Icon name="lucide:chevron-right" />
        </NuxtLink>
        <NuxtLink to="/admin/agenda">
          <span class="status-dot" :class="{ inactive: !data?.planned.calendarSync }" />
          <div><strong>Agendasync</strong><span>{{ data?.planned.calendarSync ? 'Actief' : 'Niet actief' }}</span></div>
          <Icon name="lucide:chevron-right" />
        </NuxtLink>
        <NuxtLink to="/admin/settings">
          <span class="status-dot" :class="{ inactive: !data?.planned.payments }" />
          <div><strong>Betalingen</strong><span>{{ data?.planned.payments ? 'Actief' : 'Niet actief' }}</span></div>
          <Icon name="lucide:chevron-right" />
        </NuxtLink>
      </section>
    </template>
  </div>
</template>

<style scoped>
.dashboard { max-width: 1540px; margin-inline: auto; }
.page-header { display:flex; align-items:end; justify-content:space-between; gap:1.5rem; margin-bottom:1.75rem; }
.page-header h1 { margin:.25rem 0 .35rem; font-size:clamp(2.2rem,4vw,3.6rem); letter-spacing:-.05em; }
.page-header p:last-child { margin:0; color:#938d9d; }
.actions { display:flex; gap:.6rem; }
.actions a,.actions button,.row-action,.details-button { border-radius:.7rem; padding:.68rem .9rem; text-decoration:none; font-weight:700; font-size:.82rem; }
.primary { background:linear-gradient(135deg,#7c3aed,#9d4edd); color:white; box-shadow:0 0 24px rgba(124,58,237,.24); }
.secondary { border:1px solid #2f2b35; background:#0d0b10; color:#c8c2ce; cursor:pointer; }
.with-icon { display:inline-flex; align-items:center; gap:.45rem; }
.with-icon :deep(svg) { width:1rem; height:1rem; }

.summary-grid { display:grid; grid-template-columns:1.45fr repeat(3,1fr); gap:.85rem; }
.summary-card { min-width:0; min-height:142px; padding:1.1rem 1.15rem; border:1px solid #292530; border-radius:1rem; background:linear-gradient(145deg,#100e14,#0d0b10); color:inherit; text-decoration:none; }
.summary-card:hover { border-color:#3d3350; background:#121017; }
.summary-label { display:flex; align-items:center; justify-content:space-between; gap:1rem; color:#d8d2df; font-size:.82rem; font-weight:700; }
.summary-label :deep(svg) { width:1.1rem; height:1.1rem; color:#8b5cf6; }
.summary-value { display:block; margin-top:1.15rem; font-size:2rem; line-height:1; letter-spacing:-.04em; }
.summary-detail { display:block; margin-top:.55rem; color:#7d7687; font-size:.77rem; }
.attention-card .summary-label :deep(svg) { color:#fb7185; }
.next-gig-content { display:grid; grid-template-columns:58px minmax(0,1fr); gap:.85rem; margin-top:.9rem; }
.date-tile { display:grid; place-items:center; align-content:center; min-height:68px; border:1px solid #2c2637; border-radius:.75rem; background:#1b1624; }
.date-tile strong { font-size:1.35rem; line-height:1.1; }
.date-tile span { color:#aaa0bb; font-size:.62rem; font-weight:800; letter-spacing:.05em; }
.next-copy { min-width:0; display:grid; gap:.35rem; align-content:center; }
.title-line { display:flex; align-items:center; gap:.55rem; min-width:0; }
.title-line strong { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.pill { flex:none; padding:.22rem .48rem; border:1px solid #362659; border-radius:.45rem; background:#211439; color:#bca7ff; font-size:.65rem; }
.muted { color:#857d91; font-size:.75rem; }
.summary-empty { margin-top:1rem; color:#756e7e; font-size:.8rem; }

.dashboard-grid { display:grid; grid-template-columns:minmax(0,2.1fr) minmax(310px,.9fr); gap:.85rem; margin-top:.85rem; }
.panel { overflow:hidden; border:1px solid #292530; border-radius:1rem; background:#100e14; }
.panel-heading { display:flex; align-items:end; justify-content:space-between; gap:1rem; padding:1.15rem 1.2rem; }
.panel-heading h2 { margin:.18rem 0 0; font-size:1.15rem; }
.panel-heading a { display:inline-flex; align-items:center; gap:.35rem; color:#a78bfa; font-size:.76rem; text-decoration:none; font-weight:700; }
.panel-heading a :deep(svg) { width:.9rem; }
.week-range { color:#777081; font-size:.72rem; }
.attention-list { padding:0 .8rem .8rem; display:grid; gap:.55rem; }
.attention-row { display:grid; grid-template-columns:42px minmax(0,1fr) auto auto; gap:.8rem; align-items:center; padding:.78rem; border:1px solid #28232e; border-radius:.8rem; background:#0d0b10; }
.attention-icon { display:grid; place-items:center; width:40px; height:40px; border-radius:.75rem; background:#211439; color:#a78bfa; }
.attention-icon.invoice { background:#26131b; color:#fb7185; }
.attention-icon.lead { background:#291d0b; color:#fbbf24; }
.attention-copy { min-width:0; }
.attention-copy strong,.attention-copy span { display:block; }
.attention-copy strong { font-size:.84rem; }
.attention-copy span { margin-top:.2rem; color:#827a8d; font-size:.74rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.attention-meta { color:#9c8cae; font-size:.7rem; }
.row-action { border:1px solid #3b2c55; color:#d8c8ff; background:#17111f; white-space:nowrap; }

.week-list { padding:0 .8rem .8rem; display:grid; gap:.45rem; }
.week-row { display:grid; grid-template-columns:38px minmax(0,1fr) auto 18px; align-items:center; gap:.65rem; min-height:52px; padding:.55rem .65rem; border:1px solid #28232e; border-radius:.75rem; background:#0d0b10; color:inherit; text-decoration:none; }
.week-row:not(a) { grid-template-columns:38px minmax(0,1fr) auto; }
.week-row > span:nth-child(2) { color:#aca4b6; font-size:.76rem; }
.week-row strong { font-size:.9rem; }
.week-icon { display:grid; place-items:center; width:34px; height:34px; border-radius:.6rem; background:#1f1532; color:#9f67ff; }

.upcoming-panel { margin-top:.85rem; }
.gig-list { padding:0 .8rem .8rem; display:grid; gap:.42rem; }
.gig-row { display:grid; grid-template-columns:66px minmax(180px,1.25fr) minmax(180px,1fr) minmax(125px,.65fr) auto; gap:.9rem; align-items:center; min-height:68px; padding:.45rem .55rem; border:1px solid #28232e; border-radius:.75rem; background:#0d0b10; color:inherit; text-decoration:none; }
.gig-row:hover { background:#131017; border-color:#3a3045; }
.compact-date { min-height:56px; }
.gig-copy { min-width:0; }
.gig-detail { min-width:0; color:#8e8798; font-size:.74rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.details-button { border:1px solid #342a42; color:#c8becf; background:#15111a; }

.empty { display:grid; gap:.3rem; padding:2rem 1.2rem; border-top:1px solid #242029; color:#aaa3b4; }
.empty span { color:#716b79; }
.empty.compact { grid-template-columns:auto 1fr; align-items:center; border-top:1px solid #242029; padding:1.4rem 1.2rem; }
.empty.compact :deep(svg) { width:1.4rem; height:1.4rem; color:#34d399; }

.system-strip { display:grid; grid-template-columns:repeat(3,1fr); gap:.8rem; margin-top:.85rem; }
.system-strip a { display:grid; grid-template-columns:auto 1fr auto; align-items:center; gap:.7rem; padding:.8rem 1rem; border:1px dashed #2c2733; border-radius:.8rem; color:inherit; text-decoration:none; }
.system-strip strong,.system-strip div span { display:block; }
.system-strip strong { font-size:.75rem; }
.system-strip div span { margin-top:.12rem; color:#716b79; font-size:.68rem; }
.status-dot { width:.55rem; height:.55rem; border-radius:50%; background:#22c55e; box-shadow:0 0 10px rgba(34,197,94,.45); }
.status-dot.inactive { background:#71717a; box-shadow:none; }
.state { padding:3rem 0; color:#8f8998; }

@media (max-width: 1180px) {
  .summary-grid { grid-template-columns:repeat(2,1fr); }
  .dashboard-grid { grid-template-columns:1fr; }
  .gig-row { grid-template-columns:66px minmax(0,1fr) minmax(170px,.8fr) auto; }
  .gig-row .details-button { display:none; }
}
@media (max-width: 760px) {
  .page-header { align-items:start; flex-direction:column; }
  .actions { width:100%; }
  .actions a,.actions button { flex:1; justify-content:center; }
  .summary-grid,.system-strip { grid-template-columns:1fr; }
  .attention-row { grid-template-columns:42px minmax(0,1fr) auto; }
  .attention-meta { display:none; }
  .row-action { grid-column:2 / -1; justify-self:start; }
  .gig-row { grid-template-columns:58px minmax(0,1fr); }
  .gig-detail { grid-column:2; }
  .gig-detail + .gig-detail { margin-top:-.45rem; }
  .compact-date { grid-row:1 / span 3; align-self:stretch; }
}
@media (max-width: 480px) {
  .page-header h1 { font-size:2.4rem; }
  .actions { flex-direction:column-reverse; }
  .summary-card { min-height:126px; }
  .panel-heading { align-items:start; }
  .week-range { display:none; }
}
</style>
