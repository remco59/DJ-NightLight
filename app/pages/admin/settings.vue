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
  instagram:{configured:boolean,account:{status:string}|null}
  calendar:{configured:boolean,enabled:boolean}
  email:{configured:boolean}
}

type StripeStatus = {
  status:{keyConfigured:boolean,webhookConfigured:boolean,livemode:boolean|null}
}

type SettingsTab = 'general'|'rendering'|'integrations'|'system'
type GeneralPanel = 'overview'|'company'|'invoice'|'security'

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
const activeTab=ref<SettingsTab>('general')
const generalPanel=ref<GeneralPanel>('overview')

const integrationCount=computed(()=>{
  let count=0
  if(integrationStatus.value?.calendar.configured)count++
  if(integrationStatus.value?.email.configured)count++
  if(stripeStatus.value?.status.keyConfigured&&stripeStatus.value?.status.webhookConfigured)count++
  return count
})

const intelAvailable=computed(()=>Boolean(renderStatus.value?.capabilities.find(item=>item.id==='intel')?.available))
const allHealthy=computed(()=>Boolean(renderStatus.value?.workerOnline&&integrationCount.value===3))
const nextInvoiceLabel=computed(()=>`${form.invoicePrefix || ''}${form.nextInvoiceNumber}`)

function setTab(tab:SettingsTab){
  activeTab.value=tab
  generalPanel.value='overview'
  if(import.meta.client)history.replaceState(null,'',`#${tab}`)
}

const integrationsOpen=ref(false)

onMounted(()=>{
  if(new URLSearchParams(window.location.search).has('instagram')){
    activeTab.value='integrations'
    integrationsOpen.value=true
  }
  const hash=window.location.hash.replace('#','') as SettingsTab
  if(['general','rendering','integrations','system'].includes(hash))activeTab.value=hash
})

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
    message.value=section==='company'?'Bedrijfsgegevens opgeslagen.':'Factuurinstellingen opgeslagen.'
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
      <div>
        <p class="eyebrow">Systeem</p>
        <h1>Instellingen</h1>
        <p>Beheer NightLight, facturatie, integraties en systeeminstellingen.</p>
      </div>
    </header>

    <nav class="settings-tabs" aria-label="Instellingen categorieën">
      <button :class="{active:activeTab==='general'}" @click="setTab('general')"><Icon name="lucide:settings-2"/>Algemeen</button>
      <button :class="{active:activeTab==='rendering'}" @click="setTab('rendering')"><Icon name="lucide:clapperboard"/>Video & rendering</button>
      <button :class="{active:activeTab==='integrations'}" @click="setTab('integrations')"><Icon name="lucide:link-2"/>Integraties</button>
      <button :class="{active:activeTab==='system'}" @click="setTab('system')"><Icon name="lucide:server"/>Systeem</button>
    </nav>

    <section class="status-strip" aria-label="Systeemstatus">
      <div class="status-mini">
        <span class="status-dot" :class="{warn:!renderStatus?.workerOnline}"/>
        <div><strong>Video renderer</strong><span :class="{good:renderStatus?.workerOnline}">{{renderStatus?.workerOnline?'Beschikbaar':'Offline'}}</span><small>{{intelAvailable?'Intel GPU (VAAPI)':'CPU'}}</small></div>
      </div>
      <div class="status-mini">
        <Icon name="lucide:waypoints"/>
        <div><strong>{{integrationCount}} integraties</strong><span :class="{good:integrationCount===3}">{{integrationCount===3?'Actief':'Aandacht nodig'}}</span><small>Google · Resend · Stripe</small></div>
      </div>
      <div class="status-mini">
        <Icon name="lucide:server"/>
        <div><strong>Server</strong><span :class="{good:allHealthy}">{{allHealthy?'Online':'Controleren'}}</span><small>NightLight backoffice</small></div>
      </div>
      <button class="outline status-action" @click="setTab('system')">Systeemstatus bekijken <Icon name="lucide:arrow-right"/></button>
    </section>

    <section v-if="activeTab==='general'" class="tab-pane">
      <template v-if="generalPanel==='overview'">
        <div class="overview-grid">
          <button class="overview-card" @click="generalPanel='company'">
            <span class="section-icon"><Icon name="lucide:building-2"/></span>
            <div><h2>Bedrijfsgegevens</h2><p>Je bedrijfsinformatie, contactgegevens en factuurgegevens.</p><dl><div><dt>Bedrijfsnaam</dt><dd>{{form.companyName}}</dd></div><div><dt>KvK</dt><dd>{{form.registrationNumber||'—'}}</dd></div><div><dt>BTW</dt><dd>{{form.vatNumber||'—'}}</dd></div></dl></div>
            <Icon class="card-arrow" name="lucide:chevron-right"/>
          </button>
          <button class="overview-card" @click="generalPanel='invoice'">
            <span class="section-icon"><Icon name="lucide:receipt-text"/></span>
            <div><h2>Facturatie</h2><p>Factuurnummering, betaaltermijnen en standaardteksten.</p><dl><div><dt>Volgend nummer</dt><dd>{{nextInvoiceLabel}}</dd></div><div><dt>Betaaltermijn</dt><dd>{{form.defaultPaymentTermDays}} dagen</dd></div><div><dt>Standaard btw</dt><dd>{{form.defaultVatRateBasisPoints/100}}%</dd></div></dl></div>
            <Icon class="card-arrow" name="lucide:chevron-right"/>
          </button>
          <button class="overview-card" @click="generalPanel='security'">
            <span class="section-icon"><Icon name="lucide:lock-keyhole"/></span>
            <div><h2>Account & beveiliging</h2><p>Wijzig je wachtwoord en houd je account veilig.</p><span class="manage-link">Beheren <Icon name="lucide:arrow-right"/></span></div>
            <Icon class="card-arrow" name="lucide:chevron-right"/>
          </button>
          <button class="overview-card" @click="setTab('system')">
            <span class="section-icon"><Icon name="lucide:sliders-horizontal"/></span>
            <div><h2>Geavanceerd</h2><p>Updates, diagnose en andere systeeminstellingen.</p><span class="manage-link">Open systeeminstellingen <Icon name="lucide:arrow-right"/></span></div>
            <Icon class="card-arrow" name="lucide:chevron-right"/>
          </button>
        </div>
      </template>

      <template v-else>
        <button class="back-link" @click="generalPanel='overview'"><Icon name="lucide:arrow-left"/> Terug naar overzicht</button>

        <form v-if="generalPanel==='company'" class="card detail-card" @submit.prevent="save('company')">
          <div class="detail-heading"><span class="section-icon"><Icon name="lucide:building-2"/></span><div><h2>Bedrijfsgegevens</h2><p>Deze informatie wordt gebruikt op facturen, in communicatie en in je klantenportaal.</p></div></div>
          <div class="grid">
            <label>Bedrijfsnaam<input v-model="form.companyName" required></label>
            <label>Adres<input v-model="form.address"></label>
            <label>Postcode<input v-model="form.postalCode"></label>
            <label>Plaats<input v-model="form.city"></label>
            <label>Land<input v-model="form.country"></label>
            <label>E-mail<input v-model="form.email" type="email"></label>
            <label>Telefoon<input v-model="form.phone"></label>
            <label>KvK-nummer<input v-model="form.registrationNumber"></label>
            <label>BTW-nummer<input v-model="form.vatNumber"></label>
            <label>IBAN<input v-model="form.iban"></label>
          </div>
          <div class="card-actions"><span v-if="messageSection==='company'">{{message}}</span><button :disabled="saving==='company'">{{saving==='company'?'Opslaan…':'Wijzigingen opslaan'}}</button></div>
        </form>

        <form v-if="generalPanel==='invoice'" class="card detail-card" @submit.prevent="save('invoice')">
          <div class="detail-heading"><span class="section-icon"><Icon name="lucide:receipt-text"/></span><div><h2>Facturatie</h2><p>Stel factuurnummering, betaling en juridische standaardteksten in.</p></div></div>
          <div class="subtabs"><span class="active">Nummering</span><span>Betaling</span><span>Standaardteksten</span><span>Juridisch</span></div>
          <div class="grid invoice-grid">
            <label>Voorvoegsel factuurnummer<input v-model="form.invoicePrefix" required></label>
            <label>Volgend nummer<input :value="form.nextInvoiceNumber" disabled><small>Loopt automatisch op bij definitief maken.</small></label>
            <label>BTW-berekening<select v-model="form.defaultVatMode"><option value="exclusive">Prijzen exclusief btw</option><option value="inclusive">Prijzen inclusief btw</option><option value="exempt">Geen btw / vrijgesteld</option></select></label>
            <label>BTW-tarief (%)<input :value="form.defaultVatRateBasisPoints/100" type="number" min="0" max="100" step="0.01" @input="setVatRate"></label>
            <label>Betalingstermijn (dagen)<input v-model.number="form.defaultPaymentTermDays" type="number" min="0" max="365"></label>
            <label class="wide">Betalingsvoorwaarden<textarea v-model="form.paymentTerms" rows="3"/></label>
            <label class="wide">Juridische tekst<textarea v-model="form.legalText" rows="4"/></label>
          </div>
          <div class="card-actions"><span v-if="messageSection==='invoice'">{{message}}</span><button :disabled="saving==='invoice'">{{saving==='invoice'?'Opslaan…':'Wijzigingen opslaan'}}</button></div>
        </form>

        <section v-if="generalPanel==='security'" class="card detail-card security-card">
          <div class="detail-heading"><span class="section-icon"><Icon name="lucide:lock-keyhole"/></span><div><h2>Account & beveiliging</h2><p>Wijzig je wachtwoord om je account veilig te houden.</p></div></div>
          <button v-if="!passwordOpen" class="outline" type="button" @click="passwordOpen=true">Wachtwoord wijzigen <Icon name="lucide:arrow-right"/></button>
          <form v-else class="password-form" @submit.prevent="changePassword">
            <label class="wide">Huidig wachtwoord<input v-model="passwordForm.currentPassword" type="password" autocomplete="current-password" minlength="8" maxlength="200" required></label>
            <label>Nieuw wachtwoord<input v-model="passwordForm.newPassword" type="password" autocomplete="new-password" minlength="12" maxlength="200" required><small>Gebruik minstens 12 tekens.</small></label>
            <label>Bevestig nieuw wachtwoord<input v-model="passwordForm.confirmPassword" type="password" autocomplete="new-password" minlength="12" maxlength="200" required></label>
            <div class="card-actions wide"><span :class="passwordMessageType">{{passwordMessage}}</span><button :disabled="passwordSaving">{{passwordSaving?'Wijzigen…':'Wachtwoord opslaan'}}</button></div>
          </form>
        </section>
      </template>
    </section>

    <section v-else-if="activeTab==='rendering'" class="tab-pane"><AdminRenderSettings/></section>

    <section v-else-if="activeTab==='integrations'" class="tab-pane integrations-pane">
      <div class="section-title"><span class="section-icon"><Icon name="lucide:link-2"/></span><div><h2>Integraties</h2><p>Koppel NightLight met andere diensten om je workflow te automatiseren.</p></div></div>
      <div class="integration-overview">
        <article class="service-card"><div><span class="brand instagram"><Icon name="lucide:instagram"/></span><span class="pill" :class="{on:integrationStatus?.instagram.account?.status==='active'}">{{integrationStatus?.instagram.account?(integrationStatus.instagram.account.status==='active'?'Verbonden':'Opnieuw verbinden'):(integrationStatus?.instagram.configured?'Niet verbonden':'Niet ingesteld')}}</span></div><h3>Instagram</h3><p>Publiceer en plan posts vanuit NightLight.</p><a href="#integration-details" @click="integrationsOpen=true">Instellingen <Icon name="lucide:arrow-right"/></a></article>
        <article class="service-card"><div><span class="brand google">G</span><span class="pill" :class="{on:integrationStatus?.calendar.configured}">{{integrationStatus?.calendar.configured?'Verbonden':'Niet gekoppeld'}}</span></div><h3>Google Calendar</h3><p>Synchroniseer geboekte gigs met je agenda.</p><a href="#integration-details">Instellingen <Icon name="lucide:arrow-right"/></a></article>
        <article class="service-card"><div><span class="brand resend"><Icon name="lucide:send"/></span><span class="pill" :class="{on:integrationStatus?.email.configured}">{{integrationStatus?.email.configured?'Actief':'Niet ingesteld'}}</span></div><h3>Resend</h3><p>Verstuur e-mails, facturen en uitnodigingen.</p><a href="#integration-details">Instellingen <Icon name="lucide:arrow-right"/></a></article>
        <article class="service-card"><div><span class="brand stripe">S</span><span class="pill" :class="{on:stripeStatus?.status.keyConfigured&&stripeStatus?.status.webhookConfigured}">{{stripeStatus?.status.keyConfigured&&stripeStatus?.status.webhookConfigured?(stripeStatus?.status.livemode?'Live':'Testmodus'):'Niet ingesteld'}}</span></div><h3>Stripe</h3><p>Online betalingen en betaalstatussen.</p><a href="#integration-details">Instellingen <Icon name="lucide:arrow-right"/></a></article>
      </div>
      <details id="integration-details" class="management-details" :open="integrationsOpen" @toggle="integrationsOpen=($event.target as HTMLDetailsElement).open"><summary>Integraties beheren <Icon name="lucide:chevron-down"/></summary><AdminIntegrationsSettings/></details>
    </section>

    <section v-else class="tab-pane system-pane">
      <div class="section-title"><span class="section-icon"><Icon name="lucide:server"/></span><div><h2>Systeem</h2><p>Bekijk status, updates en geavanceerde instellingen van NightLight.</p></div></div>
      <div class="system-grid">
        <article class="system-card"><span class="section-icon success"><Icon name="lucide:activity"/></span><div><h3>Systeemstatus</h3><p>{{allHealthy?'Alle systemen werken correct.':'Een of meer onderdelen vragen aandacht.'}}</p></div><span class="pill" :class="{on:allHealthy}">{{allHealthy?'Online':'Controleren'}}</span></article>
        <article class="system-card"><span class="section-icon"><Icon name="lucide:chart-no-axes-combined"/></span><div><h3>Diagnostiek</h3><p>Bekijk renderer- en integratiestatus hierboven.</p></div><Icon name="lucide:chevron-right"/></article>
        <article class="system-card"><span class="section-icon"><Icon name="lucide:database"/></span><div><h3>Database</h3><p>Onderhoud en back-ups worden door de server beheerd.</p></div><Icon name="lucide:chevron-right"/></article>
        <article class="system-card"><span class="section-icon"><Icon name="lucide:settings"/></span><div><h3>Geavanceerde opties</h3><p>Technische instellingen blijven veilig op de server.</p></div><Icon name="lucide:chevron-right"/></article>
      </div>
      <AdminUpdateSettings/>
    </section>
  </div>
</template>

<style scoped>
.settings{max-width:1180px;margin-inline:auto;padding-bottom:4rem}
.page-head{display:flex;align-items:flex-end;justify-content:space-between;gap:1rem;margin-bottom:1rem}.page-head h1{margin:.15rem 0;font-size:clamp(2.8rem,6vw,4.5rem);letter-spacing:-.045em}.page-head>div>p:last-child{margin:.2rem 0;color:var(--text-subtle)}
.settings-tabs{display:flex;gap:.5rem;flex-wrap:wrap;margin-bottom:1rem}.settings-tabs button{display:flex;align-items:center;gap:.45rem;min-height:2.65rem;padding:.68rem 1rem;border:1px solid var(--border-strong);border-radius:.72rem;background:#0d0b10;color:#cfc6d6;font-size:.8rem;font-weight:760;cursor:pointer}.settings-tabs button.active{border-color:#6f42c1;background:linear-gradient(135deg,#5526aa,#6f35df);color:#fff;box-shadow:0 8px 26px rgba(84,38,170,.18)}
.status-strip{display:grid;grid-template-columns:repeat(3,minmax(0,1fr)) auto;align-items:stretch;margin-bottom:1.15rem;border:1px solid var(--border);border-radius:.95rem;background:linear-gradient(180deg,#111016,#0d0b10);overflow:hidden}.status-mini{display:flex;align-items:center;gap:.65rem;padding:.85rem 1rem;border-right:1px solid var(--border)}.status-mini>svg{font-size:1.2rem;color:#d0c2df}.status-mini>div{display:grid}.status-mini strong{font-size:.75rem}.status-mini span{font-size:.72rem;color:#aaa0b0}.status-mini span.good{color:#55e995}.status-mini small{font-size:.65rem;color:var(--text-subtle)}.status-dot{width:.55rem;height:.55rem;border-radius:50%;background:#41df87;box-shadow:0 0 14px rgba(65,223,135,.38)}.status-dot.warn{background:#e9c46a;box-shadow:none}.status-action{margin:.65rem;align-self:center}
.tab-pane{animation:fade .18s ease}@keyframes fade{from{opacity:.45;transform:translateY(3px)}to{opacity:1;transform:none}}
.overview-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.9rem}.overview-card{position:relative;display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:start;gap:.9rem;padding:1.05rem;text-align:left;border:1px solid var(--border);border-radius:1rem;background:linear-gradient(180deg,#121017,#0f0d13);color:var(--text);cursor:pointer;transition:.18s ease}.overview-card:hover{transform:translateY(-1px);border-color:#583c78;background:#131019}.overview-card h2{margin:.05rem 0;font-size:1rem}.overview-card p{margin:.25rem 0 .8rem;color:var(--text-subtle);font-size:.77rem;line-height:1.4}.overview-card dl{display:grid;gap:.35rem;margin:0}.overview-card dl div{display:flex;justify-content:space-between;gap:1rem;padding-top:.35rem;border-top:1px solid var(--border);font-size:.72rem}.overview-card dt{color:var(--text-subtle)}.overview-card dd{margin:0;color:#e8e1eb}.card-arrow{align-self:center;color:#8f8299}.manage-link{display:inline-flex;align-items:center;gap:.4rem;color:#c9b6e6;font-size:.74rem;font-weight:750}
.section-icon{display:grid;place-items:center;flex:0 0 2.55rem;width:2.55rem;height:2.55rem;border-radius:.75rem;background:#28164a;color:#bd91ff}.section-icon.success{background:#123c2b;color:#61e89b}
.back-link{display:inline-flex;align-items:center;gap:.4rem;margin:0 0 .8rem;padding:0;border:0;background:transparent;color:#aaa0b0;cursor:pointer;font-size:.78rem}.card{padding:1.15rem;border:1px solid var(--border);border-radius:1rem;background:linear-gradient(180deg,#111016,#0f0d13)}.detail-card{max-width:100%}.detail-heading,.section-title{display:flex;align-items:flex-start;gap:.8rem;margin-bottom:1rem}.detail-heading h2,.section-title h2{margin:0;font-size:1.25rem}.detail-heading p,.section-title p{margin:.25rem 0 0;color:var(--text-subtle);font-size:.8rem}.grid,.password-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.8rem}.wide{grid-column:1/-1}label{display:grid;gap:.35rem;color:var(--text-muted);font-size:.75rem}label small{color:var(--text-subtle)}input,select,textarea{width:100%;border:1px solid var(--border-strong);border-radius:.65rem;padding:.72rem;background:#09080b;color:var(--text)}input:focus,select:focus,textarea:focus{outline:none;border-color:#7144b5;box-shadow:0 0 0 3px rgba(113,68,181,.13)}.card-actions{display:flex;align-items:center;justify-content:flex-end;gap:1rem;margin-top:1rem;min-height:2.4rem}.card-actions>span{margin-right:auto;color:var(--text-muted);font-size:.78rem}.card-actions .success{color:#7be0a8}.card-actions .error{color:#ff9d9d}.subtabs{display:flex;gap:.35rem;margin-bottom:1rem;padding:.25rem;border-radius:.75rem;background:#0a090c;border:1px solid var(--border)}.subtabs span{padding:.5rem .85rem;border-radius:.55rem;color:#857c8b;font-size:.72rem}.subtabs span.active{background:#5125a1;color:#fff}
button:not(.overview-card):not(.back-link):not(.settings-tabs button){display:inline-flex;align-items:center;justify-content:center;gap:.4rem;border:0;border-radius:.68rem;padding:.68rem .95rem;background:linear-gradient(135deg,#7737f2,#5c25d9);color:#fff;font-weight:800;cursor:pointer}button:disabled{opacity:.55;cursor:not-allowed}.outline{border:1px solid var(--border-strong)!important;background:transparent!important;color:var(--text)!important}
.integration-overview{display:grid;grid-template-columns:repeat(auto-fit,minmax(14rem,1fr));gap:.8rem}.service-card{padding:1rem;border:1px solid var(--border);border-radius:.95rem;background:linear-gradient(180deg,#111016,#0f0d13)}.service-card>div{display:flex;align-items:center;justify-content:space-between}.brand{display:grid;place-items:center;width:2.45rem;height:2.45rem;border-radius:.7rem;font-weight:900}.brand.google{background:linear-gradient(135deg,#2d6cdf,#34a853 45%,#fbbc05 70%,#ea4335);color:#fff}.brand.resend{background:#171717;color:#fff}.brand.instagram{background:linear-gradient(135deg,#833ab4,#c13584 50%,#fd1d1d 80%,#fcb045);color:#fff}.brand.stripe{background:linear-gradient(135deg,#7855ff,#4f2de0);color:#fff}.pill{display:inline-flex;align-items:center;padding:.27rem .6rem;border-radius:99px;background:#26222a;color:#9c929f;font-size:.65rem;font-weight:800}.pill.on{background:#153426;color:#72e6a2}.service-card h3{margin:.8rem 0 .2rem;font-size:.95rem}.service-card p{min-height:2.2rem;margin:0;color:var(--text-subtle);font-size:.74rem;line-height:1.4}.service-card a{display:flex;align-items:center;justify-content:center;gap:.35rem;margin-top:.85rem;padding:.58rem .7rem;border:1px solid var(--border-strong);border-radius:.6rem;color:#e8e0ed;text-decoration:none;font-size:.72rem;font-weight:750}.management-details{margin-top:1rem;border:1px solid var(--border);border-radius:.9rem;background:#0d0b10}.management-details>summary{display:flex;align-items:center;justify-content:space-between;padding:.9rem 1rem;cursor:pointer;color:#d7ccde;font-size:.8rem;font-weight:800}.management-details[open]>summary{border-bottom:1px solid var(--border)}.management-details :deep(.integrations){margin-top:0;padding:0 1rem 1rem}.management-details :deep(.section-intro){display:none}
.system-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.75rem;margin-bottom:1rem}.system-card{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:.75rem;padding:.9rem;border:1px solid var(--border);border-radius:.9rem;background:linear-gradient(180deg,#111016,#0f0d13)}.system-card h3{margin:0;font-size:.88rem}.system-card p{margin:.2rem 0 0;color:var(--text-subtle);font-size:.72rem}
@media(max-width:900px){.status-strip{grid-template-columns:1fr 1fr}.status-mini{border-bottom:1px solid var(--border)}.integration-overview{grid-template-columns:1fr}.overview-grid,.system-grid{grid-template-columns:1fr}}
@media(max-width:640px){.settings{padding-inline:.15rem}.settings-tabs{display:grid;grid-template-columns:1fr 1fr}.settings-tabs button{justify-content:center}.status-strip{grid-template-columns:1fr}.status-mini{border-right:0}.status-action{width:calc(100% - 1.3rem)}.grid,.password-form{grid-template-columns:1fr}.wide{grid-column:auto}.subtabs{overflow-x:auto}.overview-card{grid-template-columns:auto minmax(0,1fr)}.overview-card>.card-arrow{display:none}}
</style>
