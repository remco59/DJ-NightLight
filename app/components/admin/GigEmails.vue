<script setup lang="ts">
import { clientAllowsAutomaticEmail } from '~~/shared/email-automation'
import { emailJobStatusLabels, emailTemplateLabels, labelFor } from '~~/shared/labels'

const props = defineProps<{ gigId: string, portalUrl?: string }>()

type Variables = Record<string, string | number | null>
type Template = { key: string, name: string, enabled: boolean, subject: string, body: string, scheduleAnchor: string, offsetMinutes: number, automatic: boolean }
type Job = { id: string, templateKey: string, recipient: string, status: string, runAt: string, sentAt: string | null, lastError: string | null, manual: boolean, subjectOverride: string | null, attachments: string[], variables: Variables | null, createdAt: string }
type GigEmails = {
  providerConfigured: boolean
  client: { id: string, name: string, email: string | null, emailAutomationDisabled: string[] } | null
  variables: Variables
  templates: Template[]
  invoices: Array<{ id: string, invoiceNumber: string | null, paymentStatus: string }>
  jobs: Job[]
}
type Composer = {
  templateKey: string
  recipient: string
  variables: Variables
  extraVariables: Variables
  replacesJobId?: string
  note?: string
  /** Changes on every open so the editor starts fresh. */
  key: number
}

const { data, refresh } = await useFetch<GigEmails>(`/api/admin/gigs/${props.gigId}/emails`)

const composer = ref<Composer | null>(null)
const message = ref('')
let composerKey = 0

const templateName = (key: string) => labelFor(emailTemplateLabels, key)
const automaticTemplates = computed(() => data.value?.templates.filter(template => template.automatic) || [])
const automaticForClient = computed(() => automaticTemplates.value.filter(template =>
  template.enabled && clientAllowsAutomaticEmail(data.value?.client?.emailAutomationDisabled, template.key)))
const portalVariables = computed((): Variables => props.portalUrl ? { portalUrl: props.portalUrl } : {})
const invitationAutomatic = computed(() => {
  const template = data.value?.templates.find(item => item.key === 'client_portal_invitation')
  return Boolean(template?.enabled && data.value?.client?.email
    && clientAllowsAutomaticEmail(data.value.client.emailAutomationDisabled, template.key))
})

function openComposer(templateKey = 'custom_message') {
  message.value = ''
  composer.value = {
    templateKey,
    recipient: data.value?.client?.email || '',
    variables: { ...data.value?.variables, ...portalVariables.value },
    extraVariables: portalVariables.value,
    key: ++composerKey,
  }
}

/** Automatic email that has not gone out: it can still be edited and sent by hand, which replaces it. */
function canEdit(job: Job) {
  return !job.manual && ['pending', 'failed', 'suppressed'].includes(job.status)
}

function editJob(job: Job) {
  message.value = ''
  const scheduled = job.status === 'pending' && new Date(job.runAt).getTime() > Date.now()
  composer.value = {
    templateKey: job.templateKey,
    recipient: job.recipient,
    // The job keeps its own links and invoice details; client and gig details are refreshed.
    variables: { ...job.variables, ...data.value?.variables, ...portalVariables.value },
    extraVariables: portalVariables.value,
    replacesJobId: job.id,
    note: scheduled
      ? `Gepland voor ${when(job)}. Als je hem nu verstuurt, wordt de geplande e-mail geannuleerd.`
      : 'Deze automatische e-mail is niet verstuurd. Pas hem aan en verstuur hem hier alsnog.',
    key: ++composerKey,
  }
}

async function onSent(result: string) {
  composer.value = null
  message.value = result
  await refresh()
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
      <button v-if="!composer || composer.replacesJobId" type="button" class="secondary with-icon" @click="openComposer()"><Icon name="lucide:mail-plus" aria-hidden="true" />E-mail schrijven</button>
    </div>

    <p v-if="!data.providerConfigured" class="warn">De e-mailprovider is nog niet ingesteld; e-mails kunnen niet worden verstuurd.</p>

    <div v-if="portalUrl && !composer && !invitationAutomatic" class="notice">
      <span>Er is een nieuwe portaallink. De uitnodiging gaat niet automatisch naar deze klant.</span>
      <button type="button" class="text-button" @click="openComposer('client_portal_invitation')">Uitnodiging zelf versturen</button>
    </div>

    <AdminGigEmailComposer
      v-if="composer && !composer.replacesJobId"
      :key="composer.key"
      :gig-id="gigId"
      :templates="data.templates"
      :invoices="data.invoices"
      :provider-configured="data.providerConfigured"
      :client-disabled="data.client?.emailAutomationDisabled || []"
      :variables="composer.variables"
      :extra-variables="composer.extraVariables"
      :template-key="composer.templateKey"
      :recipient="composer.recipient"
      @sent="onSent"
      @cancel="composer = null"
    />
    <p v-if="message" class="message">{{ message }}</p>

    <h3>Geschiedenis</h3>
    <div v-if="!data.jobs.length" class="subtle">Nog geen e-mails voor deze gig.</div>
    <div v-for="job in data.jobs" :key="job.id" class="job">
      <div class="job-row">
        <div class="job-main">
          <strong>{{ job.subjectOverride || templateName(job.templateKey) }}</strong>
          <span>{{ job.manual ? 'Handmatig' : 'Automatisch' }} · {{ templateName(job.templateKey) }} · {{ job.recipient }} · {{ when(job) }}</span>
          <span v-if="job.attachments.length" class="job-files"><Icon name="lucide:paperclip" aria-hidden="true" /> {{ job.attachments.join(', ') }}</span>
          <small v-if="job.lastError && job.status !== 'sent'">{{ job.lastError }}</small>
        </div>
        <div class="job-side">
          <span class="state" :data-state="job.status">{{ statusLabel(job) }}</span>
          <button v-if="canEdit(job) && composer?.replacesJobId !== job.id" type="button" class="text-button" @click="editJob(job)"><Icon name="lucide:pencil" aria-hidden="true" /> Bewerken en versturen</button>
        </div>
      </div>
      <AdminGigEmailComposer
        v-if="composer?.replacesJobId === job.id"
        :key="composer.key"
        :gig-id="gigId"
        :templates="data.templates"
        :invoices="data.invoices"
        :provider-configured="data.providerConfigured"
        :client-disabled="data.client?.emailAutomationDisabled || []"
        :variables="composer.variables"
        :extra-variables="composer.extraVariables"
        :template-key="composer.templateKey"
        :recipient="composer.recipient"
        :replaces-job-id="composer.replacesJobId"
        :note="composer.note"
        class="inline-composer"
        @sent="onSent"
        @cancel="composer = null"
      />
    </div>
  </section>
</template>

<style scoped>
.card{margin-bottom:1rem;padding:1.25rem;border:1px solid #2b2631;border-radius:1rem;background:#100e14}
.section-title{display:flex;align-items:end;justify-content:space-between;gap:1rem;margin:0 0 .6rem}
.section-title h2{margin:.2rem 0}
.subtle-copy{display:block;margin-top:.2rem;color:#777080;font-size:.78rem}
.subtle-copy a{color:#b9b2c2}
.warn{color:#e6c46f;font-size:.8rem}
.notice{display:flex;align-items:center;justify-content:space-between;gap:1rem;margin-top:.6rem;padding:.7rem .8rem;border-radius:.7rem;background:#18141d;color:#cfc8d6;font-size:.82rem}
.message{margin:.8rem 0 0;color:#aaa4b1;font-size:.82rem}
h3{margin:1.3rem 0 .3rem;font-size:.95rem}
.subtle{padding:.6rem 0;color:#777080}
.job{padding:.75rem 0;border-top:1px solid #29242f}
.job-row{display:flex;justify-content:space-between;align-items:start;gap:1rem}
.inline-composer{margin-bottom:.2rem}
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
.secondary{border:0;border-radius:.65rem;padding:.72rem .9rem;background:#211c27;color:#eee9f2;font-weight:800;cursor:pointer}
.with-icon{display:inline-flex;align-items:center;gap:.4rem}
@media(max-width:700px){
  .section-title,.notice{align-items:stretch;flex-direction:column}
  .job-row{flex-direction:column}
  .job-side{align-items:start}
}
</style>
