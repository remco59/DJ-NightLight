<script setup lang="ts">
import { apiErrorMessage } from '~/utils/api-error'

definePageMeta({ layout: 'admin' })

type Settings = {
  companyName:string
  address:string
  postalCode:string
  city:string
  country:string
  email:string
  phone:string
  registrationNumber:string
  vatNumber:string
  iban:string
  invoicePrefix:string
  nextInvoiceNumber:number
  defaultVatMode:'exclusive'|'inclusive'|'exempt'
  defaultVatRateBasisPoints:number
  defaultPaymentTermDays:number
  paymentTerms:string
  legalText:string
}

type RenderStatus = {
  workerOnline:boolean
  capabilities:{id:'cpu'|'intel',available:boolean}[]
}

type IntegrationStatus = {
  calendar:{configured:boolean,enabled:boolean}
  email:{configured:boolean}
}

type StripeStatus = {
  status:{keyConfigured:boolean,webhookConfigured:boolean,livemode:boolean|null}
}

const {data,refresh}=await useFetch<{settings:Settings}>('/api/admin/business-settings')
if(!data.value)throw createError({statusCode:500,statusMessage:'Bedrijfsinstellingen niet beschikbaar'})

const [{data:renderStatus},{data:integrationStatus},{data:stripeStatus}] = await Promise.all([
  useFetch<RenderStatus>('/api/admin/render-settings'),
  useFetch<IntegrationStatus>('/api/admin/integrations'),
  useFetch<StripeStatus>('/api/admin/stripe'),
])

const form=reactive({...data.value.settings})
const saving=ref('')
const message=ref('')
const messageSection=ref<'company'|'invoice'|''>('')
const passwordOpen=ref(false)
const passwordForm=reactive({currentPassword:'',newPassword:'',confirmPassword:''})
const passwordSaving=ref(false)
const passwordMessage=ref('')
const passwordMessageType=ref<'success'|'error'|''>('')

const integrationCount=computed(()=>{
  let count=0
  if(integrationStatus.value?.calendar.configured)count++
  if(integrationStatus.value?.email.configured)count++
  if(stripeStatus.value?.status.keyConfigured&&stripeStatus.value?.status.webhookConfigured)count++
  return count
})

const intelAvailable=computed(()=>Boolean(renderStatus.value?.capabilities.find(item=>item.id==='intel')?.available))
const allHealthy=computed(()=>Boolean(
  renderStatus.value?.workerOnline
  && integrationCount.value===3
))

function setVatRate(event:Event){
  form.defaultVatRateBasisPoints=Math.round(Number((event.target as HTMLInputElement).value)*100)
}

async function save(section:'company'|'invoice'){
  saving.value=section
  message.value=''
  messageSection.value=section
  try{
    await $fetch('/api/admin/business-settings',{method:'PUT',body:form})
    await refresh()
    message.value=section==='company'
      ? 'Bedrijfsgegevens opgeslagen.'
      : 'Factuurinstellingen opgeslagen.'
  }catch(error:unknown){
    message.value=apiErrorMessage(error,'Instellingen opslaan is niet gelukt.')
  }finally{
    saving.value=''
  }
}

async function changePassword(){
  passwordMessage.value=''
  passwordMessageType.value=''

  if(passwordForm.newPassword!==passwordForm.confirmPassword){
    passwordMessage.value='De nieuwe wachtwoorden komen niet overeen.'
    passwordMessageType.value='error'
    return
  }

  passwordSaving.value=true
  try{
    await $fetch('/api/admin/account/password',{method:'POST',body:passwordForm})
    passwordForm.currentPassword=''
    passwordForm.newPassword=''
    passwordForm.confirmPassword=''
    passwordMessage.value='Wachtwoord gewijzigd. Andere ingelogde sessies zijn uitgelogd.'
    passwordMessageType.value='success'
  }catch(error:unknown){
    passwordMessage.value=apiErrorMessage(error,'Wachtwoord wijzigen is niet gelukt.')
    passwordMessageType.value='error'
  }finally{
    passwordSaving.value=false
  }
}

useSeoMeta({title:'Instellingen — DJ NightLight',robots:'noindex, nofollow'})
</script>

<template>
  <div class="settings">
    <header class="page-head">
      <p class="eyebrow">Systeem</p>
      <h1>Instellingen</h1>
      <p>Beheer bedrijfsgegevens, facturatie, integraties en andere instellingen.</p>
    </header>

    <nav class="settings-tabs" aria-label="Instellingencategorieën">
      <a href="#general"><Icon name="lucide:settings-2" aria-hidden="true"/>Algemeen</a>
      <a href="#rendering"><Icon name="lucide:play" aria-hidden="true"/>Video</a>
      <a href="#integrations"><Icon name="lucide:link-2" aria-hidden="true"/>Integraties</a>
    </nav>

    <section class="status-card" aria-label="Systeemstatus">
      <div class="status-header">
        <div class="status-title">
          <span class="status-dot" :class="{warn:!allHealthy}"/>
          <div>
            <h2>Systeemstatus</h2>
            <p>{{ allHealthy ? 'Alle systemen werken naar behoren.' : 'Controleer de onderdelen met aandacht.' }}</p>
          </div>
        </div>
      </div>
      <div class="status-grid">
        <div class="status-item">
          <Icon name="lucide:clapperboard" aria-hidden="true"/>
          <strong>Video rendering</strong>
          <span :class="{good:renderStatus?.workerOnline}">{{ renderStatus?.workerOnline ? 'Beschikbaar' : 'Worker offline' }}</span>
          <small>CPU{{ intelAvailable ? ' · Intel GPU' : '' }}</small>
        </div>
        <div class="status-item">
          <Icon name="lucide:waypoints" aria-hidden="true"/>
          <strong>Integraties</strong>
          <span :class="{good:integrationCount===3}">{{ integrationCount }}/3 actief</span>
          <small>Google · Resend · Stripe</small>
        </div>
        <div class="status-item">
          <Icon name="lucide:server" aria-hidden="true"/>
          <strong>Services</strong>
          <span :class="{good:allHealthy}">{{ allHealthy ? 'Online' : 'Aandacht nodig' }}</span>
          <small>NightLight systeemstatus</small>
        </div>
      </div>
    </section>

    <section id="general" class="settings-section">
      <form class="card" @submit.prevent="save('company')">
        <div class="card-heading">
          <span class="section-icon"><Icon name="lucide:building-2" aria-hidden="true"/></span>
          <div>
            <h2>Bedrijf</h2>
            <p>Beheer je bedrijfsgegevens. Deze informatie wordt gebruikt op facturen en in communicatie.</p>
          </div>
        </div>
        <div class="grid">
          <label>Bedrijfsnaam<input v-model="form.companyName" required></label>
          <label>Adres<input v-model="form.address"></label>
          <label>Postcode<input v-model="form.postalCode"></label>
          <label>Plaats<input v-model="form.city"></label>
          <label>Land<input v-model="form.country"></label>
          <label>E-mail<input v-model="form.email" type="email"></label>
          <label>Telefoon<input v-model="form.phone"></label>
          <label>KvK-nummer<input v-model="form.registrationNumber"></label>
          <label>Btw-nummer<input v-model="form.vatNumber"></label>
          <label>IBAN<input v-model="form.iban"></label>
        </div>
        <div class="card-actions">
          <span v-if="messageSection==='company'" aria-live="polite">{{message}}</span>
          <button :disabled="saving==='company'">{{saving==='company'?'Opslaan…':'Wijzigingen opslaan'}}</button>
        </div>
      </form>

      <form class="card" @submit.prevent="save('invoice')">
        <div class="card-heading">
          <span class="section-icon"><Icon name="lucide:receipt-text" aria-hidden="true"/></span>
          <div>
            <h2>Factuurinstellingen</h2>
            <p>Stel in hoe facturen worden aangemaakt en welke gegevens standaard worden getoond.</p>
          </div>
        </div>
        <div class="grid">
          <label>Voorvoegsel factuurnummer<input v-model="form.invoicePrefix" required></label>
          <label>Volgend nummer<input :value="form.nextInvoiceNumber" disabled><small>Loopt automatisch op bij het definitief maken.</small></label>
          <label>Btw-berekening<select v-model="form.defaultVatMode"><option value="exclusive">Prijzen exclusief btw</option><option value="inclusive">Prijzen inclusief btw</option><option value="exempt">Geen btw / vrijgesteld</option></select></label>
          <label>Btw-tarief (%)<input :value="form.defaultVatRateBasisPoints/100" type="number" min="0" max="100" step="0.01" @input="setVatRate"></label>
          <label>Betalingstermijn (dagen)<input v-model.number="form.defaultPaymentTermDays" type="number" min="0" max="365"></label>
          <label class="wide">Betalingsvoorwaarden<textarea v-model="form.paymentTerms" rows="3"/></label>
          <label class="wide">Juridische tekst<textarea v-model="form.legalText" rows="3"/></label>
        </div>
        <div class="card-actions">
          <span v-if="messageSection==='invoice'" aria-live="polite">{{message}}</span>
          <button :disabled="saving==='invoice'">{{saving==='invoice'?'Opslaan…':'Wijzigingen opslaan'}}</button>
        </div>
      </form>

      <section class="card security-card">
        <div class="security-summary">
          <div class="card-heading compact">
            <span class="section-icon"><Icon name="lucide:lock-keyhole" aria-hidden="true"/></span>
            <div>
              <h2>Wachtwoord</h2>
              <p>Wijzig je wachtwoord om je account veilig te houden.</p>
            </div>
          </div>
          <button class="outline" type="button" @click="passwordOpen=!passwordOpen">
            {{ passwordOpen ? 'Sluiten' : 'Wachtwoord wijzigen' }}
            <Icon :name="passwordOpen?'lucide:chevron-up':'lucide:arrow-right'" aria-hidden="true"/>
          </button>
        </div>

        <form v-if="passwordOpen" class="password-form" @submit.prevent="changePassword">
          <label class="wide">Huidig wachtwoord<input v-model="passwordForm.currentPassword" type="password" autocomplete="current-password" minlength="8" maxlength="200" required></label>
          <label>Nieuw wachtwoord<input v-model="passwordForm.newPassword" type="password" autocomplete="new-password" minlength="12" maxlength="200" required><small>Gebruik minstens 12 tekens.</small></label>
          <label>Bevestig nieuw wachtwoord<input v-model="passwordForm.confirmPassword" type="password" autocomplete="new-password" minlength="12" maxlength="200" required></label>
          <div class="card-actions wide">
            <span :class="passwordMessageType">{{passwordMessage}}</span>
            <button :disabled="passwordSaving">{{passwordSaving?'Wijzigen…':'Wachtwoord opslaan'}}</button>
          </div>
        </form>
      </section>
    </section>

    <AdminRenderSettings/>
    <AdminIntegrationsSettings/>

    <AdminUpdateSettings/>
  </div>
</template>

<style scoped>
.settings{max-width:980px;margin-inline:auto;padding-bottom:4rem}
.page-head{margin-bottom:1.1rem}
h1{margin:.2rem 0;font-size:clamp(2.8rem,6vw,4.8rem);letter-spacing:-.04em}
.page-head>p:last-child{max-width:680px;color:#8c8594}
.settings-tabs{display:flex;gap:.6rem;margin-bottom:1rem}
.settings-tabs a{display:flex;align-items:center;gap:.5rem;min-width:140px;justify-content:center;padding:.75rem 1rem;border:1px solid #332e39;border-radius:.75rem;background:#0d0b10;color:#d8d1df;font-size:.85rem;font-weight:750;text-decoration:none;transition:.2s ease}
.settings-tabs a:first-child,.settings-tabs a:hover{border-color:#6f42c1;background:linear-gradient(135deg,#39206b,#5b2eb5);color:#fff}
.status-card,.card{margin-bottom:1rem;border:1px solid #2b2631;border-radius:1rem;background:linear-gradient(180deg,#111016,#0f0d13)}
.status-card{padding:1rem}
.status-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:.9rem}
.status-title{display:flex;align-items:center;gap:.8rem}
.status-title h2{margin:0;font-size:1rem}
.status-title p{margin:.2rem 0 0;color:#8c8594;font-size:.8rem}
.status-dot{width:.65rem;height:.65rem;border-radius:50%;background:#37df82;box-shadow:0 0 18px rgba(55,223,130,.35)}
.status-dot.warn{background:#e9c46a;box-shadow:none}
.status-grid{display:grid;grid-template-columns:repeat(3,1fr);border:1px solid #29242f;border-radius:.85rem;overflow:hidden;background:#0b0a0d}
.status-item{display:grid;justify-items:center;gap:.3rem;padding:1rem;text-align:center;border-right:1px solid #29242f}
.status-item:last-child{border-right:0}
.status-item>svg{font-size:1.2rem;color:#d4c7e3}
.status-item strong{font-size:.85rem}
.status-item span{font-size:.78rem;color:#c5b8ca}
.status-item span.good{color:#60e99a}
.status-item small{color:#9a93a4;font-size:.7rem}
.settings-section{scroll-margin-top:1rem}
.card{padding:1.15rem}
.card-heading{display:flex;align-items:flex-start;gap:.8rem;margin-bottom:1rem}
.card-heading.compact{margin:0}
.section-icon{display:grid;place-items:center;flex:0 0 2.5rem;height:2.5rem;border-radius:.75rem;background:#241440;color:#b98cff}
.card-heading h2{margin:0;font-size:1.15rem}
.card-heading p{margin:.25rem 0 0;color:#8c8594;font-size:.82rem;line-height:1.45}
.grid,.password-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.8rem}
.wide{grid-column:1/-1}
label{display:grid;gap:.35rem;color:#aaa4b1;font-size:.78rem}
label small{color:#9a93a4}
input,select,textarea{width:100%;border:1px solid #332e39;border-radius:.65rem;padding:.72rem;background:#0a090c;color:#f6f3fa;transition:border-color .2s ease,box-shadow .2s ease}
input:focus,select:focus,textarea:focus{outline:none;border-color:#6741a1;box-shadow:0 0 0 3px rgba(103,65,161,.13)}
.card-actions{display:flex;align-items:center;justify-content:flex-end;gap:1rem;margin-top:1rem;min-height:2.4rem}
.card-actions span{margin-right:auto;color:#aaa4b1;font-size:.82rem}
.card-actions .success{color:#8ed6a3}
.card-actions .error{color:#ff9d9d}
button{border:0;border-radius:.7rem;padding:.72rem 1rem;background:linear-gradient(135deg,#7737f2,#5c25d9);color:#fff;font-weight:800;cursor:pointer}
button:disabled{cursor:not-allowed;opacity:.55}
button.outline{display:flex;align-items:center;gap:.5rem;border:1px solid #5f3a91;background:transparent;color:#f6f3fa}
.security-summary{display:flex;align-items:center;justify-content:space-between;gap:1rem}
.password-form{margin-top:1rem;padding-top:1rem;border-top:1px solid #29242f}
@media(max-width:700px){
  .settings-tabs{display:grid;grid-template-columns:repeat(3,1fr)}
  .settings-tabs a{min-width:0;padding:.7rem .45rem}
  .status-grid{grid-template-columns:1fr}
  .status-item{border-right:0;border-bottom:1px solid #29242f}
  .status-item:last-child{border-bottom:0}
  .grid,.password-form{grid-template-columns:1fr}
  .wide{grid-column:auto}
  .security-summary,.card-actions{align-items:stretch;flex-direction:column}
  .card-actions button,.security-summary button{width:100%;justify-content:center}
  .card-actions span{margin-right:0}
}
</style>
