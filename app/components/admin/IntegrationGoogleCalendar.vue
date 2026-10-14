<script setup lang="ts">
import { apiErrorMessage } from '~/utils/api-error'
import type { CancellationBehavior, IntegrationsData, Source } from '~/types/integrations'

const { data, refresh } = await useFetch<IntegrationsData>('/api/admin/integrations')
const busy = ref('')
const confirmAction = useConfirm()

const calendarForm = reactive({
  enabled: false,
  calendarId: 'primary',
  cancellationBehavior: 'delete' as CancellationBehavior,
})
const calendarCredentials = reactive({ clientId: '', clientSecret: '', refreshToken: '' })
const calendarEditingCredentials = ref(false)
const calendarMessage = ref('')
const calendarMessageType = ref<'success' | 'error' | ''>('')

watchEffect(() => {
  if (!data.value) return
  calendarForm.enabled = data.value.calendar.enabled
  calendarForm.calendarId = data.value.calendar.calendarId
  calendarForm.cancellationBehavior = data.value.calendar.cancellationBehavior
})

function sourceLabel(source: Source) {
  if (source === 'settings') return 'Opgeslagen in NightLight'
  if (source === 'environment') return 'Serveromgeving'
  return 'Niet ingesteld'
}

function startCalendarCredentials() {
  calendarCredentials.clientId = data.value?.calendar.clientId || ''
  calendarCredentials.clientSecret = ''
  calendarCredentials.refreshToken = ''
  calendarEditingCredentials.value = true
  calendarMessage.value = ''
}

async function saveCalendar() {
  calendarMessage.value = ''
  calendarMessageType.value = ''

  const payload: {
    provider: 'calendar'
    enabled: boolean
    calendarId: string
    cancellationBehavior: CancellationBehavior
    credentials?: { clientId: string, clientSecret: string, refreshToken: string }
  } = { provider: 'calendar', ...calendarForm }

  if (calendarEditingCredentials.value) {
    if (!calendarCredentials.clientId || !calendarCredentials.clientSecret || !calendarCredentials.refreshToken) {
      calendarMessage.value = 'Vul de client-ID, het client secret en de refresh token samen in.'
      calendarMessageType.value = 'error'
      return
    }
    payload.credentials = { ...calendarCredentials }
  }

  busy.value = 'calendar'
  try {
    await $fetch('/api/admin/integrations', { method: 'PUT', body: payload })
    calendarEditingCredentials.value = false
    calendarCredentials.clientSecret = ''
    calendarCredentials.refreshToken = ''
    await refresh()
    calendarMessage.value = 'Instellingen voor Google Calendar opgeslagen.'
    calendarMessageType.value = 'success'
  } catch (error: unknown) {
    calendarMessage.value = apiErrorMessage(error, 'Instellingen voor Google Calendar opslaan is niet gelukt.')
    calendarMessageType.value = 'error'
  } finally {
    busy.value = ''
  }
}

async function removeCalendarCredentials() {
  if (!(await confirmAction({ title: 'Google Calendar-gegevens verwijderen?', body: 'De in NightLight opgeslagen inloggegevens worden verwijderd. Inloggegevens uit de serveromgeving worden dan gebruikt als die er zijn.', confirmLabel: 'Verwijderen', tone: 'danger' }))) return
  busy.value = 'calendar-remove'
  calendarMessage.value = ''
  try {
    await $fetch('/api/admin/integrations', { method: 'DELETE', body: { provider: 'calendar' } })
    await refresh()
    calendarMessage.value = data.value?.calendar.source === 'environment'
      ? 'Opgeslagen inloggegevens verwijderd. NightLight gebruikt weer de serveromgeving.'
      : 'Opgeslagen inloggegevens voor Google Calendar verwijderd.'
    calendarMessageType.value = 'success'
  } catch (error: unknown) {
    calendarMessage.value = apiErrorMessage(error, 'Inloggegevens voor Google Calendar verwijderen is niet gelukt.')
    calendarMessageType.value = 'error'
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
          <span class="brand-icon google">G</span>
          <div>
            <h3>Google Calendar</h3>
            <p>Synchroniseer geboekte gigs in één richting naar je agenda.</p>
          </div>
        </div>
        <div class="status-stack">
          <span class="pill" :class="{ on: data.calendar.configured }"><span class="dot"/>{{ data.calendar.configured ? 'Gekoppeld' : 'Niet gekoppeld' }}</span>
          <small>{{ sourceLabel(data.calendar.source) }}</small>
        </div>
      </div>

      <div class="form-grid">
        <label class="toggle">
          <input v-model="calendarForm.enabled" type="checkbox">
          <span>Agendasynchronisatie inschakelen</span>
        </label>
        <label>
          Agenda-ID
          <input v-model="calendarForm.calendarId" placeholder="primary">
        </label>
        <label class="wide">
          Als een geboekte gig wordt geannuleerd
          <select v-model="calendarForm.cancellationBehavior">
            <option value="delete">Gekoppelde afspraak verwijderen</option>
            <option value="mark_cancelled">Afspraak behouden en als geannuleerd markeren</option>
            <option value="keep">Afspraak ongewijzigd laten</option>
          </select>
        </label>
      </div>

      <div class="credential-panel">
        <div class="credential-head">
          <div>
            <strong>OAuth-inloggegevens</strong>
            <p v-if="data.calendar.configured">Client-ID {{ data.calendar.clientId || 'ingesteld' }} · geheimen veilig opgeslagen</p>
            <p v-else>Voeg een Google OAuth client-ID, client secret en refresh token toe.</p>
          </div>
          <button v-if="!calendarEditingCredentials" class="ghost" type="button" @click="startCalendarCredentials">
            {{ data.calendar.configured ? 'Inloggegevens vervangen' : 'Inloggegevens toevoegen' }}
          </button>
        </div>

        <div v-if="calendarEditingCredentials" class="credentials-grid">
          <label>Client-ID<input v-model="calendarCredentials.clientId" autocomplete="off" spellcheck="false"></label>
          <label>Client secret<input v-model="calendarCredentials.clientSecret" type="password" autocomplete="off" spellcheck="false"></label>
          <label class="wide">Refresh token<input v-model="calendarCredentials.refreshToken" type="password" autocomplete="off" spellcheck="false"></label>
          <p class="wide hint">Bestaande geheimen worden nooit opnieuw getoond. Nieuwe gegevens worden versleuteld opgeslagen.</p>
        </div>
      </div>

      <div class="actions">
        <button type="button" :disabled="busy === 'calendar'" @click="saveCalendar">
          {{ busy === 'calendar' ? 'Opslaan…' : 'Wijzigingen opslaan' }}
        </button>
        <button v-if="calendarEditingCredentials" class="ghost" type="button" @click="calendarEditingCredentials = false">Annuleren</button>
        <button v-if="data.calendar.source === 'settings'" class="ghost danger" type="button" :disabled="busy === 'calendar-remove'" @click="removeCalendarCredentials">
          Koppeling verwijderen
        </button>
      </div>
      <p v-if="calendarMessage" class="message" :class="calendarMessageType">{{ calendarMessage }}</p>
    </article>
  </section>
</template>
