<script setup lang="ts">
import { expenseCategoryLabels, gigResultCents, MILEAGE_CATEGORY } from '~~/shared/finance'
import type { ExpenseRow } from './ExpenseDialog.vue'

const props = defineProps<{
  gigId: string
  expenses: ExpenseRow[]
  /** The gig's invoices; only issued (finalized) ones count as revenue. */
  invoices: Array<{ status: string, subtotalCents: number }>
  kmRateCents: number
  canEdit: boolean
}>()
const emit = defineEmits<{ changed: [] }>()

const dialog = ref<InstanceType<typeof import('./ExpenseDialog.vue').default> | null>(null)
const result = computed(() => gigResultCents(props.invoices.filter(invoice => invoice.status === 'finalized'), props.expenses))
const dayFormat = new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short', timeZone: 'Europe/Amsterdam' })
function money(cents: number) { return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(cents / 100) }
function day(value: string) { return dayFormat.format(new Date(`${value}T12:00:00`)).replace('.', '') }
function detail(expense: ExpenseRow) {
  if (expense.kind === 'mileage') return `${String(Number(expense.kilometers)).replace('.', ',')} km${expense.kmRateCents !== null ? ` × ${money(expense.kmRateCents)}` : ''}`
  return expenseCategoryLabels[expense.category as keyof typeof expenseCategoryLabels] || expense.category
}
function label(expense: ExpenseRow) { return expense.kind === 'mileage' && expense.description === 'Kilometers' ? expenseCategoryLabels[MILEAGE_CATEGORY] : expense.description }
</script>

<template>
  <section class="card expenses-card">
    <header class="card-head"><Icon name="lucide:piggy-bank" class="lead-icon" aria-hidden="true" /><h2>Kosten en kilometers</h2></header>

    <dl class="result">
      <div><dt>Omzet excl. btw</dt><dd>{{ money(result.revenueCents) }}</dd></div>
      <div><dt>Kosten excl. btw</dt><dd>{{ money(result.costCents) }}</dd></div>
      <div class="net" :data-negative="result.resultCents < 0 || undefined"><dt>Resultaat</dt><dd>{{ money(result.resultCents) }}</dd></div>
    </dl>

    <p v-if="!expenses.length" class="empty">Nog geen kosten of kilometers voor deze gig.</p>
    <ul v-else class="rows">
      <li v-for="expense in expenses" :key="expense.id">
        <button type="button" class="row" :disabled="!canEdit" :aria-label="`${label(expense)}, ${money(expense.amountCents)}. Wijzigen`" @click="dialog?.show(expense)">
          <Icon :name="expense.kind === 'mileage' ? 'lucide:car' : 'lucide:receipt'" class="kind-icon" aria-hidden="true" />
          <span class="row-main"><strong>{{ label(expense) }}</strong><small>{{ day(expense.spentOn) }} · {{ detail(expense) }}</small></span>
          <span v-if="expense.billedInvoiceId" class="tag" data-on>Op factuur</span>
          <span v-else-if="expense.billable" class="tag">Wordt doorberekend</span>
          <strong class="row-amount">{{ money(expense.amountCents) }}</strong>
        </button>
      </li>
    </ul>
    <button v-if="canEdit" type="button" class="outline wide-button" @click="dialog?.show()"><Icon name="lucide:plus" aria-hidden="true" /> Kosten of kilometers toevoegen</button>

    <AdminExpenseDialog ref="dialog" :gig-id="gigId" :km-rate-cents="kmRateCents" @saved="emit('changed')" />
  </section>
</template>

<style scoped>
.expenses-card { padding: 1rem 1.1rem; }
.card-head { display: flex; align-items: center; gap: .7rem; margin: 0 0 .7rem; }
.card-head h2 { flex: 1; margin: 0; font-size: 1rem; }
.lead-icon { flex: none; width: 1.35rem; height: 1.35rem; color: var(--electric-accent); }
.wide-button { display: inline-flex; align-items: center; justify-content: center; gap: .5rem; width: 100%; min-height: 2.75rem; margin-top: .3rem; padding: .5rem .9rem; border: 1px solid var(--border-strong); border-radius: .7rem; background: transparent; color: var(--text); font: inherit; font-size: .9rem; font-weight: 600; cursor: pointer; }
.result { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: .6rem; margin: 0 0 .9rem; }
.result div { display: grid; gap: .15rem; padding: .7rem .8rem; border: 1px solid var(--border); border-radius: .75rem; background: var(--surface-input); }
.result dt { color: var(--text-subtle); font-size: .72rem; }
.result dd { margin: 0; font-size: 1.02rem; font-weight: 800; font-variant-numeric: tabular-nums; }
.result .net dd { color: #a9e1bb; }
.result .net[data-negative] dd { color: #f3a7b2; }
.empty { margin: 0 0 .8rem; color: var(--text-muted); }
.rows { display: grid; margin: 0 0 .8rem; padding: 0; list-style: none; }
.rows li + li { border-top: 1px solid var(--border); }
.row { display: flex; align-items: center; gap: .75rem; width: 100%; min-height: 3.4rem; padding: .5rem 0; border: 0; background: transparent; color: inherit; text-align: left; cursor: pointer; }
.row:disabled { cursor: default; }
.kind-icon { flex: none; width: 1.15rem; height: 1.15rem; color: var(--electric-soft); }
.row-main { display: grid; flex: 1; min-width: 0; gap: .1rem; }
.row-main strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.row-main small { color: var(--text-muted); }
.tag { flex: none; padding: .15rem .55rem; border: 1px solid var(--border-strong); border-radius: 999px; color: var(--text-muted); font-size: .72rem; font-weight: 700; }
.tag[data-on] { border-color: #3f6b50; color: #a9e1bb; }
.row-amount { font-variant-numeric: tabular-nums; }
@media (max-width: 520px) { .result { grid-template-columns: 1fr; } }
</style>
