<script setup lang="ts">
import { inquiryInputSchema, todayInAmsterdam, type InquiryField } from '~~/shared/schemas/inquiry'
import { apiErrorMessage, apiFieldErrors } from '~/utils/api-error'

definePageMeta({layout:'public'})
const {data}=await useSiteContent();const content=computed(()=>data.value?.content)
const form=reactive({name:'',company:'',email:'',phone:'',eventType:'',eventDate:'',location:'',message:'',website:''})
const sending=ref(false);const errorMessage=ref('');const sent=ref(false)
const fieldErrors=ref<Partial<Record<InquiryField,string>>>({})
const successHeading=ref<HTMLElement|null>(null)
const today=todayInAmsterdam()
const eventTypeOptions=['Bruiloft','Verjaardag','Bedrijfsfeest','Studentenfeest','Clubavond']

// A half-filled request survives a refresh or a quick switch to another app.
const DRAFT_KEY='nightlight-booking-draft'
onMounted(()=>{try{const saved=sessionStorage.getItem(DRAFT_KEY);if(saved)Object.assign(form,{...JSON.parse(saved),website:''})}catch{/* storage unavailable */}})
watch(form,(value)=>{if(sent.value)return;try{const {website:_website,...draft}=value;sessionStorage.setItem(DRAFT_KEY,JSON.stringify(draft))}catch{/* storage unavailable */}},{deep:true})

function errorFor(field:InquiryField){return fieldErrors.value[field]}
function describedBy(field:InquiryField){return errorFor(field)?`${field}-error`:undefined}
function clearError(field:InquiryField){if(fieldErrors.value[field])fieldErrors.value=Object.fromEntries(Object.entries(fieldErrors.value).filter(([key])=>key!==field))}
async function focusFirstError(){await nextTick();const first=document.querySelector<HTMLElement>('.booking-form [aria-invalid="true"]');first?.focus()}

async function submit(){
  errorMessage.value=''
  const parsed=inquiryInputSchema.safeParse(form)
  if(!parsed.success){
    const next:Partial<Record<InquiryField,string>>={}
    for(const issue of parsed.error.issues){const field=issue.path[0] as InquiryField;if(field&&!next[field])next[field]=issue.message}
    fieldErrors.value=next
    await focusFirstError()
    return
  }
  fieldErrors.value={}
  sending.value=true
  try{
    await $fetch('/api/public/inquiry',{method:'POST',body:form})
    sent.value=true
    try{sessionStorage.removeItem(DRAFT_KEY)}catch{/* storage unavailable */}
    await nextTick();successHeading.value?.focus()
  }catch(error:unknown){
    const fields=apiFieldErrors(error)
    if(Object.keys(fields).length){fieldErrors.value=fields as Partial<Record<InquiryField,string>>;await focusFirstError()}
    else errorMessage.value=apiErrorMessage(error,content.value?.publicCopy.booking.errorFallback||'Je aanvraag kon niet worden verstuurd. Probeer het later opnieuw.')
  }
  finally{sending.value=false}
}

useSeoMeta({title:()=>`Boeken — ${content.value?.brandName||'DJ NightLight'}`,description:()=>content.value?.bookingBody})
</script>

<template>
  <main v-if="content" class="public-page">
    <div class="public-container booking-grid">
      <div>
        <p class="eyebrow">{{content.bookingEyebrow}}</p>
        <h1 class="display-title">{{content.bookingTitle}}</h1>
        <p class="lead-copy">{{content.bookingBody}}</p>
        <div class="direct">
          <a v-if="content.contactEmail" :href="`mailto:${content.contactEmail}`"><Icon name="lucide:mail" aria-hidden="true" />{{content.contactEmail}}</a>
          <a v-if="content.contactPhone" :href="`tel:${content.contactPhone}`"><Icon name="lucide:phone" aria-hidden="true" />{{content.contactPhone}}</a>
        </div>
      </div>

      <div class="form-wrap">
        <div v-if="sent" class="success" role="status">
          <span>{{content.publicCopy.booking.successEyebrow}}</span>
          <strong ref="successHeading" tabindex="-1">{{content.publicCopy.booking.successTitle}}</strong>
          <p>{{content.publicCopy.booking.successBody}}</p>
          <p v-if="content.contactPhone||content.contactEmail" class="success-direct">
            Iets vergeten of haast?
            <a v-if="content.contactPhone" :href="`tel:${content.contactPhone}`">Bel {{content.contactPhone}}</a>
            <template v-if="content.contactPhone&&content.contactEmail"> of </template>
            <a v-if="content.contactEmail" :href="`mailto:${content.contactEmail}`">mail {{content.contactEmail}}</a>.
          </p>
        </div>

        <form v-else class="booking-form" novalidate @submit.prevent="submit">
          <p class="form-intro">Alleen je naam en e-mailadres zijn nodig. De rest helpt om meteen goed mee te denken.</p>
          <fieldset class="fields">
            <legend>Je feest</legend>
            <label>
              <span class="label-text">{{content.publicCopy.booking.dateLabel}}</span>
              <input v-model="form.eventDate" type="date" :min="today" :aria-invalid="Boolean(errorFor('eventDate'))" :aria-describedby="describedBy('eventDate')" @input="clearError('eventDate')">
              <small v-if="errorFor('eventDate')" id="eventDate-error" class="field-error">{{errorFor('eventDate')}}</small>
            </label>
            <label>
              <span class="label-text">{{content.publicCopy.booking.locationLabel}}</span>
              <input v-model="form.location" :placeholder="content.publicCopy.booking.locationPlaceholder" :aria-invalid="Boolean(errorFor('location'))" :aria-describedby="describedBy('location')" @input="clearError('location')">
              <small v-if="errorFor('location')" id="location-error" class="field-error">{{errorFor('location')}}</small>
            </label>
            <div class="wide event-type">
              <label for="event-type-input" class="label-text">{{content.publicCopy.booking.eventTypeLabel}}</label>
              <div class="event-type-options" role="group" :aria-label="content.publicCopy.booking.eventTypeLabel">
                <button v-for="option in eventTypeOptions" :key="option" type="button" :aria-pressed="form.eventType===option" @click="form.eventType=form.eventType===option?'':option;clearError('eventType')">{{option}}</button>
              </div>
              <input id="event-type-input" v-model="form.eventType" :placeholder="content.publicCopy.booking.eventTypePlaceholder" :aria-invalid="Boolean(errorFor('eventType'))" :aria-describedby="describedBy('eventType')" @input="clearError('eventType')">
              <small v-if="errorFor('eventType')" id="eventType-error" class="field-error">{{errorFor('eventType')}}</small>
            </div>
            <label class="wide">
              <span class="label-text">{{content.publicCopy.booking.messageLabel}}</span>
              <textarea v-model="form.message" rows="5" :placeholder="content.publicCopy.booking.messagePlaceholder" :aria-invalid="Boolean(errorFor('message'))" :aria-describedby="describedBy('message')" @input="clearError('message')"/>
              <small v-if="errorFor('message')" id="message-error" class="field-error">{{errorFor('message')}}</small>
            </label>
          </fieldset>
          <fieldset class="fields">
            <legend>Jouw gegevens</legend>
            <label>
              <span class="label-text">{{content.publicCopy.booking.nameLabel}}</span>
              <input v-model="form.name" required autocomplete="name" :aria-invalid="Boolean(errorFor('name'))" :aria-describedby="describedBy('name')" @input="clearError('name')">
              <small v-if="errorFor('name')" id="name-error" class="field-error">{{errorFor('name')}}</small>
            </label>
            <label>
              <span class="label-text">{{content.publicCopy.booking.emailLabel}}</span>
              <input v-model="form.email" required type="email" autocomplete="email" inputmode="email" :aria-invalid="Boolean(errorFor('email'))" :aria-describedby="describedBy('email')" @input="clearError('email')">
              <small v-if="errorFor('email')" id="email-error" class="field-error">{{errorFor('email')}}</small>
            </label>
            <label>
              <span class="label-text">{{content.publicCopy.booking.phoneLabel}}</span>
              <input v-model="form.phone" type="tel" autocomplete="tel" :aria-invalid="Boolean(errorFor('phone'))" :aria-describedby="describedBy('phone')" @input="clearError('phone')">
              <small v-if="errorFor('phone')" id="phone-error" class="field-error">{{errorFor('phone')}}</small>
            </label>
            <label>
              <span class="label-text">{{content.publicCopy.booking.companyLabel}}</span>
              <input v-model="form.company" autocomplete="organization" :aria-invalid="Boolean(errorFor('company'))" :aria-describedby="describedBy('company')" @input="clearError('company')">
              <small v-if="errorFor('company')" id="company-error" class="field-error">{{errorFor('company')}}</small>
            </label>
          </fieldset>
          <label class="honey" aria-hidden="true">Website<input v-model="form.website" tabindex="-1" autocomplete="off"></label>
          <p v-if="errorMessage" class="error" role="alert">{{errorMessage}}</p>
          <div class="submit-row"><button class="public-button" type="submit" :disabled="sending">{{sending?content.publicCopy.booking.sendingLabel:content.publicCopy.booking.submitLabel}}<Icon v-if="!sending" name="lucide:send" aria-hidden="true" /></button><span>Vrijblijvend: een aanvraag is nog geen boeking.</span></div>
        </form>
      </div>
    </div>
  </main>
</template>

<style scoped>
.booking-grid{display:grid;grid-template-columns:1fr 1fr;gap:clamp(2rem,7vw,7rem);align-items:start}.display-title{font-size:clamp(3rem,7vw,6rem)}.direct{display:grid;gap:.4rem;margin-top:2rem}.direct a{display:inline-flex;align-items:center;gap:.5rem;width:max-content;min-height:2.75rem;color:#b8b2bd}.form-wrap{padding:1.4rem;border:1px solid #29252e;border-radius:1rem;background:#0e0c11}.form-intro{margin:0 0 1.2rem;color:var(--text-muted);font-size:.9rem;line-height:1.55}.fields{display:grid;grid-template-columns:repeat(2,1fr);gap:1rem .8rem;min-width:0;margin:0 0 1.4rem;padding:0;border:0}.fields legend{grid-column:1/-1;margin-bottom:.9rem;padding:0;color:var(--text);font-size:1.05rem;font-weight:800}.event-type{display:grid;gap:.45rem}.event-type-options{display:flex;flex-wrap:wrap;gap:.4rem}.event-type-options button{min-height:2.75rem;border:1px solid #34303a;border-radius:999px;padding:.45rem .9rem;background:transparent;color:#d8d2dc;font-size:.88rem;cursor:pointer}.event-type-options button[aria-pressed="true"]{border-color:var(--electric-accent);background:rgba(157,92,255,.16);color:#fff}.submit-row{display:flex;flex-wrap:wrap;align-items:center;gap:.6rem 1rem}.submit-row span{color:var(--text-muted);font-size:.85rem}.wide{grid-column:1/-1}label{display:grid;grid-template-rows:auto auto;align-content:start;gap:.35rem;color:#b3adb9;font-size:.8rem}.label-text em{margin-left:.35rem;color:#8f8996;font-style:normal}input,textarea{width:100%;min-height:2.85rem;scroll-margin-top:7rem;border:1px solid #34303a;border-radius:.65rem;padding:.78rem;background:#08070a;color:#f5f2f7}input::placeholder,textarea::placeholder{color:#8a8490}input[aria-invalid="true"],textarea[aria-invalid="true"]{border-color:#c4566a}.field-error{color:#ffb3bf;font-size:.78rem;line-height:1.4}.honey{position:absolute;left:-10000px;width:1px;height:1px;overflow:hidden}.public-button{border:0;cursor:pointer}.public-button:disabled{opacity:.55}.error{color:#ffb3bf}.success{display:grid;min-height:25rem;align-content:center;gap:.7rem}.success span{color:#8f8996;font-size:.7rem;letter-spacing:.12em;text-transform:uppercase}.success strong{font-size:2rem;line-height:1.05;outline:none}.success p{color:#a39daa;line-height:1.6}.success-direct a{color:#e6defc}@media(max-width:800px){.booking-grid,.fields{grid-template-columns:1fr}.wide{grid-column:auto}}
</style>
