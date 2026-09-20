<script setup lang="ts">
import { apiErrorMessage } from '~/utils/api-error'
import type { QuestionnaireField } from '~~/shared/questionnaire'

definePageMeta({layout:'admin'})
const route=useRoute();const id=String(route.params.id)

type Status='lead'|'booked'|'declined'|'cancelled'
type ClientOption={id:string;type:'person'|'company';firstName:string|null;lastName:string|null;companyName:string|null}
type VenueOption={id:string;name:string;city:string|null}
type Contact={id?:string;name:string;role:string|null;email:string|null;phone:string|null;notes:string|null}
type Timeline={id?:string;time:string|null;title:string;description:string|null;ordering?:number}
type Gig={id:string;title:string;eventType:string|null;clientId:string|null;venueId:string|null;status:Status;startsAt:string|null;endsAt:string|null;loadInAt:string|null;fee:string|null;currency:string;publicVisibility:boolean;publicTitle:string|null;publicDescription:string|null;internalNotes:string|null;source:string|null;clientFirstName:string|null;clientLastName:string|null;clientCompanyName:string|null;venueName:string|null}
type Activity={id:string;action:string;metadata:Record<string,unknown>|null;createdAt:string}
type Detail={gig:Gig;contacts:Contact[];timeline:Timeline[];activity:Activity[];options:{clients:ClientOption[];venues:VenueOption[]}}
type PortalLink={id:string;expiresAt:string;revokedAt:string|null;lastUsedAt:string|null;lastInvitedAt:string;invitationCount:number;createdAt:string;state:'active'|'expired'|'revoked'}
type PortalSubmission={status:'not_started'|'draft'|'submitted';submission:{answers:Record<string,unknown>;acceptedName:string|null;submittedAt:string|null}|null;fields:QuestionnaireField[];templateVersion:number;wishes:Array<{id:string;category:string;artist:string|null;title:string|null;spotifyUrl:string|null;note:string|null}>}

const {data,refresh}=await useFetch<Detail>(`/api/admin/gigs/${id}`)
if(!data.value)throw createError({statusCode:404,statusMessage:'Gig not found'})

function localDate(value:string|null){if(!value)return '';const d=new Date(value);const offset=d.getTimezoneOffset();return new Date(d.getTime()-offset*60000).toISOString().slice(0,16)}
function iso(value:string){return value?new Date(value).toISOString():null}
function clientName(c:ClientOption){return c.companyName||[c.firstName,c.lastName].filter(Boolean).join(' ')||'Unnamed client'}
function activityDate(value:string){return new Intl.DateTimeFormat('nl-NL',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value))}

const g=data.value.gig
const form=reactive({title:g.title,eventType:g.eventType||'',clientId:g.clientId||'',venueId:g.venueId||'',status:g.status,startsAt:localDate(g.startsAt),endsAt:localDate(g.endsAt),loadInAt:localDate(g.loadInAt),fee:g.fee||'',currency:g.currency,publicVisibility:g.publicVisibility,publicTitle:g.publicTitle||'',publicDescription:g.publicDescription||'',internalNotes:g.internalNotes||'',source:g.source||''})
const contacts=ref(data.value.contacts.map(c=>({name:c.name,role:c.role||'',email:c.email||'',phone:c.phone||'',notes:c.notes||''})))
const timeline=ref(data.value.timeline.map(t=>({time:t.time||'',title:t.title,description:t.description||''})))
const saving=ref(false);const message=ref('')
const portalMessage=ref('');const portalUrl=ref('');const portalDays=ref(30);const portalBusy=ref(false)
const {data:portalData,refresh:refreshPortal}=await useFetch<{links:PortalLink[]}>(`/api/admin/gigs/${id}/portal-links`)
const {data:submissionData}=await useFetch<PortalSubmission>(`/api/admin/gigs/${id}/portal-submission`)

function addContact(){contacts.value.push({name:'',role:'',email:'',phone:'',notes:''})}
function addTimeline(){timeline.value.push({time:'',title:'',description:''})}
async function save(){
  saving.value=true;message.value=''
  try{
    await $fetch(`/api/admin/gigs/${id}`,{method:'PUT',body:{
      ...form,clientId:form.clientId||null,venueId:form.venueId||null,
      startsAt:iso(form.startsAt),endsAt:iso(form.endsAt),loadInAt:iso(form.loadInAt),fee:form.fee||null,
      contacts:contacts.value,timeline:timeline.value,
    }})
    await refresh();message.value='Gig saved.'
  }catch(error:unknown){message.value=apiErrorMessage(error,'Could not save gig.')}
  finally{saving.value=false}
}
async function duplicate(){
  try{const result=await $fetch<{gig:{id:string}}>(`/api/admin/gigs/${id}/duplicate`,{method:'POST'});await navigateTo(`/admin/gigs/${result.gig.id}`)}
  catch(error:unknown){message.value=apiErrorMessage(error,'Could not duplicate gig.')}
}
async function remove(){
  if(!confirm('Permanently delete this declined gig?'))return
  try{await $fetch(`/api/admin/gigs/${id}`,{method:'DELETE'});await navigateTo('/admin/gigs')}
  catch(error:unknown){message.value=apiErrorMessage(error,'Could not delete gig.')}
}
async function createPortalLink(resend=false){
  portalBusy.value=true;portalMessage.value='';portalUrl.value=''
  try{
    const result=await $fetch<{url:string}>(`/api/admin/gigs/${id}/portal-links${resend?'/resend':''}`,{method:'POST',body:{expiresInDays:portalDays.value,revokeExisting:resend}})
    portalUrl.value=result.url;portalMessage.value=resend?'A new invitation was created and older links were revoked.':'Secure link created. Copy it now; the token is only shown once.'
    await refreshPortal();await refresh()
  }catch(error:unknown){portalMessage.value=apiErrorMessage(error,'Could not create portal link.')}
  finally{portalBusy.value=false}
}
async function revokePortalLink(linkId:string){
  if(!confirm('Revoke this portal link?'))return
  try{await $fetch(`/api/admin/gigs/${id}/portal-links/${linkId}`,{method:'DELETE'});portalMessage.value='Portal link revoked.';portalUrl.value='';await refreshPortal();await refresh()}
  catch(error:unknown){portalMessage.value=apiErrorMessage(error,'Could not revoke portal link.')}
}
async function copyPortalUrl(){
  if(!portalUrl.value)return
  await navigator.clipboard.writeText(portalUrl.value);portalMessage.value='Portal link copied.'
}
function portalDate(value:string|null){return value?new Intl.DateTimeFormat('nl-NL',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value)):'Never'}
function answerValue(value:unknown){return Array.isArray(value)?value.join(', '):value===true?'Yes':value===false?'No':String(value??'—')}

useSeoMeta({title:()=>`${data.value?.gig.title||'Gig'} — DJ NightLight`,robots:'noindex, nofollow'})
</script>

<template><div v-if="data" class="detail">
<NuxtLink to="/admin/gigs" class="back">← Gigs</NuxtLink>
<header class="hero"><div><p class="eyebrow">Gig</p><h1>{{data.gig.title}}</h1><div class="summary"><span>{{data.gig.status}}</span><span>{{data.gig.clientCompanyName||[data.gig.clientFirstName,data.gig.clientLastName].filter(Boolean).join(' ')||'No client'}}</span><span>{{data.gig.venueName||'No venue'}}</span></div></div><div class="hero-actions"><button class="secondary" @click="duplicate">Duplicate</button><button v-if="form.status==='declined'" class="danger" @click="remove">Delete</button></div></header>

<form @submit.prevent="save">
<section class="card"><p class="eyebrow">Overview</p><div class="grid"><label class="wide">Title<input v-model="form.title" required></label><label>Status<select v-model="form.status"><option value="lead">Lead</option><option value="booked">Booked</option><option value="declined">Declined</option><option value="cancelled">Cancelled</option></select></label><label>Event type<input v-model="form.eventType"></label><label>Client<select v-model="form.clientId"><option value="">No client</option><option v-for="c in data.options.clients" :key="c.id" :value="c.id">{{clientName(c)}}</option></select></label><label>Venue<select v-model="form.venueId"><option value="">No venue</option><option v-for="v in data.options.venues" :key="v.id" :value="v.id">{{v.name}}{{v.city?` — ${v.city}`:''}}</option></select></label><label>Fee<input v-model="form.fee" inputmode="decimal"></label><label>Currency<input v-model="form.currency" maxlength="3"></label><label>Source<input v-model="form.source"></label></div></section>

<section class="card"><p class="eyebrow">Schedule</p><div class="grid"><label>Load-in<input v-model="form.loadInAt" type="datetime-local"></label><label>Start<input v-model="form.startsAt" type="datetime-local"></label><label>End<input v-model="form.endsAt" type="datetime-local"></label></div><div class="section-title"><h2>Timeline</h2><button type="button" class="text-button" @click="addTimeline">+ Add item</button></div><div v-if="!timeline.length" class="subtle">No timeline items yet.</div><div v-for="(item,index) in timeline" :key="index" class="repeat-row timeline-row"><input v-model="item.time" type="time" aria-label="Time"><input v-model="item.title" placeholder="Opening dance, DJ start…" required><input v-model="item.description" placeholder="Notes"><button type="button" @click="timeline.splice(index,1)">×</button></div></section>

<section class="card"><div class="section-title"><div><p class="eyebrow">People</p><h2>Event contacts</h2></div><button type="button" class="text-button" @click="addContact">+ Add contact</button></div><div v-if="!contacts.length" class="subtle">No event-specific contacts yet.</div><div v-for="(contact,index) in contacts" :key="index" class="contact-card"><div class="grid"><label>Name<input v-model="contact.name" required></label><label>Role<input v-model="contact.role" placeholder="Ceremony master, venue…"></label><label>Email<input v-model="contact.email" type="email"></label><label>Phone<input v-model="contact.phone"></label><label class="wide">Notes<input v-model="contact.notes"></label></div><button type="button" class="remove-small" @click="contacts.splice(index,1)">Remove contact</button></div></section>

<section class="card"><p class="eyebrow">Visibility</p><label class="checkbox"><input v-model="form.publicVisibility" type="checkbox"> Show this gig in the public agenda</label><div class="grid public-fields"><label>Public title<input v-model="form.publicTitle" placeholder="Optional public-facing title"></label><label class="wide">Public description<textarea v-model="form.publicDescription" rows="3"/></label></div></section>
<section class="card"><p class="eyebrow">Internal</p><label>Internal notes<textarea v-model="form.internalNotes" rows="6"/></label></section>

<section class="card"><div class="section-title"><div><p class="eyebrow">Client portal</p><h2>Secure access</h2></div></div><div class="portal-actions"><label>Validity (days)<input v-model.number="portalDays" type="number" min="1" max="365"></label><button type="button" class="secondary" :disabled="portalBusy" @click="createPortalLink(false)">Create link</button><button type="button" class="primary" :disabled="portalBusy" @click="createPortalLink(true)">Resend invitation</button></div><div v-if="portalUrl" class="one-time-link"><div><strong>One-time result</strong><span>{{portalUrl}}</span></div><button type="button" class="secondary" @click="copyPortalUrl">Copy</button></div><p v-if="portalMessage" class="portal-message">{{portalMessage}}</p><div v-if="!portalData?.links.length" class="subtle">No portal links have been issued.</div><div v-for="link in portalData?.links||[]" :key="link.id" class="portal-row"><div><strong>{{link.state}}</strong><span>Expires {{portalDate(link.expiresAt)}} · Last used {{portalDate(link.lastUsedAt)}}</span></div><button v-if="link.state==='active'" type="button" class="remove-small" @click="revokePortalLink(link.id)">Revoke</button></div></section>

<section v-if="submissionData" class="card"><div class="section-title"><div><p class="eyebrow">Portal submission</p><h2>Contract & music wishes</h2></div><NuxtLink to="/admin/questionnaire" class="text-button">Edit template</NuxtLink></div><div class="submission-status"><strong>{{submissionData.status.replace('_',' ')}}</strong><span>Questionnaire version {{submissionData.templateVersion}}<template v-if="submissionData.submission?.submittedAt"> · {{portalDate(submissionData.submission.submittedAt)}}</template></span></div><div v-if="submissionData.submission" class="answer-grid"><div v-for="field in submissionData.fields" :key="field.id"><span>{{field.label}}</span><strong>{{answerValue(submissionData.submission.answers[field.id])}}</strong></div><div><span>Accepted by</span><strong>{{submissionData.submission.acceptedName||'—'}}</strong></div></div><div v-else class="subtle">The client has not submitted the questionnaire yet.</div><h3>Music wishes</h3><div v-if="!submissionData.wishes.length" class="subtle">No music wishes submitted.</div><div v-for="wish in submissionData.wishes" :key="wish.id" class="wish-row"><span>{{wish.category.replaceAll('_',' ')}}</span><div><strong>{{[wish.artist,wish.title].filter(Boolean).join(' — ')||wish.note||'Untitled wish'}}</strong><a v-if="wish.spotifyUrl" :href="wish.spotifyUrl" target="_blank" rel="noreferrer">Open Spotify</a><small v-if="wish.note">{{wish.note}}</small></div></div></section>

<div class="save-bar"><div><strong>{{message||'Changes are only stored after saving.'}}</strong><span>Calendar, finance and client portal integrations arrive in later phases.</span></div><button class="primary" type="submit" :disabled="saving">{{saving?'Saving…':'Save gig'}}</button></div>
</form>

<section class="card activity"><p class="eyebrow">Activity</p><h2>Recent changes</h2><div v-if="!data.activity.length" class="subtle">No activity recorded yet.</div><div v-for="item in data.activity" :key="item.id" class="activity-row"><strong>{{item.action.replaceAll('_',' ')}}</strong><span>{{activityDate(item.createdAt)}}</span></div></section>
</div></template>

<style scoped>
.detail{max-width:1000px;margin-inline:auto}.back{display:inline-block;margin-bottom:1.2rem;color:#8e8797;text-decoration:none}.hero{display:flex;justify-content:space-between;align-items:end;gap:1rem;margin-bottom:1.5rem}h1{margin:.2rem 0;font-size:clamp(2.3rem,6vw,4.2rem);letter-spacing:-.05em}.summary{display:flex;gap:.5rem;flex-wrap:wrap}.summary span{padding:.25rem .5rem;border-radius:999px;background:#1d1922;color:#9c95a5;font-size:.72rem}.hero-actions{display:flex;gap:.5rem}.card{margin-bottom:1rem;padding:1.25rem;border:1px solid #2b2631;border-radius:1rem;background:#100e14}.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:.8rem}.wide{grid-column:1/-1}label{display:grid;gap:.35rem;color:#aaa4b1;font-size:.8rem}input,select,textarea{width:100%;border:1px solid #332e39;border-radius:.65rem;padding:.7rem;background:#0b0a0d;color:#f6f3fa}.section-title{display:flex;align-items:end;justify-content:space-between;gap:1rem;margin:1rem 0 .6rem}.section-title h2,.activity h2{margin:.2rem 0}.text-button,.remove-small{border:0;background:transparent;color:#b9b2c2;cursor:pointer;text-decoration:none}.repeat-row{display:grid;gap:.5rem;margin-top:.5rem}.timeline-row{grid-template-columns:7rem 1fr 1.5fr 2rem}.timeline-row button{border:0;border-radius:.55rem;background:#241a20;color:#eab4bc}.contact-card{margin-top:.7rem;padding:.9rem;border:1px solid #27222d;border-radius:.8rem}.remove-small{margin-top:.7rem;color:#d9959f}.checkbox{display:flex;align-items:center;gap:.6rem}.checkbox input{width:auto}.public-fields{margin-top:.8rem}.subtle{padding:.8rem 0;color:#777080}.portal-actions{display:grid;grid-template-columns:minmax(8rem,1fr) auto auto;gap:.7rem;align-items:end}.one-time-link,.portal-row{display:flex;align-items:center;justify-content:space-between;gap:1rem;margin-top:.8rem;padding:.8rem;border:1px solid #2d2832;border-radius:.75rem;background:#0b0a0d}.one-time-link div,.portal-row div{min-width:0}.one-time-link strong,.one-time-link span,.portal-row strong,.portal-row span{display:block}.one-time-link span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#aaa4b1;font-size:.76rem}.portal-row strong{text-transform:capitalize}.portal-row span,.portal-message{color:#827b8a;font-size:.78rem}.submission-status{display:flex;justify-content:space-between;gap:1rem;padding:.75rem;border-radius:.7rem;background:#18141d}.submission-status strong{text-transform:capitalize}.submission-status span{color:#8b8493;font-size:.78rem}.answer-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:.6rem;margin-top:.8rem}.answer-grid div{padding:.7rem;border:1px solid #29242f;border-radius:.65rem}.answer-grid span,.answer-grid strong{display:block}.answer-grid span{color:#7f7887;font-size:.72rem}.answer-grid strong{margin-top:.2rem}.wish-row{display:grid;grid-template-columns:8rem 1fr;gap:.8rem;padding:.75rem 0;border-top:1px solid #29242f}.wish-row>span{color:#967ca8;font-size:.72rem;text-transform:capitalize}.wish-row strong,.wish-row a,.wish-row small{display:block}.wish-row a{color:#b9b2c2;font-size:.75rem}.wish-row small{color:#807988}.save-bar{position:sticky;bottom:1rem;z-index:5;display:flex;align-items:center;justify-content:space-between;gap:1rem;margin:1rem 0;padding:1rem 1.15rem;border:1px solid #35303b;border-radius:1rem;background:rgba(20,17,25,.94);backdrop-filter:blur(14px)}.save-bar strong,.save-bar span{display:block}.save-bar span{margin-top:.2rem;color:#777080;font-size:.75rem}.primary,.secondary,.danger{border:0;border-radius:.65rem;padding:.72rem .9rem;font-weight:800;cursor:pointer}.primary{background:#fff;color:#09080b}.secondary{background:#211c27;color:#eee9f2}.danger{background:#2a1519;color:#ffabb5}.activity-row{display:flex;justify-content:space-between;gap:1rem;padding:.65rem 0;border-top:1px solid #27222d}.activity-row strong{text-transform:capitalize}.activity-row span{color:#777080;font-size:.8rem}@media(max-width:700px){.hero{align-items:start;flex-direction:column}.grid,.portal-actions,.answer-grid{grid-template-columns:1fr}.wide{grid-column:auto}.hero-actions{width:100%}.hero-actions button{flex:1}.timeline-row{grid-template-columns:1fr}.one-time-link,.portal-row,.submission-status{align-items:stretch;flex-direction:column}.wish-row{grid-template-columns:1fr}.save-bar{align-items:stretch;flex-direction:column}.save-bar .primary{width:100%}}
</style>
