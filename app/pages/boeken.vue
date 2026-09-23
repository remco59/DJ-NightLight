<script setup lang="ts">
import { apiErrorMessage } from '~/utils/api-error'

definePageMeta({layout:'public'})
const {data}=await useSiteContent();const content=computed(()=>data.value?.content)
const form=reactive({name:'',company:'',email:'',phone:'',eventType:'',eventDate:'',location:'',message:'',website:''})
const sending=ref(false);const errorMessage=ref('');const sent=ref(false)

async function submit(){
  sending.value=true;errorMessage.value=''
  try{
    await $fetch('/api/public/inquiry',{method:'POST',body:form})
    sent.value=true
  }catch(error:unknown){errorMessage.value=apiErrorMessage(error,content.value?.publicCopy.booking.errorFallback||'Je aanvraag kon niet worden verstuurd. Probeer het later opnieuw.')}
  finally{sending.value=false}
}

useSeoMeta({title:()=>`Boeken — ${content.value?.brandName||'DJ NightLight'}`,description:()=>content.value?.bookingBody})
</script>
<template><main v-if="content" class="public-page"><div class="public-container booking-grid"><div><p class="eyebrow">{{content.bookingEyebrow}}</p><h1 class="display-title">{{content.bookingTitle}}</h1><p class="lead-copy">{{content.bookingBody}}</p><div class="direct"><a v-if="content.contactEmail" :href="`mailto:${content.contactEmail}`"><Icon name="lucide:mail" aria-hidden="true" />{{content.contactEmail}}</a><a v-if="content.contactPhone" :href="`tel:${content.contactPhone}`"><Icon name="lucide:phone" aria-hidden="true" />{{content.contactPhone}}</a></div></div>
<div class="form-wrap"><div v-if="sent" class="success"><span>{{content.publicCopy.booking.successEyebrow}}</span><strong>{{content.publicCopy.booking.successTitle}}</strong><p>{{content.publicCopy.booking.successBody}}</p></div><form v-else @submit.prevent="submit"><div class="fields"><label>{{content.publicCopy.booking.nameLabel}}<input v-model="form.name" required autocomplete="name"></label><label>{{content.publicCopy.booking.companyLabel}} <span>{{content.publicCopy.booking.optionalLabel}}</span><input v-model="form.company" autocomplete="organization"></label><label>{{content.publicCopy.booking.emailLabel}}<input v-model="form.email" required type="email" autocomplete="email"></label><label>{{content.publicCopy.booking.phoneLabel}} <span>{{content.publicCopy.booking.optionalLabel}}</span><input v-model="form.phone" type="tel" autocomplete="tel"></label><label>{{content.publicCopy.booking.eventTypeLabel}}<input v-model="form.eventType" :placeholder="content.publicCopy.booking.eventTypePlaceholder"></label><label>{{content.publicCopy.booking.dateLabel}}<input v-model="form.eventDate" type="date"></label><label class="wide">{{content.publicCopy.booking.locationLabel}}<input v-model="form.location" :placeholder="content.publicCopy.booking.locationPlaceholder"></label><label class="wide">{{content.publicCopy.booking.messageLabel}}<textarea v-model="form.message" rows="6" :placeholder="content.publicCopy.booking.messagePlaceholder"/></label><label class="honey" aria-hidden="true">Website<input v-model="form.website" tabindex="-1" autocomplete="off"></label></div><p v-if="errorMessage" class="error">{{errorMessage}}</p><button class="public-button" type="submit" :disabled="sending">{{sending?content.publicCopy.booking.sendingLabel:content.publicCopy.booking.submitLabel}}<Icon v-if="!sending" name="lucide:send" aria-hidden="true" /></button></form></div></div></main></template>
<style scoped>
.booking-grid{display:grid;grid-template-columns:1fr 1fr;gap:clamp(2rem,7vw,7rem);align-items:start}.display-title{font-size:clamp(3rem,7vw,6rem)}.direct{display:grid;gap:.4rem;margin-top:2rem}.direct a{display:inline-flex;align-items:center;gap:.5rem;width:max-content;color:#b8b2bd}.form-wrap{padding:1.4rem;border:1px solid #29252e;border-radius:1rem;background:#0e0c11}.fields{display:grid;grid-template-columns:repeat(2,1fr);gap:.8rem;margin-bottom:1rem}.wide{grid-column:1/-1}label{display:grid;gap:.35rem;color:#aaa4b0;font-size:.8rem}label span{color:#66606a}input,textarea{width:100%;border:1px solid #34303a;border-radius:.65rem;padding:.78rem;background:#08070a;color:#f5f2f7}.honey{position:absolute;left:-10000px;width:1px;height:1px;overflow:hidden}.public-button{border:0;cursor:pointer}.public-button:disabled{opacity:.55}.error{color:#ff9daa}.success{display:grid;min-height:25rem;align-content:center;gap:.7rem}.success span{color:#7e7784;font-size:.7rem;letter-spacing:.12em;text-transform:uppercase}.success strong{font-size:2rem;line-height:1.05}.success p{color:#928b98;line-height:1.6}@media(max-width:800px){.booking-grid,.fields{grid-template-columns:1fr}.wide{grid-column:auto}}
</style>
