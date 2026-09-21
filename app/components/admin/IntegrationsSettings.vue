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
  if (source === 'settings') return 'Saved in NightLight'
  if (source === 'environment') return 'Server environment'
  return 'Not configured'
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
      calendarMessage.value = 'Enter the client ID, client secret and refresh token together.'
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
    calendarMessage.value = 'Google Calendar settings saved.'
    calendarMessageType.value = 'success'
  } catch (error: unknown) {
    calendarMessage.value = apiErrorMessage(error, 'Could not save Google Calendar settings.')
    calendarMessageType.value = 'error'
  } finally {
    busy.value = ''
  }
}

async function removeCalendarCredentials() {
  if (!confirm('Remove the Google Calendar credentials saved in NightLight? Environment credentials will still be used if they exist.')) return
  busy.value = 'calendar-remove'
  calendarMessage.value = ''
  try {
    await $fetch('/api/admin/integrations', { method: 'DELETE', body: { provider: 'calendar' } })
    await refresh()
    calendarMessage.value = data.value?.calendar.source === 'environment'
      ? 'Saved credentials removed. NightLight is using the server environment again.'
      : 'Saved Google Calendar credentials removed.'
    calendarMessageType.value = 'success'
  } catch (error: unknown) {
    calendarMessage.value = apiErrorMessage(error, 'Could not remove Google Calendar credentials.')
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
    emailMessage.value = 'Enter a Resend API key before enabling email delivery.'
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
    emailMessage.value = 'Email provider settings saved.'
    emailMessageType.value = 'success'
  } catch (error: unknown) {
    emailMessage.value = apiErrorMessage(error, 'Could not save email provider settings.')
    emailMessageType.value = 'error'
  } finally {
    busy.value = ''
  }
}

async function removeEmailSettings() {
  if (!confirm('Remove the email provider settings saved in NightLight? Environment settings will still be used if they exist.')) return
  busy.value = 'email-remove'
  emailMessage.value = ''
  try {
    await $fetch('/api/admin/integrations', { method: 'DELETE', body: { provider: 'email' } })
    await refresh()
    emailMessage.value = data.value?.email.source === 'environment'
      ? 'Saved email settings removed. NightLight is using the server environment again.'
      : 'Saved email provider settings removed.'
    emailMessageType.value = 'success'
  } catch (error: unknown) {
    emailMessage.value = apiErrorMessage(error, 'Could not remove email provider settings.')
    emailMessageType.value = 'error'
  } finally {
    busy.value = ''
  }
}
</script>

<template>
  <section id="integrations" class="integrations">
    <div class="section-intro">
      <div>
        <p class="eyebrow">Connected services</p>
        <h2>Integrations</h2>
        <p>Configure every external service here. Secrets saved in NightLight are encrypted and take precedence over server environment variables.</p>
      </div>
    </div>

    <article v-if="data" class="integration-card">
      <div class="integration-head">
        <div>
          <p class="eyebrow">Google</p>
          <h3>Google Calendar</h3>
          <p>Synchronize booked gigs one-way to your calendar.</p>
        </div>
        <div class="status-stack">
          <span class="pill" :class="{ on: data.calendar.configured }">{{ data.calendar.configured ? 'Connected' : 'Missing credentials' }}</span>
          <small>{{ sourceLabel(data.calendar.source) }}</small>
        </div>
      </div>

      <div class="form-grid">
        <label class="toggle">
          <input v-model="calendarForm.enabled" type="checkbox">
          <span>Enable calendar sync</span>
        </label>
        <label>
          Calendar ID
          <input v-model="calendarForm.calendarId" placeholder="primary">
        </label>
        <label>
          When a booked gig is cancelled
          <select v-model="calendarForm.cancellationBehavior">
            <option value="delete">Delete mapped event</option>
            <option value="mark_cancelled">Keep event and mark cancelled</option>
            <option value="keep">Leave event unchanged</option>
          </select>
        </label>
      </div>

      <div class="credential-panel">
        <div class="credential-head">
          <div>
            <strong>OAuth credentials</strong>
            <p v-if="data.calendar.configured">
              Client ID {{ data.calendar.clientId || 'configured' }} · secret configured · refresh token configured
            </p>
            <p v-else>Add a Google OAuth client ID, client secret and refresh token.</p>
          </div>
          <button v-if="!calendarEditingCredentials" class="ghost" type="button" @click="startCalendarCredentials">
            {{ data.calendar.configured ? 'Replace credentials' : 'Add credentials' }}
          </button>
        </div>

        <div v-if="calendarEditingCredentials" class="credentials-grid">
          <label>Client ID<input v-model="calendarCredentials.clientId" autocomplete="off" spellcheck="false"></label>
          <label>Client secret<input v-model="calendarCredentials.clientSecret" type="password" autocomplete="off" spellcheck="false"></label>
          <label class="wide">Refresh token<input v-model="calendarCredentials.refreshToken" type="password" autocomplete="off" spellcheck="false"></label>
          <p class="wide hint">Create OAuth credentials in Google Cloud, authorize Calendar access once, then paste the resulting refresh token here. Existing secrets are never shown again.</p>
        </div>
      </div>

      <div class="actions">
        <button type="button" :disabled="busy === 'calendar'" @click="saveCalendar">
          {{ busy === 'calendar' ? 'Saving…' : 'Save Google Calendar' }}
        </button>
        <button v-if="calendarEditingCredentials" class="ghost" type="button" @click="calendarEditingCredentials = false">Cancel credential change</button>
        <button v-if="data.calendar.source === 'settings'" class="ghost danger" type="button" :disabled="busy === 'calendar-remove'" @click="removeCalendarCredentials">
          Remove saved credentials
        </button>
      </div>
      <p v-if="calendarMessage" class="message" :class="calendarMessageType">{{ calendarMessage }}</p>
    </article>

    <article v-if="data" class="integration-card">
      <div class="integration-head">
        <div>
          <p class="eyebrow">Email</p>
          <h3>Resend</h3>
          <p>Send portal invitations, invoice emails, reminders and review requests.</p>
        </div>
        <div class="status-stack">
          <span class="pill" :class="{ on: data.email.configured }">{{ data.email.configured ? 'Connected' : 'Missing settings' }}</span>
          <small>{{ sourceLabel(data.email.source) }}</small>
        </div>
      </div>

      <div class="form-grid email-grid">
        <label>
          From address
          <input v-model="emailForm.from" placeholder="DJ NightLight (boekingen@example.com)">
        </label>
        <label>
          Review URL
          <input v-model="emailForm.reviewUrl" type="url" placeholder="https://…">
        </label>
      </div>

      <div class="credential-panel">
        <div class="credential-head">
          <div>
            <strong>Resend API key</strong>
            <p>{{ data.email.apiKeyConfigured ? (data.email.apiKeyPreview || 'Configured') : 'No API key configured' }}</p>
          </div>
          <button v-if="!emailEditingKey" class="ghost" type="button" @click="startEmailKey">
            {{ data.email.apiKeyConfigured ? 'Replace API key' : 'Add API key' }}
          </button>
        </div>
        <label v-if="emailEditingKey">
          New API key
          <input v-model="emailApiKey" type="password" autocomplete="off" spellcheck="false" placeholder="re_…">
          <small>The key is encrypted after saving and cannot be read back from the UI.</small>
        </label>
      </div>

      <div class="actions">
        <button type="button" :disabled="busy === 'email'" @click="saveEmail">
          {{ busy === 'email' ? 'Saving…' : 'Save email settings' }}
        </button>
        <button v-if="emailEditingKey" class="ghost" type="button" @click="emailEditingKey = false; emailApiKey = ''">Cancel key change</button>
        <button v-if="data.email.source === 'settings'" class="ghost danger" type="button" :disabled="busy === 'email-remove'" @click="removeEmailSettings">
          Remove saved settings
        </button>
        <NuxtLink class="text-link" to="/admin/email">Open email automation</NuxtLink>
      </div>
      <p v-if="emailMessage" class="message" :class="emailMessageType">{{ emailMessage }}</p>
    </article>

    <AdminStripeSetup/>
  </section>
</template>

<style scoped>
.integrations{margin-top:1.5rem;scroll-margin-top:1rem}
.section-intro{display:flex;justify-content:space-between;gap:1rem;margin-bottom:.9rem;padding:0 .1rem}
.section-intro h2{margin:.15rem 0;font-size:1.55rem}
.section-intro p:last-child{max-width:680px;margin:.3rem 0 0;color:#8c8594;line-height:1.5}
.integration-card{margin-bottom:1rem;padding:1.2rem;border:1px solid #2b2631;border-radius:1rem;background:#100e14}
.integration-head,.credential-head,.actions{display:flex;justify-content:space-between;gap:1rem;align-items:flex-start}
.integration-head h3{margin:.15rem 0 .3rem;font-size:1.2rem}
.integration-head p{margin:0;color:#8c8594;font-size:.85rem}
.status-stack{display:grid;justify-items:end;gap:.3rem;flex:none}
.status-stack small{color:#716a78;font-size:.72rem}
.pill{padding:.25rem .7rem;border-radius:99px;background:#2b2631;color:#aaa4b1;font-size:.75rem;font-weight:700}
.pill.on{background:#16382a;color:#7be0a8}
.form-grid,.credentials-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.8rem;margin-top:1rem}
.email-grid{grid-template-columns:1fr 1fr}
.wide{grid-column:1/-1}
label{display:grid;gap:.35rem;color:#aaa4b1;font-size:.8rem}
label small,.hint{color:#716a78;font-size:.75rem;line-height:1.45}
input,select{width:100%;border:1px solid #332e39;border-radius:.65rem;padding:.7rem;background:#0b0a0d;color:#f6f3fa}
.toggle{display:flex;align-items:center;gap:.6rem;min-height:2.7rem}
.toggle input{width:auto}
.credential-panel{margin-top:1rem;padding:1rem;border:1px solid #29242f;border-radius:.8rem;background:#0b0a0d}
.credential-head strong,.credential-head p{display:block}
.credential-head p{margin:.25rem 0 0;color:#777080;font-size:.78rem;word-break:break-word}
.actions{justify-content:flex-start;align-items:center;flex-wrap:wrap;margin-top:1rem}
button{border:0;border-radius:.7rem;padding:.7rem 1rem;background:#fff;color:#09080b;font-weight:800;cursor:pointer}
button:disabled{cursor:not-allowed;opacity:.55}
button.ghost{border:1px solid #332e39;background:transparent;color:#f6f3fa}
button.danger{color:#ff9d9d}
.text-link{margin-left:auto;color:#c9b2df;font-size:.82rem}
.message{margin:.8rem 0 0;font-size:.85rem}
.message.success{color:#8ed6a3}
.message.error{color:#ff9d9d}
@media(max-width:650px){
  .integration-head,.credential-head,.actions{align-items:stretch;flex-direction:column}
  .status-stack{justify-items:start}
  .form-grid,.email-grid,.credentials-grid{grid-template-columns:1fr}
  .wide{grid-column:auto}
  .actions button{width:100%}
  .text-link{margin-left:0}
}
</style>
