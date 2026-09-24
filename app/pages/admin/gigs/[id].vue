<script setup lang="ts">
import { apiErrorMessage } from '~/utils/api-error'
import { gigDisplayTitle } from '~~/shared/gig-title'
import type { QuestionnaireField } from '~~/shared/questionnaire'
import { activityActionLabels, gigStatusLabels, labelFor, musicWishCategoryLabels, paymentStatusLabels, portalLinkStateLabels, submissionStatusLabels } from '~~/shared/labels'

definePageMeta({layout:'admin'})
const route=useRoute();const id=String(route.params.id)
const {user}=useUserSession();const canManageGigs=computed(()=>user.value?.role==='owner'||user.value?.role==='manager');const canDeleteGig=computed(()=>user.value?.role==='owner')

type Status='lead'|'booked'|'declined'|'cancelled'
type ClientOption={id:string;type:'person'|'company';firstName:string|null;lastName:string|null;companyName:string|null}
type VenueOption={id:string;name:string;city:string|null}
type DjOption={id:string;name:string;email:string}
type Contact={id?:string;name:string;role:string|null;email:string|null;phone:string|null;notes:string|null}
type Timeline={id?:string;time:string|null;title:string;description:string|null;ordering?:number}
type Gig={id:string;title:string|null;displayTitle:string;eventType:string|null;clientId:string|null;venueId:string|null;assignedUserId:string|null;status:Status;startsAt:string|null;endsAt:string|null;loadInAt:string|null;fee:string|null;currency:string;publicVisibility:boolean;publicTitle:string|null;publicDescription:string|null;internalNotes:string|null;source:string|null;clientFirstName:string|null;clientLastName:string|null;clientCompanyName:string|null;venueName:string|null}
type Activity={id:string;action:string;metadata:Record<string,unknown>|null;createdAt:string;actorName:string|null;actorEmail:string|null}
type InvoiceSummary={id:string;invoiceNumber:string|null;status:'draft'|'finalized'|'void';paymentStatus:'unpaid'|'pending'|'paid'|'failed';issueDate:string;dueDate:string;currency:string;totalCents:number;finalizedAt:string|null;paymentProvider:string|null;stripeSessionId:string|null;stripePaymentIntentId:string|null;stripeStatus:'pending'|'succeeded'|'failed'|'cancelled'|'expired'|null;paidAt:string|null;paymentFailureCode:string|null}
type Detail={gig:Gig;contacts:Contact[];timeline:Timeline[];activity:Activity[];invoices:InvoiceSummary[];options:{clients:ClientOption[];venues:VenueOption[];djs:DjOption[]}}
type PortalLink={id:string;expiresAt:string;revokedAt:string|null;lastUsedAt:string|null;lastInvitedAt:string;invitationCount:number;createdAt:string;state:'active'|'expired'|'revoked'}
type PortalSubmission={status:'not_started'|'draft'|'submitted';submission:{answers:Record<string,unknown>;acceptedName:string|null;submittedAt:string|null}|null;fields:QuestionnaireField[];templateVersion:number;wishes:Array<{id:string;category:string;artist:string|null;title:string|null;spotifyUrl:string|null;note:string|null}>}

const {data,refresh}=await useFetch<Detail>(`/api/admin/gigs/${id}`)
if(!data.value)throw createError({statusCode:404,statusMessage:'Gig niet gevonden'})

function localDate(value:string|null){if(!value)return '';const d=new Date(value);const offset=d.getTimezoneOffset();return new Date(d.getTime()-offset*60000).toISOString().slice(0,16)}
function iso(value:string){return value?new Date(value).toISOString():null}
function clientName(c:ClientOption){return c.companyName||[c.firstName,c.lastName].filter(Boolean).join(' ')||'Naamloze klant'}
function activityDate(value:string){return new Intl.DateTimeFormat('nl-NL',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value))}
function invoiceDate(value:string){return new Intl.DateTimeFormat('nl-NL',{dateStyle:'medium'}).format(new Date(`${value}T12:00:00`))}
function money(cents:number,currency:string){return new Intl.NumberFormat('nl-NL',{style:'currency',currency}).format(cents/100)}
function stripeLabel(invoice:InvoiceSummary){
  if(invoice.paymentStatus==='paid'||invoice.stripeStatus==='succeeded')return 'Betaald via Stripe'
  if(invoice.stripeStatus==='pending'||invoice.paymentStatus==='pending')return 'Stripe-betaling in afwachting'
  if(invoice.stripeStatus==='failed'||invoice.paymentStatus==='failed')return 'Stripe-betaling mislukt'
  if(invoice.stripeStatus==='expired')return 'Stripe Checkout verlopen'
  return invoice.status==='finalized'?'Klaar voor Stripe-betaling':'Nog niet naar Stripe gestuurd'
}

const g=data.value.gig
const form=reactive({title:g.title||'',eventType:g.eventType||'',clientId:g.clientId||'',venueId:g.venueId||'',assignedUserId:g.assignedUserId||'',status:g.status,startsAt:localDate(g.startsAt),endsAt:localDate(g.endsAt),loadInAt:localDate(g.loadInAt),fee:g.fee||'',currency:g.currency,publicVisibility:g.publicVisibility,publicTitle:g.publicTitle||'',publicDescription:g.publicDescription||'',internalNotes:g.internalNotes||'',source:g.source||''})
const venueName=computed(()=>data.value?.options.venues.find(v=>v.id===form.venueId)?.name)
const titlePlaceholder=computed(()=>`Optioneel: laat leeg om “${gigDisplayTitle({venueName:venueName.value,eventType:form.eventType})}” te tonen`)
const publicTitlePlaceholder=computed(()=>`Optioneel: laat leeg om “${gigDisplayTitle({title:form.title,venueName:venueName.value,eventType:form.eventType})}” te tonen`)
const contacts=ref(data.value.contacts.map(c=>({name:c.name,role:c.role||'',email:c.email||'',phone:c.phone||'',notes:c.notes||''})))
const timeline=ref(data.value.timeline.map(t=>({time:t.time||'',title:t.title,description:t.description||''})))
const saving=ref(false);const message=ref('')
const portalMessage=ref('');const portalUrl=ref('');const portalDays=ref(30);const portalBusy=ref(false)
const {data:portalData,refresh:refreshPortal}=await useFetch<{links:PortalLink[]}>(`/api/admin/gigs/${id}/portal-links`,{immediate:canManageGigs.value})
const {data:submissionData}=await useFetch<PortalSubmission>(`/api/admin/gigs/${id}/portal-submission`,{immediate:canManageGigs.value})

function addContact(){contacts.value.push({name:'',role:'',email:'',phone:'',notes:''})}
function addTimeline(){timeline.value.push({time:'',title:'',description:''})}
async function save(){
  saving.value=true;message.value=''
  try{
    await $fetch(`/api/admin/gigs/${id}`,{method:'PUT',body:{
      ...form,clientId:form.clientId||null,venueId:form.venueId||null,assignedUserId:form.assignedUserId||null,
      startsAt:iso(form.startsAt),endsAt:iso(form.endsAt),loadInAt:iso(form.loadInAt),fee:form.fee||null,
      contacts:contacts.value,timeline:timeline.value,
    }})
    await refresh();message.value='Gig opgeslagen.'
  }catch(error:unknown){message.value=apiErrorMessage(error,'Gig opslaan is niet gelukt.')}
  finally{saving.value=false}
}
async function duplicate(){
  try{const result=await $fetch<{gig:{id:string}}>(`/api/admin/gigs/${id}/duplicate`,{method:'POST'});await navigateTo(`/admin/gigs/${result.gig.id}`)}
  catch(error:unknown){message.value=apiErrorMessage(error,'Gig dupliceren is niet gelukt.')}
}
async function createInvoice(){
  try{const result=await $fetch<{invoice:{id:string}}>(`/api/admin/gigs/${id}/invoice`,{method:'POST'});await navigateTo(`/admin/invoices/${result.invoice.id}`)}
  catch(error:unknown){message.value=apiErrorMessage(error,'Factuur aanmaken is niet gelukt.')}
}
async function remove(){
  if(!confirm('Deze afgewezen gig verwijderen? Gigs met een factuur- of betaalgeschiedenis worden gearchiveerd in plaats van definitief verwijderd.'))return
  try{
    const result=await $fetch<{mode:'delete'|'archive'}>(`/api/admin/gigs/${id}`,{method:'DELETE'})
    await navigateTo({path:'/admin/gigs',query:{removed:result.mode}})
  }catch(error:unknown){message.value=apiErrorMessage(error,'Gig verwijderen is niet gelukt.')}
}
async function createPortalLink(resend=false){
  portalBusy.value=true;portalMessage.value='';portalUrl.value=''
  try{
    const result=await $fetch<{url:string}>(`/api/admin/gigs/${id}/portal-links${resend?'/resend':''}`,{method:'POST',body:{expiresInDays:portalDays.value,revokeExisting:resend}})
    portalUrl.value=result.url;portalMessage.value=resend?'Er is een nieuwe uitnodiging gemaakt en oudere links zijn ingetrokken.':'Beveiligde link aangemaakt. Kopieer hem nu; de token wordt maar één keer getoond.'
    await refreshPortal();await refresh()
  }catch(error:unknown){portalMessage.value=apiErrorMessage(error,'Portaallink aanmaken is niet gelukt.')}
  finally{portalBusy.value=false}
}
async function revokePortalLink(linkId:string){
  if(!confirm('Deze portaallink intrekken?'))return
  try{await $fetch(`/api/admin/gigs/${id}/portal-links/${linkId}`,{method:'DELETE'});portalMessage.value='Portaallink ingetrokken.';portalUrl.value='';await refreshPortal();await refresh()}
  catch(error:unknown){portalMessage.value=apiErrorMessage(error,'Portaallink intrekken is niet gelukt.')}
}
async function copyPortalUrl(){
  if(!portalUrl.value)return
  await navigator.clipboard.writeText(portalUrl.value);portalMessage.value='Portaallink gekopieerd.'
}
function portalDate(value:string|null){return value?new Intl.DateTimeFormat('nl-NL',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value)):'Nooit'}
function answerValue(value:unknown){return Array.isArray(value)?value.join(', '):value===true?'Ja':value===false?'Nee':String(value??'—')}

useSeoMeta({title:()=>`${data.value?.gig.displayTitle||'Gig'} — DJ NightLight`,robots:'noindex, nofollow'})
</script>

<template><div v-if="data" class="detail" :class="{readonly:!canManageGigs}">
<NuxtLink to="/admin/gigs" class="back"><Icon name="lucide:arrow-left" aria-hidden="true" /> Gigs</NuxtLink>
<header class="hero"><div><p class="eyebrow">Gig</p><h1>{{data.gig.displayTitle}}</h1><div class="summary"><span>{{labelFor(gigStatusLabels,data.gig.status)}}</span><span>{{data.gig.clientCompanyName||[data.gig.clientFirstName,data.gig.clientLastName].filter(Boolean).join(' ')||'Geen klant'}}</span><span>{{data.gig.venueName||'Geen locatie'}}</span></div></div><div v-if="canManageGigs" class="hero-actions"><button class="secondary" type="button" @click="duplicate">Dupliceren</button><button v-if="canDeleteGig&&form.status==='declined'" class="danger" type="button" @click="remove">Verwijderen</button></div></header>

<div v-if="!canManageGigs" class="readonly-note">Deze gig is aan jou toegewezen. Als DJ kun je alleen meekijken; een manager of eigenaar kan de boekingsgegevens wijzigen.</div>
<form @submit.prevent="save">
<section class="card"><p class="eyebrow">Overzicht</p><div class="grid"><label class="wide">Titel<input v-model="form.title" :placeholder="titlePlaceholder"></label><label>Status<select v-model="form.status"><option value="lead">Lead</option><option value="booked">Geboekt</option><option value="declined">Afgewezen</option><option value="cancelled">Geannuleerd</option></select></label><label>Soort evenement<input v-model="form.eventType"></label><label>Klant<select v-model="form.clientId"><option value="">Geen klant</option><option v-for="c in data.options.clients" :key="c.id" :value="c.id">{{clientName(c)}}</option></select></label><label>Locatie<select v-model="form.venueId"><option value="">Geen locatie</option><option v-for="v in data.options.venues" :key="v.id" :value="v.id">{{v.name}}{{v.city?` — ${v.city}`:''}}</option></select></label><label>Toegewezen DJ<select v-model="form.assignedUserId"><option value="">Niet toegewezen</option><option v-for="dj in data.options.djs" :key="dj.id" :value="dj.id">{{dj.name}}</option></select></label><label>Gage<input v-model="form.fee" inputmode="decimal"></label><label>Valuta<input v-model="form.currency" maxlength="3"></label><label>Bron<input v-model="form.source"></label></div></section>

<section v-if="canManageGigs" class="card invoice-card">
  <div class="section-title invoice-heading">
    <div><p class="eyebrow">Financiën</p><h2>Facturen & Stripe</h2><span class="subtle-copy">Facturen horen bij deze gig. De Stripe-status wordt automatisch bijgewerkt na betaling via Checkout of bankoverschrijving.</span></div>
    <button type="button" class="secondary" @click="createInvoice">Factuur aanmaken</button>
  </div>
  <div v-if="!data.invoices.length" class="subtle">Nog geen facturen voor deze gig.</div>
  <NuxtLink v-for="invoice in data.invoices" :key="invoice.id" :to="`/admin/invoices/${invoice.id}`" class="invoice-row">
    <div class="invoice-main">
      <strong>{{invoice.invoiceNumber||'Conceptfactuur'}}</strong>
      <span>{{invoice.status==='draft'?'Concept':`Uitgegeven ${invoiceDate(invoice.issueDate)} · vervalt ${invoiceDate(invoice.dueDate)}`}}</span>
    </div>
    <div class="invoice-statuses">
      <span class="state" :data-state="invoice.paymentStatus">{{labelFor(paymentStatusLabels,invoice.paymentStatus)}}</span>
      <span class="stripe-state" :data-state="invoice.stripeStatus||invoice.paymentStatus">{{stripeLabel(invoice)}}</span>
    </div>
    <strong class="invoice-total">{{money(invoice.totalCents,invoice.currency)}}</strong>
  </NuxtLink>
</section>

<section class="card"><p class="eyebrow">Planning</p><div class="grid"><label>Opbouw<input v-model="form.loadInAt" type="datetime-local"></label><label>Start<input v-model="form.startsAt" type="datetime-local"></label><label>Einde<input v-model="form.endsAt" type="datetime-local"></label></div><div class="section-title"><h2>Timeline</h2><button type="button" class="text-button" @click="addTimeline"><Icon name="lucide:plus" aria-hidden="true" /> Item toevoegen</button></div><div v-if="!timeline.length" class="subtle">Nog geen items in de timeline.</div><div v-for="(item,index) in timeline" :key="index" class="repeat-row timeline-row"><input v-model="item.time" type="time" aria-label="Tijd"><input v-model="item.title" placeholder="Openingsdans, start DJ…" required><input v-model="item.description" placeholder="Notities"><button type="button" aria-label="Item verwijderen" title="Item verwijderen" @click="timeline.splice(index,1)"><Icon name="lucide:x" aria-hidden="true" /></button></div></section>

<section class="card"><div class="section-title"><div><p class="eyebrow">Personen</p><h2>Contactpersonen evenement</h2></div><button type="button" class="text-button" @click="addContact"><Icon name="lucide:plus" aria-hidden="true" /> Contact toevoegen</button></div><div v-if="!contacts.length" class="subtle">Nog geen contactpersonen voor dit evenement.</div><div v-for="(contact,index) in contacts" :key="index" class="contact-card"><div class="grid"><label>Naam<input v-model="contact.name" required></label><label>Rol<input v-model="contact.role" placeholder="Ceremoniemeester, locatie…"></label><label>E-mail<input v-model="contact.email" type="email"></label><label>Telefoon<input v-model="contact.phone"></label><label class="wide">Notities<input v-model="contact.notes"></label></div><button type="button" class="remove-small" @click="contacts.splice(index,1)">Contact verwijderen</button></div></section>

<section class="card"><p class="eyebrow">Zichtbaarheid</p><label class="checkbox"><input v-model="form.publicVisibility" type="checkbox"> Toon deze gig in de publieke agenda</label><div class="grid public-fields"><label>Publieke titel<input v-model="form.publicTitle" :placeholder="publicTitlePlaceholder"></label><label class="wide">Publieke beschrijving<textarea v-model="form.publicDescription" rows="3"/></label></div></section>
<section class="card"><p class="eyebrow">Intern</p><label>Interne notities<textarea v-model="form.internalNotes" rows="6"/></label></section>

<section v-if="canManageGigs" class="card"><div class="section-title"><div><p class="eyebrow">Klantportaal</p><h2>Beveiligde toegang</h2></div></div><div class="portal-actions"><label>Geldigheid (dagen)<input v-model.number="portalDays" type="number" min="1" max="365"></label><button type="button" class="secondary" :disabled="portalBusy" @click="createPortalLink(false)">Link aanmaken</button><button type="button" class="primary" :disabled="portalBusy" @click="createPortalLink(true)">Uitnodiging opnieuw versturen</button></div><div v-if="portalUrl" class="one-time-link"><div><strong>Eenmalig zichtbaar</strong><span>{{portalUrl}}</span></div><button type="button" class="with-icon secondary" @click="copyPortalUrl"><Icon name="lucide:copy" aria-hidden="true" />Kopiëren</button></div><p v-if="portalMessage" class="portal-message">{{portalMessage}}</p><div v-if="!portalData?.links.length" class="subtle">Er zijn nog geen portaallinks uitgegeven.</div><div v-for="link in portalData?.links||[]" :key="link.id" class="portal-row"><div><strong>{{labelFor(portalLinkStateLabels,link.state)}}</strong><span>Verloopt {{portalDate(link.expiresAt)}} · Laatst gebruikt {{portalDate(link.lastUsedAt)}}</span></div><button v-if="link.state==='active'" type="button" class="remove-small" @click="revokePortalLink(link.id)">Intrekken</button></div></section>

<section v-if="canManageGigs&&submissionData" class="card"><div class="section-title"><div><p class="eyebrow">Ingevuld portaal</p><h2>Contract & muziekwensen</h2></div><NuxtLink to="/admin/questionnaire" class="text-button">Template bewerken</NuxtLink></div><div class="submission-status"><strong>{{labelFor(submissionStatusLabels,submissionData.status)}}</strong><span>Vragenlijstversie {{submissionData.templateVersion}}<template v-if="submissionData.submission?.submittedAt"> · {{portalDate(submissionData.submission.submittedAt)}}</template></span></div><div v-if="submissionData.submission" class="answer-grid"><div v-for="field in submissionData.fields" :key="field.id"><span>{{field.label}}</span><strong>{{answerValue(submissionData.submission.answers[field.id])}}</strong></div><div><span>Geaccepteerd door</span><strong>{{submissionData.submission.acceptedName||'—'}}</strong></div></div><div v-else class="subtle">De klant heeft de vragenlijst nog niet ingediend.</div><h3>Muziekwensen</h3><div v-if="!submissionData.wishes.length" class="subtle">Geen muziekwensen ingediend.</div><div v-for="wish in submissionData.wishes" :key="wish.id" class="wish-row"><span>{{labelFor(musicWishCategoryLabels,wish.category)}}</span><div><strong>{{[wish.artist,wish.title].filter(Boolean).join(' — ')||wish.note||'Naamloze wens'}}</strong><a v-if="wish.spotifyUrl" :href="wish.spotifyUrl" target="_blank" rel="noreferrer">Openen in Spotify</a><small v-if="wish.note">{{wish.note}}</small></div></div></section>

<div v-if="canManageGigs" class="save-bar"><div><strong>{{message||'Wijzigingen worden pas bewaard na opslaan.'}}</strong><span>Agendasynchronisatie volgt in fase 5.</span></div><button class="primary" type="submit" :disabled="saving">{{saving?'Opslaan…':'Gig opslaan'}}</button></div>
</form>

<AdminGigEmails v-if="canManageGigs" :gig-id="id" :portal-url="portalUrl" />

<section class="card activity"><p class="eyebrow">Activiteit</p><h2>Recente wijzigingen</h2><div v-if="!data.activity.length" class="subtle">Nog geen activiteit vastgelegd.</div><div v-for="item in data.activity" :key="item.id" class="activity-row"><strong>{{labelFor(activityActionLabels,item.action)}}<small v-if="item.actorName"> · {{item.actorName}}</small></strong><span>{{activityDate(item.createdAt)}}</span></div></section>
</div></template>

<style scoped>
.detail{max-width:1000px;margin-inline:auto}.invoice-heading{margin-top:0}.subtle-copy{display:block;margin-top:.2rem;color:#777080;font-size:.78rem}.invoice-row{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:1rem;align-items:center;padding:.85rem 0;border-top:1px solid #29242f;color:inherit;text-decoration:none}.invoice-row:first-of-type{margin-top:.6rem}.invoice-main strong,.invoice-main span{display:block}.invoice-main span{margin-top:.15rem;color:#7f7887;font-size:.75rem}.invoice-statuses{display:flex;gap:.4rem;align-items:center;flex-wrap:wrap}.state,.stripe-state{padding:.28rem .5rem;border-radius:999px;background:#211b28;color:#aaa2b2;font-size:.68rem}.state[data-state="paid"],.stripe-state[data-state="succeeded"]{background:#16382a;color:#8fe1ad}.state[data-state="failed"],.stripe-state[data-state="failed"]{background:#351a20;color:#ffadb7}.state[data-state="pending"],.stripe-state[data-state="pending"]{background:#352d16;color:#ead17a}.invoice-total{text-align:right}.readonly-note{margin-bottom:1rem;padding:.8rem 1rem;border:1px solid #302a38;border-radius:.8rem;background:#141119;color:#aaa3b4}.readonly form input,.readonly form select,.readonly form textarea,.readonly form button{pointer-events:none;opacity:.78}.back{display:inline-block;margin-bottom:1.2rem;color:#8e8797;text-decoration:none}.hero{display:flex;justify-content:space-between;align-items:end;gap:1rem;margin-bottom:1.5rem}h1{margin:.2rem 0;font-size:clamp(2.3rem,6vw,4.2rem);letter-spacing:-.05em}.summary{display:flex;gap:.5rem;flex-wrap:wrap}.summary span{padding:.25rem .5rem;border-radius:999px;background:#1d1922;color:#9c95a5;font-size:.72rem}.hero-actions{display:flex;gap:.5rem}.card{margin-bottom:1rem;padding:1.25rem;border:1px solid #2b2631;border-radius:1rem;background:#100e14}.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:.8rem}.wide{grid-column:1/-1}label{display:grid;gap:.35rem;color:#aaa4b1;font-size:.8rem}input,select,textarea{width:100%;border:1px solid #332e39;border-radius:.65rem;padding:.7rem;background:#0b0a0d;color:#f6f3fa}.section-title{display:flex;align-items:end;justify-content:space-between;gap:1rem;margin:1rem 0 .6rem}.section-title h2,.activity h2{margin:.2rem 0}.text-button,.remove-small{border:0;background:transparent;color:#b9b2c2;cursor:pointer;text-decoration:none}.repeat-row{display:grid;gap:.5rem;margin-top:.5rem}.timeline-row{grid-template-columns:7rem 1fr 1.5fr 2rem}.timeline-row button{border:0;border-radius:.55rem;background:#241a20;color:#eab4bc}.contact-card{margin-top:.7rem;padding:.9rem;border:1px solid #27222d;border-radius:.8rem}.remove-small{margin-top:.7rem;color:#d9959f}.checkbox{display:flex;align-items:center;gap:.6rem}.checkbox input{width:auto}.public-fields{margin-top:.8rem}.subtle{padding:.8rem 0;color:#777080}.portal-actions{display:grid;grid-template-columns:minmax(8rem,1fr) auto auto;gap:.7rem;align-items:end}.one-time-link,.portal-row{display:flex;align-items:center;justify-content:space-between;gap:1rem;margin-top:.8rem;padding:.8rem;border:1px solid #2d2832;border-radius:.75rem;background:#0b0a0d}.one-time-link div,.portal-row div{min-width:0}.one-time-link strong,.one-time-link span,.portal-row strong,.portal-row span{display:block}.one-time-link span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#aaa4b1;font-size:.76rem}.portal-row span,.portal-message{color:#827b8a;font-size:.78rem}.submission-status{display:flex;justify-content:space-between;gap:1rem;padding:.75rem;border-radius:.7rem;background:#18141d}.submission-status span{color:#8b8493;font-size:.78rem}.answer-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:.6rem;margin-top:.8rem}.answer-grid div{padding:.7rem;border:1px solid #29242f;border-radius:.65rem}.answer-grid span,.answer-grid strong{display:block}.answer-grid span{color:#7f7887;font-size:.72rem}.answer-grid strong{margin-top:.2rem}.wish-row{display:grid;grid-template-columns:8rem 1fr;gap:.8rem;padding:.75rem 0;border-top:1px solid #29242f}.wish-row>span{color:#967ca8;font-size:.72rem}.wish-row strong,.wish-row a,.wish-row small{display:block}.wish-row a{color:#b9b2c2;font-size:.75rem}.wish-row small{color:#807988}.save-bar{position:sticky;bottom:1rem;z-index:5;display:flex;align-items:center;justify-content:space-between;gap:1rem;margin:1rem 0;padding:1rem 1.15rem;border:1px solid #35303b;border-radius:1rem;background:rgba(20,17,25,.94);backdrop-filter:blur(14px)}.save-bar strong,.save-bar span{display:block}.save-bar span{margin-top:.2rem;color:#777080;font-size:.75rem}.primary,.secondary,.danger{border:0;border-radius:.65rem;padding:.72rem .9rem;font-weight:800;cursor:pointer}.primary{background:#fff;color:#09080b}.secondary{background:#211c27;color:#eee9f2}.danger{background:#2a1519;color:#ffabb5}.activity-row{display:flex;justify-content:space-between;gap:1rem;padding:.65rem 0;border-top:1px solid #27222d}.activity-row span{color:#777080;font-size:.8rem}@media(max-width:700px){.hero{align-items:start;flex-direction:column}.invoice-row{grid-template-columns:1fr}.invoice-total{text-align:left}.grid,.portal-actions,.answer-grid{grid-template-columns:1fr}.wide{grid-column:auto}.hero-actions{width:100%}.hero-actions button{flex:1}.timeline-row{grid-template-columns:1fr}.one-time-link,.portal-row,.submission-status{align-items:stretch;flex-direction:column}.wish-row{grid-template-columns:1fr}.save-bar{align-items:stretch;flex-direction:column}.save-bar .primary{width:100%}}
</style>
