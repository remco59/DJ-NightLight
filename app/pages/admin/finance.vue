<script setup lang="ts">
import { expenseCategoryLabels, MILEAGE_CATEGORY, parseEuroToCents, type FinanceReport } from '~~/shared/finance'
import { apiErrorMessage } from '~/utils/api-error'
import type { ExpenseRow } from '~/components/admin/ExpenseDialog.vue'
import type { VatReturns } from '~~/shared/vat-return'

definePageMeta({ layout: 'admin' })

type YearExpense = ExpenseRow & { gigTitle: string | null }
type FinanceData = { year: number, years: number[], kmRateCents: number, report: FinanceReport, vat: VatReturns, vatNumber: string, invoiceCount: number, expenses: YearExpense[] }

const { user } = useUserSession()
const isOwner = computed(() => user.value?.role === 'owner')
const year = ref(Number(useRoute().query.year) || new Date().getFullYear())
const { data, refresh } = await useFetch<FinanceData>('/api/admin/finance', { query: computed(() => ({ year: year.value })), watch: [year] })
// Choices for a gig on a general cost; loaded in the browser only, as it is not needed for the overview itself.
const { data: gigList } = useFetch<{ gigs: Array<{ id: string, title: string }> }>('/api/admin/gigs', { server: false, lazy: true })
const gigOptions = computed(() => (gigList.value?.gigs ?? []).map(gig => ({ id: gig.id, title: gig.title })))

const dialog = ref<InstanceType<typeof import('~/components/admin/ExpenseDialog.vue').default> | null>(null)
const monthFormat = new Intl.DateTimeFormat('nl-NL', { month: 'long', timeZone: 'UTC' })
const dayFormat = new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short', timeZone: 'Europe/Amsterdam' })
function money(cents: number) { return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(cents / 100) }
function monthName(key: string) { return monthFormat.format(new Date(`${key}-01T12:00:00Z`)) }
function day(value: string) { return dayFormat.format(new Date(`${value}T12:00:00`)).replace('.', '') }
function categoryName(category: string) { return expenseCategoryLabels[category as keyof typeof expenseCategoryLabels] || category }
function rowLabel(expense: YearExpense) { return expense.kind === 'mileage' && expense.description === 'Kilometers' ? expenseCategoryLabels[MILEAGE_CATEGORY] : expense.description }
function rowDetail(expense: YearExpense) {
  return expense.kind === 'mileage'
    ? `${String(Number(expense.kilometers)).replace('.', ',')} km${expense.kmRateCents !== null ? ` × ${money(expense.kmRateCents)}` : ''}`
    : categoryName(expense.category)
}

const totals = computed(() => data.value!.report.totals)
const maxMonth = computed(() => Math.max(1, ...data.value!.report.months.map(month => Math.max(month.revenueCents, month.costCents + month.mileageCents))))
const maxCategory = computed(() => Math.max(1, ...data.value!.report.categories.map(category => category.cents)))
const empty = computed(() => data.value!.invoiceCount === 0 && data.value!.expenses.length === 0)

const rate = ref(((data.value?.kmRateCents ?? 23) / 100).toFixed(2).replace('.', ','))
const rateMessage = ref('')
const rateBusy = ref(false)
async function saveRate() {
  const cents = parseEuroToCents(rate.value)
  if (cents === null || cents > 500) { rateMessage.value = 'Vul een tarief in tussen € 0,00 en € 5,00.'; return }
  rateBusy.value = true
  rateMessage.value = ''
  try {
    await $fetch('/api/admin/finance/settings', { method: 'PUT', body: { kmRateCents: cents } })
    await refresh()
    rateMessage.value = 'Tarief opgeslagen. Eerder geregistreerde ritten behouden hun tarief.'
  }
  catch (error: unknown) { rateMessage.value = apiErrorMessage(error, 'Opslaan is niet gelukt.') }
  finally { rateBusy.value = false }
}

useSeoMeta({ title: 'Financiën — DJ NightLight', robots: 'noindex, nofollow' })
</script>

<template>
  <div v-if="data" class="finance">
    <header class="page-head">
      <div>
        <p class="eyebrow">Administratie</p>
        <h1>Financiën</h1>
        <p class="sub">Omzet, kosten en kilometers per jaar. Alle bedragen zijn exclusief btw, tenzij anders vermeld.</p>
      </div>
      <div class="head-actions">
        <label class="year-picker">Jaar<select v-model.number="year"><option v-for="option in data.years" :key="option" :value="option">{{ option }}</option></select></label>
        <a class="outline-link" :href="`/api/admin/finance/export.csv?year=${data.year}`" download><Icon name="lucide:download" aria-hidden="true" />Export voor boekhouder</a>
      </div>
    </header>

    <section class="kpis" aria-label="Samenvatting">
      <article><span>Omzet</span><strong>{{ money(totals.revenueCents) }}</strong><small>{{ data.invoiceCount }} {{ data.invoiceCount === 1 ? 'factuur' : 'facturen' }} uitgegeven</small></article>
      <article><span>Kosten</span><strong>{{ money(totals.costCents + totals.mileageCents) }}</strong><small>waarvan {{ money(totals.mileageCents) }} kilometers</small></article>
      <article class="result" :data-negative="totals.resultCents < 0 || undefined"><span>Resultaat</span><strong>{{ money(totals.resultCents) }}</strong><small>omzet min kosten</small></article>
      <article><span>Openstaand</span><strong>{{ money(totals.openCents) }}</strong><small>incl. btw · {{ money(totals.paidCents) }} betaald</small></article>
    </section>

    <p v-if="empty" class="empty">In {{ data.year }} is nog niets geregistreerd. Zodra je facturen uitgeeft en kosten toevoegt, verschijnt het hier.</p>

    <section class="card">
      <h2>Per maand</h2>
      <div class="table-wrap" tabindex="0" role="region" aria-label="Omzet, kosten en resultaat per maand">
        <table>
          <caption class="sr-only">Omzet, kosten en resultaat per maand in {{ data.year }}</caption>
          <thead>
            <tr><th scope="col">Maand</th><th scope="col" class="num">Omzet</th><th scope="col" class="num">Kosten</th><th scope="col" class="num">Km</th><th scope="col" class="num">Resultaat</th><th scope="col" class="num">Openstaand <small>incl. btw</small></th></tr>
          </thead>
          <tbody>
            <tr v-for="month in data.report.months" :key="month.month" :class="{ quiet: !month.revenueCents && !month.costCents && !month.mileageCents && !month.openCents }">
              <th scope="row">
                {{ monthName(month.month) }}
                <span class="bars" aria-hidden="true"><i class="rev" :style="{ width: `${(month.revenueCents / maxMonth) * 100}%` }" /><i class="cost" :style="{ width: `${((month.costCents + month.mileageCents) / maxMonth) * 100}%` }" /></span>
              </th>
              <td class="num">{{ money(month.revenueCents) }}</td>
              <td class="num">{{ money(month.costCents + month.mileageCents) }}</td>
              <td class="num">{{ month.kilometers ? String(month.kilometers).replace('.', ',') : '–' }}</td>
              <td class="num" :data-negative="month.resultCents < 0 || undefined">{{ money(month.resultCents) }}</td>
              <td class="num">{{ money(month.openCents) }}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr><th scope="row">Totaal {{ data.year }}</th><td class="num">{{ money(totals.revenueCents) }}</td><td class="num">{{ money(totals.costCents + totals.mileageCents) }}</td><td class="num">{{ totals.kilometers ? String(totals.kilometers).replace('.', ',') : '–' }}</td><td class="num" :data-negative="totals.resultCents < 0 || undefined">{{ money(totals.resultCents) }}</td><td class="num">{{ money(totals.openCents) }}</td></tr>
          </tfoot>
        </table>
      </div>
      <p class="note">Omzet telt mee in de maand van de factuurdatum. Btw over de omzet in {{ data.year }}: {{ money(totals.vatOnRevenueCents) }}.</p>
    </section>

    <AdminVatReturn :vat="data.vat" :year="data.year" :vat-number="data.vatNumber" />

    <div class="two-col">
      <section class="card">
        <h2>Kosten per categorie</h2>
        <p v-if="!data.report.categories.length" class="muted">Nog geen kosten in {{ data.year }}.</p>
        <ul v-else class="categories">
          <li v-for="category in data.report.categories" :key="category.category">
            <span class="cat-head"><span>{{ categoryName(category.category) }}</span><strong>{{ money(category.cents) }}</strong></span>
            <span class="cat-bar" aria-hidden="true"><i :style="{ width: `${(category.cents / maxCategory) * 100}%` }" /></span>
          </li>
        </ul>
      </section>

      <section class="card">
        <h2>Kilometertarief</h2>
        <p class="muted">Het standaardtarief voor nieuwe ritten. Pas het aan als het wettelijke of afgesproken tarief wijzigt; eerdere ritten blijven op hun eigen tarief staan.</p>
        <form v-if="isOwner" class="rate-form" @submit.prevent="saveRate">
          <label>Per kilometer (€)<input v-model="rate" inputmode="decimal"></label>
          <button class="secondary" :disabled="rateBusy">{{ rateBusy ? 'Opslaan…' : 'Opslaan' }}</button>
        </form>
        <p v-else class="rate-value">{{ money(data.kmRateCents) }} per kilometer</p>
        <p v-if="rateMessage" class="muted" role="status">{{ rateMessage }}</p>
      </section>
    </div>

    <section class="card">
      <div class="section-title">
        <h2>Kosten en kilometers in {{ data.year }}</h2>
        <button type="button" class="primary" @click="dialog?.show()"><Icon name="lucide:plus" aria-hidden="true" /> Toevoegen</button>
      </div>
      <p v-if="!data.expenses.length" class="muted">Nog niets geregistreerd. Kosten en kilometers voeg je hier toe, of op de gig zelf.</p>
      <ul v-else class="expense-list">
        <li v-for="expense in data.expenses" :key="expense.id">
          <button type="button" class="expense-row" :aria-label="`${rowLabel(expense)}, ${money(expense.amountCents)}. Wijzigen`" @click="dialog?.show(expense)">
            <Icon :name="expense.kind === 'mileage' ? 'lucide:car' : 'lucide:receipt'" class="kind-icon" aria-hidden="true" />
            <span class="row-main"><strong>{{ rowLabel(expense) }}</strong><small>{{ day(expense.spentOn) }} · {{ rowDetail(expense) }}<template v-if="expense.gigTitle"> · {{ expense.gigTitle }}</template></small></span>
            <strong class="row-amount">{{ money(expense.amountCents) }}</strong>
          </button>
        </li>
      </ul>
    </section>

    <AdminExpenseDialog ref="dialog" :gig-options="gigOptions" :km-rate-cents="data.kmRateCents" @saved="refresh" />
  </div>
</template>

<style scoped>
.finance { display: grid; gap: 1rem; max-width: 1000px; margin-inline: auto; padding-bottom: 3rem; }
.page-head { display: flex; align-items: flex-end; justify-content: space-between; flex-wrap: wrap; gap: 1rem; }
.eyebrow { margin: 0; color: #b99bff; font-size: .7rem; font-weight: 800; letter-spacing: .16em; text-transform: uppercase; }
h1 { margin: .2rem 0; font-size: clamp(2.4rem, 6vw, 4rem); letter-spacing: -.04em; }
.sub { margin: 0; max-width: 34rem; color: var(--text-muted); }
.head-actions { display: flex; align-items: flex-end; gap: .75rem; }
.year-picker { display: grid; gap: .3rem; color: var(--text-subtle); font-size: .72rem; font-weight: 700; }
select, input { min-height: 2.75rem; padding: .5rem .75rem; border: 1px solid var(--border-strong); border-radius: .65rem; background: var(--surface-input); color: var(--text); }
.outline-link { display: inline-flex; align-items: center; gap: .4rem; min-height: 2.75rem; padding: .5rem .95rem; border: 1px solid var(--border-strong); border-radius: .7rem; color: var(--text); font-weight: 700; text-decoration: none; }
.kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: .75rem; }
.kpis article { display: grid; gap: .25rem; padding: 1rem; border: 1px solid var(--border); border-radius: 1rem; background: var(--surface-card); }
.kpis span { color: var(--text-subtle); font-size: .78rem; font-weight: 700; }
.kpis strong { font-size: 1.45rem; font-variant-numeric: tabular-nums; letter-spacing: -.02em; }
.kpis small { color: var(--text-muted); font-size: .76rem; }
.kpis .result strong { color: #a9e1bb; }
.kpis .result[data-negative] strong { color: #f3a7b2; }
.empty { margin: 0; padding: .9rem 1rem; border: 1px dashed var(--border-strong); border-radius: .85rem; color: var(--text-muted); }
.card { display: grid; gap: .9rem; padding: 1.25rem; border: 1px solid var(--border); border-radius: 1rem; background: var(--surface-card); }
.card h2 { margin: 0; font-size: 1.15rem; }
.table-wrap { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; font-size: .9rem; font-variant-numeric: tabular-nums; }
th, td { padding: .6rem .5rem; border-bottom: 1px solid var(--border); text-align: left; white-space: nowrap; }
thead th { color: var(--text-subtle); font-size: .72rem; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; }
thead th small { text-transform: none; letter-spacing: 0; font-weight: 500; }
tbody th { font-weight: 600; text-transform: capitalize; }
.num { text-align: right; }
td[data-negative] { color: #f3a7b2; }
tr.quiet { color: var(--text-subtle); }
tfoot th, tfoot td { border-bottom: 0; font-weight: 800; }
.bars { display: grid; gap: 2px; margin-top: .3rem; min-width: 6rem; }
.bars i { display: block; height: 3px; border-radius: 2px; min-width: 0; }
.bars .rev { background: var(--electric-accent); }
.bars .cost { background: #f2cf8a; }
.note, .muted { margin: 0; color: var(--text-muted); font-size: .85rem; line-height: 1.5; }
.two-col { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; }
.categories { display: grid; gap: .75rem; margin: 0; padding: 0; list-style: none; }
.cat-head { display: flex; justify-content: space-between; gap: .75rem; font-size: .9rem; }
.cat-head strong { font-variant-numeric: tabular-nums; }
.cat-bar { display: block; height: 6px; margin-top: .3rem; border-radius: 3px; background: var(--surface-input); overflow: hidden; }
.cat-bar i { display: block; height: 100%; border-radius: 3px; background: var(--electric-accent); }
.rate-form { display: flex; align-items: flex-end; gap: .6rem; }
.rate-form label { display: grid; gap: .3rem; color: #c9c3ce; font-size: .8rem; font-weight: 650; }
.rate-value { margin: 0; font-size: 1.2rem; font-weight: 800; }
.section-title { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
.primary, .secondary { display: inline-flex; align-items: center; gap: .4rem; min-height: 2.75rem; padding: .5rem 1.1rem; border: 1px solid transparent; border-radius: .7rem; font-weight: 800; cursor: pointer; }
.primary { background: var(--button-primary-bg); color: var(--button-primary-fg); }
.secondary { border-color: var(--border-strong); background: var(--button-secondary-bg); color: var(--button-secondary-fg); }
button:disabled { opacity: .5; cursor: not-allowed; }
.expense-list { display: grid; margin: 0; padding: 0; list-style: none; }
.expense-list li + li { border-top: 1px solid var(--border); }
.expense-row { display: flex; align-items: center; gap: .75rem; width: 100%; min-height: 3.4rem; padding: .5rem 0; border: 0; background: transparent; color: inherit; text-align: left; cursor: pointer; }
.kind-icon { flex: none; width: 1.15rem; height: 1.15rem; color: var(--electric-soft); }
.row-main { display: grid; flex: 1; min-width: 0; gap: .1rem; }
.row-main strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.row-main small { color: var(--text-muted); }
.row-amount { font-variant-numeric: tabular-nums; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
@media (max-width: 800px) { .kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); } .two-col { grid-template-columns: 1fr; } }
@media (max-width: 480px) { .kpis { gap: .5rem; } .kpis article { padding: .8rem; } .kpis strong { font-size: 1.15rem; } .head-actions { width: 100%; flex-wrap: wrap; } }
</style>
