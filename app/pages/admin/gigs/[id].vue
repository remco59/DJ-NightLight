<script setup lang="ts">
import { apiErrorMessage } from '~/utils/api-error'
import { gigDisplayTitle } from '~~/shared/gig-title'
import type { QuestionnaireField } from '~~/shared/questionnaire'
import { activityActionLabels, labelFor, musicWishCategoryLabels, portalLinkStateLabels, submissionStatusLabels } from '~~/shared/labels'

definePageMeta({layout:'admin'})
const route=useRoute();const id=String(route.params.id)
const {user}=useUserSession();const canManageGigs=computed(()=>user.value?.role==='owner'||user.value?.role==='manager');const canDeleteGig=computed(()=>user.value?.role==='owner')
const online=useOnline()
// Offline the gig can be read from the cache but not changed, so no edit controls are shown at all.
const canEdit=computed(()=>canManageGigs.value&&online.value)

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
  if(invoice.paymentProvider==='manual'&&invoice.paymentStatus==='paid')return 'Handmatig als betaald gemarkeerd'
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
const actionMenu=ref<HTMLDetailsElement|null>(null)
const {data:portalData,refresh:refreshPortal}=await useFetch<{links:PortalLink[]}>(`/api/admin/gigs/${id}/portal-links`,{immediate:canManageGigs.value})
const {data:reviewData}=await useFetch<{review:{rating:number,comment:string|null,authorName:string|null,createdAt:string}|null}>(`/api/admin/gigs/${id}/review`,{immediate:canManageGigs.value})
const {data:submissionData}=await useFetch<PortalSubmission>(`/api/admin/gigs/${id}/portal-submission`,{immediate:canManageGigs.value})

function addContact(){contacts.value.push({name:'',role:'',email:'',phone:'',notes:''})}
function addTimeline(){timeline.value.push({time:'',title:'',description:''})}
function closeActionMenu(){if(actionMenu.value)actionMenu.value.open=false}
const {isDirty,markSaved}=useUnsavedChanges(()=>({form,contacts:contacts.value,timeline:timeline.value}))
const confirmAction=useConfirm();const chooseAction=useChoice()
const clientLabel=computed(()=>data.value?.gig.clientCompanyName||[data.value?.gig.clientFirstName,data.value?.gig.clientLastName].filter(Boolean).join(' ')||'Nog geen klant')
const gigWhen=computed(()=>{
  const gig=data.value?.gig;if(!gig?.startsAt)return 'Nog geen datum'
  const tz='Europe/Amsterdam';const start=new Date(gig.startsAt)
  const day=new Intl.DateTimeFormat('nl-NL',{weekday:'short',day:'numeric',month:'long',year:'numeric',timeZone:tz}).format(start)
  const time=(d:Date)=>new Intl.DateTimeFormat('nl-NL',{hour:'2-digit',minute:'2-digit',timeZone:tz}).format(d)
  return gig.endsAt?`${day} · ${time(start)}–${time(new Date(gig.endsAt))}`:`${day} · ${time(start)}`
})
const deleteBlocked=computed(()=>!canDeleteGig.value||data.value?.gig.status!=='declined'||Boolean(data.value?.invoices.length))
type NextStep={title:string;hint?:string;action?:string;to?:string;run?:()=>void}
// The one thing that moves this gig forward: book it, invoice it, invite the client, get paid.
const nextStep=computed<NextStep|null>(()=>{
  const gig=data.value?.gig;if(!gig)return null
  if(gig.status==='declined'||gig.status==='cancelled')return null
  if(gig.status==='lead')return {title:'Boeking bevestigen',hint:gig.startsAt?undefined:'Vul eerst een datum in als die bekend is.',action:'Gig boeken',run:()=>{form.status='booked';save()}}
  const invoices=(data.value?.invoices||[]).filter(invoice=>invoice.status!=='void')
  const draft=invoices.find(invoice=>invoice.status==='draft')
  const open=invoices.find(invoice=>invoice.status==='finalized'&&invoice.paymentStatus!=='paid')
  if(!invoices.length)return {title:'Factuur maken',hint:'Er is nog geen factuur voor deze gig.',action:'Factuur aanmaken',run:createInvoice}
  if(draft)return {title:'Factuur afronden',hint:'De conceptfactuur is nog niet verstuurd.',action:'Factuur openen',to:`/admin/invoices/${draft.id}`}
  if(!hasActivePortalLink.value&&!submissionData.value?.submission)return {title:'Klantportaal versturen',hint:'Laat de klant gegevens en muziekwensen invullen.',action:'Uitnodiging versturen',run:sendPortalInvitation}
  if(open)return {title:'Wachten op betaling',hint:`Te betalen vóór ${invoiceDate(open.dueDate)}.`,action:'Factuur bekijken',to:`/admin/invoices/${open.id}`}
  return {title:'Alles staat klaar',hint:'Geboekt, gefactureerd en betaald.'}
})
type TabKey='overview'|'planning'|'finance'|'portal'|'communication'|'internal'
const tabs:Array<{key:TabKey;label:string}>=[{key:'overview',label:'Overzicht'},{key:'planning',label:'Planning'},{key:'finance',label:'Financieel'},{key:'portal',label:'Klantportaal'},{key:'communication',label:'Communicatie'},{key:'internal',label:'Intern'}]
const tab=ref<TabKey>('overview')
const titleInput=ref<HTMLInputElement|null>(null)
function moveTab(step:number){const index=tabs.findIndex(item=>item.key===tab.value);const next=tabs[(index+step+tabs.length)%tabs.length]!;tab.value=next.key;nextTick(()=>document.getElementById(`tab-${next.key}`)?.focus())}
// A required field on a hidden tab cannot be focused by the browser, so switch to its tab first.
function revealInvalid(event:Event){const key=(event.target as HTMLElement|null)?.closest<HTMLElement>('[data-tab]')?.dataset.tab as TabKey|undefined;if(key&&key!==tab.value)tab.value=key}
function focusEdit(){tab.value='overview';nextTick(()=>{titleInput.value?.focus();titleInput.value?.scrollIntoView({block:'center',behavior:'smooth'})})}
async function cancelGig(){
  if(!(await confirmAction({title:'Deze gig annuleren?',body:'De status wordt Geannuleerd en de gig wordt direct opgeslagen.',confirmLabel:'Gig annuleren',tone:'danger'})))return
  form.status='cancelled';await save()
}
const feeLabel=computed(()=>data.value?.gig.fee?money(Math.round(Number(data.value.gig.fee)*100),data.value.gig.currency):'Nog niet ingevuld')
function planningMoment(value:string|null){return value?new Intl.DateTimeFormat('nl-NL',{weekday:'short',day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'Europe/Amsterdam'}).format(new Date(value)):'Nog niet ingevuld'}
const planningRows=computed(()=>[{label:'Opbouw',value:planningMoment(data.value?.gig.loadInAt??null)},{label:'Start',value:planningMoment(data.value?.gig.startsAt??null)},{label:'Einde',value:planningMoment(data.value?.gig.endsAt??null)}])
// Where the gig is in its life: booked, client portal, contract, invoice, review.
const stages=computed(()=>{
  const gig=data.value?.gig;if(!gig||(gig.status!=='lead'&&gig.status!=='booked'))return []
  const portalDone=hasActivePortalLink.value||Boolean(submissionData.value?.submission)
  const contractDone=submissionData.value?.status==='submitted'
  const live=(data.value?.invoices||[]).filter(invoice=>invoice.status!=='void')
  const paid=live.length>0&&live.every(invoice=>invoice.paymentStatus==='paid')
  const list=[
    {key:'booked',label:'Gig geboekt',sub:gig.status==='booked'?(gig.startsAt?new Intl.DateTimeFormat('nl-NL',{day:'numeric',month:'short',year:'numeric',timeZone:'Europe/Amsterdam'}).format(new Date(gig.startsAt)):'Geboekt'):'Nog bevestigen',icon:'lucide:check',done:gig.status==='booked'},
    {key:'portal',label:'Klantportaal',sub:portalDone?'Toegang actief':'Toegang instellen',icon:'lucide:link',done:portalDone},
    {key:'contract',label:'Contract',sub:contractDone?'Ingediend':'Vragenlijst',icon:'lucide:file-text',done:contractDone},
    {key:'invoice',label:'Factuur',sub:paid?'Betaald':live.length?'Aangemaakt':'Nog maken',icon:'lucide:credit-card',done:paid},
    {key:'review',label:'Review',sub:'Na het event',icon:'lucide:star',done:false},
  ]
  const current=list.findIndex(stage=>!stage.done)
  return list.map((stage,index)=>({...stage,state:stage.done?'done':index===current?'current':'todo'}))
})
type EmailPlan={templateName:string;recipient:string|null;willSend:boolean;skipReason:string|null;delayMinutes:number;providerConfigured:boolean}
function emailPlan(template:'booking_accepted'|'client_portal_invitation'){return $fetch<EmailPlan>(`/api/admin/gigs/${id}/email-plan`,{query:{template}})}
function planTiming(plan:EmailPlan){const minutes=plan.delayMinutes;const when=minutes<=0?'direct':minutes%1440===0?`over ${minutes/1440} dag${minutes===1440?'':'en'}`:minutes%60===0?`over ${minutes/60} uur`:`over ${minutes} minuten`;return `${when}${plan.providerConfigured?'':' (zodra er een e-mailprovider is ingesteld)'}`}
async function save(){
  // Booking a gig emails the client "Boeking bevestigd", so ask first and offer to save without it.
  let notify=true
  if(form.status==='booked'&&data.value?.gig.status!=='booked'){
    let plan:EmailPlan|null=null
    try{plan=await emailPlan('booking_accepted')}catch{plan=null}
    if(plan?.willSend){
      const choice=await chooseAction({title:'Gig boeken en de klant mailen?',body:`De e-mail "${plan.templateName}" gaat ${planTiming(plan)} naar ${plan.recipient}.`,confirmLabel:'Opslaan en mailen',secondaryLabel:'Opslaan zonder e-mail'})
      if(!choice)return
      notify=choice==='confirm'
    }
  }
  saving.value=true;message.value=''
  try{
    await $fetch(`/api/admin/gigs/${id}`,{method:'PUT',query:notify?undefined:{notify:'0'},body:{
      ...form,clientId:form.clientId||null,venueId:form.venueId||null,assignedUserId:form.assignedUserId||null,
      startsAt:iso(form.startsAt),endsAt:iso(form.endsAt),loadInAt:iso(form.loadInAt),fee:form.fee||null,
      contacts:contacts.value,timeline:timeline.value,
    }})
    markSaved();await refresh();message.value='Gig opgeslagen.'
  }catch(error:unknown){message.value=apiErrorMessage(error,'Gig opslaan is niet gelukt.')}
  finally{saving.value=false}
}
async function duplicate(){
  closeActionMenu()
  try{const result=await $fetch<{gig:{id:string}}>(`/api/admin/gigs/${id}/duplicate`,{method:'POST'});await navigateTo(`/admin/gigs/${result.gig.id}`)}
  catch(error:unknown){message.value=apiErrorMessage(error,'Gig dupliceren is niet gelukt.')}
}
async function createInvoice(){
  try{const result=await $fetch<{invoice:{id:string}}>(`/api/admin/gigs/${id}/invoice`,{method:'POST'});await navigateTo(`/admin/invoices/${result.invoice.id}`)}
  catch(error:unknown){message.value=apiErrorMessage(error,'Factuur aanmaken is niet gelukt.')}
}
async function performRemoval(){
  try{
    const result=await $fetch<{mode:'delete'|'archive'}>(`/api/admin/gigs/${id}`,{method:'DELETE'})
    await navigateTo({path:'/admin/gigs',query:{removed:result.mode}})
  }catch(error:unknown){message.value=apiErrorMessage(error,'Gig verwijderen is niet gelukt.')}
}
async function requestRemove(){
  closeActionMenu()
  if(!canDeleteGig.value){
    await confirmAction({title:'Je kunt deze gig niet verwijderen',body:'Alleen een eigenaar kan gigs verwijderen. Vraag een eigenaar om de gig te verwijderen of je rol aan te passen.',confirmLabel:'Sluiten'})
    return
  }
  if(data.value?.gig.status!=='declined'){
    const choice=await chooseAction({title:'Gig moet eerst worden afgewezen',body:'Alleen afgewezen gigs kunnen worden verwijderd. Zet de status eerst op Afgewezen en sla de gig daarna op.',confirmLabel:'Status op Afgewezen zetten',secondaryLabel:'Annuleren'})
    if(choice==='confirm'){
      form.status='declined'
      message.value='Status aangepast naar Afgewezen. Sla de gig op om verwijderen mogelijk te maken.'
    }
    return
  }
  const invoices=data.value?.invoices||[]
  if(invoices.length){
    const invoice=invoices[0]!
    const invoiceLabel=invoice.invoiceNumber||'de gekoppelde conceptfactuur'
    const choice=await chooseAction({title:'Definitief verwijderen kan niet',body:invoices.length===1?`Deze gig is gekoppeld aan ${invoiceLabel}. Vanwege de financiële historie kan de gig niet definitief worden verwijderd, maar wel worden gearchiveerd.`:`Deze gig is gekoppeld aan ${invoices.length} facturen. Vanwege de financiële historie kan de gig niet definitief worden verwijderd, maar wel worden gearchiveerd.`,confirmLabel:'Gig archiveren',secondaryLabel:invoices.length===1?'Factuur openen':'Eerste factuur openen'})
    if(choice==='confirm')await performRemoval()
    else if(choice==='secondary')await navigateTo(`/admin/invoices/${invoice.id}`)
    return
  }
  if(!(await confirmAction({title:'Deze gig definitief verwijderen?',body:'Deze actie kan niet ongedaan worden gemaakt.',confirmLabel:'Verwijderen',tone:'danger'})))return
  await performRemoval()
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
const hasActivePortalLink=computed(()=>Boolean(portalData.value?.links.some(link=>link.state==='active')))
async function sendPortalInvitation(){
  let plan:EmailPlan|null=null
  try{plan=await emailPlan('client_portal_invitation')}catch{plan=null}
  const replaces=hasActivePortalLink.value?' Eerder verstuurde links werken daarna niet meer.':''
  const ok=await confirmAction(plan?.willSend
    ?{title:hasActivePortalLink.value?'Nieuwe uitnodiging versturen?':'Uitnodiging versturen?',body:`De uitnodiging voor het klantportaal gaat ${planTiming(plan)} naar ${plan.recipient}.${replaces}`,confirmLabel:'Versturen'}
    :{title:'Alleen een link maken?',body:`Er wordt geen e-mail verstuurd: ${plan?.skipReason||'de e-mailstatus is onbekend.'} Je krijgt een link om zelf te delen.${replaces}`,confirmLabel:'Link maken'})
  if(ok)await createPortalLink(true)
}
async function revokePortalLink(linkId:string){
  if(!(await confirmAction({title:'Deze portaallink intrekken?',body:'De klant kan de link daarna niet meer gebruiken.',confirmLabel:'Intrekken',tone:'danger'})))return
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
<nav class="crumbs" aria-label="Kruimelpad"><NuxtLink to="/admin/gigs" class="back"><Icon name="lucide:arrow-left" aria-hidden="true" /> Gigs</NuxtLink><Icon name="lucide:chevron-right" class="crumb-sep" aria-hidden="true" /><span class="crumb-current">{{data.gig.displayTitle}}</span></nav>
<header class="hero"><div><h1>{{data.gig.displayTitle}}</h1><div class="status-row"><AdminStatusChip kind="gig" :status="data.gig.status" /></div></div><div v-if="canEdit" class="hero-actions"><NuxtLink v-if="nextStep?.to" class="primary hero-cta with-icon" :to="nextStep.to"><Icon name="lucide:arrow-right" aria-hidden="true" />{{nextStep.action}}</NuxtLink><button v-else-if="nextStep?.run" type="button" class="primary hero-cta with-icon" :disabled="saving||portalBusy" @click="nextStep.run"><Icon name="lucide:file-text" aria-hidden="true" />{{nextStep.action}}</button><details ref="actionMenu" class="action-menu"><summary class="secondary icon-button" aria-label="Meer acties" title="Meer acties"><Icon name="lucide:ellipsis" aria-hidden="true" /></summary><div class="action-menu-popover" role="menu"><button type="button" role="menuitem" @click="duplicate"><Icon name="lucide:copy" aria-hidden="true" />Dupliceren</button><button type="button" role="menuitem" class="menu-danger" :aria-disabled="deleteBlocked" @click="requestRemove"><Icon name="lucide:trash-2" aria-hidden="true" />Verwijderen</button></div></details></div></header>

<ol v-if="stages.length" class="stages" aria-label="Voortgang"><li v-for="stage in stages" :key="stage.key" class="stage" :data-state="stage.state" :aria-current="stage.state==='current'?'step':undefined"><span class="stage-dot"><Icon :name="stage.icon" aria-hidden="true" /></span><strong>{{stage.label}}</strong><small>{{stage.sub}}</small></li></ol>

<section class="gig-facts" aria-label="Samenvatting">
<dl><div><dt><Icon name="lucide:calendar" aria-hidden="true" />Datum & tijd</dt><dd>{{gigWhen}}</dd></div><div><dt><Icon name="lucide:map-pin" aria-hidden="true" />Locatie</dt><dd>{{data.gig.venueName||'Nog geen locatie'}}</dd></div><div><dt><Icon name="lucide:users" aria-hidden="true" />Klant</dt><dd>{{clientLabel}}</dd></div><div><dt><Icon name="lucide:wallet" aria-hidden="true" />Gage</dt><dd>{{data.gig.fee?money(Math.round(Number(data.gig.fee)*100),data.gig.currency):'Nog niet ingevuld'}}</dd></div></dl>
</section>
<div v-if="!canManageGigs" class="readonly-note">Deze gig is aan jou toegewezen. Als DJ kun je alleen meekijken; een manager of eigenaar kan de boekingsgegevens wijzigen.</div>

<div class="tabs" role="tablist" aria-label="Gig onderdelen" @keydown.right.prevent="moveTab(1)" @keydown.left.prevent="moveTab(-1)"><button v-for="item in tabs" :id="`tab-${item.key}`" :key="item.key" type="button" role="tab" class="tab" :class="{active:tab===item.key}" :aria-selected="tab===item.key" :aria-controls="`panel-${item.key}`" :tabindex="tab===item.key?0:-1" @click="tab=item.key">{{item.label}}</button></div>

<form :inert="!canEdit||undefined" @submit.prevent="save" @invalid.capture="revealInvalid">
<div v-show="tab==='overview'" id="panel-overview" class="tab-panel" data-tab="overview" role="tabpanel" aria-labelledby="tab-overview">
<div class="overview-layout">
<div class="overview-main">
<section class="card"><p class="eyebrow">Overzicht</p><div class="grid"><label class="wide">Titel<input ref="titleInput" v-model="form.title" :placeholder="titlePlaceholder"></label><label>Status<select v-model="form.status"><option value="lead">Lead</option><option value="booked">Geboekt</option><option value="declined">Afgewezen</option><option value="cancelled">Geannuleerd</option></select></label><label>Soort evenement<input v-model="form.eventType"></label><label>Klant<select v-model="form.clientId"><option value="">Geen klant</option><option v-for="c in data.options.clients" :key="c.id" :value="c.id">{{clientName(c)}}</option></select></label><label>Locatie<select v-model="form.venueId"><option value="">Geen locatie</option><option v-for="v in data.options.venues" :key="v.id" :value="v.id">{{v.name}}{{v.city?` — ${v.city}`:''}}</option></select></label><label>Toegewezen DJ<select v-model="form.assignedUserId"><option value="">Niet toegewezen</option><option v-for="dj in data.options.djs" :key="dj.id" :value="dj.id">{{dj.name}}</option></select></label><label>Gage<input v-model="form.fee" inputmode="decimal"></label><label>Valuta<input v-model="form.currency" maxlength="3"></label><label>Bron<input v-model="form.source"></label></div></section>
</div>
<aside class="overview-aside">
<section v-if="nextStep&&canEdit" class="next-step"><div><span><Icon name="lucide:zap" aria-hidden="true" />Volgende stap</span><strong>{{nextStep.title}}</strong><small v-if="nextStep.hint">{{nextStep.hint}}</small></div><NuxtLink v-if="nextStep.to" class="primary" :to="nextStep.to">{{nextStep.action}}</NuxtLink><button v-else-if="nextStep.run" type="button" class="primary" :disabled="saving||portalBusy" @click="nextStep.run">{{nextStep.action}}</button></section>
<section v-if="canEdit" class="card quick-actions"><p class="eyebrow">Snelle acties</p><button type="button" @click="focusEdit"><Icon name="lucide:pencil" aria-hidden="true" />Bewerken<Icon name="lucide:chevron-right" class="chev" aria-hidden="true" /></button><button type="button" @click="duplicate"><Icon name="lucide:copy" aria-hidden="true" />Dupliceren<Icon name="lucide:chevron-right" class="chev" aria-hidden="true" /></button><button v-if="data.gig.status!=='cancelled'" type="button" class="danger" @click="cancelGig"><Icon name="lucide:circle-x" aria-hidden="true" />Annuleren</button><button type="button" class="danger" :aria-disabled="deleteBlocked" @click="requestRemove"><Icon name="lucide:trash-2" aria-hidden="true" />Verwijderen</button></section>
</aside>
</div>
<div class="summary-grid">
<section v-if="reviewData?.review" class="card"><p class="eyebrow">Review van de klant</p><p><strong>{{'★'.repeat(reviewData.review.rating)}}{{'☆'.repeat(5-reviewData.review.rating)}}</strong> <small>{{reviewData.review.authorName||'Anoniem'}}</small></p><p v-if="reviewData.review.comment">“{{reviewData.review.comment}}”</p></section>
<section class="card"><div class="section-title"><p class="eyebrow">Planning</p><button type="button" class="text-button with-icon" @click="tab='planning'"><Icon name="lucide:pencil" aria-hidden="true" />Bewerken</button></div><ol class="mini-timeline"><li v-for="row in planningRows" :key="row.label"><strong>{{row.label}}</strong><span>{{row.value}}</span></li></ol></section>
<section class="card"><div class="section-title"><p class="eyebrow">Financieel</p><button type="button" class="text-button with-icon" @click="tab='finance'"><Icon name="lucide:pencil" aria-hidden="true" />Bewerken</button></div><dl class="kv"><div><dt>Gage</dt><dd>{{feeLabel}}</dd></div><div><dt>Valuta</dt><dd>{{data.gig.currency}}</dd></div><div><dt>Facturen</dt><dd>{{data.invoices.length?`${data.invoices.length} gekoppeld`:'Nog geen facturen voor deze gig.'}}</dd></div></dl></section>
</div>
</div>

<div v-show="tab==='planning'" id="panel-planning" class="tab-panel" data-tab="planning" role="tabpanel" aria-labelledby="tab-planning">
<section class="card"><p class="eyebrow">Planning</p><div class="grid"><label>Opbouw<input v-model="form.loadInAt" type="datetime-local"></label><label>Start<input v-model="form.startsAt" type="datetime-local"></label><label>Einde<input v-model="form.endsAt" type="datetime-local"></label></div><div class="section-title"><h2>Timeline</h2><button type="button" class="text-button" @click="addTimeline"><Icon name="lucide:plus" aria-hidden="true" /> Item toevoegen</button></div><div v-if="!timeline.length" class="subtle">Nog geen items in de timeline.</div><div v-for="(item,index) in timeline" :key="index" class="repeat-row timeline-row"><input v-model="item.time" type="time" aria-label="Tijd"><input v-model="item.title" placeholder="Openingsdans, start DJ…" required><input v-model="item.description" placeholder="Notities"><button type="button" aria-label="Item verwijderen" title="Item verwijderen" @click="timeline.splice(index,1)"><Icon name="lucide:x" aria-hidden="true" /></button></div></section>
</div>

<div v-show="tab==='finance'" id="panel-finance" class="tab-panel" data-tab="finance" role="tabpanel" aria-labelledby="tab-finance">
<section class="card"><p class="eyebrow">Financieel</p><dl class="kv"><div><dt>Gage</dt><dd>{{feeLabel}}</dd></div><div><dt>Valuta</dt><dd>{{data.gig.currency}}</dd></div></dl></section>
<section v-if="canEdit" class="card invoice-card">
  <div class="section-title invoice-heading">
    <div><p class="eyebrow">Financiën</p><h2>Facturen & Stripe</h2><span class="subtle-copy">Facturen horen bij deze gig. Online betalingen via Stripe worden automatisch verwerkt. Een overschrijving of contante betaling registreer je op de factuur.</span></div>
    <button type="button" class="secondary" @click="createInvoice">Factuur aanmaken</button>
  </div>
  <div v-if="!data.invoices.length" class="subtle">Nog geen facturen voor deze gig.</div>
  <NuxtLink v-for="invoice in data.invoices" :key="invoice.id" :to="`/admin/invoices/${invoice.id}`" class="invoice-row">
    <div class="invoice-main">
      <strong>{{invoice.invoiceNumber||'Conceptfactuur'}}</strong>
      <span>{{invoice.status==='draft'?'Concept':`Uitgegeven ${invoiceDate(invoice.issueDate)} · vervalt ${invoiceDate(invoice.dueDate)}`}}</span>
    </div>
    <div class="invoice-statuses">
      <AdminStatusChip v-if="invoice.status==='finalized'" kind="payment" :status="invoice.paymentStatus" :provider="invoice.paymentProvider" /><AdminStatusChip v-else kind="invoice" :status="invoice.status" />
      <span class="stripe-state" :data-state="invoice.stripeStatus||invoice.paymentStatus">{{stripeLabel(invoice)}}</span>
    </div>
    <strong class="invoice-total">{{money(invoice.totalCents,invoice.currency)}}</strong>
  </NuxtLink>
</section>
</div>

<div v-show="tab==='portal'" id="panel-portal" class="tab-panel" data-tab="portal" role="tabpanel" aria-labelledby="tab-portal">
<section v-if="canEdit" class="card"><div class="section-title"><div><p class="eyebrow">Klantportaal</p><h2>Beveiligde toegang</h2></div></div><div class="portal-actions"><label>Geldigheid (dagen)<input v-model.number="portalDays" type="number" min="1" max="365"></label><button type="button" class="secondary" :disabled="portalBusy" @click="createPortalLink(false)">Link aanmaken</button><button type="button" class="primary" :disabled="portalBusy" @click="sendPortalInvitation">{{hasActivePortalLink?'Nieuwe uitnodiging versturen':'Uitnodiging versturen'}}</button></div><div v-if="portalUrl" class="one-time-link"><div><strong>Eenmalig zichtbaar</strong><span>{{portalUrl}}</span></div><button type="button" class="with-icon secondary" @click="copyPortalUrl"><Icon name="lucide:copy" aria-hidden="true" />Kopiëren</button></div><p v-if="portalMessage" class="portal-message">{{portalMessage}}</p><div v-if="!portalData?.links.length" class="subtle">Er zijn nog geen portaallinks uitgegeven.</div><div v-for="link in portalData?.links||[]" :key="link.id" class="portal-row"><div><strong>{{labelFor(portalLinkStateLabels,link.state)}}</strong><span>Verloopt {{portalDate(link.expiresAt)}} · Laatst gebruikt {{portalDate(link.lastUsedAt)}}</span></div><button v-if="link.state==='active'" type="button" class="remove-small" @click="revokePortalLink(link.id)">Intrekken</button></div></section>

<section v-if="canEdit&&submissionData" class="card"><div class="section-title"><div><p class="eyebrow">Ingevuld portaal</p><h2>Contract & muziekwensen</h2></div><NuxtLink to="/admin/questionnaire" class="text-button">Template bewerken</NuxtLink></div><div class="submission-status"><strong>{{labelFor(submissionStatusLabels,submissionData.status)}}</strong><span>Vragenlijstversie {{submissionData.templateVersion}}<template v-if="submissionData.submission?.submittedAt"> · {{portalDate(submissionData.submission.submittedAt)}}</template></span></div><div v-if="submissionData.submission" class="answer-grid"><div v-for="field in submissionData.fields" :key="field.id"><span>{{field.label}}</span><strong>{{answerValue(submissionData.submission.answers[field.id])}}</strong></div><div><span>Geaccepteerd door</span><strong>{{submissionData.submission.acceptedName||'—'}}</strong></div></div><div v-else class="subtle">De klant heeft de vragenlijst nog niet ingediend.</div><h3>Muziekwensen</h3><div v-if="!submissionData.wishes.length" class="subtle">Geen muziekwensen ingediend.</div><div v-for="wish in submissionData.wishes" :key="wish.id" class="wish-row"><span>{{labelFor(musicWishCategoryLabels,wish.category)}}</span><div><strong>{{[wish.artist,wish.title].filter(Boolean).join(' — ')||wish.note||'Naamloze wens'}}</strong><a v-if="wish.spotifyUrl" :href="wish.spotifyUrl" target="_blank" rel="noreferrer">Openen in Spotify</a><small v-if="wish.note">{{wish.note}}</small></div></div></section>
</div>

<div v-show="tab==='communication'" id="panel-communication" class="tab-panel" role="tabpanel" aria-labelledby="tab-communication" data-tab="communication">
<section class="card"><div class="section-title"><div><p class="eyebrow">Personen</p><h2>Contactpersonen evenement</h2></div><button v-if="contacts.length" type="button" class="text-button" @click="addContact"><Icon name="lucide:plus" aria-hidden="true" /> Contact toevoegen</button></div><div v-if="!contacts.length" class="empty-state"><span class="empty-icon"><Icon name="lucide:users" aria-hidden="true" /></span><strong>Nog geen contactpersonen toegevoegd</strong><p>Voeg contactpersonen toe om sneller te communiceren en alle afspraken op één plek te bewaren.</p><button type="button" class="primary with-icon" @click="addContact"><Icon name="lucide:plus" aria-hidden="true" /> Contactpersoon toevoegen</button></div><div v-for="(contact,index) in contacts" :key="index" class="contact-card"><div class="grid"><label>Naam<input v-model="contact.name" required></label><label>Rol<input v-model="contact.role" placeholder="Ceremoniemeester, locatie…"></label><label>E-mail<input v-model="contact.email" type="email"></label><label>Telefoon<input v-model="contact.phone"></label><label class="wide">Notities<input v-model="contact.notes"></label></div><button type="button" class="remove-small" @click="contacts.splice(index,1)">Contact verwijderen</button></div></section>

<section class="card"><p class="eyebrow">Zichtbaarheid</p><label class="checkbox"><input v-model="form.publicVisibility" type="checkbox"> Toon deze gig in de publieke agenda</label><div class="grid public-fields"><label>Publieke titel<input v-model="form.publicTitle" :placeholder="publicTitlePlaceholder"></label><label class="wide">Publieke beschrijving<textarea v-model="form.publicDescription" rows="3"/></label></div></section>
</div>

<div v-show="tab==='internal'" id="panel-internal-form" class="tab-panel" data-tab="internal">
<section class="card"><p class="eyebrow">Intern</p><label>Interne notities<textarea v-model="form.internalNotes" rows="6"/></label></section>
</div>

<div v-if="canEdit&&(isDirty||message)" class="save-bar"><div><strong role="status">{{message||(isDirty?'Niet-opgeslagen wijzigingen':'Alles is opgeslagen')}}</strong><span>{{isDirty?'Wijzigingen worden pas bewaard na opslaan.':'Wijzig een veld om de gig bij te werken.'}}</span></div><button class="primary" type="submit" :disabled="saving">{{saving?'Opslaan…':'Gig opslaan'}}</button></div>
</form>

<div v-show="tab==='communication'" class="tab-panel tab-extra" role="tabpanel" aria-labelledby="tab-communication">
<AdminGigEmails v-if="canEdit" :gig-id="id" :portal-url="portalUrl" />
</div>

<div v-show="tab==='internal'" id="panel-internal" class="tab-panel tab-extra" role="tabpanel" aria-labelledby="tab-internal">
<section class="card activity"><p class="eyebrow">Activiteit</p><h2>Recente wijzigingen</h2><div v-if="!data.activity.length" class="subtle">Nog geen activiteit vastgelegd.</div><div v-for="item in data.activity" :key="item.id" class="activity-row"><strong>{{labelFor(activityActionLabels,item.action)}}<small v-if="item.actorName"> · {{item.actorName}}</small></strong><span>{{activityDate(item.createdAt)}}</span></div></section>
</div>
</div></template>

<style scoped>
.detail{max-width:1000px;margin-inline:auto}.invoice-heading{margin-top:0}.subtle-copy{display:block;margin-top:.2rem;color:var(--text-subtle);font-size:.78rem}.invoice-row{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:1rem;align-items:center;padding:.85rem 0;border-top:1px solid var(--border);color:inherit;text-decoration:none}.invoice-row:first-of-type{margin-top:.6rem}.invoice-main strong,.invoice-main span{display:block}.invoice-main span{margin-top:.15rem;color:var(--text-subtle);font-size:.75rem}.invoice-statuses{display:flex;gap:.4rem;align-items:center;flex-wrap:wrap}.state,.stripe-state{padding:.28rem .5rem;border-radius:999px;background:#211b28;color:#aaa2b2;font-size:.75rem}.state[data-state="paid"],.stripe-state[data-state="succeeded"]{background:#16382a;color:#8fe1ad}.state[data-state="failed"],.stripe-state[data-state="failed"]{background:#351a20;color:#ffadb7}.state[data-state="pending"],.stripe-state[data-state="pending"]{background:#352d16;color:#ead17a}.invoice-total{text-align:right}.readonly-note{margin-bottom:1rem;padding:.8rem 1rem;border:1px solid #302a38;border-radius:.8rem;background:#141119;color:#aaa3b4}.readonly form input,.readonly form select,.readonly form textarea,.readonly form button{pointer-events:none;opacity:.78}.back{display:inline-flex;align-items:center;gap:.35rem;min-height:2.75rem;margin-bottom:1.2rem;color:var(--text-subtle);text-decoration:none}.hero{display:flex;justify-content:space-between;align-items:end;gap:1rem;margin-bottom:1.5rem}h1{margin:.2rem 0;font-size:clamp(2.3rem,6vw,4.2rem);letter-spacing:-.04em}.gig-facts{display:grid;grid-template-columns:minmax(0,1fr) minmax(16rem,.42fr);gap:1rem;margin-bottom:1rem;padding:1.1rem 1.2rem;border:1px solid var(--border);border-radius:1rem;background:var(--surface-card)}.gig-facts dl{display:grid;grid-template-columns:repeat(auto-fit,minmax(9.5rem,1fr));gap:.9rem 1.25rem;margin:0}.gig-facts dt{color:var(--text-subtle);font-size:.75rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase}.gig-facts dd{margin:.25rem 0 0;color:var(--text);font-weight:700;line-height:1.35}.next-step{display:grid;align-content:space-between;gap:.8rem;padding:.9rem 1rem;border:1px solid #3d2f55;border-radius:.8rem;background:#17121f}.next-step span{color:#c9b2ef;font-size:.75rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase}.next-step strong{display:block;margin-top:.2rem;font-size:1.05rem}.next-step small{display:block;margin-top:.25rem;color:var(--text-muted);line-height:1.4}.next-step .primary{justify-self:start;display:inline-flex;align-items:center;min-height:2.75rem;text-decoration:none}@media(max-width:760px){.gig-facts{grid-template-columns:1fr}.gig-facts dl{grid-template-columns:1fr 1fr}}.hero-actions{display:flex;gap:.5rem}.action-menu{position:relative}.action-menu>summary{list-style:none}.action-menu>summary::-webkit-details-marker{display:none}.icon-button{display:grid;place-items:center;width:2.8rem;height:2.8rem;padding:0}.action-menu-popover{position:absolute;z-index:var(--z-raised);top:calc(100% + .45rem);right:0;min-width:12rem;padding:.35rem;border:1px solid var(--border);border-radius:.75rem;background:var(--surface-card);box-shadow:0 14px 40px rgba(0,0,0,.35)}.action-menu-popover button{display:flex;align-items:center;gap:.65rem;width:100%;padding:.7rem .75rem;border:0;border-radius:.55rem;background:transparent;color:var(--text);font:inherit;text-align:left;cursor:pointer}.action-menu-popover button:hover{background:var(--surface-input)}.action-menu-popover .menu-danger{color:#f0a5ad}.action-menu-popover .menu-danger[aria-disabled="true"]{opacity:.45;cursor:not-allowed}.action-menu-popover .menu-danger[aria-disabled="true"]:hover{background:transparent}.card{margin-bottom:1rem;padding:1.25rem;border:1px solid var(--border);border-radius:1rem;background:var(--surface-card)}.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:.8rem}.wide{grid-column:1/-1}label{display:grid;gap:.35rem;color:var(--text-muted);font-size:.8rem}input,select,textarea{width:100%;border:1px solid var(--border-strong);border-radius:.65rem;padding:.7rem;background:var(--surface-input);color:var(--text)}.section-title{display:flex;align-items:end;justify-content:space-between;gap:1rem;margin:1rem 0 .6rem}.section-title h2,.activity h2{margin:.2rem 0}.text-button,.remove-small{border:0;background:transparent;color:#b9b2c2;cursor:pointer;text-decoration:none}.repeat-row{display:grid;gap:.5rem;margin-top:.5rem}.timeline-row{grid-template-columns:7rem 1fr 1.5fr 2rem}.timeline-row button{border:0;border-radius:.55rem;background:#241a20;color:#eab4bc}.contact-card{margin-top:.7rem;padding:.9rem;border:1px solid #27222d;border-radius:.8rem}.remove-small{margin-top:.7rem;color:#d9959f}.checkbox{display:flex;align-items:center;gap:.6rem}.checkbox input{width:auto}.public-fields{margin-top:.8rem}.subtle{padding:.8rem 0;color:var(--text-subtle)}.portal-actions{display:grid;grid-template-columns:minmax(8rem,1fr) auto auto;gap:.7rem;align-items:end}.one-time-link,.portal-row{display:flex;align-items:center;justify-content:space-between;gap:1rem;margin-top:.8rem;padding:.8rem;border:1px solid #2d2832;border-radius:.75rem;background:var(--surface-input)}.one-time-link div,.portal-row div{min-width:0}.one-time-link strong,.one-time-link span,.portal-row strong,.portal-row span{display:block}.one-time-link span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text-muted);font-size:.76rem}.portal-row span,.portal-message{color:#827b8a;font-size:.78rem}.submission-status{display:flex;justify-content:space-between;gap:1rem;padding:.75rem;border-radius:.7rem;background:#18141d}.submission-status span{color:#8b8493;font-size:.78rem}.answer-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:.6rem;margin-top:.8rem}.answer-grid div{padding:.7rem;border:1px solid var(--border);border-radius:.65rem}.answer-grid span,.answer-grid strong{display:block}.answer-grid span{color:var(--text-subtle);font-size:.72rem}.answer-grid strong{margin-top:.2rem}.wish-row{display:grid;grid-template-columns:8rem 1fr;gap:.8rem;padding:.75rem 0;border-top:1px solid var(--border)}.wish-row>span{color:#967ca8;font-size:.72rem}.wish-row strong,.wish-row a,.wish-row small{display:block}.wish-row a{color:#b9b2c2;font-size:.75rem}.wish-row small{color:var(--text-subtle)}.save-bar{position:sticky;bottom:1rem;z-index:var(--z-raised);display:flex;align-items:center;justify-content:space-between;gap:1rem;margin:1rem 0;padding:1rem 1.15rem;border:1px solid #35303b;border-radius:1rem;background:rgba(20,17,25,.94);backdrop-filter:blur(14px)}.save-bar strong,.save-bar span{display:block}.save-bar span{margin-top:.2rem;color:var(--text-subtle);font-size:.75rem}.primary,.secondary,.danger{border:0;border-radius:.65rem;padding:.72rem .9rem;font-weight:800;cursor:pointer}.primary{background:var(--button-primary-bg);color:var(--button-primary-fg)}.secondary{background:var(--button-secondary-bg);color:var(--button-secondary-fg)}.danger{background:var(--button-danger-bg);color:var(--button-danger-fg)}.activity-row{display:flex;justify-content:space-between;gap:1rem;padding:.65rem 0;border-top:1px solid #27222d}.activity-row span{color:var(--text-subtle);font-size:.8rem}@media(max-width:700px){.hero{align-items:start;flex-direction:column}.invoice-row{grid-template-columns:1fr}.invoice-total{text-align:left}.grid,.portal-actions,.answer-grid{grid-template-columns:1fr}.wide{grid-column:auto}.hero-actions{width:auto}.hero-actions button{flex:0 0 auto}.timeline-row{grid-template-columns:1fr}.one-time-link,.portal-row,.submission-status{align-items:stretch;flex-direction:column}.wish-row{grid-template-columns:1fr}.save-bar{align-items:stretch;flex-direction:column}.save-bar .primary{width:100%}}
</style>