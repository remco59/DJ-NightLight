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
import { emailTemplateLabels, labelFor } from '~~/shared/labels'

type Template = { key: string, subject: string, body: string, enabled: boolean, automatic: boolean }
type Variables = Record<string, string | number | null>

const props = defineProps<{
  gigId: string
  templates: Template[]
  invoices: Array<{ id: string, invoiceNumber: string | null }>
  providerConfigured: boolean
  clientDisabled: string[]
  /** Values used to fill in the template text and the email layout. */
  variables: Variables
  /** Extra values sent along with the email (for example a fresh portal link). */
  extraVariables?: Variables
  templateKey: string
  recipient: string
  /** Automatic email this one replaces; the server cancels it so it is not sent twice. */
  replacesJobId?: string
  /** Explains which automatic email is being edited. */
  note?: string
}>()

const emit = defineEmits<{ sent: [message: string], cancel: [] }>()

const showPreview = ref(false)
const sending = ref(false)
const message = ref('')
const fileInput = ref<HTMLInputElement | null>(null)
const draft = reactive({
  templateKey: '',
  recipient: props.recipient,
  subject: '',
  body: '',
  files: [] as File[],
  invoiceIds: [] as string[],
})

const acceptedExtensions = EMAIL_ATTACHMENT_EXTENSIONS.map(ext => `.${ext}`).join(',')
const templateName = (key: string) => labelFor(emailTemplateLabels, key)
const selectedTemplate = computed(() => props.templates.find(template => template.key === draft.templateKey))
const needsPortalLink = computed(() => ['client_portal_invitation', 'portal_reminder'].includes(draft.templateKey) && !props.variables.portalUrl)
const attachmentCount = computed(() => draft.files.length + draft.invoiceIds.length)
const previewHtml = computed(() => draft.templateKey ? renderBrandedEmailHtml(draft.templateKey, normalizeEmailText(draft.body), props.variables) : '')

function sendsAutomatically(template: Template) {
  return template.automatic && template.enabled && clientAllowsAutomaticEmail(props.clientDisabled, template.key)
}

function applyTemplate(key: string) {
  const template = props.templates.find(item => item.key === key)
  if (!template) return
  draft.templateKey = key
  draft.subject = renderEmailTemplate(template.subject, props.variables)
  draft.body = normalizeEmailText(renderEmailTemplate(template.body, props.variables))
}

applyTemplate(props.templates.some(template => template.key === props.templateKey) ? props.templateKey : props.templates[0]?.key || '')

function onTemplateChange(event: Event) {
  const select = event.target as HTMLSelectElement
  if ((draft.subject || draft.body) && !confirm('Onderwerp en tekst vervangen door dit template?')) {
    select.value = draft.templateKey
    return
  }
  applyTemplate(select.value)
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
    body.append('variables', JSON.stringify(props.extraVariables || {}))
    body.append('invoiceIds', JSON.stringify(draft.invoiceIds))
    if (props.replacesJobId) body.append('replacesJobId', props.replacesJobId)
    for (const file of draft.files) body.append('attachments', file, file.name)
    const result = await $fetch<{ status: string, error?: string }>(`/api/admin/gigs/${props.gigId}/emails`, { method: 'POST', body })
    emit('sent', result.status === 'sent'
      ? `E-mail verstuurd naar ${draft.recipient}.`
      : `Versturen mislukt: ${result.error || result.status}. Er wordt automatisch opnieuw geprobeerd.`)
  } catch (error: unknown) {
    message.value = apiErrorMessage(error, 'E-mail versturen is niet gelukt.')
  } finally {
    sending.value = false
  }
}

function fileSize(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`
}
</script>

<template>
  <div class="composer">
    <p v-if="note" class="note">{{ note }}</p>
    <div class="grid">
      <label>Template
        <select :value="draft.templateKey" @change="onTemplateChange">
          <option v-for="template in templates" :key="template.key" :value="template.key">
            {{ templateName(template.key) }}{{ template.automatic ? (sendsAutomatically(template) ? ' · automatisch' : ' · niet automatisch') : '' }}
          </option>
        </select>
      </label>
      <label>Aan<input v-model="draft.recipient" type="email" required placeholder="klant@voorbeeld.nl"></label>
      <label class="wide">Onderwerp<input v-model="draft.subject" maxlength="300" required></label>
      <label class="wide">Tekst<textarea v-model="draft.body" rows="10" required /></label>
    </div>
    <p v-if="!replacesJobId && selectedTemplate?.automatic && sendsAutomatically(selectedTemplate)" class="hint">Deze e-mail gaat ook automatisch naar deze klant.</p>
    <p v-if="needsPortalLink" class="hint warn">Maak eerst hieronder een portaallink aan om de portaalknop mee te sturen, of plak een link in de tekst.</p>

    <div class="attachments">
      <div class="attachments-head">
        <strong>Bijlagen <small>optioneel · max. {{ MAX_EMAIL_ATTACHMENTS }} bestanden, 10 MB per stuk</small></strong>
        <button type="button" class="text-button" :disabled="attachmentCount >= MAX_EMAIL_ATTACHMENTS" @click="fileInput?.click()"><Icon name="lucide:paperclip" aria-hidden="true" /> Bestand toevoegen</button>
        <input ref="fileInput" type="file" multiple hidden :accept="acceptedExtensions" @change="addFiles">
      </div>
      <label v-for="invoice in invoices" :key="invoice.id" class="checkbox">
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

    <p v-if="message" class="hint warn">{{ message }}</p>
    <div class="composer-actions">
      <button type="button" class="text-button" @click="showPreview = !showPreview">{{ showPreview ? 'Voorbeeld verbergen' : 'Voorbeeld' }}</button>
      <span class="spacer" />
      <button type="button" class="secondary" :disabled="sending" @click="emit('cancel')">Annuleren</button>
      <button type="button" class="primary with-icon" :disabled="sending || !providerConfigured" @click="send"><Icon name="lucide:send" aria-hidden="true" />{{ sending ? 'Versturen…' : 'Nu versturen' }}</button>
    </div>
  </div>
</template>

<style scoped>
.composer{margin-top:.8rem;padding:1rem;border:1px solid #2d2832;border-radius:.8rem;background:#0d0b10}
.note{margin:0 0 .9rem;padding:.6rem .75rem;border-radius:.6rem;background:#18141d;color:#cfc8d6;font-size:.8rem;line-height:1.45}
.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:.8rem}
.wide{grid-column:1/-1}
label{display:grid;gap:.35rem;color:#aaa4b1;font-size:.8rem}
input,select,textarea{width:100%;border:1px solid #332e39;border-radius:.65rem;padding:.7rem;background:#0b0a0d;color:#f6f3fa;font:inherit}
textarea{resize:vertical;line-height:1.5}
.hint{margin:.6rem 0 0;color:#8b8493;font-size:.78rem}
.warn{color:#e6c46f;font-size:.8rem}
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
  .composer-actions{flex-wrap:wrap}
  .composer-actions .spacer{display:none}
  .composer-actions .primary,.composer-actions .secondary{flex:1}
}
</style>
