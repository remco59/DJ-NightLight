<script setup lang="ts">
import { apiErrorMessage } from '~/utils/api-error'
import { instagramAccountTypeLabels, type InstagramHealthLevel } from '~~/shared/instagram'

type Source = 'settings' | 'environment' | 'none'
type CancellationBehavior = 'delete' | 'mark_cancelled' | 'keep'

type InstagramStatus = {
  source: Source
  configured: boolean
  appIdPreview: string | null
  appSecretConfigured: boolean
  loginConfigId: string
  redirectUri: string
  account: {
    id: string
    username: string
    accountType: string | null
    externalIdPreview: string
    pageName: string | null
    status: 'active' | 'needs_reauth' | 'disabled'
    tokenIssuedAt: string
    tokenExpiresAt: string
    canPublish: boolean
    lastCheckedAt: string | null
    lastError: string | null
  } | null
  lastPublishedAt: string | null
  lastWorkerRunAt: string | null
  workerOnline: boolean
  health: { level: InstagramHealthLevel, title: string, detail: string }
}

type IntegrationsData = {
  instagram: InstagramStatus
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
const instagramMessages: Record<string, { text: string, type: 'success' | 'error' }> = {
  connected: { text: 'Instagram-account gekoppeld.', type: 'success' },
  choose: { text: 'Facebook gaf toegang tot meerdere Instagram-accounts. Kies hieronder welk account NightLight moet gebruiken.', type: 'success' },
  denied: { text: 'Je hebt geen toegang gegeven. Er is niets gekoppeld.', type: 'error' },
  state: { text: 'De koppelpoging is verlopen of ongeldig. Probeer het opnieuw.', type: 'error' },
  missing: { text: 'Stel eerst het app-ID en het app secret van de Meta-app in.', type: 'error' },
  error: { text: 'Koppelen is niet gelukt. Controleer het app-ID, het app secret, de redirect-URI en of het Instagram-account aan een Facebook-pagina is gekoppeld.', type: 'error' },
}

const instagramMessage = ref('')
const instagramMessageType = ref<'success' | 'error' | ''>('')
type InstagramChoice = { instagramId: string, username: string, pageId: string, pageName: string }
const choices = ref<InstagramChoice[]>([])
const choiceId = ref('')

const metaForm = reactive({ appId: '', appSecret: '', loginConfigId: '' })
const metaEditing = ref(false)
const metaMessage = ref('')
const metaMessageType = ref<'success' | 'error' | ''>('')

onMounted(() => {
  const url = new URL(window.location.href)
  const outcome = url.searchParams.get('instagram')
  if (!outcome) return
  const known = instagramMessages[outcome]
  const detail = url.searchParams.get('detail')
  if (known) {
    instagramMessage.value = detail && known.type === 'error' ? `${known.text} Meta meldt: ${detail}` : known.text
    instagramMessageType.value = known.type
  }
  url.searchParams.delete('instagram')
  url.searchParams.delete('detail')
  history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
  if (outcome === 'choose') void loadChoices()
})

const instagram = computed(() => data.value?.instagram)

function formatDay(value: string | null | undefined) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(value))
}

function formatMoment(value: string | null | undefined) {
  if (!value) return 'Nog niet'
  return new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

function relativeTime(value: string | null | undefined) {
  if (!value) return ''
  const seconds = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000))
  if (seconds < 60) return `${seconds} sec geleden`
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min geleden`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} uur geleden`
  return `${Math.floor(seconds / 86400)} dagen geleden`
}

function instagramPill() {
  const account = instagram.value?.account
  if (!account) return { on: false, text: instagram.value?.configured ? 'Niet verbonden' : 'Niet ingesteld' }
  if (account.status === 'active') return { on: true, text: 'Verbonden' }
  return { on: false, text: 'Opnieuw verbinden' }
}

function startMetaApp() {
  metaForm.appId = ''
  metaForm.appSecret = ''
  metaForm.loginConfigId = instagram.value?.loginConfigId || ''
  metaEditing.value = true
  metaMessage.value = ''
}

async function saveMetaApp() {
  metaMessage.value = ''
  metaMessageType.value = ''
  if (!metaForm.appId || !metaForm.appSecret) {
    metaMessage.value = 'Vul het app-ID en het app secret samen in.'
    metaMessageType.value = 'error'
    return
  }
  busy.value = 'meta'
  try {
    await $fetch('/api/admin/integrations', { method: 'PUT', body: { provider: 'instagram', ...metaForm } })
    metaEditing.value = false
    metaForm.appSecret = ''
    await refresh()
    metaMessage.value = 'Meta-app opgeslagen.'
    metaMessageType.value = 'success'
  } catch (error: unknown) {
    metaMessage.value = apiErrorMessage(error, 'Meta-app opslaan is niet gelukt.')
    metaMessageType.value = 'error'
  } finally {
    busy.value = ''
  }
}

async function removeMetaApp() {
  if (!(await confirmAction({ title: 'Meta-app-gegevens verwijderen?', body: 'Het app-ID en het app secret worden verwijderd. Een gekoppeld Instagram-account blijft staan, maar kan niet meer worden vernieuwd of opnieuw verbonden. Waarden uit de serveromgeving worden gebruikt als die er zijn.', confirmLabel: 'Verwijderen', tone: 'danger' }))) return
  busy.value = 'meta-remove'
  metaMessage.value = ''
  try {
    await $fetch('/api/admin/integrations', { method: 'DELETE', body: { provider: 'instagram' } })
    await refresh()
    metaMessage.value = 'Opgeslagen Meta-app-gegevens verwijderd.'
    metaMessageType.value = 'success'
  } catch (error: unknown) {
    metaMessage.value = apiErrorMessage(error, 'Meta-app-gegevens verwijderen is niet gelukt.')
    metaMessageType.value = 'error'
  } finally {
    busy.value = ''
  }
}

async function loadChoices() {
  try {
    const result = await $fetch<{ accounts: InstagramChoice[] }>('/api/admin/social/instagram/candidates')
    choices.value = result.accounts
    choiceId.value = result.accounts.length === 1 ? result.accounts[0]!.instagramId : ''
  } catch (error: unknown) {
    choices.value = []
    instagramMessage.value = apiErrorMessage(error, 'De Instagram-accounts ophalen is niet gelukt. Verbind opnieuw.')
    instagramMessageType.value = 'error'
  }
}

async function confirmChoice() {
  if (!choiceId.value) return
  busy.value = 'instagram-choose'
  instagramMessage.value = ''
  try {
    await $fetch('/api/admin/social/instagram/choose', { method: 'POST', body: { instagramId: choiceId.value } })
    choices.value = []
    choiceId.value = ''
    await refresh()
    instagramMessage.value = 'Instagram-account gekoppeld.'
    instagramMessageType.value = 'success'
  } catch (error: unknown) {
    instagramMessage.value = apiErrorMessage(error, 'Koppelen is niet gelukt.')
    instagramMessageType.value = 'error'
  } finally {
    busy.value = ''
  }
}

async function checkInstagramConnection() {
  busy.value = 'instagram-check'
  instagramMessage.value = ''
  try {
    await $fetch('/api/admin/social/instagram/check', { method: 'POST' })
    await refresh()
    instagramMessage.value = 'Verbinding gecontroleerd.'
    instagramMessageType.value = 'success'
  } catch (error: unknown) {
    await refresh()
    instagramMessage.value = apiErrorMessage(error, 'Verbinding controleren is niet gelukt.')
    instagramMessageType.value = 'error'
  } finally {
    busy.value = ''
  }
}

async function disconnectInstagram() {
  if (!(await confirmAction({ title: 'Instagram ontkoppelen?', body: 'NightLight verliest de toegang tot het account en verwijdert het opgeslagen token. Je kunt het account later opnieuw verbinden.', confirmLabel: 'Ontkoppelen', tone: 'danger' }))) return
  busy.value = 'instagram-remove'
  instagramMessage.value = ''
  try {
    await $fetch('/api/admin/social/instagram/account', { method: 'DELETE' })
    await refresh()
    instagramMessage.value = 'Instagram-account ontkoppeld.'
    instagramMessageType.value = 'success'
  } catch (error: unknown) {
    instagramMessage.value = apiErrorMessage(error, 'Ontkoppelen is niet gelukt.')
    instagramMessageType.value = 'error'
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

    <article v-if="instagram" id="instagram" class="integration-card">
      <div class="integration-head">
        <div class="integration-title">
          <span class="brand-icon instagram"><Icon name="lucide:instagram" aria-hidden="true"/></span>
          <div>
            <h3>Instagram</h3>
            <p>Publiceer en plan posts rechtstreeks vanuit NightLight.</p>
          </div>
        </div>
        <div class="status-stack">
          <span class="pill" :class="{ on: instagramPill().on }"><span class="dot"/>{{ instagramPill().text }}</span>
        </div>
      </div>

      <div v-if="instagram.account" class="account-row">
        <span class="brand-icon instagram small"><Icon name="lucide:at-sign" aria-hidden="true"/></span>
        <div>
          <strong>@{{ instagram.account.username }}</strong>
          <small>{{ instagramAccountTypeLabels[instagram.account.accountType || ''] || 'Professioneel account' }}<template v-if="instagram.account.pageName"> · Pagina {{ instagram.account.pageName }}</template> · ID {{ instagram.account.externalIdPreview }}</small>
        </div>
      </div>

      <div v-if="instagram.account" class="tiles">
        <div><small>Toegang geldig tot</small><strong>{{ formatDay(instagram.account.tokenExpiresAt) }}</strong></div>
        <div><small>Automatisch controleren</small><strong>Ja · dagelijks</strong></div>
        <div><small>Laatste publicatie</small><strong>{{ formatMoment(instagram.lastPublishedAt) }}</strong></div>
        <div><small>Laatste worker run</small><strong>{{ instagram.lastWorkerRunAt ? `${formatMoment(instagram.lastWorkerRunAt)} · ${relativeTime(instagram.lastWorkerRunAt)}` : 'Nog niet' }}</strong></div>
      </div>

      <div class="health" :class="instagram.health.level" role="status">
        <span class="dot"/>
        <div>
          <strong>{{ instagram.health.title }}</strong>
          <p>{{ instagram.health.detail }}</p>
        </div>
      </div>

      <div v-if="choices.length" class="chooser">
        <strong>Kies het Instagram-account voor NightLight</strong>
        <p>Facebook gaf toegang tot meerdere accounts. NightLight gebruikt er één. Koppel je later een ander account, dan vervangt dat het huidige.</p>
        <label v-for="choice in choices" :key="choice.instagramId" class="choice">
          <input v-model="choiceId" type="radio" name="instagram-choice" :value="choice.instagramId">
          <span><b>@{{ choice.username || choice.pageName }}</b><small>Pagina {{ choice.pageName }} · ID {{ choice.instagramId }}</small></span>
        </label>
        <div class="actions">
          <button type="button" :disabled="!choiceId || busy === 'instagram-choose'" @click="confirmChoice">
            {{ busy === 'instagram-choose' ? 'Koppelen…' : 'Dit account koppelen' }}
          </button>
          <button class="ghost" type="button" @click="choices = []">Annuleren</button>
        </div>
      </div>

      <div class="actions">
        <a v-if="instagram.configured" class="button-link" href="/api/admin/social/instagram/connect">
          {{ instagram.account ? 'Opnieuw verbinden' : 'Instagram verbinden' }}
        </a>
        <button v-else type="button" disabled>Instagram verbinden</button>
        <button v-if="instagram.account" class="ghost" type="button" :disabled="busy === 'instagram-check' || instagram.account.status !== 'active'" @click="checkInstagramConnection">
          {{ busy === 'instagram-check' ? 'Controleren…' : 'Verbinding controleren' }}
        </button>
        <button v-if="instagram.account" class="ghost danger" type="button" :disabled="busy === 'instagram-remove'" @click="disconnectInstagram">
          Ontkoppelen
        </button>
      </div>
      <p v-if="instagramMessage" class="message" :class="instagramMessageType">{{ instagramMessage }}</p>
    </article>

    <article v-if="instagram" id="meta-app" class="integration-card">
      <div class="integration-head">
        <div class="integration-title">
          <span class="brand-icon meta"><Icon name="lucide:key-round" aria-hidden="true"/></span>
          <div>
            <h3>Meta-app</h3>
            <p>App-gegevens worden versleuteld opgeslagen en zijn alleen voor de owner beheerbaar.</p>
          </div>
        </div>
        <div class="status-stack">
          <span class="pill" :class="{ on: instagram.configured }"><span class="dot"/>{{ instagram.configured ? 'Ingesteld' : 'Niet ingesteld' }}</span>
          <small>{{ sourceLabel(instagram.source) }}</small>
        </div>
      </div>

      <div class="credential-panel">
        <div class="credential-head">
          <div>
            <strong>App-gegevens</strong>
            <p v-if="instagram.configured">App-ID {{ instagram.appIdPreview }} · app secret veilig opgeslagen<template v-if="instagram.loginConfigId"> · configuratie-ID {{ instagram.loginConfigId }}</template></p>
            <p v-else>Voeg het app-ID en app secret van je Meta-app toe (Instellingen → Algemeen in de Meta-app).</p>
          </div>
          <button v-if="!metaEditing" class="ghost" type="button" @click="startMetaApp">
            {{ instagram.configured ? 'Wijzigen' : 'Toevoegen' }}
          </button>
        </div>
        <div v-if="metaEditing" class="credentials-grid">
          <label>App-ID<input v-model="metaForm.appId" inputmode="numeric" autocomplete="off" spellcheck="false"></label>
          <label>App secret<input v-model="metaForm.appSecret" type="password" autocomplete="off" spellcheck="false"></label>
          <label class="wide">Configuratie-ID (optioneel)<input v-model="metaForm.loginConfigId" inputmode="numeric" autocomplete="off" spellcheck="false"><small>Alleen nodig als Meta voor je app Facebook Login for Business met een configuratie vraagt.</small></label>
          <p class="wide hint">Bestaande geheimen worden nooit opnieuw getoond. Bij een andere app moet het Instagram-account opnieuw worden verbonden.</p>
        </div>
      </div>

      <div class="dev-note">
        <strong>Development mode</strong>
        <p>Werkt zolang je alleen publiceert naar het eigen NightLight-account en je zelf een rol op de Meta-app hebt.</p>
      </div>
      <p class="hint redirect">Redirect-URI (toevoegen bij Facebook Login → Valid OAuth Redirect URIs): <code>{{ instagram.redirectUri }}</code></p>

      <div v-if="metaEditing || instagram.source === 'settings'" class="actions">
        <button v-if="metaEditing" type="button" :disabled="busy === 'meta'" @click="saveMetaApp">
          {{ busy === 'meta' ? 'Opslaan…' : 'Opslaan' }}
        </button>
        <button v-if="metaEditing" class="ghost" type="button" @click="metaEditing = false">Annuleren</button>
        <button v-if="instagram.source === 'settings'" class="ghost danger" type="button" :disabled="busy === 'meta-remove'" @click="removeMetaApp">
          Gegevens verwijderen
        </button>
      </div>
      <p v-if="metaMessage" class="message" :class="metaMessageType">{{ metaMessage }}</p>
    </article>

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
.brand-icon.instagram{color:#fff;background:linear-gradient(135deg,#833ab4,#c13584 50%,#fd1d1d 80%,#fcb045)}
.brand-icon.meta{color:#fff;background:#0b57d0}
.brand-icon.small{flex-basis:2.1rem;height:2.1rem;font-size:.9rem}
.account-row{display:flex;gap:.75rem;align-items:center;margin-top:1rem;padding:.8rem 1rem;border:1px solid var(--border);border-radius:.8rem;background:var(--surface-input)}
.account-row strong,.account-row small{display:block}
.account-row small{margin-top:.15rem;color:var(--text-subtle);font-size:.72rem}
.tiles{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.7rem;margin-top:.8rem}
.tiles>div{padding:.75rem .9rem;border:1px solid var(--border);border-radius:.75rem;background:var(--surface-input)}
.tiles small{display:block;color:var(--text-subtle);font-size:.62rem;font-weight:750;letter-spacing:.04em;text-transform:uppercase}
.tiles strong{display:block;margin-top:.3rem;font-size:.82rem}
.health{display:flex;gap:.7rem;align-items:flex-start;margin-top:.9rem;padding:.8rem 1rem;border:1px solid var(--border);border-radius:.8rem;background:var(--surface-input)}
.health p{margin:.2rem 0 0;color:var(--text-subtle);font-size:.74rem;line-height:1.4}
.health .dot{flex:none;width:.5rem;height:.5rem;margin-top:.35rem;border-radius:50%;background:#7d7682}
.health.ok{border-color:#1e5a3b;background:#0f2118}
.health.ok .dot{background:#48df89}
.health.warning{border-color:#6b5320;background:#211b0d}
.health.warning .dot{background:#f2c14e}
.health.error{border-color:#6b2a33;background:#21100f}
.health.error .dot{background:#ff7d7d}
.dev-note{margin-top:.9rem;padding:.75rem 1rem;border-left:3px solid #7a3eed;background:#15101e}
.dev-note p{margin:.2rem 0 0;color:var(--text-subtle);font-size:.74rem}
.redirect{margin:.7rem 0 0;word-break:break-all}
.redirect code{color:var(--text-muted)}
.chooser{margin-top:.9rem;padding:.9rem 1rem;border:1px solid #4a3578;border-radius:.8rem;background:#15101e}
.chooser p{margin:.25rem 0 .7rem;color:var(--text-subtle);font-size:.74rem;line-height:1.4}
.choice{display:flex;align-items:center;gap:.7rem;margin-top:.5rem;padding:.65rem .8rem;border:1px solid var(--border);border-radius:.7rem;background:var(--surface-input);cursor:pointer}
.choice input{width:auto;accent-color:#7a3eed}
.choice b,.choice small{display:block}
.choice small{margin-top:.15rem;color:var(--text-subtle);font-size:.7rem}
.button-link{display:inline-flex;align-items:center;border-radius:.7rem;padding:.68rem 1rem;background:linear-gradient(135deg,#7737f2,#5c25d9);color:#fff;font-weight:800;text-decoration:none}
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
  .form-grid,.email-grid,.credentials-grid,.tiles{grid-template-columns:1fr}
  .wide{grid-column:auto}
  .actions button,.actions .button-link{width:100%;justify-content:center}
  .text-link{margin-left:0}
}
</style>
