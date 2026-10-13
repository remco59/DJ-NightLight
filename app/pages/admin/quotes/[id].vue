<script setup lang="ts">
import { calculateInvoiceTotals, type VatMode } from '~~/shared/invoice'
import { todayInAmsterdam } from '~~/shared/dates'
import { quoteDisplayStatus, type QuoteStatus } from '~~/shared/quote'
import { apiErrorMessage } from '~/utils/api-error'

definePageMeta({ layout: 'admin' })

const route = useRoute()
const id = String(route.params.id)

type Line = { id: string, description: string, quantity: string, unitPriceCents: number }
type Quote = {
  id: string, gigId: string, quoteNumber: string | null, status: QuoteStatus, issueDate: string, validUntil: string, currency: string,
  vatMode: VatMode, vatRateBasisPoints: number, subtotalCents: number, vatAmountCents: number, totalCents: number, terms: string, notes: string,
  sentAt: string | null, acceptedAt: string | null, acceptedName: string | null, declinedAt: string | null, declineReason: string | null,
  invoiceId: string | null, gigTitle: string, clientFirstName: string | null, clientLastName: string | null, clientCompanyName: string | null, clientEmail: string | null,
}
type EditableLine = { description: string, quantity: string, unitPrice: string }
type SendCheck = { blockers: string[], email: { recipient: string | null, willSend: boolean, skipReason: string | null, delayMinutes: number, providerConfigured: boolean } }

const { data, refresh } = await useFetch<{ quote: Quote, lines: Line[] }>(`/api/admin/quotes/${id}`)
if (!data.value) throw createError({ statusCode: 404, statusMessage: 'Offerte niet gevonden' })

const quote = computed(() => data.value!.quote)
const draft = computed(() => quote.value.status === 'draft')
const display = computed(() => quoteDisplayStatus(quote.value, todayInAmsterdam()))
const form = reactive({
  issueDate: quote.value.issueDate, validUntil: quote.value.validUntil, currency: quote.value.currency, vatMode: quote.value.vatMode,
  vatRateBasisPoints: quote.value.vatRateBasisPoints, terms: quote.value.terms, notes: quote.value.notes,
})
const lines = ref<EditableLine[]>(data.value.lines.map(line => ({
  description: line.description, quantity: String(Number(line.quantity)), unitPrice: (line.unitPriceCents / 100).toFixed(2),
})))
const busy = ref(false)
const message = ref('')

function lineInputs() {
  return lines.value.map(line => ({ description: line.description, quantity: line.quantity, unitPriceCents: Math.round(Number(line.unitPrice) * 100) }))
}
const totals = computed(() => {
  try { return calculateInvoiceTotals(lineInputs(), form.vatMode, form.vatRateBasisPoints) }
  catch { return null }
})
function money(cents: number) { return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: form.currency || 'EUR' }).format(cents / 100) }
function longDate(value: string | null) { return value ? new Intl.DateTimeFormat('nl-NL', { dateStyle: 'long', timeZone: 'Europe/Amsterdam' }).format(new Date(value)) : '' }
function clientName() { return quote.value.clientCompanyName || [quote.value.clientFirstName, quote.value.clientLastName].filter(Boolean).join(' ') || 'Klant' }
function setVatRate(event: Event) { form.vatRateBasisPoints = Math.round(Number((event.target as HTMLInputElement).value) * 100) }
function payload() { return { ...form, lines: lineInputs() } }

async function save() {
  busy.value = true
  message.value = ''
  try {
    await $fetch(`/api/admin/quotes/${id}`, { method: 'PUT', body: payload() })
    await refresh()
    message.value = 'Concept opgeslagen.'
  }
  catch (error: unknown) { message.value = apiErrorMessage(error, 'Offerte opslaan is niet gelukt.') }
  finally { busy.value = false }
}

// Sending locks the quote and mails the client, so it goes through a dialog that shows both first.
const sendDialog = ref<HTMLDialogElement | null>(null)
const check = ref<SendCheck | null>(null)
const checkError = ref('')
async function openSend() {
  busy.value = true
  message.value = ''
  checkError.value = ''
  check.value = null
  try {
    await $fetch(`/api/admin/quotes/${id}`, { method: 'PUT', body: payload() })
    await refresh()
    check.value = await $fetch<SendCheck>(`/api/admin/quotes/${id}/send-check`)
    sendDialog.value?.showModal()
  }
  catch (error: unknown) { message.value = apiErrorMessage(error, 'De offerte kon niet worden gecontroleerd.') }
  finally { busy.value = false }
}
function sendMoment(minutes: number) {
  if (minutes <= 0) return 'direct'
  if (minutes % 1440 === 0) return `${minutes / 1440} dag${minutes === 1440 ? '' : 'en'} later`
  if (minutes % 60 === 0) return `${minutes / 60} uur later`
  return `${minutes} minuten later`
}
async function send() {
  busy.value = true
  try {
    const result = await $fetch<{ quote: { quoteNumber: string | null }, email: { recipient: string } | null }>(`/api/admin/quotes/${id}/send`, { method: 'POST' })
    sendDialog.value?.close()
    await refresh()
    const number = result.quote.quoteNumber || 'De offerte'
    message.value = result.email ? `${number} is verstuurd. De klant krijgt een mail op ${result.email.recipient}.` : `${number} is vergrendeld. Er is geen e-mail verstuurd, stuur de klant zelf de link.`
  }
  catch (error: unknown) {
    sendDialog.value?.close()
    message.value = apiErrorMessage(error, 'Offerte versturen is niet gelukt.')
  }
  finally { busy.value = false }
}

const confirmAction = useConfirm()
async function voidQuote() {
  if (!(await confirmAction({ title: 'Offerte laten vervallen?', body: 'De klant kan de offerte daarna niet meer accepteren. Het nummer blijft bewaard en je kunt een nieuwe offerte maken.', confirmLabel: 'Laten vervallen', tone: 'danger' }))) return
  busy.value = true
  try {
    await $fetch(`/api/admin/quotes/${id}/void`, { method: 'POST' })
    await refresh()
    message.value = 'De offerte is laten vervallen.'
  }
  catch (error: unknown) { message.value = apiErrorMessage(error, 'Laten vervallen is niet gelukt.') }
  finally { busy.value = false }
}
async function removeDraft() {
  if (!(await confirmAction({ title: 'Dit concept verwijderen?', body: 'Het concept wordt volledig verwijderd. Dit kan niet ongedaan worden gemaakt.', confirmLabel: 'Verwijderen', tone: 'danger' }))) return
  busy.value = true
  try {
    await $fetch(`/api/admin/quotes/${id}`, { method: 'DELETE' })
    await navigateTo(`/admin/gigs/${quote.value.gigId}?tab=finance`)
  }
  catch (error: unknown) { message.value = apiErrorMessage(error, 'Verwijderen is niet gelukt.'); busy.value = false }
}
async function createInvoice() {
  busy.value = true
  try {
    const result = await $fetch<{ invoice: { id: string } }>(`/api/admin/quotes/${id}/invoice`, { method: 'POST' })
    await navigateTo(`/admin/invoices/${result.invoice.id}`)
  }
  catch (error: unknown) { message.value = apiErrorMessage(error, 'Factuur aanmaken is niet gelukt.'); busy.value = false }
}

useSeoMeta({ title: () => `${quote.value.quoteNumber || 'Conceptofferte'} — DJ NightLight`, robots: 'noindex, nofollow' })
</script>

<template>
  <div v-if="data" class="quote-page">
    <NuxtLink :to="`/admin/gigs/${quote.gigId}?tab=finance`" class="back"><Icon name="lucide:arrow-left" aria-hidden="true" /> {{ quote.gigTitle }}</NuxtLink>

    <header class="page-head">
      <div>
        <p class="eyebrow">Offerte</p>
        <h1>{{ quote.quoteNumber || 'Conceptofferte' }}</h1>
        <p class="sub">{{ quote.gigTitle }} · {{ clientName() }}</p>
      </div>
      <div class="head-actions">
        <AdminStatusChip kind="quote" :status="display" />
        <a class="outline-link" :href="`/api/admin/quotes/${id}/pdf`" target="_blank" rel="noopener"><Icon name="lucide:file-text" aria-hidden="true" />{{ draft ? 'PDF-voorbeeld' : 'PDF' }}</a>
      </div>
    </header>

    <p v-if="message" class="message" role="status">{{ message }}</p>

    <section v-if="quote.status === 'accepted'" class="outcome accepted" role="status">
      <Icon name="lucide:circle-check" aria-hidden="true" />
      <div>
        <strong>{{ quote.acceptedName }} heeft akkoord gegeven</strong>
        <span>Op {{ longDate(quote.acceptedAt) }}. Bevestig de boeking op de gig en maak daarna de factuur.</span>
        <div class="outcome-actions">
          <NuxtLink v-if="quote.invoiceId" class="primary-link" :to="`/admin/invoices/${quote.invoiceId}`">Factuur openen</NuxtLink>
          <button v-else type="button" class="primary" :disabled="busy" @click="createInvoice">Factuur maken uit offerte</button>
        </div>
      </div>
    </section>
    <section v-else-if="quote.status === 'declined'" class="outcome declined" role="status">
      <Icon name="lucide:circle-x" aria-hidden="true" />
      <div>
        <strong>De klant heeft de offerte afgewezen</strong>
        <span>Op {{ longDate(quote.declinedAt) }}.<template v-if="quote.declineReason"> Reden: “{{ quote.declineReason }}”</template></span>
      </div>
    </section>
    <section v-else-if="display === 'expired'" class="outcome expired" role="status">
      <Icon name="lucide:clock-alert" aria-hidden="true" />
      <div>
        <strong>Deze offerte is verlopen</strong>
        <span>De klant kan hem niet meer accepteren. Laat hem vervallen en maak zo nodig een nieuwe.</span>
      </div>
    </section>

    <form @submit.prevent="save">
      <section class="card">
        <h2>Offertegegevens</h2>
        <div class="grid">
          <label>Offertedatum<input v-model="form.issueDate" type="date" :disabled="!draft"></label>
          <label>Geldig tot<input v-model="form.validUntil" type="date" :disabled="!draft"></label>
          <label>Valuta<input v-model="form.currency" maxlength="3" :disabled="!draft"></label>
          <label>
            BTW-berekening
            <select v-model="form.vatMode" :disabled="!draft">
              <option value="exclusive">Prijzen exclusief btw</option>
              <option value="inclusive">Prijzen inclusief btw</option>
              <option value="exempt">Geen btw / vrijgesteld</option>
            </select>
          </label>
          <label>BTW-tarief (%)<input :value="form.vatRateBasisPoints / 100" type="number" min="0" max="100" step="0.01" :disabled="!draft || form.vatMode === 'exempt'" @input="setVatRate"></label>
        </div>
      </section>

      <section class="card">
        <div class="section-title">
          <h2>Regels</h2>
          <button v-if="draft" type="button" class="text-button" @click="lines.push({ description: '', quantity: '1', unitPrice: '0.00' })"><Icon name="lucide:plus" aria-hidden="true" /> Regel toevoegen</button>
        </div>
        <div v-for="(line, index) in lines" :key="index" class="line">
          <input v-model="line.description" :aria-label="`Omschrijving regel ${index + 1}`" placeholder="Omschrijving" :disabled="!draft">
          <input v-model="line.quantity" :aria-label="`Aantal regel ${index + 1}`" inputmode="decimal" :disabled="!draft">
          <input v-model="line.unitPrice" :aria-label="`Prijs per stuk regel ${index + 1}`" inputmode="decimal" :disabled="!draft">
          <button v-if="draft && lines.length > 1" type="button" class="icon-button" :aria-label="`Regel ${index + 1} verwijderen`" @click="lines.splice(index, 1)"><Icon name="lucide:trash-2" aria-hidden="true" /></button>
        </div>
        <dl v-if="totals" class="totals">
          <div><dt>Subtotaal</dt><dd>{{ money(totals.subtotalCents) }}</dd></div>
          <div><dt>{{ form.vatMode === 'exempt' ? 'Geen btw' : `BTW (${form.vatRateBasisPoints / 100}%)` }}</dt><dd>{{ money(totals.vatAmountCents) }}</dd></div>
          <div class="grand"><dt>Totaal</dt><dd>{{ money(totals.totalCents) }}</dd></div>
        </dl>
        <p v-else class="message error" role="alert">De bedragen kloppen niet. Controleer aantallen en prijzen.</p>
      </section>

      <section class="card">
        <h2>Voorwaarden en notities</h2>
        <div class="grid">
          <label class="wide">Voorwaarden (staan op de offerte)<textarea v-model="form.terms" rows="3" :disabled="!draft" /></label>
          <label class="wide">Interne notities (alleen voor jou)<textarea v-model="form.notes" rows="2" :disabled="!draft" /></label>
        </div>
      </section>

      <div v-if="draft" class="save-bar">
        <span>Bij versturen wordt het concept eerst opgeslagen.</span>
        <div>
          <button type="button" class="danger-text" :disabled="busy" @click="removeDraft">Concept verwijderen</button>
          <button type="submit" class="secondary" :disabled="busy">Concept opslaan</button>
          <button type="button" class="primary" :disabled="busy || !totals" @click="openSend">Versturen…</button>
        </div>
      </div>
      <div v-else-if="quote.status === 'sent'" class="save-bar">
        <span>Verstuurd op {{ longDate(quote.sentAt) }}. De inhoud is vergrendeld.</span>
        <div><button type="button" class="danger-text" :disabled="busy" @click="voidQuote">Laten vervallen</button></div>
      </div>
    </form>

    <dialog ref="sendDialog" class="send-dialog" aria-labelledby="send-title">
      <h2 id="send-title">Offerte versturen</h2>
      <p class="dialog-lead">{{ clientName() }} · <strong>{{ totals ? money(totals.totalCents) : '' }}</strong></p>
      <template v-if="check">
        <div v-if="check.blockers.length" class="blockers" role="alert">
          <strong>Dit moet eerst kloppen</strong>
          <ul><li v-for="blocker in check.blockers" :key="blocker">{{ blocker }}</li></ul>
        </div>
        <ul v-else class="consequences">
          <li><Icon name="lucide:lock" aria-hidden="true" /><span>De offerte krijgt een nummer en wordt vergrendeld. Daarna kun je hem alleen nog laten vervallen en opnieuw maken.</span></li>
          <li v-if="check.email.willSend"><Icon name="lucide:send" aria-hidden="true" /><span>De klant krijgt <strong>{{ sendMoment(check.email.delayMinutes) }}</strong> een mail op <strong>{{ check.email.recipient }}</strong> met een link naar het klantportaal, waar hij akkoord kan geven.<template v-if="!check.email.providerConfigured"> Let op: er is nog geen e-mailprovider ingesteld, dus de mail blijft in de wachtrij staan.</template></span></li>
          <li v-else><Icon name="lucide:mail-x" aria-hidden="true" /><span>Er wordt geen e-mail verstuurd. {{ check.email.skipReason }}</span></li>
        </ul>
        <a class="preview-link" :href="`/api/admin/quotes/${id}/pdf`" target="_blank" rel="noopener">Bekijk PDF-voorbeeld <Icon name="lucide:external-link" aria-hidden="true" /></a>
      </template>
      <div class="dialog-actions">
        <button type="button" class="secondary" autofocus :disabled="busy" @click="sendDialog?.close()">Annuleren</button>
        <button type="button" class="primary" :disabled="busy || !check || check.blockers.length > 0" @click="send">{{ check?.email.willSend ? 'Versturen' : 'Vergrendelen' }}</button>
      </div>
    </dialog>
  </div>
</template>

<style scoped>
.quote-page { max-width: 900px; margin-inline: auto; }
.back { display: inline-flex; align-items: center; gap: .35rem; min-height: 2.75rem; margin-bottom: 1rem; color: var(--text-subtle); text-decoration: none; }
.page-head { display: flex; align-items: flex-end; justify-content: space-between; flex-wrap: wrap; gap: 1rem; margin-bottom: 1.25rem; }
.eyebrow { margin: 0; color: #b99bff; font-size: .7rem; font-weight: 800; letter-spacing: .16em; text-transform: uppercase; }
h1 { margin: .2rem 0; font-size: clamp(2.2rem, 6vw, 4rem); letter-spacing: -.04em; }
.sub { margin: 0; color: var(--text-muted); }
.head-actions { display: flex; align-items: center; gap: .75rem; }
.outline-link { display: inline-flex; align-items: center; gap: .4rem; min-height: 2.75rem; padding: .5rem .95rem; border: 1px solid var(--border-strong); border-radius: .7rem; color: var(--text); text-decoration: none; font-weight: 700; }
.message { margin: 0 0 1rem; padding: .8rem 1rem; border: 1px solid var(--border-strong); border-radius: .8rem; background: var(--surface-card); }
.message.error { border-color: #5a2a33; color: #ffb3bf; }
.outcome { display: flex; gap: .9rem; align-items: flex-start; margin-bottom: 1rem; padding: 1rem 1.1rem; border: 1px solid var(--border-strong); border-radius: 1rem; background: var(--surface-card); }
.outcome > svg { flex: none; width: 1.5rem; height: 1.5rem; margin-top: .1rem; }
.outcome > div { display: grid; gap: .25rem; }
.outcome span { color: var(--text-muted); }
.outcome.accepted { border-color: #2f5a42; background: #0f1a14; }
.outcome.accepted > svg { color: #4ade80; }
.outcome.declined { border-color: #5a2a33; background: #1a0f12; }
.outcome.declined > svg { color: #f3a7b2; }
.outcome.expired { border-color: #5b4a24; background: #1a160d; }
.outcome.expired > svg { color: #f2cf8a; }
.outcome-actions { margin-top: .5rem; }
.card { display: grid; gap: 1rem; margin-bottom: 1rem; padding: 1.25rem; border: 1px solid var(--border); border-radius: 1rem; background: var(--surface-card); }
.card h2 { margin: 0; font-size: 1.15rem; }
.section-title { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
.grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .9rem; }
.wide { grid-column: 1 / -1; }
label { display: grid; gap: .35rem; color: #c9c3ce; font-size: .8rem; font-weight: 650; }
input, select, textarea { width: 100%; min-height: 2.75rem; padding: .65rem .75rem; border: 1px solid var(--border-strong); border-radius: .65rem; background: var(--surface-input); color: var(--text); }
input:disabled, select:disabled, textarea:disabled { opacity: .65; }
.line { display: grid; grid-template-columns: minmax(0, 1fr) 5rem 7rem auto; gap: .5rem; align-items: center; }
.icon-button { display: grid; place-items: center; width: 2.75rem; height: 2.75rem; border: 1px solid var(--border-strong); border-radius: .65rem; background: transparent; color: var(--text-muted); cursor: pointer; }
.text-button { display: inline-flex; align-items: center; gap: .3rem; min-height: 2.75rem; border: 0; background: none; color: var(--electric-soft); font-weight: 700; cursor: pointer; }
.totals { display: grid; gap: .35rem; margin: .25rem 0 0; padding-top: .8rem; border-top: 1px solid var(--border); }
.totals div { display: flex; justify-content: space-between; color: var(--text-muted); }
.totals dd { margin: 0; }
.totals .grand { color: var(--text); font-size: 1.15rem; font-weight: 800; }
.save-bar { position: sticky; bottom: 0; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: .75rem; padding: .9rem 1rem; border: 1px solid var(--border-strong); border-radius: 1rem; background: rgba(16, 14, 20, .96); backdrop-filter: blur(10px); }
.save-bar > span { color: var(--text-muted); font-size: .88rem; }
.save-bar > div { display: flex; flex-wrap: wrap; gap: .5rem; }
.primary, .secondary, .primary-link { display: inline-flex; align-items: center; justify-content: center; min-height: 2.75rem; padding: .5rem 1.1rem; border: 1px solid transparent; border-radius: .7rem; font-weight: 800; cursor: pointer; text-decoration: none; }
.primary, .primary-link { background: var(--button-primary-bg); color: var(--button-primary-fg); }
.secondary { border-color: var(--border-strong); background: var(--button-secondary-bg); color: var(--button-secondary-fg); }
.danger-text { min-height: 2.75rem; padding: .5rem .8rem; border: 0; background: none; color: #f3a7b2; font-weight: 700; cursor: pointer; }
button:disabled { opacity: .5; cursor: not-allowed; }
.send-dialog { width: min(34rem, calc(100% - 2rem)); padding: 1.4rem; border: 1px solid #37313d; border-radius: 1rem; background: #141119; color: var(--text); }
.send-dialog::backdrop { background: rgba(5, 4, 7, .72); }
.send-dialog h2 { margin: 0 0 .35rem; font-size: 1.35rem; }
.dialog-lead { margin: 0 0 1.1rem; color: var(--text-muted); }
.dialog-lead strong { color: var(--text); }
.consequences { display: grid; gap: .85rem; margin: 0 0 1rem; padding: 0; list-style: none; }
.consequences li { display: flex; gap: .7rem; align-items: flex-start; color: #d6d1db; line-height: 1.5; }
.consequences svg { flex: none; width: 1.15rem; height: 1.15rem; margin-top: .2rem; color: var(--electric-soft); }
.blockers { margin-bottom: 1rem; padding: .85rem 1rem; border: 1px solid #5b4a24; border-radius: .8rem; background: #1a160d; color: #f2cf8a; }
.blockers ul { margin: .4rem 0 0; padding-left: 1.1rem; }
.preview-link { display: inline-flex; align-items: center; gap: .35rem; color: var(--electric-soft); }
.dialog-actions { display: flex; justify-content: flex-end; gap: .6rem; margin-top: 1.25rem; }
@media (max-width: 640px) {
  .grid { grid-template-columns: 1fr; }
  .line { grid-template-columns: minmax(0, 1fr) 4.2rem 6rem; }
  .line .icon-button { grid-column: 1 / -1; width: 100%; }
}
</style>
