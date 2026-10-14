<script setup lang="ts">
import { apiErrorMessage } from '~/utils/api-error'
import type { IntegrationsData, Source } from '~/types/integrations'

const { data, refresh } = await useFetch<IntegrationsData>('/api/admin/integrations')
const busy = ref('')
const confirmAction = useConfirm()

const emailForm = reactive({ from: '', reviewUrl: '' })
const emailApiKey = ref('')
const emailEditingKey = ref(false)
const emailMessage = ref('')
const emailMessageType = ref<'success' | 'error' | ''>('')

watchEffect(() => {
  if (!data.value) return
  emailForm.from = data.value.email.from
  emailForm.reviewUrl = data.value.email.reviewUrl
})

function sourceLabel(source: Source) {
  if (source === 'settings') return 'Opgeslagen in NightLight'
  if (source === 'environment') return 'Serveromgeving'
  return 'Niet ingesteld'
}

function startEmailKey() {
  emailApiKey.value = ''
  emailEditingKey.value = true
  emailMessage.value = ''
}

async function saveEmail() {
  emailMessage.value = ''
  emailMessageType.value = ''
  if (!data.value?.email.apiKeyConfigured && !emailApiKey.value) {
    emailMessage.value = 'Vul een Resend API-sleutel in voordat je het versturen van e-mail inschakelt.'
    emailMessageType.value = 'error'
    return
  }

  busy.value = 'email'
  try {
    await $fetch('/api/admin/integrations', {
      method: 'PUT',
      body: {
        provider: 'email',
        from: emailForm.from,
        reviewUrl: emailForm.reviewUrl,
        ...(emailApiKey.value ? { apiKey: emailApiKey.value } : {}),
      },
    })
    emailApiKey.value = ''
    emailEditingKey.value = false
    await refresh()
    emailMessage.value = 'Instellingen voor de e-mailprovider opgeslagen.'
    emailMessageType.value = 'success'
  } catch (error: unknown) {
    emailMessage.value = apiErrorMessage(error, 'Instellingen voor de e-mailprovider opslaan is niet gelukt.')
    emailMessageType.value = 'error'
  } finally {
    busy.value = ''
  }
}

async function removeEmailSettings() {
  if (!(await confirmAction({ title: 'E-mailinstellingen verwijderen?', body: 'De in NightLight opgeslagen instellingen voor de e-mailprovider worden verwijderd. Instellingen uit de serveromgeving worden dan gebruikt als die er zijn.', confirmLabel: 'Verwijderen', tone: 'danger' }))) return
  busy.value = 'email-remove'
  emailMessage.value = ''
  try {
    await $fetch('/api/admin/integrations', { method: 'DELETE', body: { provider: 'email' } })
    await refresh()
    emailMessage.value = data.value?.email.source === 'environment'
      ? 'Opgeslagen e-mailinstellingen verwijderd. NightLight gebruikt weer de serveromgeving.'
      : 'Opgeslagen instellingen voor de e-mailprovider verwijderd.'
    emailMessageType.value = 'success'
  } catch (error: unknown) {
    emailMessage.value = apiErrorMessage(error, 'Instellingen voor de e-mailprovider verwijderen is niet gelukt.')
    emailMessageType.value = 'error'
  } finally {
    busy.value = ''
  }
}
</script>

<template>
  <section class="integration-page">
    <article v-if="data" class="integration-card">
      <div class="integration-head">
        <div class="integration-title">
          <span class="brand-icon resend"><Icon name="lucide:send" aria-hidden="true"/></span>
          <div>
            <h3>Resend</h3>
            <p>Verstuur portaaluitnodigingen, factuurmails, herinneringen en reviewverzoeken.</p>
          </div>
        </div>
        <div class="status-stack">
          <span class="pill" :class="{ on: data.email.configured }"><span class="dot"/>{{ data.email.configured ? 'Actief' : 'Niet ingesteld' }}</span>
          <small>{{ sourceLabel(data.email.source) }}</small>
        </div>
      </div>

      <div class="form-grid email-grid">
        <label>
          Afzenderadres
          <input v-model="emailForm.from" placeholder="DJ NightLight (boekingen@example.com)">
        </label>
        <label>
          Review-URL
          <input v-model="emailForm.reviewUrl" type="url" placeholder="https://…">
        </label>
      </div>

      <div class="credential-panel">
        <div class="credential-head">
          <div>
            <strong>API-sleutel</strong>
            <p>{{ data.email.apiKeyConfigured ? (data.email.apiKeyPreview || 'Veilig opgeslagen') : 'Geen API-sleutel ingesteld' }}</p>
          </div>
          <button v-if="!emailEditingKey" class="ghost" type="button" @click="startEmailKey">
            {{ data.email.apiKeyConfigured ? 'API-sleutel vervangen' : 'API-sleutel toevoegen' }}
          </button>
        </div>
        <label v-if="emailEditingKey" class="key-field">
          Nieuwe API-sleutel
          <input v-model="emailApiKey" type="password" autocomplete="off" spellcheck="false" placeholder="re_…">
          <small>De sleutel wordt na opslaan versleuteld en is daarna niet meer uit te lezen.</small>
        </label>
      </div>

      <div class="actions">
        <button type="button" :disabled="busy === 'email'" @click="saveEmail">
          {{ busy === 'email' ? 'Opslaan…' : 'Wijzigingen opslaan' }}
        </button>
        <button v-if="emailEditingKey" class="ghost" type="button" @click="emailEditingKey = false; emailApiKey = ''">Annuleren</button>
        <NuxtLink class="text-link" to="/admin/settings/emails">E-mailautomatisering</NuxtLink>
        <button v-if="data.email.source === 'settings'" class="ghost danger" type="button" :disabled="busy === 'email-remove'" @click="removeEmailSettings">
          Integratie verwijderen
        </button>
      </div>
      <p v-if="emailMessage" class="message" :class="emailMessageType">{{ emailMessage }}</p>
    </article>
  </section>
</template>
