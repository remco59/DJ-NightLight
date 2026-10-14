<script setup lang="ts">
import { apiErrorMessage } from '~/utils/api-error'
import { instagramAccountTypeLabels } from '~~/shared/instagram'
import type { IntegrationsData, Source } from '~/types/integrations'

const { data, refresh } = await useFetch<IntegrationsData>('/api/admin/integrations')
const busy = ref('')
const confirmAction = useConfirm()

function sourceLabel(source: Source) {
  if (source === 'settings') return 'Opgeslagen in NightLight'
  if (source === 'environment') return 'Serveromgeving'
  return 'Niet ingesteld'
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
  <section class="integration-page">
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
  </section>
</template>
