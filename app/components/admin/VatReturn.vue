<script setup lang="ts">
import { todayInAmsterdam } from '~~/shared/dates'
import { apiErrorMessage } from '~/utils/api-error'
import { daysUntil, defaultVatPeriod, vatFilingStatus, vatRubriekLabels, wholeEuroCents, type VatFiling, type VatFilingState, type VatPeriod, type VatQuarter, type VatReturn, type VatReturns, type VatRubriek } from '~~/shared/vat-return'

const props = defineProps<{ vat: VatReturns, year: number, vatNumber: string, filings: VatFiling[] }>()
const emit = defineEmits<{ saved: [] }>()

const today = todayInAmsterdam()
const period = ref<VatPeriod>(defaultVatPeriod(props.year, today))
// A different year opens on the period that most likely needs filing.
watch(() => props.year, year => { period.value = defaultVatPeriod(year, todayInAmsterdam()) })

const periodOptions = computed(() => [
  ...props.vat.quarters.map(quarter => ({ key: quarter.period, short: `Q${quarter.period.slice(1)}` })),
  { key: 'year' as const, short: 'Heel jaar' },
])
const current = computed<VatReturn>(() => period.value === 'year' ? props.vat.year : props.vat.quarters.find(quarter => quarter.period === period.value)!)
const rubrieken = (['1a', '1b', '1c', '1e'] as VatRubriek[])
const empty = computed(() => current.value.invoiceCount === 0 && current.value.expenseCount === 0)
const refund = computed(() => current.value.balanceCents < 0)

const dateFormat = new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Amsterdam' })
function money(cents: number) { return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(cents / 100) }
function wholeEuros(cents: number) { return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(wholeEuroCents(cents) / 100) }
function dateText(value: string) { return dateFormat.format(new Date(`${value}T12:00:00`)) }

const stateText: Record<VatFilingState, string> = {
  running: 'Loopt nog',
  open: 'Nog in te dienen',
  late: 'Te laat',
  submitted: 'Ingediend, nog niet betaald',
  paid: 'Ingediend en betaald',
}
const filingFor = (period: VatPeriod) => props.filings.find(filing => filing.period === period) ?? null
const statusOf = (quarter: VatReturn) => vatFilingStatus(quarter, filingFor(quarter.period), today)
const selectedQuarter = computed(() => current.value.period === 'year' ? null : current.value)
const filing = computed(() => selectedQuarter.value ? filingFor(selectedQuarter.value.period) : null)
const status = computed(() => selectedQuarter.value ? statusOf(selectedQuarter.value) : null)

const form = reactive({ submittedOn: '', paidOn: '' })
watch([filing, period], () => {
  form.submittedOn = filing.value?.submittedOn ?? ''
  form.paidOn = filing.value?.paidOn ?? ''
}, { immediate: true })
const saving = ref(false)
const message = ref('')
const failed = ref(false)
async function save() {
  if (!selectedQuarter.value) return
  saving.value = true
  message.value = ''
  failed.value = false
  try {
    await $fetch('/api/admin/finance/vat-filings', {
      method: 'PUT',
      body: { year: props.year, period: selectedQuarter.value.period as VatQuarter, submittedOn: form.submittedOn || null, paidOn: form.paidOn || null },
    })
    emit('saved')
    message.value = form.submittedOn ? 'Opgeslagen.' : 'Status gewist.'
  }
  catch (error: unknown) {
    failed.value = true
    message.value = apiErrorMessage(error, 'Opslaan is niet gelukt.')
  }
  finally { saving.value = false }
}
function setToday(field: 'submittedOn' | 'paidOn') { form[field] = today }

const deadline = computed(() => {
  const days = daysUntil(current.value.dueDate, today)
  if (current.value.to >= today) return { state: 'later', text: 'Dit tijdvak loopt nog.' }
  if (days < 0) return { state: 'late', text: `De uiterste datum was ${days === -1 ? 'gisteren' : `${-days} dagen geleden`}.` }
  if (days === 0) return { state: 'soon', text: 'Vandaag is de uiterste datum.' }
  return { state: days <= 14 ? 'soon' : 'later', text: days === 1 ? 'Nog 1 dag.' : `Nog ${days} dagen.` }
})
</script>

<template>
  <section class="card" aria-labelledby="vat-heading">
    <div class="head">
      <div>
        <h2 id="vat-heading">Omzetbelastingaangifte</h2>
        <p class="muted">De bedragen voor je btw-aangifte, op volgorde van het formulier van de Belastingdienst.<template v-if="vatNumber"> BTW-nummer {{ vatNumber }}.</template></p>
      </div>
      <div class="periods" role="group" aria-label="Tijdvak">
        <button v-for="option in periodOptions" :key="option.key" type="button" :aria-pressed="period === option.key" @click="period = option.key">{{ option.short }}</button>
      </div>
    </div>

    <div class="deadline" :data-state="deadline.state">
      <strong>{{ current.label }}</strong>
      <span>{{ dateText(current.from) }} t/m {{ dateText(current.to) }}</span>
      <span>Indienen en betalen uiterlijk <strong>{{ dateText(current.dueDate) }}</strong>. {{ status?.state === 'submitted' || status?.state === 'paid' ? '' : deadline.text }}</span>
      <span v-if="status" class="status" :data-state="status.state">Status: <strong>{{ stateText[status.state] }}</strong><template v-if="filing?.submittedOn"> · ingediend op {{ dateText(filing.submittedOn) }}</template><template v-if="filing?.paidOn"> · {{ current.balanceCents < 0 ? 'ontvangen' : 'betaald' }} op {{ dateText(filing.paidOn) }}</template></span>
    </div>
    <p v-if="status?.changedSinceFiled && filing?.filedBalanceCents != null" class="warning" role="status">
      Sinds het indienen zijn de cijfers gewijzigd: toen {{ money(filing.filedBalanceCents) }}, nu {{ money(current.balanceCents) }}. Controleer of een correctie nodig is.
    </p>

    <p v-if="empty" class="empty">In dit tijdvak zijn geen uitgegeven facturen en geen kosten met btw. De aangifte is dan nul.</p>

    <div class="table-wrap" tabindex="0" role="region" aria-label="Rubrieken van de btw-aangifte">
      <table>
        <caption class="sr-only">Btw-aangifte {{ current.label }}</caption>
        <thead>
          <tr><th scope="col">Rubriek</th><th scope="col">Omschrijving</th><th scope="col" class="num">Omzet <small>hele euro's</small></th><th scope="col" class="num">Btw</th></tr>
        </thead>
        <tbody>
          <tr v-for="rubriek in rubrieken" :key="rubriek" :class="{ quiet: !current.rubrieken[rubriek].turnoverCents }">
            <th scope="row" class="code">{{ rubriek }}</th>
            <td class="desc">{{ vatRubriekLabels[rubriek] }}</td>
            <td class="num">{{ wholeEuros(current.rubrieken[rubriek].turnoverCents) }}</td>
            <td class="num">{{ rubriek === '1e' ? '–' : money(current.rubrieken[rubriek].vatCents) }}</td>
          </tr>
          <tr class="sum">
            <th scope="row" class="code">5a</th>
            <td class="desc">Verschuldigde omzetbelasting</td>
            <td class="num" />
            <td class="num">{{ money(current.dueVatCents) }}</td>
          </tr>
          <tr>
            <th scope="row" class="code">5b</th>
            <td class="desc">Voorbelasting <small>btw op kosten, {{ current.expenseCount }} {{ current.expenseCount === 1 ? 'post' : 'posten' }}</small></td>
            <td class="num" />
            <td class="num">{{ money(current.inputVatCents) }}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr :data-refund="refund || undefined">
            <th scope="row" class="code">5g</th>
            <td class="desc">{{ refund ? 'Terug te vragen' : 'Te betalen' }}</td>
            <td class="num" />
            <td class="num">{{ money(Math.abs(current.balanceCents)) }}</td>
          </tr>
        </tfoot>
      </table>
    </div>

    <p class="note">
      Gebaseerd op {{ current.invoiceCount }} {{ current.invoiceCount === 1 ? 'uitgegeven factuur' : 'uitgegeven facturen' }} naar factuurdatum; conceptfacturen en vervallen facturen tellen niet mee.
      Facturen zonder btw staan bij 1e. Controleer de cijfers voor je indient, bijvoorbeeld in Mijn Belastingdienst Zakelijk.
    </p>

    <form v-if="selectedQuarter" class="filing" @submit.prevent="save">
      <h3>Ingediend en betaald</h3>
      <div class="fields">
        <div class="field">
          <label for="vat-submitted">Ingediend op</label>
          <div class="row"><input id="vat-submitted" v-model="form.submittedOn" type="date"><button type="button" class="secondary" @click="setToday('submittedOn')">Vandaag</button></div>
        </div>
        <div class="field">
          <label for="vat-paid">{{ current.balanceCents < 0 ? 'Teruggave ontvangen op' : 'Betaald op' }}</label>
          <div class="row"><input id="vat-paid" v-model="form.paidOn" type="date" :disabled="!form.submittedOn" :min="form.submittedOn || undefined"><button type="button" class="secondary" :disabled="!form.submittedOn" @click="setToday('paidOn')">Vandaag</button></div>
        </div>
        <button class="primary" :disabled="saving">{{ saving ? 'Opslaan…' : 'Opslaan' }}</button>
      </div>
      <p class="note">Laat beide velden leeg en sla op om de status te wissen. De betaaldatum kan pas als de aangifte is ingediend.</p>
      <p v-if="message" class="note" :class="{ error: failed }" role="status">{{ message }}</p>
    </form>
    <p v-else class="note">De status van indienen en betalen houd je per kwartaal bij. Kies hierboven een kwartaal.</p>

    <h3>Alle kwartalen in {{ year }}</h3>
    <div class="table-wrap" tabindex="0" role="region" aria-label="Btw per kwartaal">
      <table>
        <caption class="sr-only">Verschuldigde btw, voorbelasting en saldo per kwartaal in {{ year }}</caption>
        <thead>
          <tr><th scope="col">Kwartaal</th><th scope="col" class="num">5a Verschuldigd</th><th scope="col" class="num">5b Voorbelasting</th><th scope="col" class="num">5g Saldo</th><th scope="col">Uiterste datum</th><th scope="col">Status</th></tr>
        </thead>
        <tbody>
          <tr v-for="quarter in vat.quarters" :key="quarter.period" :class="{ quiet: !quarter.invoiceCount && !quarter.expenseCount }">
            <th scope="row"><button type="button" class="link" :aria-label="`${quarter.label} bekijken`" @click="period = quarter.period">{{ quarter.label }}</button></th>
            <td class="num">{{ money(quarter.dueVatCents) }}</td>
            <td class="num">{{ money(quarter.inputVatCents) }}</td>
            <td class="num" :data-refund="quarter.balanceCents < 0 || undefined">{{ money(quarter.balanceCents) }}</td>
            <td>{{ dateText(quarter.dueDate) }}</td>
            <td><span class="pill" :data-state="statusOf(quarter).state">{{ stateText[statusOf(quarter).state] }}</span><span v-if="statusOf(quarter).changedSinceFiled" class="pill" data-state="changed">Cijfers gewijzigd</span></td>
          </tr>
        </tbody>
        <tfoot>
          <tr><th scope="row">Totaal {{ year }}</th><td class="num">{{ money(vat.year.dueVatCents) }}</td><td class="num">{{ money(vat.year.inputVatCents) }}</td><td class="num" :data-refund="vat.year.balanceCents < 0 || undefined">{{ money(vat.year.balanceCents) }}</td><td /><td /></tr>
        </tfoot>
      </table>
    </div>
    <p class="note">Een negatief saldo betekent dat je btw terugkrijgt.</p>
  </section>
</template>

<style scoped>
.card { display: grid; gap: .9rem; padding: 1.25rem; border: 1px solid var(--border); border-radius: 1rem; background: var(--surface-card); }
.card h2 { margin: 0; font-size: 1.15rem; }
.card h3 { margin: .6rem 0 0; font-size: 1rem; }
.head { display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: .9rem; }
.head p { margin-top: .25rem; max-width: 34rem; }
.periods { display: flex; flex-wrap: wrap; gap: .4rem; }
.periods button { min-height: 2.75rem; min-width: 2.75rem; padding: .5rem .9rem; border: 1px solid var(--border-strong); border-radius: .7rem; background: var(--surface-input); color: var(--text); font-weight: 700; cursor: pointer; }
.periods button[aria-pressed='true'] { border-color: transparent; background: var(--button-primary-bg); color: var(--button-primary-fg); }
.deadline { display: grid; gap: .15rem; padding: .8rem 1rem; border: 1px solid var(--border); border-left-width: 4px; border-radius: .75rem; background: var(--surface-input); font-size: .9rem; }
.deadline span { color: var(--text-muted); }
.deadline[data-state='soon'] { border-left-color: #f2cf8a; }
.deadline[data-state='late'] { border-left-color: #f3a7b2; }
.deadline[data-state='later'] { border-left-color: var(--electric-accent); }
.status strong { color: var(--text); }
.status[data-state='late'] strong { color: #f3a7b2; }
.status[data-state='paid'] strong { color: #a9e1bb; }
.warning { margin: 0; padding: .7rem .9rem; border: 1px solid #f2cf8a; border-radius: .75rem; color: var(--text); font-size: .88rem; }
.filing { display: grid; gap: .7rem; padding: 1rem; border: 1px solid var(--border); border-radius: .85rem; }
.fields { display: flex; flex-wrap: wrap; align-items: flex-end; gap: .8rem; }
.field { display: grid; gap: .3rem; }
.field label { color: var(--text-subtle); font-size: .78rem; font-weight: 700; }
.row { display: flex; gap: .4rem; }
input[type='date'] { min-height: 2.75rem; padding: .5rem .75rem; border: 1px solid var(--border-strong); border-radius: .65rem; background: var(--surface-input); color: var(--text); }
.primary, .secondary { display: inline-flex; align-items: center; min-height: 2.75rem; padding: .5rem 1.1rem; border: 1px solid transparent; border-radius: .7rem; font-weight: 800; cursor: pointer; }
.primary { background: var(--button-primary-bg); color: var(--button-primary-fg); }
.secondary { border-color: var(--border-strong); background: var(--button-secondary-bg); color: var(--button-secondary-fg); font-weight: 700; }
button:disabled, input:disabled { opacity: .5; cursor: not-allowed; }
.error { color: #f3a7b2; }
.pill { display: inline-block; margin-right: .3rem; padding: .15rem .55rem; border: 1px solid var(--border-strong); border-radius: 999px; font-size: .78rem; font-weight: 700; white-space: nowrap; }
.pill[data-state='paid'] { color: #a9e1bb; }
.pill[data-state='late'], .pill[data-state='changed'] { color: #f3a7b2; }
.pill[data-state='open'], .pill[data-state='submitted'] { color: #f2cf8a; }
.empty { margin: 0; padding: .9rem 1rem; border: 1px dashed var(--border-strong); border-radius: .85rem; color: var(--text-muted); }
.table-wrap { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; font-size: .9rem; font-variant-numeric: tabular-nums; }
th, td { padding: .6rem .5rem; border-bottom: 1px solid var(--border); text-align: left; }
thead th { color: var(--text-subtle); font-size: .72rem; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; white-space: nowrap; }
thead th small { text-transform: none; letter-spacing: 0; font-weight: 500; }
.num { text-align: right; white-space: nowrap; }
.code { width: 4.5rem; font-weight: 800; white-space: nowrap; }
.desc small { color: var(--text-muted); }
tr.quiet { color: var(--text-subtle); }
tr.sum th, tr.sum td { border-top: 1px solid var(--border-strong); font-weight: 700; }
tfoot th, tfoot td { border-bottom: 0; font-weight: 800; }
[data-refund] { color: #a9e1bb; }
.link { padding: 0; border: 0; background: transparent; color: var(--text); font: inherit; font-weight: 700; text-decoration: underline; text-underline-offset: .2em; cursor: pointer; }
.note, .muted { margin: 0; color: var(--text-muted); font-size: .85rem; line-height: 1.5; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
</style>
