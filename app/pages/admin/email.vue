<script setup lang="ts">
import { apiErrorMessage } from '~/utils/api-error'
import { emailJobStatusLabels, emailTemplateLabels, gigStatusLabels, labelFor } from '~~/shared/labels'

definePageMeta({ layout: 'admin' })

type Template = {
  key: string
  name: string
  enabled: boolean
  subject: string
  body: string
  scheduleAnchor: 'event' | 'gig_start' | 'gig_end' | 'invoice_due'
  offsetMinutes: number
}
type Job = {
  id: string
  templateKey: string
  gigId: string | null
  recipient: string
  status: string
  attemptCount: number
  runAt: string
  sentAt: string | null
  lastError: string | null
  gigTitle: string | null
}
type Attempt = {
  id: string
  jobId: string
  status: string
  providerMessageId: string | null
  error: string | null
  attemptedAt: string
}
type EmailData = {
  providerConfigured: boolean
  templates: Template[]
  jobs: Job[]
  attempts: Attempt[]
  suppressions: Array<{ id: string, gigId: string, templateKey: string, gigTitle: string }>
  gigOptions: Array<{ id: string, title: string, startsAt: string | null, status: string }>
}

const { data, refresh } = await useFetch<EmailData>('/api/admin/email')
const selectedKey = ref('')
const form = reactive({
  enabled: true,
  subject: '',
  body: '',
  scheduleAnchor: 'event' as Template['scheduleAnchor'],
  offsetMinutes: 0,
})
const preview = ref<{ subject: string, body: string, html: string } | null>(null)
const testRecipient = ref('')
const suppressionGigId = ref('')
const suppressionTemplateKey = ref('')
const busy = ref('')
const message = ref('')

const selected = computed(() => data.value?.templates.find(item => item.key === selectedKey.value) || null)
const isSuppressed = computed(() => Boolean(data.value?.suppressions.some(
  item => item.gigId === suppressionGigId.value && item.templateKey === suppressionTemplateKey.value,
)))

watchEffect(() => {
  if (!selectedKey.value && data.value?.templates[0]) selectedKey.value = data.value.templates[0].key
  const template = selected.value
  if (!template) return
  form.enabled = template.enabled
  form.subject = template.subject
  form.body = template.body
  form.scheduleAnchor = template.scheduleAnchor
  form.offsetMinutes = template.offsetMinutes
  preview.value = null
})

const sampleVariables = {
  clientName: 'Sam',
  gigTitle: 'Bruiloft Sam & Noor',
  gigDate: '12 juni 2027 om 20:00',
  portalUrl: 'https://djnightlight.nl/client/voorbeeld',
  invoiceNumber: 'NL-2027-0012',
  invoiceTotal: '€ 950,00',
  invoiceDueDate: '12 juni 2027',
  reviewUrl: 'https://example.com/review',
}

async function saveTemplate() {
  if (!selected.value) return
  busy.value = 'save'
  message.value = ''
  try {
    await $fetch(`/api/admin/email/templates/${selected.value.key}`, { method: 'PUT', body: form })
    message.value = 'Template opgeslagen.'
    await refresh()
  } catch (error) {
    message.value = apiErrorMessage(error, 'Opslaan mislukt.')
  } finally {
    busy.value = ''
  }
}

async function makePreview() {
  if (!selected.value) return
  busy.value = 'preview'
  try {
    preview.value = await $fetch<{ subject: string, body: string, html: string }>('/api/admin/email/preview', {
      method: 'POST',
      body: { templateKey: selected.value.key, variables: sampleVariables },
    })
  } finally {
    busy.value = ''
  }
}

async function sendTest() {
  if (!selected.value || !testRecipient.value) return
  busy.value = 'test'
  message.value = ''
  try {
    await $fetch('/api/admin/email/test', {
      method: 'POST',
      body: { templateKey: selected.value.key, recipient: testRecipient.value, variables: sampleVariables },
    })
    message.value = 'Testmail verzonden.'
    await refresh()
  } catch (error) {
    message.value = apiErrorMessage(error, 'Testmail versturen mislukt.')
  } finally {
    busy.value = ''
  }
}

async function runAutomation() {
  busy.value = 'run'
  message.value = ''
  try {
    const result = await $fetch<{ processed: number, failed: number }>('/api/admin/email/run', { method: 'POST' })
    message.value = `Automatisering uitgevoerd: ${result.processed} verwerkt, ${result.failed} mislukt.`
    await refresh()
  } finally {
    busy.value = ''
  }
}

async function toggleSuppression() {
  if (!suppressionGigId.value || !suppressionTemplateKey.value) return
  busy.value = 'suppression'
  await $fetch('/api/admin/email/suppressions', {
    method: 'POST',
    body: {
      gigId: suppressionGigId.value,
      templateKey: suppressionTemplateKey.value,
      suppressed: !isSuppressed.value,
    },
  })
  await refresh()
  busy.value = ''
}

async function retry(jobId: string) {
  busy.value = jobId
  message.value = ''
  try {
    await $fetch('/api/admin/email/retry', { method: 'POST', body: { jobId } })
    message.value = 'E-mail opnieuw verstuurd.'
  } catch (error) {
    message.value = apiErrorMessage(error, 'Opnieuw proberen mislukt.')
  } finally {
    busy.value = ''
    await refresh()
  }
}

function formatDate(value: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('nl-NL', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
}

const anchorLabels: Record<Template['scheduleAnchor'], string> = {
  event: 'de gebeurtenis',
  gig_start: 'start gig',
  gig_end: 'einde gig',
  invoice_due: 'vervaldatum factuur',
}
function offsetLabel(template: Template) {
  if (template.scheduleAnchor === 'event') return `${template.offsetMinutes} min na de gebeurtenis`
  const amount = Math.abs(template.offsetMinutes)
  const direction = template.offsetMinutes < 0 ? 'voor' : 'na'
  return `${amount} min ${direction} ${anchorLabels[template.scheduleAnchor]}`
}
function templateName(key: string, fallback?: string) {
  return emailTemplateLabels[key] ?? fallback ?? labelFor(emailTemplateLabels, key)
}
</script>

<template>
  <div class="page">
    <header class="header">
      <div>
        <p class="eyebrow">Communicatie</p>
        <h1>Email</h1>
        <p>Bewerkbare templates, blijvende automatiseringstaken en verzendgeschiedenis.</p>
      </div>
      <div class="actions">
        <span class="provider" :class="{ ok: data?.providerConfigured }">
          {{ data?.providerConfigured ? 'Provider klaar' : 'Provider ontbreekt' }}
        </span>
        <NuxtLink class="settings-link" to="/admin/settings#integrations">Providerinstellingen</NuxtLink>
        <button type="button" :disabled="busy === 'run'" @click="runAutomation">
          {{ busy === 'run' ? 'Bezig…' : 'Automatiseringen uitvoeren' }}
        </button>
      </div>
    </header>

    <p v-if="message" class="message">{{ message }}</p>

    <section class="workspace">
      <aside class="template-list">
        <button
          v-for="template in data?.templates"
          :key="template.key"
          type="button"
          :class="{ active: selectedKey === template.key }"
          @click="selectedKey = template.key"
        >
          <strong>{{ templateName(template.key, template.name) }}</strong>
          <span>{{ template.enabled ? offsetLabel(template) : 'Uitgeschakeld' }}</span>
        </button>
      </aside>

      <div v-if="selected" class="editor panel">
        <div class="editor-head">
          <div>
            <p class="eyebrow">Template</p>
            <h2>{{ templateName(selected.key, selected.name) }}</h2>
          </div>
          <label class="toggle"><input v-model="form.enabled" type="checkbox"> Ingeschakeld</label>
        </div>

        <label>
          <span>Onderwerp</span>
          <input v-model="form.subject">
        </label>
        <label>
          <span>Tekst</span>
          <textarea v-model="form.body" rows="11" />
        </label>

        <div class="timing">
          <label>
            <span>Moment</span>
            <select v-model="form.scheduleAnchor">
              <option value="event">Bij gebeurtenis</option>
              <option value="gig_start">Start gig</option>
              <option value="gig_end">Einde gig</option>
              <option value="invoice_due">Vervaldatum factuur</option>
            </select>
          </label>
          <label>
            <span>Verschuiving in minuten</span>
            <input v-model.number="form.offsetMinutes" type="number">
          </label>
        </div>

        <div class="row-actions">
          <button class="primary" type="button" :disabled="busy === 'save'" @click="saveTemplate">Opslaan</button>
          <button type="button" :disabled="busy === 'preview'" @click="makePreview">Voorbeeld met testgegevens</button>
        </div>

        <div v-if="preview" class="preview">
          <div class="preview-head">
            <span>Voorbeeld e-mail</span>
            <strong>{{ preview.subject }}</strong>
          </div>
          <iframe
            class="email-preview"
            :srcdoc="preview.html"
            title="Voorbeeld van de e-mail in huisstijl"
            sandbox=""
          />
        </div>

        <div class="test-send">
          <input v-model="testRecipient" type="email" placeholder="E-mailadres voor testmail">
          <button type="button" :disabled="busy === 'test' || !data?.providerConfigured" @click="sendTest">
            {{ busy === 'test' ? 'Versturen…' : 'Testmail versturen' }}
          </button>
        </div>
      </div>
    </section>

    <section class="panel suppression">
      <div>
        <h2>Per gig uitschakelen</h2>
        <p>Schakel één automatisering uit voor één specifieke gig, zonder het algemene template te wijzigen.</p>
      </div>
      <select v-model="suppressionGigId">
        <option value="">Kies een gig</option>
        <option v-for="gig in data?.gigOptions" :key="gig.id" :value="gig.id">{{ gig.title }} · {{ labelFor(gigStatusLabels, gig.status) }}</option>
      </select>
      <select v-model="suppressionTemplateKey">
        <option value="">Kies een template</option>
        <option v-for="template in data?.templates" :key="template.key" :value="template.key">{{ templateName(template.key, template.name) }}</option>
      </select>
      <button type="button" :disabled="busy === 'suppression' || !suppressionGigId || !suppressionTemplateKey" @click="toggleSuppression">
        {{ isSuppressed ? 'Inschakelen voor deze gig' : 'Uitschakelen voor deze gig' }}
      </button>
    </section>

    <section class="panel">
      <div class="section-head">
        <div>
          <h2>Verzendtaken</h2>
          <p>Taken blijven bewaard na een herstart. Mislukte taken houden hun foutmelding en kun je opnieuw proberen.</p>
        </div>
        <button class="with-icon" type="button" @click="refresh()"><Icon name="lucide:refresh-cw" aria-hidden="true" />Vernieuwen</button>
      </div>
      <div class="history">
        <article v-for="job in data?.jobs" :key="job.id" class="history-row">
          <div>
            <strong>{{ templateName(job.templateKey) }}</strong>
            <span>{{ job.gigTitle || job.recipient }}</span>
          </div>
          <div>
            <span class="pill" :data-status="job.status">{{ labelFor(emailJobStatusLabels, job.status) }}</span>
            <small>{{ job.attemptCount }} poging(en) · gepland {{ formatDate(job.runAt) }}</small>
            <small v-if="job.lastError" class="error">{{ job.lastError }}</small>
          </div>
          <button v-if="job.status === 'failed'" class="with-icon" type="button" :disabled="busy === job.id" @click="retry(job.id)"><Icon name="lucide:rotate-ccw" aria-hidden="true" />Opnieuw proberen</button>
        </article>
        <p v-if="!data?.jobs.length" class="empty">Nog geen e-mailtaken.</p>
      </div>
    </section>

    <section class="panel">
      <h2>Verzendpogingen</h2>
      <div class="attempts">
        <div v-for="attempt in data?.attempts.slice(0, 30)" :key="attempt.id" class="attempt">
          <span class="pill" :data-status="attempt.status">{{ labelFor(emailJobStatusLabels, attempt.status) }}</span>
          <span>{{ formatDate(attempt.attemptedAt) }}</span>
          <span>{{ attempt.providerMessageId || attempt.error || '—' }}</span>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.page { max-width: 1180px; margin: 0 auto; }
.header, .section-head, .editor-head, .row-actions, .test-send, .history-row, .attempt, .actions { display: flex; gap: .8rem; align-items: center; }
.header, .section-head, .editor-head, .history-row { justify-content: space-between; align-items: flex-start; }
h1 { margin: .2rem 0; font-size: clamp(2.5rem, 6vw, 4.6rem); letter-spacing: -.05em; }
h2 { margin: 0 0 .35rem; }
p, small, .template-list span { color: #928a9a; }
button, input, textarea, select { border: 1px solid #35303b; border-radius: .65rem; background: #17141c; color: #fff; }
button { padding: .65rem .85rem; cursor: pointer; }
button:disabled { opacity: .45; cursor: not-allowed; }
input, textarea, select { width: 100%; padding: .72rem; }
textarea { resize: vertical; }
label { display: grid; gap: .4rem; margin-top: 1rem; color: #bbb4c2; font-size: .85rem; }
.toggle { display: flex; align-items: center; margin: 0; }
.toggle input { width: auto; }
.provider, .pill { border: 1px solid #48404f; border-radius: 999px; padding: .3rem .55rem; color: #aaa2b2; font-size: .7rem; text-transform: uppercase; letter-spacing: .08em; }
.provider.ok, .pill[data-status="sent"] { border-color: #315a45; color: #90c9a7; }
.settings-link { color: #c9b2df; font-size: .78rem; }
.pill[data-status="failed"] { border-color: #704048; color: #ef9aa7; }
.workspace { display: grid; grid-template-columns: 260px 1fr; gap: 1rem; margin-top: 1.5rem; }
.template-list { display: grid; gap: .4rem; align-content: start; }
.template-list button { display: grid; gap: .3rem; text-align: left; }
.template-list button.active { border-color: #82738f; background: #211c28; }
.panel { margin-top: 1rem; padding: 1.25rem; border: 1px solid #29242f; border-radius: 1rem; background: #121016; }
.workspace .panel { margin-top: 0; }
.timing { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
.row-actions { margin-top: 1rem; }
.primary { background: #fff; color: #0e0c11; border-color: #fff; font-weight: 700; }
.preview { margin-top: 1rem; padding: 1rem; border: 1px dashed #3a3342; border-radius: .8rem; }
.preview-head { display: grid; gap: .3rem; margin-bottom: .8rem; }
.preview-head span { color: #928a9a; font-size: .72rem; text-transform: uppercase; letter-spacing: .08em; }
.email-preview { display: block; width: 100%; min-height: 720px; border: 1px solid #2b2631; border-radius: .75rem; background: #09080b; }
.test-send { margin-top: 1rem; }
.suppression { display: grid; grid-template-columns: 2fr 1fr 1fr auto; gap: .8rem; align-items: end; }
.history { display: grid; }
.history-row { padding: .9rem 0; border-top: 1px solid #28232d; }
.history-row > div { display: grid; gap: .3rem; }
.history-row > div:nth-child(2) { min-width: 300px; }
.error { color: #ef9aa7; max-width: 520px; }
.attempts { display: grid; margin-top: .8rem; }
.attempt { padding: .65rem 0; border-top: 1px solid #28232d; grid-template-columns: 90px 150px 1fr; }
.message { padding: .75rem 1rem; border: 1px solid #3b3542; border-radius: .75rem; }
.empty { padding: 1rem 0; }
@media (max-width: 850px) {
  .workspace { grid-template-columns: 1fr; }
  .template-list { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .suppression { grid-template-columns: 1fr; }
  .header, .history-row { display: grid; }
  .history-row > div:nth-child(2) { min-width: 0; }
}
@media (max-width: 560px) {
  .template-list, .timing { grid-template-columns: 1fr; }
  .test-send, .row-actions { align-items: stretch; flex-direction: column; }
  .attempt { grid-template-columns: 1fr; }
}
</style>
