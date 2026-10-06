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
type Gig={id:string;title:string|null;displayTitle:string;eventType:string|null;clientId:string|null;venueId:string|null;assignedUserId:string|null;status:Status;startsAt:string|null;endsAt:string|null;loadInAt:string|null;fee:string|null;currency:string;publicVisibility:boolean;publicTitle:string|null;publicDescription:string|null;internalNotes:string|null;source:string|null;clientFirstName:string|null;clientLastName:string|null;clientCompanyName:string|null;venueName:string|null;venueAddress:string|null;venueCity:string|null}
type Activity={id:string;action:string;metadata:Record<string,unknown>|null;createdAt:string;actorName:string|null;actorEmail:string|null}
type InvoiceSummary={id:string;invoiceNumber:string|null;status:'draft'|'finalized'|'void';paymentStatus:'unpaid'|'pending'|'paid'|'failed';issueDate:string;dueDate:string;currency:string;totalCents:number;finalizedAt:string|null;paymentProvider:string|null;stripeSessionId:string|null;stripePaymentIntentId:string|null;stripeStatus:'pending'|'succeeded'|'failed'|'cancelled'|'expired'|null;paidAt:string|null;paymentFailureCode:string|null}
type Detail={gig:Gig;contacts:Contact[];timeline:Timeline[];activity:Activity[];invoices:InvoiceSummary[];options:{clients:ClientOption[];venues:VenueOption[];djs:DjOption[]}}
type PortalLink={id:string;expiresAt:string;revokedAt:string|null;lastUsedAt:string|null;url:string|null;lastInvitedAt:string;invitationCount:number;createdAt:string;state:'active'|'expired'|'revoked'}
type PortalSubmission={status:'not_started'|'draft'|'submitted';submission:{answers:Record<string,unknown>;acceptedName:string|null;submittedAt:string|null}|null;fields:QuestionnaireField[];templateVersion:number;wishes:Array<{id:string;category:string;artist:string|null;title:string|null;spotifyUrl:string|null;note:string|null}>}

const {data,refresh}=await useFetch<Detail>(`/api/admin/gigs/${id}`)
if(!data.value)throw createError({statusCode:404,statusMessage:'Gig niet gevonden'})

const tz='Europe/Amsterdam'
function localDate(value:string|null){if(!value)return '';const d=new Date(value);const offset=d.getTimezoneOffset();return new Date(d.getTime()-offset*60000).toISOString().slice(0,16)}
function iso(value:string){return value?new Date(value).toISOString():null}
function clientName(c:ClientOption){return c.companyName||[c.firstName,c.lastName].filter(Boolean).join(' ')||'Naamloze klant'}
function activityDate(value:string){return new Intl.DateTimeFormat('nl-NL',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',timeZone:tz}).format(new Date(value))}
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
const contactRows=(list:Contact[])=>list.map(c=>({name:c.name,role:c.role||'',email:c.email||'',phone:c.phone||'',notes:c.notes||''}))
const timelineRows=(list:Timeline[])=>list.map(t=>({time:t.time||'',title:t.title,description:t.description||''}))
const contacts=ref(contactRows(data.value.contacts))
const timeline=ref(timelineRows(data.value.timeline))
const saving=ref(false);const message=ref('')
const portalMessage=ref('');const portalUrl=ref('');const portalDays=ref(30);const portalBusy=ref(false)
const actionMenu=ref<HTMLDetailsElement|null>(null);const portalMenu=ref<HTMLDetailsElement|null>(null)
const {data:portalData,refresh:refreshPortal}=await useFetch<{links:PortalLink[]}>(`/api/admin/gigs/${id}/portal-links`,{immediate:canManageGigs.value})
const {data:reviewData}=await useFetch<{review:{rating:number,comment:string|null,authorName:string|null,createdAt:string}|null}>(`/api/admin/gigs/${id}/review`,{immediate:canManageGigs.value})
const {data:submissionData}=await useFetch<PortalSubmission>(`/api/admin/gigs/${id}/portal-submission`,{immediate:canManageGigs.value})

function addTimeline(){timeline.value.push({time:'',title:'',description:''})}
function closeMenus(){if(actionMenu.value)actionMenu.value.open=false;if(portalMenu.value)portalMenu.value.open=false}
const {isDirty,markSaved}=useUnsavedChanges(()=>({form,contacts:contacts.value,timeline:timeline.value}))
const confirmAction=useConfirm();const chooseAction=useChoice()
const clientLabel=computed(()=>data.value?.gig.clientCompanyName||[data.value?.gig.clientFirstName,data.value?.gig.clientLastName].filter(Boolean).join(' ')||'Nog geen klant')
const dayFormat=(d:Date)=>new Intl.DateTimeFormat('nl-NL',{weekday:'short',day:'numeric',month:'short',year:'numeric',timeZone:tz}).format(d).replace(/\./g,'')
const timeFormat=(d:Date)=>new Intl.DateTimeFormat('nl-NL',{hour:'2-digit',minute:'2-digit',timeZone:tz}).format(d)
function planningMoment(value:string|null,fallback='Niet gepland'){if(!value)return fallback;const d=new Date(value);return `${dayFormat(d)} · ${timeFormat(d)}`}
const gigWhen=computed(()=>{
  const gig=data.value?.gig;if(!gig?.startsAt)return 'Nog geen datum'
  const start=new Date(gig.startsAt)
  return gig.endsAt?`${dayFormat(start)} · ${timeFormat(start)} – ${timeFormat(new Date(gig.endsAt))}`:`${dayFormat(start)} · ${timeFormat(start)}`
})
const clientHead=computed(()=>data.value?.gig.clientId&&canManageGigs.value?resolveComponent('NuxtLink'):'div')
const venueLine=computed(()=>[data.value?.gig.venueName,data.value?.gig.venueCity].filter(Boolean).join(' · ')||'Nog geen locatie')
const venueAddressLines=computed(()=>{const a=data.value?.gig.venueAddress;return a?a.split(/,\s*|\n/).filter(Boolean):[]})
const mapsUrl=computed(()=>`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([data.value?.gig.venueName,data.value?.gig.venueAddress].filter(Boolean).join(' '))}`)
const deleteBlocked=computed(()=>!canDeleteGig.value||data.value?.gig.status!=='declined'||Boolean(data.value?.invoices.length))
const feeLabel=computed(()=>data.value?.gig.fee?money(Math.round(Number(data.value.gig.fee)*100),data.value.gig.currency):'Nog niet ingevuld')

const hasActivePortalLink=computed(()=>Boolean(portalData.value?.links.some(link=>link.state==='active')))
const activeLink=computed(()=>portalData.value?.links.find(link=>link.state==='active')??null)
const shownLink=computed(()=>activeLink.value||portalData.value?.links[0]||null)
function shortDate(value:string){return new Intl.DateTimeFormat('nl-NL',{day:'numeric',month:'short',timeZone:tz}).format(new Date(value)).replace(/\./g,'')}
function longDate(value:string){return new Intl.DateTimeFormat('nl-NL',{day:'numeric',month:'short',year:'numeric',timeZone:tz}).format(new Date(value)).replace(/\./g,'')}
function portalOpened(link:PortalLink){return link.lastUsedAt?`Laatst geopend ${activityDate(link.lastUsedAt)}`:'Nog niet geopend'}
function portalValidity(link:PortalLink){const days=Math.round((new Date(link.expiresAt).getTime()-new Date(link.createdAt).getTime())/86400000);return `Geldig tot ${longDate(link.expiresAt)} (${days} dagen)`}
const portalSummary=computed(()=>{
  const link=shownLink.value
  if(!link)return {state:'none',text:'Nog geen link'}
  if(link.state==='active')return {state:'active',text:`Actief · ${link.lastUsedAt?`laatst geopend ${shortDate(link.lastUsedAt)}`:'nog niet geopend'}`}
  return {state:link.state,text:labelFor(portalLinkStateLabels,link.state)}
})

const liveInvoices=computed(()=>(data.value?.invoices||[]).filter(invoice=>invoice.status!=='void'))
const currency=computed(()=>data.value?.gig.currency||'EUR')
const invoiceTotals=computed(()=>{
  const sent=liveInvoices.value.filter(invoice=>invoice.status==='finalized')
  const invoiced=sent.reduce((sum,invoice)=>sum+invoice.totalCents,0)
  const paid=sent.filter(invoice=>invoice.paymentStatus==='paid').reduce((sum,invoice)=>sum+invoice.totalCents,0)
  return {invoiced,paid,open:invoiced-paid}
})
const paidInvoices=computed(()=>liveInvoices.value.filter(invoice=>invoice.status==='finalized'&&invoice.paymentStatus==='paid'))
const invoiceSummary=computed(()=>{
  const count=liveInvoices.value.length
  return count?`${count} ${count===1?'factuur':'facturen'} · ${money(invoiceTotals.value.open,currency.value)} openstaand`:'Nog geen factuur'
})

type NextStep={title:string;hint?:string;action?:string;to?:string;run?:()=>void}
// The one thing that moves this gig forward: book it, invoice it, invite the client, get paid.
const nextStep=computed<NextStep|null>(()=>{
  const gig=data.value?.gig;if(!gig)return null
  if(gig.status==='declined'||gig.status==='cancelled')return null
  if(gig.status==='lead')return {title:'Boeking bevestigen',hint:gig.startsAt?undefined:'Vul eerst een datum in als die bekend is.',action:'Gig boeken',run:()=>{form.status='booked';save()}}
  const invoices=liveInvoices.value
  const draft=invoices.find(invoice=>invoice.status==='draft')
  const open=invoices.find(invoice=>invoice.status==='finalized'&&invoice.paymentStatus!=='paid')
  if(!invoices.length)return {title:'Factuur maken',hint:'Er zijn nog geen facturen voor deze gig.',action:'Factuur aanmaken',run:createInvoice}
  if(draft)return {title:'Factuur afronden',hint:'De conceptfactuur is nog niet verstuurd.',action:'Factuur openen',to:`/admin/invoices/${draft.id}`}
  if(!hasActivePortalLink.value&&!submissionData.value?.submission)return {title:'Klantportaal versturen',hint:'Laat de klant gegevens en muziekwensen invullen.',action:'Uitnodiging versturen',run:sendPortalInvitation}
  if(open)return {title:'Wachten op betaling',hint:`Te betalen vóór ${invoiceDate(open.dueDate)}.`,action:'Factuur bekijken',to:`/admin/invoices/${open.id}`}
  return {title:'Alles staat klaar',hint:'Geboekt, gefactureerd en betaald.'}
})
function runNextStep(){const step=nextStep.value;if(step?.to)navigateTo(step.to);else step?.run?.()}

type TabKey='overview'|'planning'|'client'|'finance'|'more'
const tabs:Array<{key:TabKey;label:string}>=[{key:'overview',label:'Overzicht'},{key:'planning',label:'Planning'},{key:'client',label:'Klant'},{key:'finance',label:'Financieel'},{key:'more',label:'Meer'}]
const initialTab=tabs.find(item=>item.key===route.query.tab)?.key
const tab=ref<TabKey>(initialTab||'overview')
const tabLabel=computed(()=>tabs.find(item=>item.key===tab.value)?.label||'')
function selectTab(key:TabKey){tab.value=key;editing.value=editing.value&&editSection[editing.value]===key?editing.value:'';if(typeof window!=='undefined')window.scrollTo({top:0})}
function moveTab(step:number){const index=tabs.findIndex(item=>item.key===tab.value);const next=tabs[(index+step+tabs.length)%tabs.length]!;tab.value=next.key;nextTick(()=>document.getElementById(`tab-${next.key}`)?.focus())}

// Read-only by default: a section only shows its form while it is being edited.
type Section='basics'|'planning'|'contacts'|'fee'|'notes'|'public'
const editSection:Record<Section,TabKey>={basics:'overview',planning:'planning',contacts:'client',fee:'finance',notes:'more',public:'more'}
const editing=ref<Section|''>('')
function edit(section:Section){
  if(!canEdit.value)return
  closeMenus();editing.value=section;tab.value=editSection[section]
  nextTick(()=>{const field=document.querySelector<HTMLElement>('[data-editing] input, [data-editing] select, [data-editing] textarea');field?.focus();field?.scrollIntoView({block:'center',behavior:'smooth'})})
}
function addContact(){contacts.value.push({name:'',role:'',email:'',phone:'',notes:''});edit('contacts')}
function resetForm(){
  const gig=data.value!.gig
  Object.assign(form,{title:gig.title||'',eventType:gig.eventType||'',clientId:gig.clientId||'',venueId:gig.venueId||'',assignedUserId:gig.assignedUserId||'',status:gig.status,startsAt:localDate(gig.startsAt),endsAt:localDate(gig.endsAt),loadInAt:localDate(gig.loadInAt),fee:gig.fee||'',currency:gig.currency,publicVisibility:gig.publicVisibility,publicTitle:gig.publicTitle||'',publicDescription:gig.publicDescription||'',internalNotes:gig.internalNotes||'',source:gig.source||''})
  contacts.value=contactRows(data.value!.contacts);timeline.value=timelineRows(data.value!.timeline)
}
function cancelEdit(){resetForm();editing.value='';message.value='';markSaved()}
async function cancelGig(){
  closeMenus()
  if(!(await confirmAction({title:'Deze gig annuleren?',body:'De status wordt Geannuleerd en de gig wordt direct opgeslagen.',confirmLabel:'Gig annuleren',tone:'danger'})))return
  form.status='cancelled';await save()
}
// Where the gig is in its life: booked, contract, invoice, review.
const stages=computed(()=>{
  const gig=data.value?.gig;if(!gig||(gig.status!=='lead'&&gig.status!=='booked'))return []
  const contractDone=submissionData.value?.status==='submitted'
  const paid=liveInvoices.value.length>0&&liveInvoices.value.every(invoice=>invoice.paymentStatus==='paid')
  const list=[
    {key:'booked',label:'Geboekt',icon:'lucide:check',done:gig.status==='booked'},
    {key:'contract',label:'Contract',icon:'lucide:file-text',done:contractDone},
    {key:'invoice',label:'Factuur',icon:'lucide:receipt',done:paid},
    {key:'review',label:'Review',icon:'lucide:star',done:Boolean(reviewData.value?.review)},
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
    markSaved();await refresh();editing.value='';message.value='Gig opgeslagen.'
  }catch(error:unknown){message.value=apiErrorMessage(error,'Gig opslaan is niet gelukt.')}
  finally{saving.value=false}
}
async function duplicate(){
  closeMenus()
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
  closeMenus()
  if(!canDeleteGig.value){
    await confirmAction({title:'Je kunt deze gig niet verwijderen',body:'Alleen een eigenaar kan gigs verwijderen. Vraag een eigenaar om de gig te verwijderen of je rol aan te passen.',confirmLabel:'Sluiten'})
    return
  }
  if(data.value?.gig.status!=='declined'){
    const choice=await chooseAction({title:'Gig moet eerst worden afgewezen',body:'Alleen afgewezen gigs kunnen worden verwijderd. Zet de status eerst op Afgewezen en sla de gig daarna op.',confirmLabel:'Status op Afgewezen zetten',secondaryLabel:'Annuleren'})
    if(choice==='confirm'){
      form.status='declined'
      message.value='Status aangepast naar Afgewezen. Sla de gig op om verwijderen mogelijk te maken.'
      edit('basics')
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
  closeMenus()
  portalBusy.value=true;portalMessage.value='';portalUrl.value=''
  try{
    const result=await $fetch<{url:string}>(`/api/admin/gigs/${id}/portal-links${resend?'/resend':''}`,{method:'POST',body:{expiresInDays:portalDays.value,revokeExisting:resend}})
    portalUrl.value=result.url;portalMessage.value=resend?'Er is een nieuwe uitnodiging gemaakt en oudere links zijn ingetrokken.':'Beveiligde link aangemaakt. Je kunt hem altijd opnieuw kopiëren.'
    await refreshPortal();await refresh()
  }catch(error:unknown){portalMessage.value=apiErrorMessage(error,'Portaallink aanmaken is niet gelukt.')}
  finally{portalBusy.value=false}
}
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
async function copyPortalUrl(url:string|null|undefined){
  if(!url)return
  await navigator.clipboard.writeText(url);portalMessage.value='Portaallink gekopieerd.'
}
function openPortal(url:string|null|undefined){if(url)window.open(url,'_blank','noopener')}
function answerValue(value:unknown){return Array.isArray(value)?value.join(', '):value===true?'Ja':value===false?'Nee':String(value??'—')}
const showAllActivity=ref(false)
const shownActivity=computed(()=>showAllActivity.value?data.value?.activity||[]:(data.value?.activity||[]).slice(0,5))
const contractLabel=computed(()=>labelFor(submissionStatusLabels,submissionData.value?.status||'not_started'))

useSeoMeta({title:()=>`${data.value?.gig.displayTitle||'Gig'} — DJ NightLight`,robots:'noindex, nofollow'})
</script>

<template><div v-if="data" class="gigpage" :class="{readonly:!canManageGigs}">
<header class="top">
  <div class="top-row">
    <NuxtLink v-if="tab==='overview'" to="/admin/gigs" class="back"><Icon name="lucide:chevron-left" aria-hidden="true" />Gigs</NuxtLink>
    <button v-else type="button" class="back" @click="selectTab('overview')"><Icon name="lucide:chevron-left" aria-hidden="true" />{{data.gig.displayTitle}}</button>
    <details v-if="canEdit" ref="actionMenu" class="menu action-menu"><summary class="icon-button" aria-label="Meer acties" title="Meer acties"><Icon name="lucide:ellipsis" aria-hidden="true" /></summary><div class="menu-popover" role="menu"><button type="button" role="menuitem" @click="edit('basics')"><Icon name="lucide:pencil" aria-hidden="true" />Bewerken</button><button type="button" role="menuitem" @click="duplicate"><Icon name="lucide:copy" aria-hidden="true" />Dupliceren</button><button v-if="data.gig.status!=='cancelled'" type="button" role="menuitem" class="menu-danger" @click="cancelGig"><Icon name="lucide:circle-x" aria-hidden="true" />Annuleren</button><button type="button" role="menuitem" class="menu-danger" :aria-disabled="deleteBlocked" @click="requestRemove"><Icon name="lucide:trash-2" aria-hidden="true" />Verwijderen</button></div></details>
  </div>
  <template v-if="tab==='overview'">
    <div class="title-row"><h1>{{data.gig.displayTitle}}</h1><AdminStatusChip kind="gig" :status="data.gig.status" /></div>
    <ul class="facts" aria-label="Samenvatting">
      <li><Icon name="lucide:calendar" aria-hidden="true" /><span>{{gigWhen}}</span></li>
      <li><Icon name="lucide:map-pin" aria-hidden="true" /><span>{{venueLine}}</span></li>
      <li><Icon name="lucide:user" aria-hidden="true" /><span>{{clientLabel}}</span></li>
      <li><Icon name="lucide:circle-euro" aria-hidden="true" /><span>{{feeLabel}}</span></li>
    </ul>
    <ol v-if="stages.length" class="stages" aria-label="Voortgang"><li v-for="stage in stages" :key="stage.key" class="stage" :data-state="stage.state" :aria-current="stage.state==='current'?'step':undefined"><span class="stage-dot"><Icon :name="stage.icon" aria-hidden="true" /></span><small>{{stage.label}}</small></li></ol>
    <button v-if="nextStep&&canEdit" type="button" class="next-step" :disabled="saving||portalBusy" @click="runNextStep"><Icon name="lucide:file-text" class="next-icon" aria-hidden="true" /><span class="next-body"><small>Volgende stap</small><strong>{{nextStep.title}}</strong><em v-if="nextStep.hint">{{nextStep.hint}}</em></span><Icon v-if="nextStep.action" name="lucide:chevron-right" aria-hidden="true" /></button>
  </template>
  <h1 v-else>{{tabLabel}}</h1>
</header>
<div v-if="!canManageGigs" class="readonly-note">Deze gig is aan jou toegewezen. Als DJ kun je alleen meekijken; een manager of eigenaar kan de boekingsgegevens wijzigen.</div>

<div class="tabs" role="tablist" aria-label="Gig onderdelen" @keydown.right.prevent="moveTab(1)" @keydown.left.prevent="moveTab(-1)"><button v-for="item in tabs" :id="`tab-${item.key}`" :key="item.key" type="button" role="tab" class="tab" :class="{active:tab===item.key}" :aria-selected="tab===item.key" :aria-controls="`panel-${item.key}`" :tabindex="tab===item.key?0:-1" @click="selectTab(item.key)">{{item.label}}</button></div>

<form :inert="!canEdit||undefined" @submit.prevent="save">

<!-- Overzicht: compact dashboard -->
<div v-show="tab==='overview'" id="panel-overview" class="tab-panel" role="tabpanel" aria-labelledby="tab-overview">
<section v-if="editing==='basics'" class="card" data-editing><h2 class="card-title">Gig bewerken</h2><div class="grid"><label class="wide">Titel<input v-model="form.title" :placeholder="titlePlaceholder"></label><label>Status<select v-model="form.status"><option value="lead">Lead</option><option value="booked">Geboekt</option><option value="declined">Afgewezen</option><option value="cancelled">Geannuleerd</option></select></label><label>Soort evenement<input v-model="form.eventType"></label><label>Klant<select v-model="form.clientId"><option value="">Geen klant</option><option v-for="c in data.options.clients" :key="c.id" :value="c.id">{{clientName(c)}}</option></select></label><label>Locatie<select v-model="form.venueId"><option value="">Geen locatie</option><option v-for="v in data.options.venues" :key="v.id" :value="v.id">{{v.name}}{{v.city?` — ${v.city}`:''}}</option></select></label><label>Toegewezen DJ<select v-model="form.assignedUserId"><option value="">Niet toegewezen</option><option v-for="dj in data.options.djs" :key="dj.id" :value="dj.id">{{dj.name}}</option></select></label><label>Bron<input v-model="form.source"></label></div><div class="edit-actions"><button type="button" class="secondary" @click="cancelEdit">Annuleren</button><button class="primary" type="submit" :disabled="saving">{{saving?'Opslaan…':'Opslaan'}}</button></div></section>

<ul class="summary-list">
<li><button type="button" class="row-card" @click="selectTab('planning')"><Icon name="lucide:calendar" class="lead-icon" aria-hidden="true" /><span class="row-body"><strong>Planning</strong><span>{{gigWhen}}</span><small>{{data.gig.loadInAt?`Opbouw ${planningMoment(data.gig.loadInAt)}`:'Opbouw nog niet gepland'}}</small></span><Icon name="lucide:chevron-right" class="chev" aria-hidden="true" /></button></li>
<li><button type="button" class="row-card" @click="selectTab('client')"><Icon name="lucide:users" class="lead-icon" aria-hidden="true" /><span class="row-body"><strong>Klant</strong><span>{{clientLabel}}</span><small>{{contacts.length?`${contacts.length} ${contacts.length===1?'contactpersoon':'contactpersonen'}`:'Geen contactpersoon'}}</small></span><Icon name="lucide:chevron-right" class="chev" aria-hidden="true" /></button></li>
<li v-if="canManageGigs"><button type="button" class="row-card" @click="selectTab('client')"><Icon name="lucide:link" class="lead-icon" aria-hidden="true" /><span class="row-body"><strong>Klantportaal</strong><span class="portal-state" :data-state="portalSummary.state"><i aria-hidden="true"/>{{portalSummary.text}}</span></span><Icon name="lucide:chevron-right" class="chev" aria-hidden="true" /></button></li>
<li><button type="button" class="row-card" @click="selectTab('finance')"><Icon name="lucide:wallet" class="lead-icon" aria-hidden="true" /><span class="row-body"><strong>Financieel</strong><span>{{feeLabel}}</span><small>{{canManageGigs?invoiceSummary:''}}</small></span><Icon name="lucide:chevron-right" class="chev" aria-hidden="true" /></button></li>
</ul>
</div>

<!-- Planning -->
<div v-show="tab==='planning'" id="panel-planning" class="tab-panel" role="tabpanel" aria-labelledby="tab-planning">
<div v-if="canEdit&&editing!=='planning'" class="panel-tools"><button type="button" class="text-button" @click="edit('planning')"><Icon name="lucide:pencil" aria-hidden="true" />Planning bewerken</button></div>
<section class="card" :data-editing="editing==='planning'||undefined">
  <header class="card-head"><Icon name="lucide:calendar" class="lead-icon" aria-hidden="true" /><h2>Datum & tijd</h2></header>
  <div v-if="editing==='planning'" class="grid"><label>Start<input v-model="form.startsAt" type="datetime-local"></label><label>Einde<input v-model="form.endsAt" type="datetime-local"></label></div>
  <dl v-else class="split"><div><dt>Start</dt><dd>{{planningMoment(data.gig.startsAt,'Nog niet ingevuld')}}</dd></div><div><dt>Einde</dt><dd>{{planningMoment(data.gig.endsAt,'Nog niet ingevuld')}}</dd></div></dl>
</section>

<section class="card" :data-editing="editing==='planning'||undefined">
  <header class="card-head"><Icon name="lucide:map-pin" class="lead-icon" aria-hidden="true" /><h2>Locatie</h2><a v-if="data.gig.venueName&&editing!=='planning'" class="icon-action" :href="mapsUrl" target="_blank" rel="noopener" aria-label="Route openen in Kaarten"><Icon name="lucide:send" aria-hidden="true" /></a></header>
  <label v-if="editing==='planning'">Locatie<select v-model="form.venueId"><option value="">Geen locatie</option><option v-for="v in data.options.venues" :key="v.id" :value="v.id">{{v.name}}{{v.city?` — ${v.city}`:''}}</option></select></label>
  <div v-else-if="data.gig.venueName" class="plain"><strong>{{data.gig.venueName}}</strong><span v-for="line in venueAddressLines" :key="line">{{line}}</span></div>
  <p v-else class="empty">Nog geen locatie gekozen.</p>
</section>

<section class="card" :data-editing="editing==='planning'||undefined">
  <header class="card-head"><Icon name="lucide:truck" class="lead-icon" aria-hidden="true" /><h2>Opbouw</h2></header>
  <label v-if="editing==='planning'">Opbouw<input v-model="form.loadInAt" type="datetime-local"></label>
  <p v-else class="plain" :class="{muted:!data.gig.loadInAt}">{{planningMoment(data.gig.loadInAt)}}</p>
</section>

<section class="card" :data-editing="editing==='planning'||undefined">
  <header class="card-head"><Icon name="lucide:list-checks" class="lead-icon" aria-hidden="true" /><h2>Timeline</h2></header>
  <template v-if="editing==='planning'">
    <div v-for="(item,index) in timeline" :key="index" class="repeat-row timeline-row"><input v-model="item.time" type="time" aria-label="Tijd"><input v-model="item.title" placeholder="Openingsdans, start DJ…" aria-label="Omschrijving" required><input v-model="item.description" placeholder="Notities" aria-label="Notities"><button type="button" aria-label="Item verwijderen" title="Item verwijderen" @click="timeline.splice(index,1)"><Icon name="lucide:x" aria-hidden="true" /></button></div>
    <button type="button" class="add-button" @click="addTimeline"><Icon name="lucide:plus" aria-hidden="true" />Item toevoegen</button>
  </template>
  <template v-else>
    <ul v-if="data.timeline.length" class="timeline-list"><li v-for="(item,index) in data.timeline" :key="item.id||index"><time>{{item.time?item.time.slice(0,5):'—'}}</time><span><strong>{{item.title}}</strong><small v-if="item.description">{{item.description}}</small></span></li></ul>
    <p v-else class="empty">Nog geen items in de timeline.</p>
  </template>
</section>
<div v-if="editing==='planning'" class="edit-actions"><button type="button" class="secondary" @click="cancelEdit">Annuleren</button><button class="primary" type="submit" :disabled="saving">{{saving?'Opslaan…':'Opslaan'}}</button></div>
</div>


<!-- Klant -->
<div v-show="tab==='client'" id="panel-client" class="tab-panel" role="tabpanel" aria-labelledby="tab-client">
<section class="card" :data-editing="editing==='contacts'||undefined">
  <component :is="clientHead" :to="data.gig.clientId&&canManageGigs?`/admin/clients/${data.gig.clientId}`:undefined" class="card-head link-head"><Icon name="lucide:users" class="lead-icon" aria-hidden="true" /><span class="head-text"><h2>Klant</h2><span>{{clientLabel}}</span></span><Icon v-if="data.gig.clientId&&canManageGigs" name="lucide:chevron-right" class="chev" aria-hidden="true" /></component>
  <div class="subsection">
    <div class="sub-head"><h3>Contactpersonen</h3><button v-if="canEdit&&editing!=='contacts'" type="button" class="icon-action" :aria-label="data.contacts.length?'Contactpersonen bewerken':'Contactpersoon toevoegen'" @click="data.contacts.length?edit('contacts'):addContact()"><Icon :name="data.contacts.length?'lucide:pencil':'lucide:plus'" aria-hidden="true" /></button></div>
    <template v-if="editing==='contacts'">
      <div v-for="(contact,index) in contacts" :key="index" class="contact-edit"><div class="grid"><label>Naam<input v-model="contact.name" required></label><label>Rol<input v-model="contact.role" placeholder="Ceremoniemeester, locatie…"></label><label>E-mail<input v-model="contact.email" type="email"></label><label>Telefoon<input v-model="contact.phone"></label><label class="wide">Notities<input v-model="contact.notes"></label></div><button type="button" class="remove-small" @click="contacts.splice(index,1)">Contact verwijderen</button></div>
      <button type="button" class="add-button" @click="contacts.push({name:'',role:'',email:'',phone:'',notes:''})"><Icon name="lucide:plus" aria-hidden="true" />Contactpersoon toevoegen</button>
      <div class="edit-actions"><button type="button" class="secondary" @click="cancelEdit">Annuleren</button><button class="primary" type="submit" :disabled="saving">{{saving?'Opslaan…':'Opslaan'}}</button></div>
    </template>
    <template v-else>
      <ul v-if="data.contacts.length" class="contact-list"><li v-for="(contact,index) in data.contacts" :key="contact.id||index"><strong>{{contact.name}}<small v-if="contact.role"> · {{contact.role}}</small></strong><a v-if="contact.email" :href="`mailto:${contact.email}`">{{contact.email}}</a><a v-if="contact.phone" :href="`tel:${contact.phone}`">{{contact.phone}}</a><small v-if="contact.notes">{{contact.notes}}</small></li></ul>
      <p v-else class="empty">Nog geen contactpersonen toegevoegd.</p>
    </template>
  </div>
</section>

<section v-if="canEdit" class="card portal-card">
  <header class="card-head"><Icon name="lucide:link" class="lead-icon" aria-hidden="true" /><h2>Klantportaal</h2></header>
  <template v-if="shownLink">
    <p class="portal-state" :data-state="shownLink.state"><i aria-hidden="true"/>{{labelFor(portalLinkStateLabels,shownLink.state)}}</p>
    <p v-if="shownLink.state==='active'" class="portal-meta">{{portalValidity(shownLink)}} · {{portalOpened(shownLink).toLowerCase()}}</p>
    <p v-else class="portal-meta">Verlopen of ingetrokken op {{longDate(shownLink.revokedAt||shownLink.expiresAt)}}</p>
  </template>
  <p v-else class="empty">Er zijn nog geen portaallinks uitgegeven.</p>
  <button type="button" class="primary wide-button" :disabled="portalBusy" @click="sendPortalInvitation">{{hasActivePortalLink?'Nieuwe uitnodiging versturen':'Uitnodiging versturen'}}</button>
  <div v-if="shownLink?.state==='active'" class="portal-tools">
    <button type="button" class="ghost with-icon" :disabled="!shownLink.url" @click="openPortal(shownLink.url)"><Icon name="lucide:external-link" aria-hidden="true" />Openen</button>
    <button type="button" class="ghost with-icon" :disabled="!shownLink.url" @click="copyPortalUrl(shownLink.url)"><Icon name="lucide:copy" aria-hidden="true" />Kopiëren</button>
    <details ref="portalMenu" class="menu"><summary class="ghost icon-only" aria-label="Meer portaalacties" title="Meer portaalacties"><Icon name="lucide:ellipsis-vertical" aria-hidden="true" /></summary><div class="menu-popover" role="menu"><label class="menu-field">Geldigheid (dagen)<input v-model.number="portalDays" type="number" min="1" max="365"></label><button type="button" role="menuitem" :disabled="portalBusy" @click="createPortalLink(false)"><Icon name="lucide:link" aria-hidden="true" />Nieuwe link aanmaken</button></div></details>
    <button type="button" class="revoke" @click="revokePortalLink(shownLink.id)">Link intrekken</button>
  </div>
  <p v-if="portalMessage" class="portal-message" role="status">{{portalMessage}}</p>
</section>

<section v-if="canEdit&&submissionData" class="card">
  <header class="card-head"><Icon name="lucide:file-text" class="lead-icon" aria-hidden="true" /><h2>Contract & muziekwensen</h2><NuxtLink to="/admin/questionnaire" class="icon-action" aria-label="Template bewerken" title="Template bewerken"><Icon name="lucide:settings-2" aria-hidden="true" /></NuxtLink></header>
  <p class="contract-state" :data-state="submissionData.status"><i aria-hidden="true"/>{{contractLabel}}</p>
  <p class="portal-meta">Vragenlijstversie {{submissionData.templateVersion}}<template v-if="submissionData.submission?.submittedAt"> · {{activityDate(submissionData.submission.submittedAt)}}</template></p>
  <details v-if="submissionData.submission" class="fold"><summary>Antwoorden bekijken</summary><dl class="answer-list"><div v-for="field in submissionData.fields" :key="field.id"><dt>{{field.label}}</dt><dd>{{answerValue(submissionData.submission.answers[field.id])}}</dd></div><div><dt>Geaccepteerd door</dt><dd>{{submissionData.submission.acceptedName||'—'}}</dd></div></dl></details>
  <details class="fold"><summary>Muziekwensen<span class="count">{{submissionData.wishes.length||'geen'}}</span></summary>
    <p v-if="!submissionData.wishes.length" class="empty">Geen muziekwensen ingediend.</p>
    <ul v-else class="wish-list"><li v-for="wish in submissionData.wishes" :key="wish.id"><small>{{labelFor(musicWishCategoryLabels,wish.category)}}</small><strong>{{[wish.artist,wish.title].filter(Boolean).join(' — ')||wish.note||'Naamloze wens'}}</strong><a v-if="wish.spotifyUrl" :href="wish.spotifyUrl" target="_blank" rel="noreferrer">Openen in Spotify</a><small v-if="wish.note&&(wish.artist||wish.title)">{{wish.note}}</small></li></ul>
  </details>
</section>

<!-- Communicatie hoort bij de klant -->
<AdminGigEmails v-if="canEdit" :gig-id="id" :portal-url="portalUrl" />
</div>


<!-- Financieel -->
<div v-show="tab==='finance'" id="panel-finance" class="tab-panel" role="tabpanel" aria-labelledby="tab-finance">
<section class="card" :data-editing="editing==='fee'||undefined">
  <header class="card-head"><Icon name="lucide:wallet" class="lead-icon" aria-hidden="true" /><span class="head-text"><h2>Gage</h2><strong class="amount">{{feeLabel}}</strong></span><button v-if="canEdit&&editing!=='fee'" type="button" class="icon-action" aria-label="Gage bewerken" @click="edit('fee')"><Icon name="lucide:pencil" aria-hidden="true" /></button></header>
  <template v-if="editing==='fee'"><div class="grid"><label>Gage<input v-model="form.fee" inputmode="decimal"></label><label>Valuta<input v-model="form.currency" maxlength="3"></label></div><div class="edit-actions"><button type="button" class="secondary" @click="cancelEdit">Annuleren</button><button class="primary" type="submit" :disabled="saving">{{saving?'Opslaan…':'Opslaan'}}</button></div></template>
  <dl v-else class="split single"><div><dt>Valuta</dt><dd>{{data.gig.currency}}</dd></div></dl>
</section>

<template v-if="canManageGigs">
<section class="card">
  <header class="card-head"><Icon name="lucide:file-text" class="lead-icon" aria-hidden="true" /><h2>Facturen</h2></header>
  <p v-if="!data.invoices.length" class="empty">Nog geen facturen voor deze gig.</p>
  <NuxtLink v-for="invoice in data.invoices" :key="invoice.id" :to="`/admin/invoices/${invoice.id}`" class="invoice-row">
    <span class="invoice-main"><strong>{{invoice.invoiceNumber||'Conceptfactuur'}}</strong><small>{{invoice.status==='draft'?'Concept':`Uitgegeven ${invoiceDate(invoice.issueDate)} · vervalt ${invoiceDate(invoice.dueDate)}`}}</small><span class="invoice-statuses"><AdminStatusChip v-if="invoice.status==='finalized'" kind="payment" :status="invoice.paymentStatus" :provider="invoice.paymentProvider" /><AdminStatusChip v-else kind="invoice" :status="invoice.status" /><small class="stripe-state" :data-state="invoice.stripeStatus||invoice.paymentStatus">{{stripeLabel(invoice)}}</small></span></span>
    <strong class="invoice-total">{{money(invoice.totalCents,invoice.currency)}}</strong><Icon name="lucide:chevron-right" class="chev" aria-hidden="true" />
  </NuxtLink>
  <button v-if="canEdit" type="button" :class="data.invoices.length?'outline wide-button':'primary wide-button'" @click="createInvoice">Factuur aanmaken</button>
</section>

<section class="card">
  <header class="card-head"><Icon name="lucide:credit-card" class="lead-icon" aria-hidden="true" /><h2>Betalingen</h2></header>
  <p v-if="!paidInvoices.length" class="empty">Nog geen betalingen geregistreerd.</p>
  <ul v-else class="payment-list"><li v-for="invoice in paidInvoices" :key="invoice.id"><span><strong>{{invoice.invoiceNumber||'Factuur'}}</strong><small>{{stripeLabel(invoice)}}<template v-if="invoice.paidAt"> · {{longDate(invoice.paidAt)}}</template></small></span><strong>{{money(invoice.totalCents,invoice.currency)}}</strong></li></ul>
</section>

<section class="card">
  <header class="card-head"><Icon name="lucide:trending-up" class="lead-icon" aria-hidden="true" /><h2>Overzicht</h2></header>
  <dl class="totals"><div><dt>Totaal gefactureerd</dt><dd>{{money(invoiceTotals.invoiced,currency)}}</dd></div><div><dt>Totaal betaald</dt><dd>{{money(invoiceTotals.paid,currency)}}</dd></div><div class="open"><dt>Openstaand</dt><dd>{{money(invoiceTotals.open,currency)}}</dd></div></dl>
</section>
</template>
</div>

<!-- Meer: interne notities, zichtbaarheid en activiteit -->
<div v-show="tab==='more'" id="panel-more" class="tab-panel" role="tabpanel" aria-labelledby="tab-more">
<section class="card" :data-editing="editing==='notes'||undefined">
  <header class="card-head"><Icon name="lucide:notebook-pen" class="lead-icon" aria-hidden="true" /><h2>Interne notities</h2></header>
  <template v-if="editing==='notes'"><label class="sr-label">Interne notities<textarea v-model="form.internalNotes" rows="6"/></label><div class="edit-actions"><button type="button" class="secondary" @click="cancelEdit">Annuleren</button><button class="primary" type="submit" :disabled="saving">{{saving?'Opslaan…':'Opslaan'}}</button></div></template>
  <template v-else>
    <p v-if="data.gig.internalNotes" class="notes-text">{{data.gig.internalNotes}}</p>
    <p v-else class="empty">Nog geen interne notities.</p>
    <button v-if="canEdit" type="button" class="add-button" @click="edit('notes')"><Icon :name="data.gig.internalNotes?'lucide:pencil':'lucide:plus'" aria-hidden="true" />{{data.gig.internalNotes?'Notitie bewerken':'Notitie toevoegen'}}</button>
  </template>
</section>

<section v-if="reviewData?.review" class="card">
  <header class="card-head"><Icon name="lucide:star" class="lead-icon" aria-hidden="true" /><h2>Review van de klant</h2></header>
  <p class="plain"><strong>{{'★'.repeat(reviewData.review.rating)}}{{'☆'.repeat(5-reviewData.review.rating)}}</strong> <small>{{reviewData.review.authorName||'Anoniem'}}</small></p><p v-if="reviewData.review.comment" class="plain">“{{reviewData.review.comment}}”</p>
</section>

<section class="card" :data-editing="editing==='public'||undefined">
  <header class="card-head"><Icon name="lucide:globe" class="lead-icon" aria-hidden="true" /><h2>Zichtbaarheid</h2><button v-if="canEdit&&editing!=='public'" type="button" class="icon-action" aria-label="Zichtbaarheid bewerken" @click="edit('public')"><Icon name="lucide:pencil" aria-hidden="true" /></button></header>
  <template v-if="editing==='public'"><label class="checkbox"><input v-model="form.publicVisibility" type="checkbox"> Toon deze gig in de publieke agenda</label><div class="grid public-fields"><label>Publieke titel<input v-model="form.publicTitle" :placeholder="publicTitlePlaceholder"></label><label class="wide">Publieke beschrijving<textarea v-model="form.publicDescription" rows="3"/></label></div><div class="edit-actions"><button type="button" class="secondary" @click="cancelEdit">Annuleren</button><button class="primary" type="submit" :disabled="saving">{{saving?'Opslaan…':'Opslaan'}}</button></div></template>
  <p v-else class="plain" :class="{muted:!data.gig.publicVisibility}">{{data.gig.publicVisibility?`Zichtbaar in de publieke agenda${data.gig.publicTitle?` als “${data.gig.publicTitle}”`:''}`:'Niet zichtbaar in de publieke agenda'}}</p>
</section>

<section class="card activity">
  <header class="card-head"><Icon name="lucide:clock" class="lead-icon" aria-hidden="true" /><h2>Activiteit</h2></header>
  <p v-if="!data.activity.length" class="empty">Nog geen activiteit vastgelegd.</p>
  <ol v-else class="activity-list"><li v-for="item in shownActivity" :key="item.id"><strong>{{labelFor(activityActionLabels,item.action)}}<template v-if="item.actorName"> · {{item.actorName}}</template></strong><small>{{activityDate(item.createdAt)}}</small></li></ol>
  <button v-if="data.activity.length>5" type="button" class="all-activity" :aria-expanded="showAllActivity" @click="showAllActivity=!showAllActivity"><Icon name="lucide:list" aria-hidden="true" />{{showAllActivity?'Minder activiteit tonen':'Alle activiteit tonen'}}<Icon :name="showAllActivity?'lucide:chevron-up':'lucide:chevron-right'" class="chev" aria-hidden="true" /></button>
</section>
</div>

<div v-if="canEdit&&(isDirty||message)" class="save-bar"><div><strong role="status">{{message||(isDirty?'Niet-opgeslagen wijzigingen':'Alles is opgeslagen')}}</strong><span v-if="isDirty">Wijzigingen worden pas bewaard na opslaan.</span></div><button v-if="isDirty" class="primary" type="submit" :disabled="saving">{{saving?'Opslaan…':'Gig opslaan'}}</button></div>
</form>

</div></template>

<style scoped>
.gigpage{max-width:46rem;margin-inline:auto;padding-bottom:2rem;--accent:#9d5cff;--accent-soft:#c9b2ef}
.top{margin-bottom:.9rem}
.top-row{display:flex;align-items:center;justify-content:space-between;gap:.75rem;min-height:2.75rem}
.back{display:inline-flex;align-items:center;gap:.25rem;min-height:2.75rem;max-width:calc(100% - 3.5rem);padding:0;border:0;background:transparent;color:var(--text-muted);font:inherit;font-size:.9rem;text-decoration:none;cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.back:hover{color:var(--text)}
h1{margin:.1rem 0 .15rem;font-size:clamp(1.9rem,7vw,2.6rem);letter-spacing:-.03em;line-height:1.1;overflow-wrap:anywhere}
.title-row{display:flex;flex-wrap:wrap;align-items:center;gap:.5rem .8rem}
.facts{display:grid;gap:.55rem;margin:.9rem 0 1rem;padding:0;list-style:none}
.facts li{display:flex;align-items:center;gap:.7rem;color:var(--text);line-height:1.3}
.facts li :deep(svg){flex:none;width:1.15rem;height:1.15rem;color:var(--text-muted)}
.facts li span{min-width:0;overflow-wrap:anywhere}

.stages{display:grid;grid-template-columns:repeat(4,1fr);margin:0 0 1rem;padding:.9rem .5rem .7rem;border:1px solid var(--border);border-radius:1rem;list-style:none;background:var(--surface-card)}
.stage{position:relative;display:grid;justify-items:center;gap:.35rem;color:var(--text-subtle)}
.stage:not(:last-child)::after{content:"";position:absolute;top:1.1rem;left:calc(50% + 1.5rem);width:calc(100% - 3rem);height:2px;background:var(--border-strong)}
.stage[data-state=done]:not(:last-child)::after{background:var(--accent)}
.stage-dot{display:grid;place-items:center;width:2.2rem;height:2.2rem;border:1.5px solid var(--border-strong);border-radius:50%;background:var(--surface-card);color:var(--text-muted)}
.stage-dot :deep(svg){width:1rem;height:1rem}
.stage[data-state=done] .stage-dot{border-color:var(--accent);background:var(--accent);color:#fff}
.stage[data-state=current] .stage-dot{border-color:var(--accent);color:var(--accent-soft)}
.stage[data-state=done],.stage[data-state=current]{color:var(--text)}
.stage small{font-size:.72rem}

.next-step{display:flex;align-items:center;gap:.9rem;width:100%;margin:0 0 1rem;padding:1rem 1.1rem;border:1px solid #5b3a9a;border-radius:1rem;background:linear-gradient(135deg,#4a2a85,#2a1a4d);color:var(--text);font:inherit;text-align:left;cursor:pointer}
.next-step:disabled{opacity:.7;cursor:progress}
.next-icon{flex:none;width:2rem;height:2rem;color:var(--accent-soft)}
.next-body{display:grid;gap:.15rem;flex:1;min-width:0}
.next-body small{color:var(--accent-soft);font-size:.7rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase}
.next-body strong{font-size:1.3rem;line-height:1.2}
.next-body em{color:var(--text-muted);font-size:.85rem;font-style:normal;line-height:1.35}
.next-step :deep(svg:last-child){flex:none;color:var(--accent-soft)}

.readonly-note{margin-bottom:1rem;padding:.8rem 1rem;border:1px solid #302a38;border-radius:.8rem;background:#141119;color:#aaa3b4}
.gigpage.readonly form input,.readonly form select,.readonly form textarea{pointer-events:none}

.tabs{display:grid;grid-template-columns:repeat(5,auto);justify-content:space-between;margin:0 0 1rem;border-bottom:1px solid var(--border)}
.tab{position:relative;min-height:2.75rem;padding:0 .15rem;border:0;background:transparent;color:var(--text-muted);font:inherit;font-size:.85rem;cursor:pointer}
.tab.active{color:var(--text);font-weight:700}
.tab.active::after{content:"";position:absolute;inset:auto 0 -1px;height:2px;border-radius:2px;background:var(--accent)}

.tab-panel{display:grid;gap:.75rem}
.summary-list{display:grid;gap:.75rem;margin:0;padding:0;list-style:none}
.card,.row-card{border:1px solid var(--border);border-radius:1rem;background:var(--surface-card)}
.card{padding:1rem 1.1rem}
.card[data-editing]{border-color:#4b3a72}
.row-card{display:flex;align-items:flex-start;gap:.85rem;width:100%;padding:1rem 1.1rem;color:var(--text);font:inherit;text-align:left;cursor:pointer}
.row-card:hover{border-color:var(--border-strong)}
.row-body{display:grid;gap:.2rem;flex:1;min-width:0}
.row-body strong{font-size:1rem}
.row-body span{color:var(--text)}
.row-body small{color:var(--text-subtle);font-size:.85rem}
.lead-icon{flex:none;width:1.35rem;height:1.35rem;margin-top:.1rem;color:var(--accent)}
.chev{flex:none;align-self:center;width:1.1rem;height:1.1rem;color:var(--text-muted)}

.card-head{display:flex;align-items:center;gap:.7rem;margin:0 0 .7rem}
.card-head h2{flex:1;margin:0;font-size:1rem}
.link-head{color:inherit;text-decoration:none}
.head-text{display:grid;gap:.15rem;flex:1;min-width:0}
.head-text span{color:var(--text-muted)}
.amount{font-size:1.45rem}
.icon-action{display:grid;place-items:center;flex:none;width:2.75rem;height:2.75rem;margin:-.6rem -.6rem -.6rem 0;border:0;border-radius:.65rem;background:transparent;color:var(--text-muted);cursor:pointer}
.icon-action:hover{color:var(--text)}
.icon-action :deep(svg){width:1.1rem;height:1.1rem}
.plain{display:grid;gap:.15rem;margin:0;color:var(--text)}
.plain span{color:var(--text-muted)}
.muted,.empty{color:var(--text-subtle)}
.empty{margin:0 0 .3rem;font-size:.9rem}
.split{display:grid;margin:0}
.split>div{display:grid;gap:.2rem;padding:.7rem 0}
.split>div+div{border-top:1px solid var(--border)}
.split>div:first-child{padding-top:0}
.split.single>div{padding-block:.25rem 0;border:0}
dt{color:var(--text-muted);font-size:.85rem}
dd{margin:0}
.split dd{font-size:1.05rem}

.add-button,.outline{display:inline-flex;align-items:center;justify-content:center;gap:.5rem;min-height:2.75rem;padding:.5rem .9rem;border:1px solid var(--border-strong);border-radius:.7rem;background:transparent;color:var(--text);font:inherit;font-size:.9rem;font-weight:600;text-decoration:none;cursor:pointer}
.add-button{width:100%;margin-top:.5rem;border-color:#4b3a72;background:#1b1428;color:var(--accent-soft)}
.add-button :deep(svg){width:1rem;height:1rem}
.text-button{display:inline-flex;align-items:center;gap:.4rem;min-height:2.75rem;padding:0;border:0;background:transparent;color:var(--accent-soft);font:inherit;font-size:.9rem;cursor:pointer}
.with-icon :deep(svg){width:1rem;height:1rem}
.outline:disabled{opacity:.5;cursor:not-allowed}

.primary,.secondary{min-height:2.75rem;padding:.6rem 1rem;border:0;border-radius:.7rem;font:inherit;font-weight:700;cursor:pointer}
.primary{background:var(--button-primary-bg);color:var(--button-primary-fg)}
.secondary{background:var(--button-secondary-bg);color:var(--button-secondary-fg)}
.primary:disabled{opacity:.6;cursor:progress}
.wide-button{width:100%;margin-top:.7rem}
.edit-actions{display:flex;justify-content:flex-end;gap:.6rem;margin-top:.9rem}

.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.8rem}
.wide{grid-column:1/-1}
label{display:grid;gap:.35rem;color:var(--text-muted);font-size:.8rem}
.sr-label{font-size:0}
.sr-label textarea{font-size:1rem}
input:focus,select:focus,textarea:focus{border-color:rgba(157,92,255,.72);outline:none;box-shadow:0 0 0 3px rgba(157,92,255,.12)}
input,select,textarea{min-height:2.75rem;width:100%;min-width:0;border:1px solid var(--border-strong);border-radius:.65rem;padding:.7rem;background:var(--surface-input);color:var(--text);font:inherit}
.checkbox{display:flex;align-items:center;gap:.6rem}
.checkbox input{width:auto}
.public-fields{margin-top:.8rem}

.repeat-row{display:grid;gap:.5rem;margin-top:.5rem}
.timeline-row{grid-template-columns:7rem 1fr 1.5fr 2.75rem}
.timeline-row button{border:0;border-radius:.55rem;background:#241a20;color:#eab4bc;cursor:pointer}
.timeline-list{display:grid;gap:.7rem;margin:0;padding:0;list-style:none}
.timeline-list li{display:grid;grid-template-columns:3.2rem 1fr;gap:.6rem}
.timeline-list time{color:var(--accent-soft);font-variant-numeric:tabular-nums;font-weight:700}
.timeline-list strong,.timeline-list small{display:block}
.timeline-list small,.contact-list small{color:var(--text-subtle)}
.contact-list{display:grid;gap:.8rem;margin:0;padding:0;list-style:none}
.contact-list li{display:grid;gap:.15rem}
.contact-list a{color:var(--accent-soft);text-decoration:none;overflow-wrap:anywhere}
.contact-edit{margin-bottom:.8rem;padding-bottom:.8rem;border-bottom:1px solid var(--border)}
.remove-small{margin-top:.5rem;padding:0;border:0;background:transparent;color:#d9959f;font:inherit;font-size:.85rem;cursor:pointer}

.portal-state,.contract-state{display:flex;align-items:center;gap:.5rem;margin:0 0 .3rem;color:var(--text-muted)}
.portal-state i,.contract-state i{width:.6rem;height:.6rem;border:2px solid var(--text-subtle);border-radius:50%}
.portal-state[data-state=active]{color:#7fe3a4}
.portal-state[data-state=active] i{border-color:#22c55e;background:#22c55e}
.contract-state{display:inline-flex;padding:.35rem .7rem;border-radius:.6rem;background:#1b1624;color:var(--text)}
.portal-meta{margin:.2rem 0 .8rem;color:var(--text-muted);font-size:.85rem;line-height:1.45}
.portal-message{margin:.7rem 0 0;color:var(--text-muted);font-size:.8rem}
.portal-tools{display:flex;flex-wrap:wrap;align-items:center;gap:.2rem .35rem;margin-top:.5rem}
.ghost{display:inline-flex;align-items:center;justify-content:center;gap:.4rem;min-height:2.75rem;padding:.4rem .6rem;border:0;border-radius:.6rem;background:transparent;color:var(--text-muted);font:inherit;font-size:.85rem;cursor:pointer}
.ghost:hover{color:var(--text)}
.ghost:disabled{opacity:.5;cursor:not-allowed}
.ghost :deep(svg){width:1rem;height:1rem}
.panel-tools{display:flex;justify-content:flex-end;margin-bottom:-.25rem}
.subsection{margin-top:.2rem;padding-top:.7rem;border-top:1px solid var(--border)}
.sub-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:.4rem}
.sub-head h3{margin:0;color:var(--text-muted);font-size:.85rem;font-weight:600}
.sub-head .icon-action{margin-block:-.6rem}
.fold{margin-top:.4rem;border-top:1px solid var(--border)}
.fold summary{display:flex;align-items:center;justify-content:space-between;min-height:2.75rem;color:var(--text);cursor:pointer}
.fold .count{color:var(--text-subtle);font-size:.85rem}
.fold[open]>summary{margin-bottom:.3rem}
.icon-only{width:2.75rem;padding:0;list-style:none}
.menu-popover{min-width:14rem}
.icon-only::-webkit-details-marker{display:none}
.revoke{margin-left:auto;min-height:2.75rem;padding:.4rem .6rem;border:0;background:transparent;color:#ff6b7d;font:inherit;font-size:.85rem;cursor:pointer}
.answer-list{display:grid;gap:.6rem;margin:0}
.answer-list dd{font-weight:600}
.wish-list{display:grid;gap:.8rem;margin:0;padding:0;list-style:none}
.wish-list li{display:grid;gap:.1rem}
.wish-list small{color:var(--text-subtle)}
.wish-list a{color:var(--accent-soft);font-size:.85rem}

.menu{position:relative}
.menu>summary{list-style:none;cursor:pointer}
.menu>summary::-webkit-details-marker{display:none}
.icon-button{display:grid;place-items:center;width:2.75rem;height:2.75rem;border:1px solid var(--border-strong);border-radius:.8rem;background:var(--surface-card);color:var(--text)}
.menu-popover{position:absolute;z-index:var(--z-raised);top:calc(100% + .4rem);right:0;min-width:13rem;padding:.35rem;border:1px solid var(--border);border-radius:.75rem;background:var(--surface-raised);box-shadow:0 14px 40px rgba(0,0,0,.45)}
.menu-popover button{display:flex;align-items:center;gap:.65rem;width:100%;min-height:2.75rem;padding:.5rem .75rem;border:0;border-radius:.55rem;background:transparent;color:var(--text);font:inherit;text-align:left;cursor:pointer}
.menu-popover button:hover{background:var(--surface-input)}
.menu-popover .menu-danger{color:#f0a5ad}
.menu-popover .menu-danger[aria-disabled=true]{opacity:.45;cursor:not-allowed}
.menu-field{padding:.5rem .75rem}

.invoice-row{display:flex;align-items:center;gap:.8rem;padding:.8rem 0;border-top:1px solid var(--border);color:inherit;text-decoration:none}
.invoice-main{display:grid;gap:.2rem;flex:1;min-width:0}
.invoice-main small{color:var(--text-subtle);font-size:.78rem}
.invoice-statuses{display:flex;flex-wrap:wrap;align-items:center;gap:.4rem}
.stripe-state[data-state=succeeded],.stripe-state[data-state=paid]{color:#8fe1ad}
.stripe-state[data-state=failed]{color:#ffadb7}
.invoice-total{white-space:nowrap}
.payment-list{display:grid;gap:.7rem;margin:0;padding:0;list-style:none}
.payment-list li{display:flex;justify-content:space-between;gap:1rem}
.payment-list span{display:grid;gap:.15rem}
.payment-list small{color:var(--text-subtle)}
.totals{display:grid;margin:0}
.totals>div{display:flex;justify-content:space-between;gap:1rem;padding:.55rem 0}
.totals>div+div{border-top:1px solid var(--border)}
.totals dd{font-weight:700;font-variant-numeric:tabular-nums}
.totals .open dd{color:#ff6b7d}

.notes-text{margin:0 0 .3rem;white-space:pre-wrap;overflow-wrap:anywhere}
.activity-list{position:relative;display:grid;gap:1rem;margin:0;padding:0;list-style:none}
.activity-list li{position:relative;display:grid;gap:.1rem;padding-left:1.6rem}
.activity-list li::before{content:"";position:absolute;left:.15rem;top:.3rem;width:.7rem;height:.7rem;border-radius:50%;background:var(--accent)}
.activity-list li:not(:last-child)::after{content:"";position:absolute;left:.44rem;top:1.1rem;bottom:-1.15rem;width:2px;background:#3a2c58}
.activity-list strong{font-size:.95rem}
.activity-list small{color:var(--text-subtle)}
.all-activity{display:flex;align-items:center;gap:.6rem;width:100%;min-height:2.75rem;margin-top:.8rem;padding:.5rem 0 0;border:0;border-top:1px solid var(--border);background:transparent;color:var(--text);font:inherit;cursor:pointer}
.all-activity .chev{margin-left:auto}

.save-bar{position:sticky;bottom:1rem;z-index:var(--z-raised);display:flex;align-items:center;justify-content:space-between;gap:1rem;margin:1rem 0 0;padding:.9rem 1.1rem;border:1px solid #35303b;border-radius:1rem;background:rgba(20,17,25,.94);backdrop-filter:blur(14px)}
.save-bar strong,.save-bar span{display:block}
.save-bar span{margin-top:.2rem;color:var(--text-subtle);font-size:.75rem}

@media(max-width:700px){
  .grid,.timeline-row{grid-template-columns:1fr}
  .wide{grid-column:auto}
  .save-bar{align-items:stretch;flex-direction:column}
  .save-bar .primary{width:100%}
}
@media(min-width:760px){
  .summary-list{grid-template-columns:repeat(2,1fr)}
}
</style>
