<script setup lang="ts">
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
    message.value = 'Template saved.'
    await refresh()
  } catch (error) {
    message.value = error instanceof Error ? error.message : 'Saving failed.'
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
    message.value = 'Test email sent.'
    await refresh()
  } catch (error) {
    message.value = error instanceof Error ? error.message : 'Test send failed.'
  } finally {
    busy.value = ''
  }
}

async function runAutomation() {
  busy.value = 'run'
  message.value = ''
  try {
    const result = await $fetch<{ processed: number, failed: number }>('/api/admin/email/run', { method: 'POST' })
    message.value = `Automation run: ${result.processed} processed, ${result.failed} failed.`
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
    message.value = 'Email retry completed.'
  } catch (error) {
    message.value = error instanceof Error ? error.message : 'Retry failed.'
  } finally {
    busy.value = ''
    await refresh()
  }
}

function formatDate(value: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('nl-NL', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
}

function offsetLabel(template: Template) {
  if (template.scheduleAnchor === 'event') return `${template.offsetMinutes} min after event`
  const amount = Math.abs(template.offsetMinutes)
  const direction = template.offsetMinutes < 0 ? 'before' : 'after'
  return `${amount} min ${direction} ${template.scheduleAnchor.replace('_', ' ')}`
}
</script>

<template>
  <div class="page">
    <header class="header">
      <div>
        <p class="eyebrow">Operations</p>
        <h1>Email</h1>
        <p>Editable templates, persistent automation jobs and delivery history.</p>
      </div>
      <div class="actions">
        <span class="provider" :class="{ ok: data?.providerConfigured }">
          {{ data?.providerConfigured ? 'Provider ready' : 'Provider missing' }}
        </span>
        <NuxtLink class="settings-link" to="/admin/settings#integrations">Provider settings</NuxtLink>
        <button type="button" :disabled="busy === 'run'" @click="runAutomation">
          {{ busy === 'run' ? 'Running…' : 'Run automations' }}
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
          <strong>{{ template.name }}</strong>
          <span>{{ template.enabled ? offsetLabel(template) : 'Disabled' }}</span>
        </button>
      </aside>

      <div v-if="selected" class="editor panel">
        <div class="editor-head">
          <div>
            <p class="eyebrow">Template</p>
            <h2>{{ selected.name }}</h2>
          </div>
          <label class="toggle"><input v-model="form.enabled" type="checkbox"> Enabled</label>
        </div>

        <label>
          <span>Subject</span>
          <input v-model="form.subject">
        </label>
        <label>
          <span>Body</span>
          <textarea v-model="form.body" rows="11" />
        </label>

        <div class="timing">
          <label>
            <span>Timing anchor</span>
            <select v-model="form.scheduleAnchor">
              <option value="event">Event trigger</option>
              <option value="gig_start">Gig start</option>
              <option value="gig_end">Gig end</option>
              <option value="invoice_due">Invoice due date</option>
            </select>
          </label>
          <label>
            <span>Offset in minutes</span>
            <input v-model.number="form.offsetMinutes" type="number">
          </label>
        </div>

        <div class="row-actions">
          <button class="primary" type="button" :disabled="busy === 'save'" @click="saveTemplate">Save</button>
          <button type="button" :disabled="busy === 'preview'" @click="makePreview">Preview with sample data</button>
        </div>

        <div v-if="preview" class="preview">
          <div class="preview-head">
            <span>Email preview</span>
            <strong>{{ preview.subject }}</strong>
          </div>
          <iframe
            class="email-preview"
            :srcdoc="preview.html"
            title="Branded email preview"
            sandbox
          />
        </div>

        <div class="test-send">
          <input v-model="testRecipient" type="email" placeholder="Test recipient email">
          <button type="button" :disabled="busy === 'test' || !data?.providerConfigured" @click="sendTest">
            {{ busy === 'test' ? 'Sending…' : 'Send test' }}
          </button>
        </div>
      </div>
    </section>

    <section class="panel suppression">
      <div>
        <h2>Per-gig suppression</h2>
        <p>Disable one automation for one specific gig without changing the global template.</p>
      </div>
      <select v-model="suppressionGigId">
        <option value="">Select gig</option>
        <option v-for="gig in data?.gigOptions" :key="gig.id" :value="gig.id">{{ gig.title }} · {{ gig.status }}</option>
      </select>
      <select v-model="suppressionTemplateKey">
        <option value="">Select template</option>
        <option v-for="template in data?.templates" :key="template.key" :value="template.key">{{ template.name }}</option>
      </select>
      <button type="button" :disabled="busy === 'suppression' || !suppressionGigId || !suppressionTemplateKey" @click="toggleSuppression">
        {{ isSuppressed ? 'Enable for this gig' : 'Suppress for this gig' }}
      </button>
    </section>

    <section class="panel">
      <div class="section-head">
        <div>
          <h2>Delivery jobs</h2>
          <p>Jobs survive restarts. Failed jobs keep their error and can be retried.</p>
        </div>
        <button type="button" @click="refresh()">Refresh</button>
      </div>
      <div class="history">
        <article v-for="job in data?.jobs" :key="job.id" class="history-row">
          <div>
            <strong>{{ job.templateKey }}</strong>
            <span>{{ job.gigTitle || job.recipient }}</span>
          </div>
          <div>
            <span class="pill" :data-status="job.status">{{ job.status }}</span>
            <small>{{ job.attemptCount }} attempt(s) · run {{ formatDate(job.runAt) }}</small>
            <small v-if="job.lastError" class="error">{{ job.lastError }}</small>
          </div>
          <button v-if="job.status === 'failed'" type="button" :disabled="busy === job.id" @click="retry(job.id)">Retry</button>
        </article>
        <p v-if="!data?.jobs.length" class="empty">No email jobs yet.</p>
      </div>
    </section>

    <section class="panel">
      <h2>Delivery attempts</h2>
      <div class="attempts">
        <div v-for="attempt in data?.attempts.slice(0, 30)" :key="attempt.id" class="attempt">
          <span class="pill" :data-status="attempt.status">{{ attempt.status }}</span>
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
