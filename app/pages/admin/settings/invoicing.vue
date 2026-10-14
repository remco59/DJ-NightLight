<script setup lang="ts">
definePageMeta({ layout: 'admin' })
useSeoMeta({ title: 'Facturatie — DJ NightLight', robots: 'noindex, nofollow' })

const { data, refresh } = await useFetch<{ settings: BusinessSettings }>('/api/admin/business-settings')
const { form, saving, message, failed, save } = useBusinessSettingsForm(data, async () => { await refresh() }, 'Factuurinstellingen opgeslagen.')

function setVatRate(event: Event) {
  form.defaultVatRateBasisPoints = Math.round(Number((event.target as HTMLInputElement).value) * 100)
}
</script>

<template>
  <AdminSettingsForm title="Facturatie" description="Stel factuurnummering, betaling en juridische standaardteksten in." icon="lucide:receipt-text" :saving="saving" :message="message" :failed="failed" @save="save">
    <label>Voorvoegsel factuurnummer<input v-model="form.invoicePrefix" required></label>
    <label>Volgend nummer<input :value="form.nextInvoiceNumber" disabled><small>Loopt automatisch op bij definitief maken.</small></label>
    <label>BTW-berekening<select v-model="form.defaultVatMode"><option value="exclusive">Prijzen exclusief btw</option><option value="inclusive">Prijzen inclusief btw</option><option value="exempt">Geen btw / vrijgesteld</option></select></label>
    <label>BTW-tarief (%)<input :value="form.defaultVatRateBasisPoints / 100" type="number" min="0" max="100" step="0.01" @input="setVatRate"></label>
    <label>Betalingstermijn (dagen)<input v-model.number="form.defaultPaymentTermDays" type="number" min="0" max="365"></label>
    <label class="wide">Betalingsvoorwaarden<textarea v-model="form.paymentTerms" rows="3" /></label>
    <label class="wide">Juridische tekst<textarea v-model="form.legalText" rows="4" /></label>
  </AdminSettingsForm>
</template>
