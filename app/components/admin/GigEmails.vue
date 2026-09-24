<script setup lang="ts">
import { apiErrorMessage } from '~/utils/api-error'
import {
  EMAIL_ATTACHMENT_EXTENSIONS,
  MAX_EMAIL_ATTACHMENTS,
  MAX_EMAIL_ATTACHMENTS_TOTAL_BYTES,
  MAX_EMAIL_ATTACHMENT_BYTES,
  attachmentExtension,
  clientAllowsAutomaticEmail,
  normalizeEmailText,
  renderBrandedEmailHtml,
  renderEmailTemplate,
} from '~~/shared/email-automation'
import { emailJobStatusLabels, emailTemplateLabels, labelFor } from '~~/shared/labels'

const props = defineProps<{ gigId: string, portalUrl?: string }>()

type Template = { key: string, name: string, enabled: boolean, subject: string, body: string, scheduleAnchor: string, offsetMinutes: number, automatic: boolean }
type Job = { id: string, templateKey: string, recipient: string, status: string, runAt: string, sentAt: string | null, lastError: string | null, manual: boolean, subjectOverride: string | null, attachments: string[], createdAt: string }
type GigEmails = {
  providerConfigured: boolean
  client: { id: string, name: string, email: string | null, emailAutomationDisabled: string[] } | null
  variables: Record<string, string | number | null>
  templates: Template[]
  invoices: Array<{ id: string, invoiceNumber: string | null, paymentStatus: string }>
  jobs: Job[]
}

const { data, refresh } = await useFetch<GigEmails>(`/api/admin/gigs/${props.gigId}/emails`)

const composing = ref(false)
const showPreview = ref(false)
const sending = ref(false)
const message = ref('')
const fileInput = ref<HTMLInputElement | null>(null)
const draft = reactive({
  templateKey: '',
  recipient: '',
  subject: '',
  body: '',
  files: [] as File[],
  invoiceIds: [] as string[],
})

const acceptedExtensions = EMAIL_ATTACHMENT_EXTENSIONS.map(ext => `.${ext}`).join(',')
const templateName = (key: string) => labelFor(emailTemplateLabels, key)
const automaticTemplates = computed(() => data.value?.templates.filter(template => template.automatic) || [])
const automaticForClient = computed(() => automaticTemplates.value.filter(template =>
  template.enabled && clientAllowsAutomaticEmail(data.value?.client?.emailAutomationDisabled, template.key)))
const variables = computed(() => ({ ...data.value?.variables, ...(props.portalUrl ? { portalUrl: props.portalUrl } : {}) }))
const selectedTemplate = computed(() => data.value?.templates.find(template => template.key === draft.templateKey))
const invitationAutomatic = computed(() => {
  const template = data.value?.templates.find(item => item.key === 'client_portal_invitation')
  return Boolean(template && data.value?.client?.email && sendsAutomatically(template))
})
const needsPortalLink = computed(() => ['client_portal_invitation', 'portal_reminder'].includes(draft.templateKey) && !props.portalUrl)
const attachmentCount = computed(() => draft.files.length + draft.invoiceIds.length)
const previewHtml = computed(() => draft.templateKey ? renderBrandedEmailHtml(draft.templateKey, normalizeEmailText(draft.body), variables.value) : '')

function sendsAutomatically(template: Template) {
  return template.automatic && template.enabled && clientAllowsAutomaticEmail(data.value?.client?.emailAutomationDisabled, template.key)
}

function applyTemplate(key: string) {
  const template = data.value?.templates.find(item => item.key === key)
  if (!template) return
  draft.templateKey = key
  draft.subject = renderEmailTemplate(template.subject, variables.value)
  draft.body = normalizeEmailText(renderEmailTemplate(template.body, variables.value))
}

function openComposer(key = 'custom_message') {
  const fallback = data.value?.templates.find(template => template.key === key) ? key : data.value?.templates[0]?.key || ''
  draft.recipient = data.value?.client?.email || ''
  draft.files = []
  draft.invoiceIds = []
  message.value = ''
  showPreview.value = false
  applyTemplate(fallback)
  composing.value = true
}

function onTemplateChange(event: Event) {
  const key = (event.target as HTMLSelectElement).value
  if ((draft.subject || draft.body) && !confirm('Onderwerp en tekst vervangen door dit template?')) {
    (event.target as HTMLSelectElement).value = draft.templateKey
    return
  }
  applyTemplate(key)
}

function addFiles(event: Event) {
  const input = event.target as HTMLInputElement
  const picked = Array.from(input.files || [])
  input.value = ''
  message.value = ''
  for (const file of picked) {
    if (attachmentCount.value >= MAX_EMAIL_ATTACHMENTS) {
      message.value = `Je kunt maximaal ${MAX_EMAIL_ATTACHMENTS} bijlagen toevoegen.`
      break
    }
    if (!EMAIL_ATTACHMENT_EXTENSIONS.includes(attachmentExtension(file.name))) {
      message.value = `${file.name} is geen toegestaan bestandstype.`
      continue
    }
    if (file.size > MAX_EMAIL_ATTACHMENT_BYTES) {
      message.value = `${file.name} is groter dan 10 MB.`
      continue
    }
    const total = draft.files.reduce((sum, item) => sum + item.size, 0) + file.size
    if (total > MAX_EMAIL_ATTACHMENTS_TOTAL_BYTES) {
      message.value = 'Bijlagen mogen samen maximaal 20 MB zijn.'
      break
    }
    draft.files.push(file)
  }
}

function toggleInvoice(id: string, on: boolean) {
  if (on && attachmentCount.value >= MAX_EMAIL_ATTACHMENTS) {
    message.value = `Je kunt maximaal ${MAX_EMAIL_ATTACHMENTS} bijlagen toevoegen.`
    return
  }
  draft.invoiceIds = on ? [...draft.invoiceIds, id] : draft.invoiceIds.filter(item => item !== id)
}

async function send() {
  if (!draft.templateKey || !draft.recipient || !draft.subject.trim() || !draft.body.trim()) {
    message.value = 'Vul een ontvanger, onderwerp en tekst in.'
    return
  }
  sending.value = true
  message.value = ''
  try {
    const body = new FormData()
    body.append('templateKey', draft.templateKey)
    body.append('recipient', draft.recipient)
    body.append('subject', draft.subject)
    body.append('body', draft.body)
    body.append('variables', JSON.stringify(props.portalUrl ? { portalUrl: props.portalUrl } : {}))
    body.append('invoiceIds', JSON.stringify(draft.invoiceIds))
    for (const file of draft.files) body.append('attachments', file, file.name)
    const result = await $fetch<{ status: string, error?: string }>(`/api/admin/gigs/${props.gigId}/emails`, { method: 'POST', body })
    if (result.status === 'sent') {
      composing.value = false
      message.value = `E-mail verstuurd naar ${draft.recipient}.`
    } else {
      message.value = `Versturen mislukt: ${result.error || result.status}. Er wordt automatisch opnieuw geprobeerd.`
      composing.value = false
    }
    await refresh()
  } catch (error: unknown) {
    message.value = apiErrorMessage(error, 'E-mail versturen is niet gelukt.')
  } finally {
    sending.value = false
  }
}

function fileSize(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`
}
function when(job: Job) {
  const value = job.sentAt || job.runAt
  return new Intl.DateTimeFormat('nl-NL', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}
function statusLabel(job: Job) {
  if (job.status === 'pending') return new Date(job.runAt).getTime() > Date.now() ? 'Gepland' : 'In wachtrij'
  if (job.status === 'suppressed') return 'Niet verstuurd'
  return labelFor(emailJobStatusLabels, job.status)
}

watch(() => props.portalUrl, (url) => {
  if (url) void refresh()
})
</script>

<template>
  <section v-if="data" class="card emails">
    <div class="section-title">
      <div>
        <p class="eyebrow">E-mail</p>
        <h2>E-mails naar de klant</h2>
        <span class="subtle-copy">
          <template v-if="!data.client">Geen klant gekoppeld, dus er wordt niets automatisch verstuurd.</template>
          <template v-else-if="!data.client.email">{{ data.client.name }} heeft geen e-mailadres, dus er wordt niets automatisch verstuurd.</template>
          <template v-else>{{ automaticForClient.length }} van {{ automaticTemplates.length }} e-mails gaan automatisch naar {{ data.client.name }}. <NuxtLink :to="`/admin/clients/${data.client.id}`">Aanpassen bij de klant</NuxtLink></template>
        </span>
      </div>
      <button v-if="!composing" type="button" class="secondary with-icon" @click="openComposer()"><Icon name="lucide:mail-plus" aria-hidden="true" />E-mail schrijven</button>
    </div>

    <p v-if="!data.providerConfigured" class="warn">De e-mailprovider is nog niet ingesteld; e-mails kunnen niet worden verstuurd.</p>

    <div v-if="portalUrl && !composing && !invitationAutomatic" class="notice">
      <span>Er is een nieuwe portaallink. De uitnodiging gaat niet automatisch naar deze klant.</span>
      <button type="button" class="text-button" @click="openComposer('client_portal_invitation')">Uitnodiging zelf versturen</button>
    </div>

    <div v-if="composing" class="composer">
      <div class="grid">
        <label>Template
          <select :value="draft.templateKey" @change="onTemplateChange">
            <option v-for="template in data.templates" :key="template.key" :value="template.key">
              {{ templateName(template.key) }}{{ template.automatic ? (sendsAutomatically(template) ? ' · automatisch' : ' · niet automatisch') : '' }}
            </option>
          </select>
        </label>
        <label>Aan<input v-model="draft.recipient" type="email" required placeholder="klant@voorbeeld.nl"></label>
        <label class="wide">Onderwerp<input v-model="draft.subject" maxlength="300" required></label>
        <label class="wide">Tekst<textarea v-model="draft.body" rows="10" required /></label>
      </div>
      <p v-if="selectedTemplate?.automatic && sendsAutomatically(selectedTemplate)" class="hint">Deze e-mail gaat ook automatisch naar deze klant.</p>
      <p v-if="needsPortalLink" class="hint warn">Maak eerst hieronder een portaallink aan om de portaalknop mee te sturen, of plak een link in de tekst.</p>

      <div class="attachments">
        <div class="attachments-head">
          <strong>Bijlagen <small>optioneel · max. {{ MAX_EMAIL_ATTACHMENTS }} bestanden, 10 MB per stuk</small></strong>
          <button type="button" class="text-button" :disabled="attachmentCount >= MAX_EMAIL_ATTACHMENTS" @click="fileInput?.click()"><Icon name="lucide:paperclip" aria-hidden="true" /> Bestand toevoegen</button>
          <input ref="fileInput" type="file" multiple hidden :accept="acceptedExtensions" @change="addFiles">
        </div>
        <label v-for="invoice in data.invoices" :key="invoice.id" class="checkbox">
          <input type="checkbox" :checked="draft.invoiceIds.includes(invoice.id)" @change="toggleInvoice(invoice.id, ($event.target as HTMLInputElement).checked)">
          Factuur {{ invoice.invoiceNumber }} (pdf)
        </label>
        <div v-for="(file, index) in draft.files" :key="`${file.name}-${index}`" class="file-row">
          <span><Icon name="lucide:file" aria-hidden="true" /> {{ file.name }} <small>{{ fileSize(file.size) }}</small></span>
          <button type="button" aria-label="Bijlage verwijderen" title="Bijlage verwijderen" @click="draft.files.splice(index, 1)"><Icon name="lucide:x" aria-hidden="true" /></button>
        </div>
      </div>

      <div v-if="showPreview" class="preview">
        <div class="preview-head"><span>Voorbeeld</span><strong>{{ draft.subject }}</strong></div>
        <iframe class="email-preview" :srcdoc="previewHtml" title="Voorbeeld van de e-mail" sandbox="" />
      </div>

      <div class="composer-actions">
        <button type="button" class="text-button" @click="showPreview = !showPreview">{{ showPreview ? 'Voorbeeld verbergen' : 'Voorbeeld' }}</button>
        <span class="spacer" />
        <button type="button" class="secondary" :disabled="sending" @click="composing = false">Annuleren</button>
        <button type="button" class="primary with-icon" :disabled="sending || !data.providerConfigured" @click="send"><Icon name="lucide:send" aria-hidden="true" />{{ sending ? 'Versturen…' : 'Nu versturen' }}</button>
      </div>
    </div>
    <p v-if="message" class="message">{{ message }}</p>

    <h3>Geschiedenis</h3>
    <div v-if="!data.jobs.length" class="subtle">Nog geen e-mails voor deze gig.</div>
    <div v-for="job in data.jobs" :key="job.id" class="job-row">
      <div class="job-main">
        <strong>{{ job.subjectOverride || templateName(job.templateKey) }}</strong>
        <span>{{ job.manual ? 'Handmatig' : 'Automatisch' }} · {{ templateName(job.templateKey) }} · {{ job.recipient }} · {{ when(job) }}</span>
        <span v-if="job.attachments.length" class="job-files"><Icon name="lucide:paperclip" aria-hidden="true" /> {{ job.attachments.join(', ') }}</span>
        <small v-if="job.lastError && job.status !== 'sent'">{{ job.lastError }}</small>
      </div>
      <div class="job-side">
        <span class="state" :data-state="job.status">{{ statusLabel(job) }}</span>
        <button v-if="!job.manual && job.status !== 'sent'" type="button" class="text-button" @click="openComposer(job.templateKey)">Zelf versturen</button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.card{margin-bottom:1rem;padding:1.25rem;border:1px solid #2b2631;border-radius:1rem;background:#100e14}
.section-title{display:flex;align-items:end;justify-content:space-between;gap:1rem;margin:0 0 .6rem}
.section-title h2{margin:.2rem 0}
.subtle-copy{display:block;margin-top:.2rem;color:#777080;font-size:.78rem}
.subtle-copy a{color:#b9b2c2}
.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:.8rem}
.wide{grid-column:1/-1}
label{display:grid;gap:.35rem;color:#aaa4b1;font-size:.8rem}
input,select,textarea{width:100%;border:1px solid #332e39;border-radius:.65rem;padding:.7rem;background:#0b0a0d;color:#f6f3fa;font:inherit}
textarea{resize:vertical;line-height:1.5}
.composer{margin-top:.8rem;padding:1rem;border:1px solid #2d2832;border-radius:.8rem;background:#0d0b10}
.hint{margin:.6rem 0 0;color:#8b8493;font-size:.78rem}
.warn{color:#e6c46f;font-size:.8rem}
.notice{display:flex;align-items:center;justify-content:space-between;gap:1rem;margin-top:.6rem;padding:.7rem .8rem;border-radius:.7rem;background:#18141d;color:#cfc8d6;font-size:.82rem}
.attachments{margin-top:1rem;padding-top:.8rem;border-top:1px solid #26212c}
.attachments-head{display:flex;align-items:center;justify-content:space-between;gap:1rem;margin-bottom:.4rem}
.attachments-head small{margin-left:.4rem;color:#777080;font-weight:400;font-size:.72rem}
.checkbox{display:flex;align-items:center;gap:.6rem;padding:.35rem 0;color:#d8d3dd;font-size:.85rem}
.checkbox input{width:auto}
.file-row{display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:.45rem 0;color:#d8d3dd;font-size:.85rem}
.file-row span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.file-row small{color:#777080}
.file-row button{border:0;border-radius:.5rem;padding:.3rem .4rem;background:#241a20;color:#eab4bc;cursor:pointer}
.preview{margin-top:1rem;border:1px solid #2d2832;border-radius:.8rem;overflow:hidden}
.preview-head{display:flex;gap:.8rem;align-items:baseline;padding:.6rem .8rem;background:#18141d;font-size:.8rem}
.preview-head span{color:#8b8493}
.email-preview{display:block;width:100%;height:560px;border:0;background:#09080b}
.composer-actions{display:flex;align-items:center;gap:.6rem;margin-top:1rem}
.spacer{flex:1}
.message{margin:.8rem 0 0;color:#aaa4b1;font-size:.82rem}
h3{margin:1.3rem 0 .3rem;font-size:.95rem}
.subtle{padding:.6rem 0;color:#777080}
.job-row{display:flex;justify-content:space-between;align-items:start;gap:1rem;padding:.75rem 0;border-top:1px solid #29242f}
.job-main{min-width:0}
.job-main strong,.job-main span,.job-main small{display:block}
.job-main span{margin-top:.15rem;color:#7f7887;font-size:.75rem;overflow-wrap:anywhere}
.job-main small{margin-top:.2rem;color:#c98f98;font-size:.72rem}
.job-side{display:flex;flex-direction:column;align-items:end;gap:.35rem;white-space:nowrap}
.state{padding:.28rem .5rem;border-radius:999px;background:#211b28;color:#aaa2b2;font-size:.68rem}
.state[data-state="sent"]{background:#16382a;color:#8fe1ad}
.state[data-state="failed"]{background:#351a20;color:#ffadb7}
.state[data-state="pending"],.state[data-state="processing"]{background:#352d16;color:#ead17a}
.text-button{display:inline-flex;align-items:center;gap:.3rem;border:0;padding:0;background:transparent;color:#b9b2c2;cursor:pointer;font:inherit;font-size:.8rem}
.text-button:disabled{opacity:.5;cursor:default}
.primary,.secondary{border:0;border-radius:.65rem;padding:.72rem .9rem;font-weight:800;cursor:pointer}
.primary{background:#fff;color:#09080b}
.secondary{background:#211c27;color:#eee9f2}
.primary:disabled,.secondary:disabled{opacity:.55;cursor:default}
.with-icon{display:inline-flex;align-items:center;gap:.4rem}
@media(max-width:700px){
  .grid{grid-template-columns:1fr}
  .wide{grid-column:auto}
  .section-title,.notice{align-items:stretch;flex-direction:column}
  .job-row{flex-direction:column}
  .job-side{align-items:start}
  .composer-actions{flex-wrap:wrap}
  .composer-actions .spacer{display:none}
  .composer-actions .primary,.composer-actions .secondary{flex:1}
}
</style>
