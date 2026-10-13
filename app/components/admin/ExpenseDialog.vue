<script setup lang="ts">
import { todayInAmsterdam } from '~~/shared/dates'
import { expenseCategories, expenseCategoryLabels, mileageAmountCents, parseEuroToCents, type ExpenseCategory } from '~~/shared/finance'
import { apiErrorMessage } from '~/utils/api-error'

export type ExpenseRow = {
  id: string
  kind: 'cost' | 'mileage'
  gigId?: string | null
  spentOn: string
  description: string
  category: string
  amountCents: number
  vatCents: number
  kilometers: string | number | null
  kmRateCents: number | null
}

const props = defineProps<{
  /** Fixed gig (on the gig page). Without it the dialog offers a choice of gigs, or none for a general cost. */
  gigId?: string
  gigOptions?: Array<{ id: string, title: string }>
  kmRateCents: number
}>()
const emit = defineEmits<{ saved: [] }>()

const dialog = ref<HTMLDialogElement | null>(null)
const editingId = ref('')
const kind = ref<'cost' | 'mileage'>('cost')
const form = reactive({ spentOn: '', description: '', category: 'overig' as ExpenseCategory, amount: '', vat: '', kilometers: '', rate: '', gigId: '' })
const busy = ref(false)
const error = ref('')

function euro(cents: number) { return (cents / 100).toFixed(2).replace('.', ',') }
function money(cents: number) { return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(cents / 100) }

function show(expense?: ExpenseRow) {
  error.value = ''
  editingId.value = expense?.id ?? ''
  kind.value = expense?.kind ?? 'cost'
  Object.assign(form, {
    spentOn: expense?.spentOn ?? todayInAmsterdam(),
    description: expense && !(expense.kind === 'mileage' && expense.description === 'Kilometers') ? expense.description : '',
    category: (expense && expenseCategories.includes(expense.category as ExpenseCategory) ? expense.category : 'overig') as ExpenseCategory,
    amount: expense?.kind === 'cost' ? euro(expense.amountCents) : '',
    vat: expense?.kind === 'cost' ? euro(expense.vatCents) : '',
    kilometers: expense?.kind === 'mileage' && expense.kilometers !== null ? String(Number(expense.kilometers)).replace('.', ',') : '',
    rate: euro(expense?.kmRateCents ?? props.kmRateCents),
    gigId: expense?.gigId ?? props.gigId ?? '',
  })
  dialog.value?.showModal()
}
defineExpose({ show })

const kilometers = computed(() => Number(form.kilometers.replace(',', '.')))
const rateCents = computed(() => parseEuroToCents(form.rate))
const tripCents = computed(() => Number.isFinite(kilometers.value) && kilometers.value > 0 && rateCents.value !== null ? mileageAmountCents(kilometers.value, rateCents.value) : null)

async function save() {
  error.value = ''
  const gigId = props.gigId || form.gigId || null
  let body: Record<string, unknown>
  if (kind.value === 'mileage') {
    if (!Number.isFinite(kilometers.value) || kilometers.value <= 0) { error.value = 'Vul het aantal kilometers in.'; return }
    if (rateCents.value === null) { error.value = 'Vul een geldig tarief per kilometer in.'; return }
    body = { kind: 'mileage', gigId, spentOn: form.spentOn, description: form.description, kilometers: kilometers.value, kmRateCents: rateCents.value }
  }
  else {
    const amountCents = parseEuroToCents(form.amount)
    const vatCents = form.vat.trim() ? parseEuroToCents(form.vat) : 0
    if (amountCents === null) { error.value = 'Vul een geldig bedrag in, bijvoorbeeld 24,50.'; return }
    if (vatCents === null) { error.value = 'Vul een geldig btw-bedrag in, of laat het leeg.'; return }
    body = { kind: 'cost', gigId, spentOn: form.spentOn, description: form.description, category: form.category, amountCents, vatCents }
  }
  busy.value = true
  try {
    await $fetch(editingId.value ? `/api/admin/expenses/${editingId.value}` : '/api/admin/expenses', { method: editingId.value ? 'PUT' : 'POST', body })
    dialog.value?.close()
    emit('saved')
  }
  catch (failure: unknown) { error.value = apiErrorMessage(failure, 'Opslaan is niet gelukt.') }
  finally { busy.value = false }
}

const confirmAction = useConfirm()
async function remove() {
  if (!editingId.value) return
  dialog.value?.close()
  if (!(await confirmAction({ title: 'Deze post verwijderen?', body: 'Dit kan niet ongedaan worden gemaakt.', confirmLabel: 'Verwijderen', tone: 'danger' }))) { dialog.value?.showModal(); return }
  busy.value = true
  try {
    await $fetch(`/api/admin/expenses/${editingId.value}`, { method: 'DELETE' })
    emit('saved')
  }
  catch (failure: unknown) { error.value = apiErrorMessage(failure, 'Verwijderen is niet gelukt.'); dialog.value?.showModal() }
  finally { busy.value = false }
}
</script>

<template>
  <dialog ref="dialog" class="expense-dialog" aria-labelledby="expense-title">
    <form @submit.prevent="save">
      <h2 id="expense-title">{{ editingId ? 'Post wijzigen' : 'Kosten of kilometers toevoegen' }}</h2>

      <div class="kind" role="radiogroup" aria-label="Soort">
        <button type="button" role="radio" :aria-checked="kind === 'cost'" @click="kind = 'cost'"><Icon name="lucide:receipt" aria-hidden="true" />Kosten</button>
        <button type="button" role="radio" :aria-checked="kind === 'mileage'" @click="kind = 'mileage'"><Icon name="lucide:car" aria-hidden="true" />Kilometers</button>
      </div>

      <div class="grid">
        <label>Datum<input v-model="form.spentOn" type="date" required></label>
        <label v-if="!gigId">
          Gig <small>optioneel</small>
          <select v-model="form.gigId">
            <option value="">Geen gig (algemene post)</option>
            <option v-for="gig in gigOptions || []" :key="gig.id" :value="gig.id">{{ gig.title }}</option>
          </select>
        </label>

        <template v-if="kind === 'cost'">
          <label class="wide">Omschrijving<input v-model="form.description" required maxlength="300" placeholder="Bijvoorbeeld: huur lichtset"></label>
          <label>
            Categorie
            <select v-model="form.category"><option v-for="category in expenseCategories" :key="category" :value="category">{{ expenseCategoryLabels[category] }}</option></select>
          </label>
          <label>Bedrag incl. btw (€)<input v-model="form.amount" required inputmode="decimal" placeholder="0,00"></label>
          <label>Waarvan btw (€) <small>optioneel</small><input v-model="form.vat" inputmode="decimal" placeholder="0,00"></label>
        </template>

        <template v-else>
          <label class="wide">Omschrijving <small>optioneel</small><input v-model="form.description" maxlength="300" placeholder="Bijvoorbeeld: heen en terug naar Zwolle"></label>
          <label>Kilometers<input v-model="form.kilometers" required inputmode="decimal" placeholder="0"></label>
          <label>Tarief per km (€)<input v-model="form.rate" required inputmode="decimal"></label>
          <p class="trip-total wide" aria-live="polite">{{ tripCents === null ? 'Vul de kilometers in' : `Vergoeding: ${money(tripCents)}` }}</p>
        </template>
      </div>

      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <div class="actions">
        <button v-if="editingId" type="button" class="danger-text" :disabled="busy" @click="remove">Verwijderen</button>
        <span class="spacer" />
        <button type="button" class="secondary" :disabled="busy" @click="dialog?.close()">Annuleren</button>
        <button class="primary" :disabled="busy">{{ busy ? 'Opslaan…' : 'Opslaan' }}</button>
      </div>
    </form>
  </dialog>
</template>

<style scoped>
.expense-dialog { width: min(34rem, calc(100% - 2rem)); padding: 1.4rem; border: 1px solid #37313d; border-radius: 1rem; background: #141119; color: var(--text); }
.expense-dialog::backdrop { background: rgba(5, 4, 7, .72); }
h2 { margin: 0 0 1rem; font-size: 1.3rem; }
.kind { display: grid; grid-template-columns: 1fr 1fr; gap: .4rem; margin-bottom: 1rem; padding: .25rem; border: 1px solid var(--border-strong); border-radius: .85rem; }
.kind button { display: inline-flex; align-items: center; justify-content: center; gap: .45rem; min-height: 2.75rem; border: 0; border-radius: .65rem; background: transparent; color: var(--text-muted); font-weight: 700; cursor: pointer; }
.kind button[aria-checked="true"] { background: var(--button-secondary-bg); color: var(--text); }
.grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .85rem; }
.wide { grid-column: 1 / -1; }
label { display: grid; gap: .35rem; color: #c9c3ce; font-size: .8rem; font-weight: 650; }
label small { color: var(--text-subtle); font-weight: 500; }
input, select { width: 100%; min-height: 2.75rem; padding: .6rem .75rem; border: 1px solid var(--border-strong); border-radius: .65rem; background: var(--surface-input); color: var(--text); }
.trip-total { margin: 0; padding: .7rem .85rem; border: 1px solid var(--border-strong); border-radius: .7rem; background: var(--surface-card); font-weight: 700; }
.error { margin: .9rem 0 0; color: #ffb3bf; }
.actions { display: flex; align-items: center; gap: .6rem; margin-top: 1.25rem; }
.spacer { flex: 1; }
.primary, .secondary { min-height: 2.75rem; padding: .5rem 1.1rem; border: 1px solid transparent; border-radius: .7rem; font-weight: 800; cursor: pointer; }
.primary { background: var(--button-primary-bg); color: var(--button-primary-fg); }
.secondary { border-color: var(--border-strong); background: var(--button-secondary-bg); color: var(--button-secondary-fg); }
.danger-text { min-height: 2.75rem; border: 0; background: none; color: #f3a7b2; font-weight: 700; cursor: pointer; }
button:disabled { opacity: .5; cursor: not-allowed; }
@media (max-width: 560px) { .grid { grid-template-columns: 1fr; } }
</style>
