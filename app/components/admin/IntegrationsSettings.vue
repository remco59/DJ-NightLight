<script setup lang="ts">
import { apiErrorMessage } from '~/utils/api-error'

type Source = 'settings' | 'environment' | 'none'
type CancellationBehavior = 'delete' | 'mark_cancelled' | 'keep'

type IntegrationsData = {
  calendar: {
    source: Source
    configured: boolean
    clientId: string
    clientSecretConfigured: boolean
    refreshTokenConfigured: boolean
    enabled: boolean
    calendarId: string
    cancellationBehavior: CancellationBehavior
  }
  email: {
    source: Source
    configured: boolean
    apiKeyConfigured: boolean
    apiKeyPreview: string | null
    from: string
    reviewUrl: string
  }
}

const { data, refresh } = await useFetch<IntegrationsData>('/api/admin/integrations')

const calendarForm = reactive({
  enabled: false,
  calendarId: 'primary',
  cancellationBehavior: 'delete' as CancellationBehavior,
})
const calendarCredentials = reactive({ clientId: '', clientSecret: '', refreshToken: '' })
const calendarEditingCredentials = ref(false)
const calendarMessage = ref('')
const calendarMessageType = ref<'success' | 'error' | ''>('')

const emailForm = reactive({ from: '', reviewUrl: '' })
const emailApiKey = ref('')
const emailEditingKey = ref(false)
const emailMessage = ref('')
const emailMessageType = ref<'success' | 'error' | ''>('')

const busy = ref('')

watchEffect(() => {
  if (!data.value) return
  calendarForm.enabled = data.value.calendar.enabled
  calendarForm.calendarId = data.value.calendar.calendarId
  calendarForm.cancellationBehavior = data.value.calendar.cancellationBehavior
  emailForm.from = data.value.email.from
  emailForm.reviewUrl = data.value.email.reviewUrl
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

const confirmAction = useConfirm()

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
  <section id="integrations" class="integrations">
    <div class="section-intro">
      <span class="section-icon"><Icon name="lucide:link-2" aria-hidden="true"/></span>
      <div>
        <p class="eyebrow">Gekoppelde diensten</p>
        <h2>Integraties</h2>
        <p>Koppel externe diensten om je workflow te automatiseren en meer uit NightLight te halen.</p>
      </div>
    </div>

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
        <NuxtLink class="text-link" to="/admin/email">E-mailautomatisering</NuxtLink>
        <button v-if="data.email.source === 'settings'" class="ghost danger" type="button" :disabled="busy === 'email-remove'" @click="removeEmailSettings">
          Integratie verwijderen
        </button>
      </div>
      <p v-if="emailMessage" class="message" :class="emailMessageType">{{ emailMessage }}</p>
    </article>

    <AdminStripeSetup/>
  </section>
</template>

<style scoped>
.integrations{margin-top:1rem;scroll-margin-top:1rem}
.section-intro{display:flex;gap:.8rem;align-items:flex-start;margin:1.4rem .1rem .85rem}
.section-icon{display:grid;place-items:center;flex:0 0 2.5rem;height:2.5rem;border-radius:.75rem;background:#241440;color:#b98cff}
.section-intro h2{margin:.1rem 0;font-size:1.3rem}
.section-intro p:last-child{max-width:680px;margin:.25rem 0 0;color:var(--text-subtle);font-size:.82rem;line-height:1.45}
.integration-card{margin-bottom:1rem;padding:1.15rem;border:1px solid var(--border);border-radius:1rem;background:linear-gradient(180deg,#111016,#0f0d13)}
.integration-head,.credential-head,.actions{display:flex;justify-content:space-between;gap:1rem;align-items:flex-start}
.integration-title{display:flex;gap:.8rem;align-items:center}
.brand-icon{display:grid;place-items:center;flex:0 0 2.5rem;height:2.5rem;border-radius:.75rem;background:#16131a;font-weight:900;font-size:1rem}
.brand-icon.google{color:#fff;background:linear-gradient(135deg,#2d6cdf,#34a853 45%,#fbbc05 70%,#ea4335)}
.brand-icon.resend{color:#fff;background:#171717}
.integration-head h3{margin:0 0 .2rem;font-size:1.05rem}
.integration-head p{margin:0;color:var(--text-subtle);font-size:.8rem}
.status-stack{display:grid;justify-items:end;gap:.25rem;flex:none}
.status-stack small{color:var(--text-subtle);font-size:.75rem}
.pill{display:inline-flex;align-items:center;gap:.4rem;padding:.28rem .68rem;border-radius:99px;background:var(--border);color:var(--text-muted);font-size:.7rem;font-weight:750}
.pill .dot{width:.42rem;height:.42rem;border-radius:50%;background:#7d7682}
.pill.on{background:#153426;color:#72e6a2}
.pill.on .dot{background:#48df89}
.form-grid,.credentials-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.8rem;margin-top:1rem}
.email-grid{grid-template-columns:1fr 1fr}
.wide{grid-column:1/-1}
label{display:grid;gap:.35rem;color:var(--text-muted);font-size:.78rem}
label small,.hint{color:var(--text-subtle);font-size:.72rem;line-height:1.45}
input,select{width:100%;border:1px solid var(--border-strong);border-radius:.65rem;padding:.72rem;background:#0a090c;color:var(--text)}
input:focus,select:focus{outline:none;border-color:#6741a1;box-shadow:0 0 0 3px rgba(103,65,161,.13)}
.toggle{display:flex;align-items:center;gap:.6rem;min-height:2.7rem}
.toggle input{width:auto;accent-color:#7a3eed}
.credential-panel{margin-top:1rem;padding:.85rem 1rem;border:1px solid var(--border);border-radius:.8rem;background:var(--surface-input)}
.credential-head{align-items:center}
.credential-head strong,.credential-head p{display:block}
.credential-head p{margin:.2rem 0 0;color:var(--text-subtle);font-size:.74rem;word-break:break-word}
.key-field{margin-top:.8rem}
.actions{justify-content:flex-start;align-items:center;flex-wrap:wrap;margin-top:1rem}
button{border:0;border-radius:.7rem;padding:.68rem 1rem;background:linear-gradient(135deg,#7737f2,#5c25d9);color:#fff;font-weight:800;cursor:pointer}
button:disabled{cursor:not-allowed;opacity:.55}
button.ghost{border:1px solid var(--border-strong);background:transparent;color:var(--text)}
button.danger{border-color:#552b34;color:#ff9d9d}
.text-link{display:inline-flex;align-items:center;min-height:2.75rem;margin-left:auto;color:#c9b2df;font-size:.78rem;text-decoration:none}
.message{margin:.8rem 0 0;font-size:.8rem}
.message.success{color:#8ed6a3}
.message.error{color:#ff9d9d}
@media(max-width:700px){
  .integration-head,.credential-head,.actions{align-items:stretch;flex-direction:column}
  .status-stack{justify-items:start}
  .form-grid,.email-grid,.credentials-grid{grid-template-columns:1fr}
  .wide{grid-column:auto}
  .actions button{width:100%}
  .text-link{margin-left:0}
}
</style>
