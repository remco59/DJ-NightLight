<script setup lang="ts">
definePageMeta({ layout: 'admin' })
useSeoMeta({ title: 'Bedrijfsgegevens — DJ NightLight', robots: 'noindex, nofollow' })

const { data, refresh } = await useFetch<{ settings: BusinessSettings }>('/api/admin/business-settings')
const { form, saving, message, failed, save } = useBusinessSettingsForm(data, async () => { await refresh() }, 'Bedrijfsgegevens opgeslagen.')
</script>

<template>
  <AdminSettingsForm title="Bedrijfsgegevens" description="Deze informatie wordt gebruikt op facturen, in communicatie en in je klantenportaal." icon="lucide:building-2" :saving="saving" :message="message" :failed="failed" @save="save">
    <label>Bedrijfsnaam<input v-model="form.companyName" required></label>
    <label>Adres<input v-model="form.address"></label>
    <label>Postcode<input v-model="form.postalCode"></label>
    <label>Plaats<input v-model="form.city"></label>
    <label>Land<input v-model="form.country"></label>
    <label>E-mail<input v-model="form.email" type="email"></label>
    <label>Telefoon<input v-model="form.phone"></label>
    <label>KvK-nummer<input v-model="form.registrationNumber"></label>
    <label>BTW-nummer<input v-model="form.vatNumber"></label>
    <label>IBAN<input v-model="form.iban"></label>
  </AdminSettingsForm>
</template>
