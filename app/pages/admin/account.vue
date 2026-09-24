<script setup lang="ts">
import { apiErrorMessage } from '~/utils/api-error'
definePageMeta({ layout: 'admin' })

const form = reactive({ currentPassword: '', newPassword: '', confirmPassword: '' })
const saving = ref(false)
const message = ref('')
const messageType = ref<'success'|'error'|''>('')

async function changePassword() {
  message.value = ''
  messageType.value = ''
  if (form.newPassword !== form.confirmPassword) {
    message.value = 'De nieuwe wachtwoorden komen niet overeen.'
    messageType.value = 'error'
    return
  }
  saving.value = true
  try {
    await $fetch('/api/admin/account/password', { method: 'POST', body: form })
    form.currentPassword = ''
    form.newPassword = ''
    form.confirmPassword = ''
    message.value = 'Wachtwoord gewijzigd. Andere ingelogde sessies zijn uitgelogd.'
    messageType.value = 'success'
  } catch (error: unknown) {
    message.value = apiErrorMessage(error, 'Wachtwoord wijzigen is niet gelukt.')
    messageType.value = 'error'
  } finally {
    saving.value = false
  }
}
useSeoMeta({ title: 'Mijn account — DJ NightLight', robots: 'noindex, nofollow' })
</script>

<template>
  <div class="account-page">
    <header><p class="eyebrow">Account</p><h1>Mijn account</h1><p>Beheer de beveiliging van je eigen NightLight-login.</p></header>
    <section class="card">
      <h2>Wachtwoord wijzigen</h2>
      <form @submit.prevent="changePassword">
        <label>Huidig wachtwoord<input v-model="form.currentPassword" type="password" autocomplete="current-password" required minlength="8"></label>
        <label>Nieuw wachtwoord<input v-model="form.newPassword" type="password" autocomplete="new-password" required minlength="12"><small>Gebruik minstens 12 tekens.</small></label>
        <label>Bevestig nieuw wachtwoord<input v-model="form.confirmPassword" type="password" autocomplete="new-password" required minlength="12"></label>
        <div class="actions"><span :class="messageType">{{ message }}</span><button :disabled="saving">{{ saving ? 'Wijzigen…' : 'Wachtwoord wijzigen' }}</button></div>
      </form>
    </section>
  </div>
</template>

<style scoped>
.account-page{max-width:760px;margin-inline:auto}header{margin-bottom:1.5rem}h1{margin:.2rem 0;font-size:clamp(2.5rem,6vw,4rem);letter-spacing:-.05em}header>p:last-child{color:#8c8594}.card{padding:1.25rem;border:1px solid #2b2631;border-radius:1rem;background:#100e14}.card h2{margin-top:0}form{display:grid;gap:.8rem}label{display:grid;gap:.35rem;color:#aaa4b1;font-size:.8rem}label small{color:#716a78}input{width:100%;border:1px solid #332e39;border-radius:.65rem;padding:.7rem;background:#0b0a0d;color:#f6f3fa}.actions{display:flex;align-items:center;justify-content:space-between;gap:1rem;margin-top:.3rem}.actions span{color:#aaa4b1}.actions .success{color:#8ed6a3}.actions .error{color:#ff9d9d}button{border:0;border-radius:.7rem;padding:.75rem 1rem;background:#fff;color:#09080b;font-weight:800}button:disabled{opacity:.6}@media(max-width:620px){.actions{align-items:stretch;flex-direction:column}.actions button{width:100%}}
</style>
