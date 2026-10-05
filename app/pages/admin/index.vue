<script setup lang="ts">
import type { RevenueMonth, Urgency } from '../../../shared/dashboard'

definePageMeta({ layout: 'admin' })

const { user } = useUserSession()
const canManageGigs = computed(() => user.value?.role === 'owner' || user.value?.role === 'manager')

type InvoiceState = 'none' | 'open' | 'overdue' | 'paid'

type DashboardData = {
  summary: {
    upcoming: number
    leads: number
    unpaidInvoices: number
    unpaidAmountCents: number
    overdueInvoices: number
    overdueAmountCents: number
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
    clientName: string | null
    feeCents: number
    daysUntil: number | null
    countdown: string | null
    contractSigned: boolean
    invoice: InvoiceState
    urgency: Urgency
  }>
  attention: Array<{
    id: string
    kind: 'invoice' | 'contract' | 'lead'
    title: string
    description: string
    meta: string | Date | null
    metaLabel: string
    urgency: Urgency
    href: string
  }>
  week: {
    gigs: number
    bookedRevenueCents: number
    invoicesDue: number
    contractsOpen: number
  }
  nextGigChecklist: {
    contractSigned: boolean
    questionnaireSubmitted: boolean
    invoice: InvoiceState | null
  } | null
  revenue: {
    months: RevenueMonth[]
    previousMonthCents: number
    trendPercent: number | null
  }
  calendarGigs: Array<{ id: string, title: string, startsAt: string | Date | null }>
  generatedAt: string
  system: {
    issues: number
    warnings: Array<{ label: string, to: string }>
  }
}

const { data, status, refresh } = await useFetch<DashboardData>('/api/admin/dashboard')

const nextGig = computed(() => data.value?.upcoming[0] ?? null)
const systemIssues = computed(() => data.value?.system.issues ?? 0)
const systemWarnings = computed(() => data.value?.system.warnings ?? [])
const systemState = computed(() => systemIssues.value > 0 ? 'problem' : systemWarnings.value.length ? 'warning' : 'ok')
const systemLabel = computed(() => systemState.value === 'problem'
  ? `${systemIssues.value} ${systemIssues.value === 1 ? 'systeemprobleem' : 'systeemproblemen'}`
  : systemState.value === 'warning' ? 'Instellingen nodig' : 'Alles actief')

// Keep the numbers fresh without a manual button: refetch every minute while the tab is visible.
const nowTick = ref(Date.now())
const updatedLabel = computed(() => {
  if (!data.value?.generatedAt) return ''
  const minutes = Math.floor((nowTick.value - new Date(data.value.generatedAt).getTime()) / 60_000)
  if (minutes < 1) return 'Zojuist bijgewerkt'
  return `Bijgewerkt ${minutes} min geleden`
})
let timer: ReturnType<typeof setInterval> | undefined
function refreshIfVisible() {
  nowTick.value = Date.now()
  if (document.visibilityState === 'visible' && Date.now() - new Date(data.value?.generatedAt ?? 0).getTime() > 60_000) {
    void refresh()
  }
}
onMounted(() => {
  timer = setInterval(refreshIfVisible, 30_000)
  document.addEventListener('visibilitychange', refreshIfVisible)
})
onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
  document.removeEventListener('visibilitychange', refreshIfVisible)
})

const attentionHidden = computed(() => Math.max(0, (data.value?.summary.attention ?? 0) - (data.value?.attention.length ?? 0)))
const overdueCount = computed(() => data.value?.summary.overdueInvoices ?? 0)

const weekRows = computed(() => {
  const week = data.value?.week
  if (!week) return []
  return [
    week.gigs > 0 && { key: 'gigs', icon: 'lucide:calendar-days', to: '/admin/calendar', label: `${week.gigs} ${week.gigs === 1 ? 'gig' : 'gigs'}`, tone: '' },
    week.bookedRevenueCents > 0 && { key: 'revenue', icon: 'lucide:chart-no-axes-combined', to: '/admin/calendar', label: `${formatCurrency(week.bookedRevenueCents)} geboekt`, tone: 'cyan' },
    week.invoicesDue > 0 && { key: 'invoices', icon: 'lucide:file-text', to: '/admin/invoices', label: `${week.invoicesDue} ${week.invoicesDue === 1 ? 'factuur' : 'facturen'} te betalen`, tone: 'cyan' },
    week.contractsOpen > 0 && { key: 'contracts', icon: 'lucide:file-signature', to: '#attention', label: `${week.contractsOpen} ${week.contractsOpen === 1 ? 'contract' : 'contracten'} open`, tone: '' },
  ].filter((row): row is { key: string, icon: string, to: string, label: string, tone: string } => Boolean(row))
})

const trendLabel = computed(() => {
  const trend = data.value?.revenue.trendPercent
  if (trend === null || trend === undefined) return null
  return `${trend > 0 ? '+' : ''}${trend}% t.o.v. vorige maand`
})

const checklist = computed(() => {
  const list = data.value?.nextGigChecklist
  if (!list) return []
  const items = [
    { key: 'contract', label: 'Contract', done: list.contractSigned },
    { key: 'questionnaire', label: 'Vragenlijst', done: list.questionnaireSubmitted },
  ]
  if (list.invoice) items.push({ key: 'invoice', label: 'Factuur', done: list.invoice === 'paid' })
  return items
})

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

const invoiceChip: Record<InvoiceState, { label: string, tone: string } | null> = {
  none: null,
  open: { label: 'Factuur open', tone: 'warn' },
  overdue: { label: 'Factuur verlopen', tone: 'danger' },
  paid: { label: 'Betaald', tone: 'ok' },
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
          :class="systemState"
        >
          <span class="status-dot" aria-hidden="true" />
          <span>{{ systemLabel }}</span>
        </NuxtLink>
        <button type="button" class="secondary refresh" :aria-label="`Vernieuwen. ${updatedLabel}`" :title="updatedLabel" @click="() => refresh()">
          <Icon name="lucide:refresh-cw" :class="{ spinning: status === 'pending' }" aria-hidden="true" />
          <span class="refresh-label">{{ updatedLabel || 'Vernieuwen' }}</span>
        </button>
        <NuxtLink v-if="canManageGigs" to="/admin/gigs?new=1" class="with-icon primary">
          <Icon name="lucide:plus" aria-hidden="true" />
          Nieuwe gig
        </NuxtLink>
      </div>
    </header>

    <div v-if="status === 'pending' && !data" class="state">Dashboard laden…</div>

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
                  <span v-if="nextGig.countdown" class="countdown" :class="nextGig.urgency">{{ nextGig.countdown }}</span>
                </div>
              </div>
              <ul v-if="checklist.length" class="checklist" aria-label="Voorbereiding volgende gig">
                <li v-for="item in checklist" :key="item.key" :class="{ done: item.done }">
                  <Icon :name="item.done ? 'lucide:circle-check' : 'lucide:circle'" aria-hidden="true" />
                  {{ item.label }}
                  <span class="sr-only">{{ item.done ? 'gereed' : 'nog open' }}</span>
                </li>
              </ul>
            </template>
            <div v-else class="summary-empty">Nog geen aankomende gig gepland.</div>
          </div>
        </NuxtLink>

        <NuxtLink class="summary-card" to="/admin/gigs?status=lead">
          <span class="summary-icon"><Icon name="lucide:users-round" /></span>
          <div class="summary-body">
            <div class="summary-label"><span>Open leads</span><Icon name="lucide:chevron-right" /></div>
            <strong class="summary-value">{{ data?.summary.leads ?? 0 }}</strong>
            <span class="summary-detail">{{ (data?.summary.leads ?? 0) > 0 ? 'Aanvragen die opvolging nodig hebben' : 'Geen aanvragen om op te volgen' }}</span>
          </div>
        </NuxtLink>

        <NuxtLink class="summary-card" to="/admin/invoices">
          <span class="summary-icon"><Icon name="lucide:file-text" /></span>
          <div class="summary-body">
            <div class="summary-label"><span>Openstaand</span><Icon name="lucide:chevron-right" /></div>
            <strong class="summary-value">{{ formatCurrency(data?.summary.unpaidAmountCents ?? 0) }}</strong>
            <span class="summary-detail">{{ data?.summary.unpaidInvoices ?? 0 }} {{ (data?.summary.unpaidInvoices ?? 0) === 1 ? 'factuur' : 'facturen' }} niet betaald</span>
            <span v-if="overdueCount" class="summary-flag danger">{{ formatCurrency(data?.summary.overdueAmountCents ?? 0) }} te laat ({{ overdueCount }})</span>
          </div>
        </NuxtLink>

        <NuxtLink class="summary-card" to="/admin/calendar">
          <span class="summary-icon"><Icon name="lucide:chart-no-axes-combined" /></span>
          <div class="summary-body">
            <div class="summary-label"><span>Omzet deze maand</span><Icon name="lucide:chevron-right" /></div>
            <strong class="summary-value">{{ formatCurrency(data?.summary.bookedRevenueThisMonthCents ?? 0) }}</strong>
            <span class="summary-detail">{{ (data?.summary.bookedRevenueThisMonthCents ?? 0) > 0 ? 'geboekt deze kalendermaand' : 'nog niets geboekt' }}</span>
            <span
              v-if="trendLabel"
              class="summary-flag"
              :class="(data?.revenue.trendPercent ?? 0) >= 0 ? 'ok' : 'warn'"
            >{{ trendLabel }}</span>
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

          <ul v-if="systemWarnings.length" class="setup-warnings">
            <li v-for="warning in systemWarnings" :key="warning.label">
              <Icon name="lucide:triangle-alert" aria-hidden="true" />
              <span>{{ warning.label }}</span>
              <NuxtLink :to="warning.to">Instellen</NuxtLink>
            </li>
          </ul>

          <div v-if="!data?.attention.length && !systemWarnings.length" class="empty compact">
            <Icon name="lucide:circle-check-big" />
            <div>
              <strong>Alles bijgewerkt.</strong>
              <span>Er zijn momenteel geen urgente actiepunten.</span>
            </div>
          </div>

          <div v-else-if="data?.attention.length" class="attention-list">
            <NuxtLink
              v-for="item in data.attention"
              :key="item.id"
              :to="item.href"
              class="attention-row"
              :class="item.urgency"
            >
              <div class="attention-icon" :class="item.kind">
                <Icon :name="attentionIcon(item.kind)" />
              </div>
              <div class="attention-copy">
                <strong>{{ item.title }}</strong>
                <span>{{ item.description }}</span>
              </div>
              <span v-if="formatMeta(item.meta)" class="attention-meta">
                <small>{{ item.metaLabel }}</small>
                <Icon name="lucide:calendar-days" aria-hidden="true" />{{ formatMeta(item.meta) }}
              </span>
              <Icon class="row-chevron" name="lucide:chevron-right" />
            </NuxtLink>
            <NuxtLink v-if="attentionHidden" to="/admin/gigs" class="attention-more">
              + nog {{ attentionHidden }} {{ attentionHidden === 1 ? 'actiepunt' : 'actiepunten' }}
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
          <div v-if="weekRows.length" class="week-list">
            <NuxtLink v-for="row in weekRows" :key="row.key" :to="row.to" class="week-row">
              <span class="week-icon" :class="row.tone"><Icon :name="row.icon" /></span>
              <strong>{{ row.label }}</strong>
              <Icon name="lucide:chevron-right" />
            </NuxtLink>
          </div>
          <div v-else class="empty compact calm">
            <Icon name="lucide:moon-star" />
            <div>
              <strong>Rustige week</strong>
              <span v-if="nextGig">Eerstvolgende gig: {{ weekday(nextGig.startsAt) }} {{ dayOfMonth(nextGig.startsAt) }} {{ shortMonth(nextGig.startsAt) }}, {{ nextGig.title }}.</span>
              <span v-else>Er staat niets gepland.</span>
            </div>
          </div>
        </aside>
      </section>

      <section class="dashboard-grid lower">
        <div class="panel upcoming-panel">
          <div class="panel-heading">
            <div class="heading-title">
              <span class="heading-icon"><Icon name="lucide:calendar-days" /></span>
              <h2>Komende gigs</h2>
            </div>
            <NuxtLink to="/admin/calendar">Volledige agenda <Icon name="lucide:arrow-right" /></NuxtLink>
          </div>

          <div v-if="!data?.upcoming.length" class="empty">
            <strong>Nog geen aankomende gigs.</strong>
            <span>Nieuw geboekte gigs verschijnen hier automatisch.</span>
          </div>

          <div v-else class="gig-table">
            <div class="gig-table-head" aria-hidden="true">
              <span>Datum</span>
              <span>Gig</span>
              <span>Status</span>
              <span>Tijd</span>
              <span class="num">Bedrag</span>
              <span />
            </div>
            <NuxtLink
              v-for="gig in data.upcoming"
              :key="gig.id"
              :to="`/admin/gigs/${gig.id}`"
              class="gig-row"
              :class="gig.urgency"
            >
              <div class="gig-date">
                <span>{{ weekday(gig.startsAt) }}</span>
                <strong>{{ dayOfMonth(gig.startsAt) }} {{ shortMonth(gig.startsAt) }}</strong>
                <small v-if="gig.countdown">{{ gig.countdown }}</small>
              </div>
              <div class="gig-main">
                <strong class="gig-title truncate">{{ gig.title }}</strong>
                <span class="gig-detail truncate">{{ [gig.clientName, gig.venueName && gig.venueName !== gig.title ? gig.venueName : null].filter(Boolean).join(' · ') || 'Geen klant gekoppeld' }}</span>
              </div>
              <div class="chips">
                <span class="chip" :class="gig.contractSigned ? 'ok' : gig.urgency === 'normal' ? 'muted' : gig.urgency">
                  {{ gig.contractSigned ? 'Getekend' : 'Contract open' }}
                </span>
                <span v-if="invoiceChip[gig.invoice]" class="chip" :class="invoiceChip[gig.invoice]!.tone">{{ invoiceChip[gig.invoice]!.label }}</span>
              </div>
              <span class="gig-detail with-icon time"><Icon name="lucide:clock-3" />{{ formatRange(gig.startsAt, gig.endsAt) }}</span>
              <span class="gig-amount num">{{ gig.feeCents ? formatCurrency(gig.feeCents) : '—' }}</span>
              <Icon class="row-chevron" name="lucide:chevron-right" />
            </NuxtLink>
          </div>
        </div>

        <aside class="panel calendar-panel">
          <div class="panel-heading">
            <div class="heading-title">
              <span class="heading-icon"><Icon name="lucide:calendar-range" /></span>
              <h2>Agenda</h2>
            </div>
          </div>
          <AdminMiniCalendar :gigs="data?.calendarGigs ?? []" />
        </aside>
      </section>

      <section class="panel chart-panel">
        <div class="panel-heading">
          <div class="heading-title">
            <span class="heading-icon"><Icon name="lucide:chart-column" /></span>
            <h2>Omzet per maand</h2>
          </div>
          <span class="panel-note">Geboekte gigs, 5 maanden terug en 6 vooruit</span>
        </div>
        <AdminRevenueChart :months="data?.revenue.months ?? []" />
      </section>
    </template>
  </div>
</template>

<style scoped>
.dashboard { max-width: 1540px; margin-inline: auto; }
.page-header { display:flex; align-items:center; justify-content:space-between; gap:1.5rem; margin-bottom:1.5rem; }
.page-header h1 { margin:.2rem 0 .2rem; font-size:clamp(2.35rem,4vw,3.7rem); line-height:1; letter-spacing:-.04em; }
.page-header p:last-child { margin:0; color:#9a93a6; }
.actions { display:flex; align-items:center; gap:.65rem; }
.actions a,.actions button { min-height:42px; border-radius:.72rem; padding:.68rem .9rem; text-decoration:none; font-weight:700; font-size:.82rem; }
.primary { background:var(--button-primary-bg); color:var(--button-primary-fg); }
.secondary { border:1px solid #2f2b35; background:#0d0b10; color:#d0c9d8; cursor:pointer; }
.refresh { display:inline-flex; align-items:center; gap:.45rem; font-weight:600; color:#9a93a6; }
.refresh :deep(svg) { width:1rem; height:1rem; }
.refresh .spinning { animation:spin 1s linear infinite; }
@keyframes spin { to { transform:rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .refresh .spinning { animation:none; } }
.with-icon { display:inline-flex; align-items:center; gap:.45rem; }
.with-icon :deep(svg) { width:1rem; height:1rem; }
.sr-only { position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0); white-space:nowrap; }
.system-status { display:inline-flex; align-items:center; gap:.55rem; border:1px solid #27342e; background:#0d1210; color:#a7c9b5; }
.system-status.problem { border-color:#4d2931; background:#160e11; color:#f0a5b0; }
.status-dot { width:.58rem; height:.58rem; border-radius:50%; background:var(--status-ok); box-shadow:0 0 11px rgba(34,197,94,.55); }
.system-status.problem .status-dot { background:var(--status-danger); box-shadow:0 0 11px rgba(239,68,68,.5); }
.system-status.warning { border-color:#4a3d22; background:#15120b; color:#f2cf8a; }
.system-status.warning .status-dot { background:var(--status-warn); box-shadow:0 0 11px rgba(245,158,11,.45); }
.setup-warnings { display:grid; gap:.5rem; margin:.85rem 1rem; padding:0; list-style:none; }
.setup-warnings li { display:grid; grid-template-columns:1rem minmax(0,1fr) auto; align-items:center; gap:.7rem; padding:.75rem .9rem; border:1px solid #4a3d22; border-radius:.75rem; background:#15120b; color:#f2dcae; font-size:.86rem; line-height:1.45; }
.setup-warnings svg { color:#f5b544; }
.setup-warnings a { display:inline-flex; align-items:center; min-height:2.75rem; padding:0 .25rem; color:#ffe2a8; font-weight:700; white-space:nowrap; }

.summary-grid { display:grid; grid-template-columns:1.35fr repeat(3,1fr); gap:.85rem; }
.summary-card { min-width:0; min-height:132px; display:grid; grid-template-columns:48px minmax(0,1fr); gap:1rem; padding:1rem 1.05rem; border:1px solid #292530; border-radius:.9rem; background:linear-gradient(145deg,var(--surface-card),#0d0b10); color:inherit; text-decoration:none; }
.summary-card:hover { border-color:#3c334a; background:#121017; }
.summary-icon,.heading-icon { display:grid; place-items:center; width:46px; height:46px; border-radius:.7rem; background:#211439; color:#a66cff; }
.summary-icon :deep(svg),.heading-icon :deep(svg) { width:1.25rem; height:1.25rem; }
.summary-body { min-width:0; }
.summary-label { display:flex; align-items:center; justify-content:space-between; gap:.75rem; color:#e4deea; font-size:.82rem; font-weight:800; }
.summary-label :deep(svg) { width:1rem; height:1rem; color:#b9a8d4; }
.summary-value { display:block; margin-top:1rem; font-size:2rem; line-height:1; letter-spacing:-.04em; }
.summary-detail { display:block; margin-top:.55rem; color:#8a8296; font-size:.76rem; }
.summary-flag { display:inline-block; margin-top:.45rem; padding:.18rem .55rem; border-radius:999px; font-size:.7rem; font-weight:800; }
.summary-flag.danger { background:#2a1218; color:#fb8a9a; }
.summary-flag.ok { background:#10261a; color:#6ee7a0; }
.summary-flag.warn { background:#2a200c; color:#f5c065; }
.next-gig-content { display:grid; grid-template-columns:56px minmax(0,1fr); gap:.8rem; margin-top:.65rem; align-items:center; }
.date-tile { display:grid; place-items:center; align-content:center; min-height:62px; border:1px solid #2e2840; border-radius:.72rem; background:#1b1624; }
.date-tile strong { font-size:1.3rem; line-height:1.05; }
.date-tile span { color:#aaa0bb; font-size:.75rem; font-weight:800; letter-spacing:.05em; }
.next-copy { min-width:0; display:grid; gap:.35rem; align-content:center; justify-items:start; }
.next-copy > strong { max-width:100%; font-size:.92rem; }
.muted { color:#a59cad; font-size:.74rem; }
.countdown { padding:.14rem .55rem; border-radius:999px; background:#1b1624; color:#cdbbea; font-size:.7rem; font-weight:800; }
.countdown.danger { background:#2a1218; color:#fb8a9a; }
.countdown.warn { background:#2a200c; color:#f5c065; }
.checklist { display:flex; flex-wrap:wrap; gap:.3rem .9rem; margin:.8rem 0 0; padding:0; list-style:none; }
.checklist li { display:inline-flex; align-items:center; gap:.35rem; color:#9a91a6; font-size:.72rem; font-weight:700; }
.checklist li :deep(svg) { width:.9rem; height:.9rem; }
.checklist li.done { color:#6ee7a0; }
.summary-empty { margin-top:1rem; color:var(--text-subtle); font-size:.8rem; }
.truncate { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }

.dashboard-grid { display:grid; grid-template-columns:minmax(0,2.15fr) minmax(300px,.85fr); gap:.85rem; margin-top:.85rem; }
.dashboard-grid.lower { grid-template-columns:minmax(0,2.15fr) minmax(300px,.85fr); align-items:start; }
.panel { overflow:hidden; border:1px solid #292530; border-radius:.9rem; background:var(--surface-card); }
.panel-heading { display:flex; align-items:center; justify-content:space-between; gap:1rem; min-height:64px; padding:.85rem 1rem; border-bottom:1px solid #26212d; }
.heading-title { display:flex; align-items:center; gap:.75rem; min-width:0; }
.heading-icon { width:38px; height:38px; border-radius:.62rem; }
.heading-icon :deep(svg) { width:1.08rem; height:1.08rem; }
.panel-heading h2 { margin:0; font-size:1.12rem; }
.panel-heading a { display:inline-flex; align-items:center; min-height:2.75rem; gap:.35rem; color:#b45cff; font-size:.76rem; text-decoration:none; font-weight:800; white-space:nowrap; }
.panel-heading a :deep(svg) { width:.9rem; }
.panel-note { color:#8f879c; font-size:.74rem; text-align:right; }

.attention-list { padding:0 1rem; }
.attention-row { display:grid; grid-template-columns:42px minmax(0,1fr) auto 18px; gap:.8rem; align-items:center; min-height:66px; padding:.55rem .25rem .55rem .6rem; border-bottom:1px solid var(--border); border-left:3px solid transparent; color:inherit; text-decoration:none; }
.attention-row.danger { border-left-color:var(--status-danger); }
.attention-row.warn { border-left-color:var(--status-warn); }
.attention-row:hover { background:rgba(255,255,255,.012); }
.attention-icon { display:grid; place-items:center; width:38px; height:38px; border-radius:.7rem; background:#26131b; color:#fb7185; }
.attention-icon.contract { background:#26131b; color:#fb7185; }
.attention-icon.lead { background:#2a1b0d; color:#fbbf24; }
.attention-copy { min-width:0; }
.attention-copy strong,.attention-copy span { display:block; }
.attention-copy strong { font-size:.84rem; }
.attention-copy span { margin-top:.18rem; color:#9a91a6; font-size:.74rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.attention-meta { display:inline-flex; align-items:center; gap:.4rem; color:#9f96ac; font-size:.7rem; white-space:nowrap; }
.attention-meta small { color:#7f778b; font-size:.66rem; font-weight:800; text-transform:uppercase; letter-spacing:.04em; }
.attention-meta :deep(svg) { width:.95rem; height:.95rem; }
.attention-more { display:flex; align-items:center; min-height:2.75rem; padding:0 .6rem; color:#b45cff; font-size:.76rem; font-weight:800; text-decoration:none; }
.row-chevron { width:1rem; height:1rem; color:#c3b5d4; }

.week-list { padding:0 1rem; }
.week-row { display:grid; grid-template-columns:38px minmax(0,1fr) 18px; align-items:center; gap:.7rem; min-height:57px; border-bottom:1px solid var(--border); color:inherit; text-decoration:none; }
.week-row:last-child { border-bottom:0; }
.week-row strong { font-size:.82rem; font-weight:750; }
.week-icon { display:grid; place-items:center; width:32px; height:32px; color:#b45cff; }
.week-icon.cyan { color:#62d6f7; }
.week-icon :deep(svg) { width:1.1rem; height:1.1rem; }
.week-row > :deep(svg) { width:.95rem; height:.95rem; color:#b7aacb; }

.gig-table { padding:0 1rem .35rem; }
.gig-table-head,.gig-row { display:grid; grid-template-columns:120px minmax(150px,1.3fr) minmax(170px,1fr) minmax(120px,.7fr) 76px 20px; gap:1rem; align-items:center; }
.gig-table-head { min-height:38px; color:#a29aaa; font-size:.7rem; font-weight:700; border-bottom:1px solid var(--border); }
.gig-row { min-height:64px; border-bottom:1px solid var(--border); border-left:3px solid transparent; padding-left:.55rem; margin-left:-.55rem; color:inherit; text-decoration:none; }
.gig-row.danger { border-left-color:var(--status-danger); }
.gig-row.warn { border-left-color:var(--status-warn); }
.gig-row:last-child { border-bottom:0; }
.gig-row:hover { background:rgba(255,255,255,.012); }
.gig-date { display:grid; gap:.08rem; }
.gig-date span { color:#a49aaa; font-size:.75rem; font-weight:800; }
.gig-date strong { font-size:.86rem; }
.gig-date small { color:#8f879c; font-size:.7rem; }
.gig-main { display:grid; gap:.2rem; min-width:0; }
.gig-title { font-size:.84rem; }
.gig-detail { min-width:0; color:#9c93aa; font-size:.74rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.gig-amount { font-size:.8rem; font-weight:750; }
.num { text-align:right; }
.chips { display:flex; flex-wrap:wrap; gap:.3rem; }
.chip { padding:.15rem .55rem; border-radius:999px; font-size:.68rem; font-weight:800; white-space:nowrap; background:#1b1624; color:#cdbbea; }
.chip.ok { background:#10261a; color:#6ee7a0; }
.chip.warn { background:#2a200c; color:#f5c065; }
.chip.danger { background:#2a1218; color:#fb8a9a; }
.chip.muted { background:#1a171f; color:#a59cad; }

.chart-panel { margin-top:.85rem; }

.empty { display:grid; gap:.3rem; padding:2rem 1.2rem; color:#aaa3b4; }
.empty span { color:var(--text-subtle); }
.empty.compact { grid-template-columns:auto 1fr; align-items:center; padding:1.4rem 1.2rem; }
.empty.compact :deep(svg) { width:1.4rem; height:1.4rem; color:#34d399; }
.empty.compact.calm :deep(svg) { color:#a66cff; }
.state { padding:3rem 0; color:#8f8998; }

@media (max-width: 1180px) {
  .summary-grid { grid-template-columns:repeat(2,minmax(0,1fr)); }
  .dashboard-grid,.dashboard-grid.lower { grid-template-columns:1fr; }
  .gig-table-head,.gig-row { grid-template-columns:110px minmax(140px,1fr) minmax(150px,.9fr) minmax(110px,.7fr) 70px 18px; }
}
@media (max-width: 780px) {
  .page-header { align-items:flex-start; flex-direction:column; }
  .actions { width:100%; flex-wrap:wrap; }
  .actions .primary,.actions .secondary { flex:1; justify-content:center; }
  /* Phone: the next gig leads, the other figures sit two by two. */
  .summary-grid { grid-template-columns:repeat(2,minmax(0,1fr)); gap:.65rem; }
  .summary-card.next-gig { grid-column:1 / -1; }
  .summary-card:last-child { grid-column:1 / -1; }
  .attention-row { grid-template-columns:42px minmax(0,1fr) 18px; }
  .attention-meta { display:none; }
  /* Let descriptions wrap instead of cutting off mid-sentence. */
  .attention-copy span { white-space:normal; overflow:visible; }
  .gig-table-head { display:none; }
  .gig-table { padding-top:.3rem; }
  .gig-row { grid-template-columns:84px minmax(0,1fr) 18px; gap:.3rem .7rem; padding-block:.65rem; }
  .gig-date { grid-row:1 / span 4; }
  .gig-main,.chips,.gig-detail.time,.gig-amount { grid-column:2; }
  .gig-amount { text-align:left; }
  .gig-row > .row-chevron { grid-column:3; grid-row:1 / span 4; }
  .calendar-panel { display:none; }
}
@media (max-width: 520px) {
  .page-header h1 { font-size:2.45rem; }
  .actions { display:grid; grid-template-columns:1fr 1fr; }
  .system-status { grid-column:1 / -1; justify-content:center; min-height:34px; padding-block:.4rem; }
  .summary-card { grid-template-columns:1fr; gap:.55rem; }
  .summary-card.next-gig,.summary-card:last-child { grid-template-columns:42px minmax(0,1fr); gap:1rem; }
  .summary-icon { width:42px; height:42px; }
  .summary-card:not(.next-gig):not(:last-child) .summary-icon { display:none; }
  .summary-value { margin-top:.6rem; font-size:1.7rem; }
  .panel-heading { align-items:center; }
  .panel-heading a { font-size:.72rem; }
  .panel-note { display:none; }
}
</style>
