<script setup lang="ts">
import { apiErrorMessage } from '~/utils/api-error'
import { emailJobStatusLabels, emailTemplateLabels, gigStatusLabels, labelFor } from '~~/shared/labels'
import { normalizeEmailText } from '~~/shared/email-automation'

definePageMeta({ layout: 'admin' })
useSeoMeta({ title: 'E-mails — DJ NightLight', robots: 'noindex, nofollow' })

type Template = {
  key: string
  name: string
  enabled: boolean
  subject: string
  body: string
  scheduleAnchor: 'event' | 'gig_start' | 'gig_end' | 'invoice_due'
  offsetMinutes: number
  heroImageUrl: string | null
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
  branding: { defaultHeroImageUrl: string | null }
  templates: Template[]
  jobs: Job[]
  attempts: Attempt[]
  suppressions: Array<{ id: string, gigId: string, templateKey: string, gigTitle: string }>
  gigOptions: Array<{ id: string, title: string, startsAt: string | null, status: string }>
}

type EmailTab = 'templates' | 'automations' | 'deliveries' | 'settings'
type OffsetUnit = 'minutes' | 'hours' | 'days'

const { data, refresh } = await useFetch<EmailData>('/api/admin/email')
const activeTab = ref<EmailTab>('templates')
const selectedKey = ref('')
const templateSearch = ref('')
const jobSearch = ref('')
const jobStatusFilter = ref('all')
const selectedJobId = ref('')
const previewMode = ref<'desktop' | 'mobile'>('desktop')
const form = reactive<{
  enabled: boolean
  subject: string
  body: string
  scheduleAnchor: Template['scheduleAnchor']
  offsetMinutes: number
  heroImageUrl: string | null
}>({
  enabled: true,
  subject: '',
  body: '',
  scheduleAnchor: 'event',
  offsetMinutes: 0,
  heroImageUrl: null,
})
const defaultHeroImageUrl = ref<string | null>(data.value?.branding.defaultHeroImageUrl ?? null)
const preview = ref<{ subject: string, body: string, html: string } | null>(null)
const testRecipient = ref('')
const suppressionGigId = ref('')
const suppressionTemplateKey = ref('')
const busy = ref('')
const message = ref('')

const selected = computed(() => data.value?.templates.find(item => item.key === selectedKey.value) || null)
const selectedJob = computed(() => data.value?.jobs.find(item => item.id === selectedJobId.value) || null)
const selectedJobAttempts = computed(() => data.value?.attempts.filter(item => item.jobId === selectedJobId.value) ?? [])
const isSuppressed = computed(() => Boolean(data.value?.suppressions.some(
  item => item.gigId === suppressionGigId.value && item.templateKey === suppressionTemplateKey.value,
)))

const unitMinutes: Record<OffsetUnit, number> = { minutes: 1, hours: 60, days: 1440 }
const offset = reactive({ amount: 0, unit: 'days' as OffsetUnit, direction: 'after' as 'before' | 'after' })
function loadOffset(minutes: number) {
  const absolute = Math.abs(minutes)
  offset.unit = absolute && absolute % 1440 === 0 ? 'days' : absolute && absolute % 60 === 0 ? 'hours' : absolute ? 'minutes' : 'days'
  offset.amount = absolute / unitMinutes[offset.unit]
  offset.direction = minutes < 0 ? 'before' : 'after'
}
watch(offset, () => {
  const minutes = Math.round(Math.max(0, Number(offset.amount) || 0) * unitMinutes[offset.unit])
  form.offsetMinutes = form.scheduleAnchor !== 'event' && offset.direction === 'before' ? -minutes : minutes
})
watch(() => form.scheduleAnchor, (anchor) => { if (anchor === 'event') offset.direction = 'after' })

function loadTemplate(template: Template) {
  form.enabled = template.enabled
  form.subject = template.subject
  form.body = normalizeEmailText(template.body)
  form.scheduleAnchor = template.scheduleAnchor
  form.offsetMinutes = template.offsetMinutes
  form.heroImageUrl = template.heroImageUrl
  loadOffset(template.offsetMinutes)
  preview.value = null
}

watchEffect(() => {
  if (!selectedKey.value && data.value?.templates[0]) selectedKey.value = data.value.templates[0].key
  const template = selected.value
  if (template) loadTemplate(template)
})

const isDirty = computed(() => {
  const template = selected.value
  if (!template) return false
  return form.enabled !== template.enabled
    || form.subject !== template.subject
    || form.body !== normalizeEmailText(template.body)
    || form.scheduleAnchor !== template.scheduleAnchor
    || form.offsetMinutes !== template.offsetMinutes
    || form.heroImageUrl !== template.heroImageUrl
})
const pendingKey = ref('')
function selectTemplate(key: string) {
  if (key === selectedKey.value) return
  if (isDirty.value) { pendingKey.value = key; return }
  selectedKey.value = key
}
function discardAndSwitch() {
  const key = pendingKey.value
  pendingKey.value = ''
  if (selected.value) loadTemplate(selected.value)
  selectedKey.value = key
}
onBeforeRouteLeave(() => {
  if (isDirty.value && !window.confirm('Je hebt niet-opgeslagen wijzigingen in deze e-mail. Toch weggaan?')) return false
})
function warnBeforeUnload(event: BeforeUnloadEvent) { if (isDirty.value) event.preventDefault() }
onMounted(() => window.addEventListener('beforeunload', warnBeforeUnload))
onBeforeUnmount(() => window.removeEventListener('beforeunload', warnBeforeUnload))

const sampleVariables = {
  clientName: 'Sam',
  gigTitle: 'Bruiloft Sam & Noor',
  gigDate: '12 juni 2027 om 20:00',
  portalUrl: 'https://djnightlight.nl/client/voorbeeld',
  invoiceUrl: 'https://djnightlight.nl/client/voorbeeld',
  invoiceNumber: 'NL-2027-0012',
  invoiceTotal: '€ 950,00',
  invoiceDueDate: '12 juni 2027',
  reviewUrl: 'https://example.com/review',
}
const variableOptions = [
  ['clientName', 'Klantnaam'],
  ['gigTitle', 'Gignaam'],
  ['gigDate', 'Gigdatum'],
  ['portalUrl', 'Klantenportaal-link'],
  ['invoiceUrl', 'Factuurlink'],
  ['invoiceNumber', 'Factuurnummer'],
  ['invoiceTotal', 'Factuurbedrag'],
  ['invoiceDueDate', 'Vervaldatum'],
  ['reviewUrl', 'Reviewlink'],
]
function appendVariable(target: 'subject' | 'body', event: Event) {
  const select = event.target as HTMLSelectElement
  if (!select.value) return
  const token = `{{${select.value}}}`
  form[target] += `${form[target] && !form[target].endsWith(' ') ? ' ' : ''}${token}`
  select.value = ''
}

async function saveBranding() {
  busy.value = 'branding'
  message.value = ''
  try {
    const result = await $fetch<{ imageUrl: string | null }>('/api/admin/email/branding', {
      method: 'PUT',
      body: { imageUrl: defaultHeroImageUrl.value },
    })
    defaultHeroImageUrl.value = result.imageUrl
    message.value = 'Standaardfoto voor e-mails opgeslagen.'
    await refresh()
  } catch (error) {
    message.value = apiErrorMessage(error, 'Standaardfoto opslaan mislukt.')
  } finally {
    busy.value = ''
  }
}

async function saveTemplate() {
  if (!selected.value) return
  busy.value = 'save'
  message.value = ''
  try {
    await $fetch(`/api/admin/email/templates/${selected.value.key}`, { method: 'PUT', body: form })
    message.value = 'Template opgeslagen.'
    await refresh()
    if (pendingKey.value) { selectedKey.value = pendingKey.value; pendingKey.value = '' }
  } catch (error) {
    message.value = apiErrorMessage(error, 'Opslaan mislukt.')
  } finally {
    busy.value = ''
  }
}

async function setTemplateEnabled(template: Template, enabled: boolean) {
  busy.value = `toggle-${template.key}`
  message.value = ''
  try {
    await $fetch(`/api/admin/email/templates/${template.key}`, {
      method: 'PUT',
      body: {
        enabled,
        subject: template.subject,
        body: template.body,
        scheduleAnchor: template.scheduleAnchor,
        offsetMinutes: template.offsetMinutes,
        heroImageUrl: template.heroImageUrl,
      },
    })
    await refresh()
    if (selectedKey.value === template.key) form.enabled = enabled
  } catch (error) {
    message.value = apiErrorMessage(error, 'Automatisering bijwerken mislukt.')
  } finally {
    busy.value = ''
  }
}

async function makePreview(silent = false) {
  if (!selected.value) return
  if (!silent) busy.value = 'preview'
  try {
    preview.value = await $fetch<{ subject: string, body: string, html: string }>('/api/admin/email/preview', {
      method: 'POST',
      body: {
        templateKey: selected.value.key,
        variables: sampleVariables,
        subject: form.subject,
        body: form.body,
        heroImageUrl: form.heroImageUrl,
      },
    })
  } finally {
    if (!silent) busy.value = ''
  }
}

let previewTimer: ReturnType<typeof setTimeout> | undefined
watch([
  () => selectedKey.value,
  () => form.subject,
  () => form.body,
  () => form.heroImageUrl,
], () => {
  if (previewTimer) clearTimeout(previewTimer)
  previewTimer = setTimeout(() => { void makePreview(true) }, 450)
})
onBeforeUnmount(() => { if (previewTimer) clearTimeout(previewTimer) })

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

const confirmAction = useConfirm()
const dueJobs = computed(() => (data.value?.jobs ?? []).filter(job => job.status === 'pending' && new Date(job.runAt).getTime() <= Date.now()))

async function runAutomation() {
  const due = dueJobs.value.length
  const recipients = [...new Set(dueJobs.value.map(job => job.recipient))]
  const ok = await confirmAction({
    title: 'Automatiseringen nu uitvoeren?',
    body: due
      ? `${due} ${due === 1 ? 'e-mail staat' : 'e-mails staan'} klaar en ${due === 1 ? 'wordt' : 'worden'} direct verstuurd naar ${recipients.slice(0, 3).join(', ')}${recipients.length > 3 ? ` en ${recipients.length - 3} anderen` : ''}. E-mails die voor later gepland staan blijven wachten.`
      : 'Er staan nu geen e-mails klaar. NightLight controleert alleen of er nieuwe automatische e-mails moeten worden ingepland.',
    confirmLabel: due ? 'Nu versturen' : 'Controleren',
  })
  if (!ok) return
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

async function setSuppression(gigId: string, templateKey: string, suppressed: boolean) {
  busy.value = `suppression-${gigId}-${templateKey}`
  message.value = ''
  try {
    await $fetch('/api/admin/email/suppressions', {
      method: 'POST',
      body: { gigId, templateKey, suppressed },
    })
    await refresh()
  } catch (error) {
    message.value = apiErrorMessage(error, 'Uitzondering bijwerken mislukt.')
  } finally {
    busy.value = ''
  }
}
async function toggleSuppression() {
  if (!suppressionGigId.value || !suppressionTemplateKey.value) return
  await setSuppression(suppressionGigId.value, suppressionTemplateKey.value, !isSuppressed.value)
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
function durationLabel(minutes: number) {
  if (minutes % 1440 === 0) return `${minutes / 1440} ${minutes === 1440 ? 'dag' : 'dagen'}`
  if (minutes % 60 === 0) return `${minutes / 60} uur`
  return `${minutes} ${minutes === 1 ? 'minuut' : 'minuten'}`
}
function offsetLabel(template: Template) {
  const amount = Math.abs(template.offsetMinutes)
  if (template.scheduleAnchor === 'event') return amount ? `${durationLabel(amount)} na de gebeurtenis` : 'Direct bij de gebeurtenis'
  if (!amount) return `Bij ${anchorLabels[template.scheduleAnchor]}`
  const direction = template.offsetMinutes < 0 ? 'voor' : 'na'
  return `${durationLabel(amount)} ${direction} ${anchorLabels[template.scheduleAnchor]}`
}
function templateName(key: string, fallback?: string) {
  return emailTemplateLabels[key] ?? fallback ?? labelFor(emailTemplateLabels, key)
}

const categories = [
  { label: 'Boekingen', keys: ['lead_acknowledgement', 'booking_accepted'] },
  { label: 'Facturen', keys: ['invoice_sent', 'payment_reminder', 'overdue_reminder', 'payment_received'] },
  { label: 'Klantenportaal', keys: ['client_portal_invitation', 'portal_reminder'] },
  { label: 'Rondom de gig', keys: ['pre_gig_reminder', 'thank_you', 'review_request'] },
  { label: 'Overig', keys: ['custom_message'] },
]
const groupedTemplates = computed(() => {
  const templates = data.value?.templates ?? []
  const query = templateSearch.value.trim().toLowerCase()
  const seen = new Set<string>()
  const result = categories.map(category => {
    const items = category.keys
      .map(key => templates.find(template => template.key === key))
      .filter((template): template is Template => Boolean(template))
      .filter(template => !query || templateName(template.key, template.name).toLowerCase().includes(query))
    items.forEach(template => seen.add(template.key))
    return { ...category, items }
  })
  const remaining = templates.filter(template => !seen.has(template.key))
    .filter(template => !query || templateName(template.key, template.name).toLowerCase().includes(query))
  if (remaining.length) result.push({ label: 'Overige templates', keys: [], items: remaining })
  return result.filter(group => group.items.length)
})

const jobCounts = computed(() => {
  const jobs = data.value?.jobs ?? []
  return {
    pending: jobs.filter(job => job.status === 'pending').length,
    sent: jobs.filter(job => job.status === 'sent').length,
    failed: jobs.filter(job => job.status === 'failed').length,
    suppressed: jobs.filter(job => job.status === 'suppressed' || job.status === 'cancelled').length,
  }
})
const filteredJobs = computed(() => {
  const query = jobSearch.value.trim().toLowerCase()
  return (data.value?.jobs ?? []).filter((job) => {
    if (jobStatusFilter.value !== 'all' && job.status !== jobStatusFilter.value) return false
    if (!query) return true
    return [templateName(job.templateKey), job.gigTitle, job.recipient].filter(Boolean).some(value => value!.toLowerCase().includes(query))
  })
})
const suppressionGroups = computed(() => {
  const groups = new Map<string, { gigId: string, gigTitle: string, items: EmailData['suppressions'] }>()
  for (const item of data.value?.suppressions ?? []) {
    const current = groups.get(item.gigId) ?? { gigId: item.gigId, gigTitle: item.gigTitle, items: [] }
    current.items.push(item)
    groups.set(item.gigId, current)
  }
  return [...groups.values()]
})
</script>

<template>
  <div class="page">
    <header class="header">
      <div>
        <p class="eyebrow">Communicatie</p>
        <h1>E-mails</h1>
        <p>Beheer templates, automatiseringen, uitzonderingen en verzendgeschiedenis vanuit één communicatiecentrum.</p>
      </div>
      <div class="header-actions">
        <span class="provider" :class="{ ok: data?.providerConfigured }">
          {{ data?.providerConfigured ? 'Provider klaar' : 'Provider ontbreekt' }}
        </span>
        <NuxtLink class="settings-link" to="/admin/settings#integrations">Providerinstellingen</NuxtLink>
      </div>
    </header>

    <nav class="tabs" aria-label="E-mailbeheer">
      <button :class="{ active: activeTab === 'templates' }" type="button" @click="activeTab = 'templates'">Templates</button>
      <button :class="{ active: activeTab === 'automations' }" type="button" @click="activeTab = 'automations'">Automatiseringen</button>
      <button :class="{ active: activeTab === 'deliveries' }" type="button" @click="activeTab = 'deliveries'">Verzendingen</button>
      <button :class="{ active: activeTab === 'settings' }" type="button" @click="activeTab = 'settings'">Instellingen</button>
    </nav>

    <p v-if="message" class="message">{{ message }}</p>

    <template v-if="activeTab === 'templates'">
      <section class="brand-strip">
        <div class="brand-thumb" :class="{ empty: !defaultHeroImageUrl }">
          <img v-if="defaultHeroImageUrl" :src="defaultHeroImageUrl" alt="">
          <Icon v-else name="lucide:image" aria-hidden="true" />
        </div>
        <div>
          <strong>Globale stijl</strong>
          <span>Templates gebruiken standaard deze headerfoto.</span>
        </div>
        <button type="button" @click="activeTab = 'settings'">Headerfoto wijzigen</button>
      </section>

      <section class="template-workspace">
        <aside class="template-sidebar panel">
          <div class="search-field">
            <Icon name="lucide:search" aria-hidden="true" />
            <input v-model="templateSearch" type="search" placeholder="Zoek template…" aria-label="Zoek template">
          </div>
          <div v-for="group in groupedTemplates" :key="group.label" class="template-group">
            <h3>{{ group.label }}</h3>
            <button
              v-for="template in group.items"
              :key="template.key"
              type="button"
              :class="{ active: selectedKey === template.key }"
              :aria-current="selectedKey === template.key ? 'true' : undefined"
              @click="selectTemplate(template.key)"
            >
              <span class="status-dot" :class="{ enabled: template.enabled }" />
              <span>
                <strong>{{ templateName(template.key, template.name) }}</strong>
                <small>{{ template.enabled ? offsetLabel(template) : 'Uitgeschakeld' }}</small>
              </span>
            </button>
          </div>
        </aside>

        <div v-if="selected" class="editor panel">
          <div class="editor-head">
            <div>
              <div class="title-row">
                <h2>{{ templateName(selected.key, selected.name) }}</h2>
                <span class="active-badge" :class="{ on: form.enabled }">{{ form.enabled ? 'Actief' : 'Uit' }}</span>
              </div>
              <p>{{ form.enabled ? 'Automatisch verzonden volgens de ingestelde timing.' : 'Deze automatisering is momenteel uitgeschakeld.' }}</p>
            </div>
            <label class="switch"><input v-model="form.enabled" type="checkbox"><span /> <b>{{ form.enabled ? 'Aan' : 'Uit' }}</b></label>
          </div>

          <div v-if="pendingKey" class="unsaved" role="alert">
            <span>Je hebt niet-opgeslagen wijzigingen in deze e-mail.</span>
            <div>
              <button type="button" class="primary" :disabled="busy === 'save'" @click="saveTemplate">Opslaan en doorgaan</button>
              <button type="button" @click="discardAndSwitch">Wijzigingen weggooien</button>
              <button type="button" class="link" @click="pendingKey = ''">Blijven</button>
            </div>
          </div>

          <div class="field-block">
            <div class="field-heading"><span>Onderwerp</span><select aria-label="Variabele invoegen in onderwerp" @change="appendVariable('subject', $event)"><option value="">+ Variabele invoegen</option><option v-for="option in variableOptions" :key="option[0]" :value="option[0]">{{ option[1] }}</option></select></div>
            <input v-model="form.subject">
          </div>
          <div class="field-block">
            <div class="field-heading"><span>Inhoud</span><select aria-label="Variabele invoegen in inhoud" @change="appendVariable('body', $event)"><option value="">+ Variabele invoegen</option><option v-for="option in variableOptions" :key="option[0]" :value="option[0]">{{ option[1] }}</option></select></div>
            <textarea v-model="form.body" rows="12" />
          </div>

          <div class="timing-card">
            <div>
              <span>Wanneer versturen?</span>
              <strong>{{ offsetLabel({ ...selected, scheduleAnchor: form.scheduleAnchor, offsetMinutes: form.offsetMinutes }) }}</strong>
            </div>
            <div class="timing-controls">
              <select v-model="form.scheduleAnchor" aria-label="Moment">
                <option value="event">Bij gebeurtenis</option>
                <option value="gig_start">Start gig</option>
                <option value="gig_end">Einde gig</option>
                <option value="invoice_due">Vervaldatum factuur</option>
              </select>
              <input v-model.number="offset.amount" type="number" min="0" step="1" aria-label="Aantal">
              <select v-model="offset.unit" aria-label="Eenheid"><option value="minutes">minuten</option><option value="hours">uur</option><option value="days">dagen</option></select>
              <select v-if="form.scheduleAnchor !== 'event'" v-model="offset.direction" aria-label="Voor of na"><option value="before">ervoor</option><option value="after">erna</option></select>
            </div>
          </div>

          <details class="image-settings">
            <summary>Afbeelding voor deze e-mail <small>{{ form.heroImageUrl ? 'Eigen afbeelding' : 'Globale headerfoto' }}</small></summary>
            <MediaPicker v-model="form.heroImageUrl" label="Headerfoto voor deze e-mail" description="Laat leeg om de globale standaardfoto te gebruiken." kind="image" upload-tags="email" />
          </details>

          <div class="row-actions">
            <button class="primary" type="button" :disabled="busy === 'save'" @click="saveTemplate">{{ busy === 'save' ? 'Opslaan…' : 'Opslaan' }}</button>
            <span v-if="isDirty" class="dirty-note">Niet-opgeslagen wijzigingen</span>
          </div>
        </div>

        <aside v-if="selected" class="preview-panel panel">
          <div class="preview-toolbar">
            <div><span>Live preview</span><small>Voorbeelddata: Bruiloft Sam & Noor</small></div>
            <div class="preview-modes"><button type="button" :class="{ active: previewMode === 'desktop' }" @click="previewMode = 'desktop'"><Icon name="lucide:monitor" aria-hidden="true" /></button><button type="button" :class="{ active: previewMode === 'mobile' }" @click="previewMode = 'mobile'"><Icon name="lucide:smartphone" aria-hidden="true" /></button></div>
          </div>
          <div class="preview-frame" :class="previewMode">
            <iframe v-if="preview" class="email-preview" :srcdoc="preview.html" title="Voorbeeld van de e-mail in huisstijl" sandbox="" />
            <div v-else class="preview-loading"><Icon name="lucide:mail" aria-hidden="true" /><span>Voorbeeld laden…</span></div>
          </div>
          <button class="refresh-preview" type="button" :disabled="busy === 'preview'" @click="makePreview()"><Icon name="lucide:refresh-cw" aria-hidden="true" />Voorbeeld verversen</button>
          <div class="test-send">
            <input v-model="testRecipient" type="email" aria-label="E-mailadres voor testmail" placeholder="E-mailadres voor testmail">
            <button type="button" :disabled="busy === 'test' || !data?.providerConfigured || !testRecipient" @click="sendTest">{{ busy === 'test' ? 'Versturen…' : 'Testmail sturen' }}</button>
          </div>
        </aside>
      </section>
    </template>

    <template v-else-if="activeTab === 'automations'">
      <section class="section-intro">
        <div><h2>Automatische e-mails</h2><p>Deze e-mails worden automatisch verstuurd op basis van gebeurtenissen in NightLight.</p></div>
        <button class="primary with-icon" type="button" :disabled="busy === 'run'" @click="runAutomation"><Icon name="lucide:play" aria-hidden="true" />{{ busy === 'run' ? 'Bezig…' : 'Nu controleren' }}</button>
      </section>

      <section class="automation-list panel">
        <article v-for="template in data?.templates" :key="template.key" class="automation-row">
          <div class="automation-icon"><Icon name="lucide:mail" aria-hidden="true" /></div>
          <div class="automation-copy"><strong>{{ templateName(template.key, template.name) }}</strong><span>{{ offsetLabel(template) }}</span></div>
          <span class="automation-timing">{{ offsetLabel(template) }}</span>
          <label class="switch"><input :checked="template.enabled" type="checkbox" :disabled="busy === `toggle-${template.key}`" @change="setTemplateEnabled(template, ($event.target as HTMLInputElement).checked)"><span /><b>{{ template.enabled ? 'Aan' : 'Uit' }}</b></label>
          <button class="icon-button" type="button" aria-label="Template bewerken" @click="selectedKey = template.key; activeTab = 'templates'"><Icon name="lucide:chevron-right" aria-hidden="true" /></button>
        </article>
      </section>

      <section class="section-intro secondary-intro">
        <div><h2>Per gig uitschakelen</h2><p>Maak uitzonderingen zonder de algemene automatisering te wijzigen.</p></div>
        <div class="suppression-create">
          <select v-model="suppressionGigId" aria-label="Gig"><option value="">Kies een gig</option><option v-for="gig in data?.gigOptions" :key="gig.id" :value="gig.id">{{ gig.title }} · {{ labelFor(gigStatusLabels, gig.status) }}</option></select>
          <select v-model="suppressionTemplateKey" aria-label="E-mail"><option value="">Kies een template</option><option v-for="template in data?.templates" :key="template.key" :value="template.key">{{ templateName(template.key, template.name) }}</option></select>
          <button class="primary" type="button" :disabled="!suppressionGigId || !suppressionTemplateKey || busy.startsWith('suppression-')" @click="toggleSuppression">{{ isSuppressed ? 'Inschakelen' : '+ Uitschakelen' }}</button>
        </div>
      </section>
      <section class="suppression-grid">
        <article v-for="group in suppressionGroups" :key="group.gigId" class="suppression-card panel">
          <div class="gig-avatar"><Icon name="lucide:calendar-days" aria-hidden="true" /></div>
          <div class="suppression-content"><strong>{{ group.gigTitle }}</strong><small>{{ group.items.length }} {{ group.items.length === 1 ? 'uitzondering' : 'uitzonderingen' }}</small><div class="suppression-tags"><span v-for="item in group.items" :key="item.id">{{ templateName(item.templateKey) }} <button type="button" aria-label="Uitzondering verwijderen" @click="setSuppression(item.gigId, item.templateKey, false)">×</button></span></div></div>
        </article>
        <p v-if="!suppressionGroups.length" class="empty panel">Er zijn nog geen uitzonderingen ingesteld.</p>
      </section>
    </template>

    <template v-else-if="activeTab === 'deliveries'">
      <section class="stat-grid">
        <button type="button" class="stat-card panel" :class="{ active: jobStatusFilter === 'pending' }" @click="jobStatusFilter = 'pending'"><Icon name="lucide:clock-3" aria-hidden="true" /><div><strong>{{ jobCounts.pending }}</strong><span>In wachtrij</span></div></button>
        <button type="button" class="stat-card panel" :class="{ active: jobStatusFilter === 'sent' }" @click="jobStatusFilter = 'sent'"><Icon name="lucide:circle-check" aria-hidden="true" /><div><strong>{{ jobCounts.sent }}</strong><span>Verzonden</span></div></button>
        <button type="button" class="stat-card panel" :class="{ active: jobStatusFilter === 'failed' }" @click="jobStatusFilter = 'failed'"><Icon name="lucide:triangle-alert" aria-hidden="true" /><div><strong>{{ jobCounts.failed }}</strong><span>Mislukt</span></div></button>
        <button type="button" class="stat-card panel" :class="{ active: jobStatusFilter === 'suppressed' }" @click="jobStatusFilter = 'suppressed'"><Icon name="lucide:pause" aria-hidden="true" /><div><strong>{{ jobCounts.suppressed }}</strong><span>Uitgeschakeld</span></div></button>
      </section>

      <section class="delivery-toolbar panel">
        <div class="search-field"><Icon name="lucide:search" aria-hidden="true" /><input v-model="jobSearch" type="search" placeholder="Zoeken…" aria-label="Zoek verzending"></div>
        <select v-model="jobStatusFilter" aria-label="Filter op status"><option value="all">Alle statussen</option><option value="pending">In wachtrij</option><option value="sent">Verzonden</option><option value="failed">Mislukt</option><option value="suppressed">Uitgeschakeld</option><option value="cancelled">Geannuleerd</option></select>
        <button class="with-icon" type="button" @click="refresh()"><Icon name="lucide:refresh-cw" aria-hidden="true" />Vernieuwen</button>
      </section>

      <section class="delivery-layout" :class="{ 'has-detail': selectedJob }">
        <div class="delivery-table panel">
          <div class="delivery-head"><span>E-mail</span><span>Gig / ontvanger</span><span>Gepland / verzonden</span><span>Status</span><span /></div>
          <button v-for="job in filteredJobs" :key="job.id" type="button" class="delivery-row" :class="{ selected: selectedJobId === job.id }" @click="selectedJobId = job.id">
            <span><strong>{{ templateName(job.templateKey) }}</strong><small>{{ job.attemptCount }} poging(en)</small></span>
            <span>{{ job.gigTitle || job.recipient }}</span>
            <span>{{ formatDate(job.sentAt || job.runAt) }}</span>
            <span><i class="pill" :data-status="job.status">{{ labelFor(emailJobStatusLabels, job.status) }}</i><small v-if="job.lastError" class="error">{{ job.lastError }}</small></span>
            <Icon name="lucide:chevron-right" aria-hidden="true" />
          </button>
          <p v-if="!filteredJobs.length" class="empty">Geen verzendingen gevonden.</p>
        </div>

        <aside v-if="selectedJob" class="delivery-detail panel">
          <div class="detail-head"><div><span class="pill" :data-status="selectedJob.status">{{ labelFor(emailJobStatusLabels, selectedJob.status) }}</span><h2>{{ templateName(selectedJob.templateKey) }}</h2><p>{{ selectedJob.gigTitle || selectedJob.recipient }}</p></div><button class="icon-button" type="button" aria-label="Sluiten" @click="selectedJobId = ''"><Icon name="lucide:x" aria-hidden="true" /></button></div>
          <dl><div><dt>Ontvanger</dt><dd>{{ selectedJob.recipient }}</dd></div><div><dt>Gepland</dt><dd>{{ formatDate(selectedJob.runAt) }}</dd></div><div><dt>Verzonden</dt><dd>{{ formatDate(selectedJob.sentAt) }}</dd></div><div><dt>Pogingen</dt><dd>{{ selectedJob.attemptCount }}</dd></div></dl>
          <p v-if="selectedJob.lastError" class="error-box">{{ selectedJob.lastError }}</p>
          <button v-if="selectedJob.status === 'failed'" class="primary with-icon" type="button" :disabled="busy === selectedJob.id" @click="retry(selectedJob.id)"><Icon name="lucide:rotate-ccw" aria-hidden="true" />Opnieuw proberen</button>
          <details class="technical"><summary>Technische details</summary><div v-for="attempt in selectedJobAttempts" :key="attempt.id" class="attempt-row"><span class="pill" :data-status="attempt.status">{{ labelFor(emailJobStatusLabels, attempt.status) }}</span><span>{{ formatDate(attempt.attemptedAt) }}</span><code>{{ attempt.providerMessageId || attempt.error || '—' }}</code></div><p v-if="!selectedJobAttempts.length">Nog geen verzendpogingen.</p></details>
        </aside>
      </section>
    </template>

    <template v-else>
      <section class="settings-grid">
        <div class="panel settings-card">
          <div><p class="eyebrow">Huisstijl</p><h2>Standaard headerfoto</h2><p>Deze afbeelding wordt gebruikt voor alle e-mails, tenzij een template een eigen foto heeft.</p></div>
          <MediaPicker v-model="defaultHeroImageUrl" label="Globale standaardfoto" description="Kies uit de mediabibliotheek of gebruik een externe HTTPS-afbeelding." kind="image" upload-tags="email" />
          <button class="primary" type="button" :disabled="busy === 'branding'" @click="saveBranding">{{ busy === 'branding' ? 'Opslaan…' : 'Standaardfoto opslaan' }}</button>
        </div>
        <div class="panel settings-card">
          <div><p class="eyebrow">Verzending</p><h2>E-mailprovider</h2><p>NightLight gebruikt de ingestelde provider om automatische en handmatige e-mails te verzenden.</p></div>
          <div class="provider-state"><span class="provider" :class="{ ok: data?.providerConfigured }">{{ data?.providerConfigured ? 'Provider klaar' : 'Provider ontbreekt' }}</span><NuxtLink class="primary button-link" to="/admin/settings#integrations">Providerinstellingen openen</NuxtLink></div>
        </div>
        <div class="panel settings-card">
          <div><p class="eyebrow">Automatisering</p><h2>Handmatig controleren</h2><p>Controleer direct of er nieuwe e-mails moeten worden ingepland of verzonden.</p></div>
          <button class="primary with-icon" type="button" :disabled="busy === 'run'" @click="runAutomation"><Icon name="lucide:play" aria-hidden="true" />{{ busy === 'run' ? 'Bezig…' : 'Automatiseringen uitvoeren' }}</button>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.page { max-width: 1480px; margin: 0 auto; padding-bottom: 3rem; }
.header, .header-actions, .editor-head, .row-actions, .test-send, .section-intro, .suppression-create, .preview-toolbar, .provider-state { display: flex; gap: .8rem; align-items: center; }
.header, .editor-head, .section-intro { justify-content: space-between; align-items: flex-start; }
h1 { margin: .2rem 0; font-size: clamp(2.5rem, 6vw, 4.5rem); letter-spacing: -.045em; }
h2, h3 { margin: 0; }
p, small, span { color: #958d9e; }
button, input, textarea, select { border: 1px solid #302a36; border-radius: .65rem; background: #151219; color: #fff; }
button { padding: .65rem .85rem; cursor: pointer; }
button:disabled { opacity: .45; cursor: not-allowed; }
input, textarea, select { width: 100%; padding: .72rem; }
textarea { resize: vertical; line-height: 1.6; }
.panel { border: 1px solid #26212c; border-radius: 1rem; background: #111014; }
.eyebrow { margin: 0; color: #897e92; font-size: .67rem; text-transform: uppercase; letter-spacing: .16em; font-weight: 800; }
.primary { background: linear-gradient(135deg, #8b5cf6, #6d28d9); border-color: #956cff; color: #fff; font-weight: 750; box-shadow: 0 0 24px #7138d622; }
.button-link { display: inline-flex; text-decoration: none; padding: .7rem .9rem; border-radius: .65rem; }
.with-icon { display: inline-flex; align-items: center; gap: .45rem; }
.icon-button { display: inline-grid; place-items: center; width: 2.35rem; height: 2.35rem; padding: 0; }
.provider, .pill, .active-badge { display: inline-flex; width: fit-content; border: 1px solid #48404f; border-radius: 999px; padding: .3rem .55rem; color: #aaa2b2; font-size: .68rem; text-transform: uppercase; letter-spacing: .06em; font-style: normal; }
.provider.ok, .pill[data-status="sent"], .active-badge.on { border-color: #315a45; color: #88d7a8; background: #18322555; }
.pill[data-status="failed"] { border-color: #704048; color: #ef9aa7; background: #351a2055; }
.pill[data-status="pending"], .pill[data-status="processing"] { border-color: #574172; color: #c9a6ff; background: #25153a66; }
.settings-link { color: #ccb7df; font-size: .78rem; }
.message { margin: 1rem 0 0; padding: .8rem 1rem; border: 1px solid #41384a; border-radius: .75rem; background: #17131d; }
.tabs { display: flex; gap: 1.5rem; margin-top: 1.25rem; border-bottom: 1px solid #242029; overflow-x: auto; }
.tabs button { border: 0; border-radius: 0; background: transparent; color: #a69eab; padding: .8rem 0; white-space: nowrap; }
.tabs button.active { color: #fff; border-bottom: 2px solid #8b5cf6; }
.brand-strip { display: grid; grid-template-columns: auto 1fr auto; gap: .85rem; align-items: center; margin: 1rem 0; padding: .75rem .9rem; border: 1px solid #26212c; border-radius: .9rem; background: #100e13; }
.brand-strip > div:nth-child(2) { display: grid; gap: .2rem; }
.brand-thumb { width: 72px; aspect-ratio: 16 / 9; overflow: hidden; border-radius: .5rem; background: #1b1621; display: grid; place-items: center; }
.brand-thumb img { width: 100%; height: 100%; object-fit: cover; }
.template-workspace { display: grid; grid-template-columns: 265px minmax(430px, 1fr) minmax(340px, .78fr); gap: 1rem; align-items: start; }
.template-sidebar { padding: .75rem; position: sticky; top: 1rem; max-height: calc(100vh - 2rem); overflow: auto; }
.search-field { display: flex; gap: .5rem; align-items: center; border: 1px solid #302a36; border-radius: .65rem; background: #151219; padding: 0 .7rem; }
.search-field input { border: 0; background: transparent; padding-left: 0; }
.template-group { margin-top: 1rem; }
.template-group h3 { margin: 0 0 .45rem .45rem; color: #c8c1cc; font-size: .75rem; }
.template-group button { display: grid; grid-template-columns: 9px 1fr; gap: .65rem; width: 100%; padding: .7rem; text-align: left; border-color: transparent; background: transparent; }
.template-group button.active { border-color: #5c3f86; background: linear-gradient(90deg, #2e1857aa, #1a1422); }
.template-group button > span:last-child { display: grid; gap: .18rem; }
.status-dot { width: 7px; height: 7px; margin-top: .35rem; border-radius: 50%; background: #5d5662; }
.status-dot.enabled { background: #50d08b; box-shadow: 0 0 9px #50d08b77; }
.editor { padding: 1.15rem; }
.editor-head p { margin: .25rem 0 0; }
.title-row { display: flex; gap: .6rem; align-items: center; flex-wrap: wrap; }
.switch { display: flex; align-items: center; gap: .45rem; cursor: pointer; }
.switch input { position: absolute; opacity: 0; pointer-events: none; }
.switch > span { width: 2.25rem; height: 1.2rem; border-radius: 99px; background: #3b3541; position: relative; transition: .2s ease; }
.switch > span::after { content: ''; width: .9rem; height: .9rem; border-radius: 50%; background: white; position: absolute; top: .15rem; left: .16rem; transition: .2s ease; }
.switch input:checked + span { background: #39b978; }
.switch input:checked + span::after { transform: translateX(1.02rem); }
.switch b { font-size: .75rem; }
.field-block { margin-top: 1rem; }
.field-heading { display: flex; justify-content: space-between; align-items: center; gap: .8rem; margin-bottom: .4rem; }
.field-heading > span { color: #c8c0cc; font-size: .8rem; }
.field-heading select { width: auto; padding: .35rem .55rem; font-size: .72rem; }
.timing-card { display: grid; gap: .7rem; margin-top: 1rem; padding: .85rem; border: 1px solid #2c2632; border-radius: .8rem; background: #0d0b0f; }
.timing-card > div:first-child { display: flex; justify-content: space-between; gap: 1rem; }
.timing-card strong { color: #d8d1dc; font-size: .82rem; }
.timing-controls { display: grid; grid-template-columns: 1.5fr .55fr .8fr .8fr; gap: .55rem; }
.image-settings { margin-top: 1rem; border: 1px solid #2c2632; border-radius: .8rem; padding: .85rem; background: #0d0b0f; }
.image-settings summary { cursor: pointer; color: #d3ccd8; font-weight: 700; }
.image-settings summary small { margin-left: .5rem; font-weight: 400; }
.row-actions { margin-top: 1rem; }
.dirty-note { color: #f2cf8a; font-size: .8rem; }
.unsaved { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: .75rem; margin-top: 1rem; padding: .85rem 1rem; border: 1px solid #5b4a24; border-radius: .75rem; background: #17130b; color: #f2dcae; }
.unsaved > div { display: flex; gap: .5rem; flex-wrap: wrap; }
.link { border-color: transparent; background: transparent; color: #d9c6ff; }
.preview-panel { padding: .9rem; position: sticky; top: 1rem; }
.preview-toolbar { justify-content: space-between; margin-bottom: .75rem; }
.preview-toolbar > div:first-child { display: grid; gap: .2rem; }
.preview-toolbar > div:first-child > span { color: #fff; font-weight: 700; }
.preview-modes { display: flex; gap: .35rem; }
.preview-modes button { display: grid; place-items: center; width: 2rem; height: 2rem; padding: 0; }
.preview-modes button.active { border-color: #7c51bd; background: #2a1845; }
.preview-frame { min-height: 680px; display: flex; justify-content: center; padding: .7rem; border: 1px solid #27212d; border-radius: .8rem; background: #09080b; overflow: hidden; }
.preview-frame.mobile .email-preview { max-width: 390px; }
.email-preview { width: 100%; min-height: 660px; border: 0; border-radius: .5rem; background: #09080b; }
.preview-loading { display: grid; place-items: center; align-content: center; gap: .5rem; color: #716a77; }
.refresh-preview { width: 100%; margin-top: .65rem; }
.test-send { margin-top: .65rem; }
.test-send input { min-width: 0; }
.section-intro { margin: 1.35rem 0 .75rem; }
.section-intro p { margin: .35rem 0 0; }
.automation-list { overflow: hidden; }
.automation-row { display: grid; grid-template-columns: auto minmax(220px, 1.4fr) 1fr auto auto; gap: .9rem; align-items: center; padding: 1rem; border-top: 1px solid #27222c; }
.automation-row:first-child { border-top: 0; }
.automation-icon { display: grid; place-items: center; width: 2.4rem; height: 2.4rem; border: 1px solid #493064; border-radius: 50%; background: #24143a; color: #c9a7ff; }
.automation-copy { display: grid; gap: .2rem; }
.automation-copy strong { color: #fff; }
.automation-timing { font-size: .82rem; }
.secondary-intro { margin-top: 2rem; }
.suppression-create { min-width: min(700px, 100%); }
.suppression-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .8rem; }
.suppression-card { display: flex; gap: .9rem; padding: 1rem; }
.gig-avatar { display: grid; place-items: center; flex: 0 0 70px; height: 70px; border-radius: .7rem; background: linear-gradient(135deg, #2a173f, #111117); color: #b98bf4; }
.suppression-content { display: grid; gap: .25rem; align-content: center; }
.suppression-tags { display: flex; flex-wrap: wrap; gap: .4rem; margin-top: .35rem; }
.suppression-tags > span { border: 1px solid #3c3444; border-radius: .45rem; padding: .3rem .45rem; color: #c8c0ce; font-size: .72rem; }
.suppression-tags button { border: 0; background: transparent; padding: 0 0 0 .25rem; color: #aaa2b2; }
.stat-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: .8rem; margin-top: 1.2rem; }
.stat-card { margin: 0; padding: .9rem 1rem; text-align: left; display: flex; gap: .8rem; align-items: center; }
.stat-card.active { border-color: #7850ad; box-shadow: inset 0 0 0 1px #7850ad55; }
.stat-card > div { display: grid; }
.stat-card strong { font-size: 1.5rem; }
.delivery-toolbar { display: grid; grid-template-columns: 1fr 190px auto; gap: .65rem; margin-top: .8rem; padding: .75rem; }
.delivery-layout { display: grid; grid-template-columns: 1fr; gap: .8rem; margin-top: .8rem; align-items: start; }
.delivery-layout.has-detail { grid-template-columns: minmax(0, 1fr) 390px; }
.delivery-table { overflow: hidden; }
.delivery-head, .delivery-row { display: grid; grid-template-columns: 1.1fr 1fr .8fr .9fr 24px; gap: .8rem; align-items: center; }
.delivery-head { padding: .65rem 1rem; color: #746d7a; font-size: .68rem; text-transform: uppercase; letter-spacing: .05em; }
.delivery-row { width: 100%; border: 0; border-top: 1px solid #27222c; border-radius: 0; background: transparent; text-align: left; padding: .85rem 1rem; }
.delivery-row:hover, .delivery-row.selected { background: #17131d; }
.delivery-row > span { min-width: 0; display: grid; gap: .2rem; }
.delivery-row small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.delivery-detail { padding: 1rem; position: sticky; top: 1rem; }
.detail-head { display: flex; justify-content: space-between; gap: .8rem; align-items: flex-start; }
.detail-head h2 { margin-top: .65rem; }
.delivery-detail dl { display: grid; gap: .65rem; margin: 1rem 0; }
.delivery-detail dl > div { display: grid; grid-template-columns: 95px 1fr; gap: .8rem; border-top: 1px solid #27222c; padding-top: .65rem; }
dt { color: #7e7585; font-size: .72rem; } dd { margin: 0; color: #ddd7e1; }
.error { color: #ef9aa7; }
.error-box { padding: .75rem; border: 1px solid #63343d; border-radius: .65rem; background: #2b151a; color: #ef9aa7; }
.technical { margin-top: 1rem; border-top: 1px solid #27222c; padding-top: 1rem; }
.technical summary { cursor: pointer; color: #c8c0ce; }
.attempt-row { display: grid; grid-template-columns: auto 130px 1fr; gap: .55rem; align-items: center; margin-top: .65rem; }
.attempt-row code { overflow-wrap: anywhere; color: #a9a0af; font-size: .7rem; }
.settings-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; margin-top: 1rem; }
.settings-card { display: grid; gap: 1rem; padding: 1.15rem; align-content: start; }
.settings-card p { margin: .4rem 0 0; }
.provider-state { justify-content: space-between; flex-wrap: wrap; }
.empty { padding: 1rem; color: #918997; }
@media (max-width: 1180px) {
  .template-workspace { grid-template-columns: 240px 1fr; }
  .preview-panel { grid-column: 2; position: static; }
  .preview-frame { min-height: 600px; }
  .delivery-layout.has-detail { grid-template-columns: 1fr; }
  .delivery-detail { position: static; }
}
@media (max-width: 850px) {
  .header, .section-intro { display: grid; }
  .template-workspace { grid-template-columns: 1fr; }
  .template-sidebar, .preview-panel { position: static; grid-column: auto; max-height: none; }
  .template-group button { min-height: 52px; }
  .suppression-grid, .settings-grid { grid-template-columns: 1fr; }
  .suppression-create { display: grid; min-width: 0; width: 100%; }
  .stat-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .delivery-toolbar { grid-template-columns: 1fr; }
  .delivery-head { display: none; }
  .delivery-row { grid-template-columns: 1fr auto; }
  .delivery-row > span:nth-child(2), .delivery-row > span:nth-child(3) { display: none; }
  .automation-row { grid-template-columns: auto 1fr auto auto; }
  .automation-timing { display: none; }
}
@media (max-width: 560px) {
  .header-actions, .test-send, .row-actions, .timing-card > div:first-child { align-items: stretch; flex-direction: column; }
  .brand-strip { grid-template-columns: auto 1fr; }
  .brand-strip > button { grid-column: 1 / -1; }
  .timing-controls { grid-template-columns: 1fr 1fr; }
  .preview-frame { min-height: 520px; padding: .3rem; }
  .email-preview { min-height: 500px; }
  .stat-grid { grid-template-columns: 1fr 1fr; }
  .automation-row { grid-template-columns: auto 1fr auto; }
  .automation-row .switch b { display: none; }
  .automation-row .icon-button { display: none; }
  .suppression-card { display: grid; grid-template-columns: auto 1fr; }
  .gig-avatar { width: 54px; height: 54px; flex-basis: 54px; }
  .attempt-row { grid-template-columns: 1fr; }
}
</style>