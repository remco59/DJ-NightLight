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

const {data,refresh}=await useFetch<{settings:Settings}>('/api/admin/business-settings')
if(!data.value)throw createError({statusCode:500,statusMessage:'Bedrijfsinstellingen niet beschikbaar'})

const form=reactive({...data.value.settings})
const saving=ref(false)
const message=ref('')
const passwordForm=reactive({currentPassword:'',newPassword:'',confirmPassword:''})
const passwordSaving=ref(false)
const passwordMessage=ref('')
const passwordMessageType=ref<'success'|'error'|''>('')

function setVatRate(event:Event){
  form.defaultVatRateBasisPoints=Math.round(Number((event.target as HTMLInputElement).value)*100)
}

async function save(){
  saving.value=true
  message.value=''
  try{
    await $fetch('/api/admin/business-settings',{method:'PUT',body:form})
    await refresh()
    message.value='Bedrijfsgegevens en factuurinstellingen opgeslagen.'
  }catch(error:unknown){
    message.value=apiErrorMessage(error,'Instellingen opslaan is niet gelukt.')
  }finally{
    saving.value=false
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
    <header>
      <p class="eyebrow">Systeem</p>
      <h1>Instellingen</h1>
      <p>Beheer bedrijfsgegevens, accountbeveiliging en gekoppelde diensten.</p>
    </header>

    <form @submit.prevent="save">
      <section class="card">
        <h2>Bedrijf</h2>
        <div class="grid">
          <label class="wide">Bedrijfsnaam<input v-model="form.companyName" required></label>
          <label class="wide">Adres<input v-model="form.address"></label>
          <label>Postcode<input v-model="form.postalCode"></label>
          <label>Plaats<input v-model="form.city"></label>
          <label>Land<input v-model="form.country"></label>
          <label>E-mail<input v-model="form.email" type="email"></label>
          <label>Telefoon<input v-model="form.phone"></label>
          <label>KvK-nummer<input v-model="form.registrationNumber"></label>
          <label>Btw-nummer<input v-model="form.vatNumber"></label>
          <label>IBAN<input v-model="form.iban"></label>
        </div>
      </section>

      <section class="card">
        <h2>Standaardinstellingen facturen</h2>
        <div class="grid">
          <label>Voorvoegsel factuurnummer<input v-model="form.invoicePrefix" required></label>
          <label>Volgend nummer<input :value="form.nextInvoiceNumber" disabled><small>Loopt automatisch op bij het definitief maken.</small></label>
          <label>Btw-berekening<select v-model="form.defaultVatMode"><option value="exclusive">Prijzen exclusief btw</option><option value="inclusive">Prijzen inclusief btw</option><option value="exempt">Geen btw / vrijgesteld</option></select></label>
          <label>Btw-tarief (%)<input :value="form.defaultVatRateBasisPoints/100" type="number" min="0" max="100" step="0.01" @input="setVatRate"></label>
          <label>Betalingstermijn (dagen)<input v-model.number="form.defaultPaymentTermDays" type="number" min="0" max="365"></label>
          <label class="wide">Betalingsvoorwaarden<textarea v-model="form.paymentTerms" rows="3"/></label>
          <label class="wide">Juridische tekst<textarea v-model="form.legalText" rows="3"/></label>
        </div>
      </section>

      <div class="save">
        <span>{{message}}</span>
        <button :disabled="saving">{{saving?'Opslaan…':'Bedrijfsinstellingen opslaan'}}</button>
      </div>
    </form>

    <section class="card security-card">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Accountbeveiliging</p>
          <h2>Wachtwoord wijzigen</h2>
        </div>
        <p>Als je je wachtwoord wijzigt, word je uitgelogd uit je andere NightLight-sessies. Deze browser blijft ingelogd.</p>
      </div>

      <form class="password-form" @submit.prevent="changePassword">
        <label>
          Huidig wachtwoord
          <input
            v-model="passwordForm.currentPassword"
            type="password"
            autocomplete="current-password"
            minlength="8"
            maxlength="200"
            required
          >
        </label>
        <label>
          Nieuw wachtwoord
          <input
            v-model="passwordForm.newPassword"
            type="password"
            autocomplete="new-password"
            minlength="12"
            maxlength="200"
            required
          >
          <small>Gebruik minstens 12 tekens.</small>
        </label>
        <label>
          Bevestig nieuw wachtwoord
          <input
            v-model="passwordForm.confirmPassword"
            type="password"
            autocomplete="new-password"
            minlength="12"
            maxlength="200"
            required
          >
        </label>

        <div class="security-actions">
          <span :class="passwordMessageType">{{passwordMessage}}</span>
          <button :disabled="passwordSaving">{{passwordSaving?'Wijzigen…':'Wachtwoord wijzigen'}}</button>
        </div>
      </form>
    </section>

    <AdminRenderSettings/>

    <AdminIntegrationsSettings/>
  </div>
</template>

<style scoped>
.settings{max-width:900px;margin-inline:auto}
header{margin-bottom:1.5rem}
h1{margin:.2rem 0;font-size:clamp(2.5rem,6vw,4.5rem);letter-spacing:-.05em}
header>p:last-child{max-width:680px;color:#8c8594}
.card{margin-bottom:1rem;padding:1.2rem;border:1px solid #2b2631;border-radius:1rem;background:#100e14}
.card h2{margin-top:0}
.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:.8rem}
.wide{grid-column:1/-1}
label{display:grid;gap:.35rem;color:#aaa4b1;font-size:.8rem}
label small{color:#716a78}
input,select,textarea{width:100%;border:1px solid #332e39;border-radius:.65rem;padding:.7rem;background:#0b0a0d;color:#f6f3fa}
.save,.security-actions{display:flex;align-items:center;justify-content:space-between;gap:1rem}
.save span,.security-actions span{color:#aaa4b1}
button{border:0;border-radius:.7rem;padding:.75rem 1rem;background:#fff;color:#09080b;font-weight:800}
button:disabled{cursor:not-allowed;opacity:.6}
.security-card{margin-top:1.5rem}
.section-heading{display:flex;justify-content:space-between;gap:2rem;align-items:flex-start;margin-bottom:1rem}
.section-heading h2{margin:.15rem 0 0}
.section-heading>p{max-width:430px;margin:0;color:#8c8594;font-size:.9rem;line-height:1.5}
.password-form{display:grid;grid-template-columns:repeat(2,1fr);gap:.8rem}
.password-form label:first-child{grid-column:1/-1}
.security-actions{grid-column:1/-1;margin-top:.2rem}
.security-actions .success{color:#8ed6a3}
.security-actions .error{color:#ff9d9d}
@media(max-width:650px){
  .grid,.password-form{grid-template-columns:1fr}
  .wide,.password-form label:first-child{grid-column:auto}
  .save,.security-actions,.section-heading{align-items:stretch;flex-direction:column}
  .save button,.security-actions button{width:100%}
}
</style>
