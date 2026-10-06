<script setup lang="ts">
import { apiErrorMessage } from '~/utils/api-error'
import { gigDisplayTitle } from '~~/shared/gig-title'
import type { QuestionnaireField } from '~~/shared/questionnaire'
import { activityActionLabels, labelFor, musicWishCategoryLabels, portalLinkStateLabels, submissionStatusLabels } from '~~/shared/labels'

definePageMeta({layout:'admin'})
const route=useRoute();const id=String(route.params.id)
const {user}=useUserSession();const canManageGigs=computed(()=>user.value?.role==='owner'||user.value?.role==='manager');const canDeleteGig=computed(()=>user.value?.role==='owner')
const online=useOnline()
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
type PortalLink={id:string;expiresAt:string;revokedAt:string|null;lastUsedAt:string|null;url:string|null;lastInvitedAt:string;invitationCount:number;createdAt:string;state:'active'|'expired'|'revoked'}
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
const editingDetails=ref(false);const editingPlanning=ref(false);const editingFinance=ref(false);const editingContacts=ref(false);const editingInternal=ref(false);const editingVisibility=ref(false)
const {data:portalData,refresh:refreshPortal}=await useFetch<{links:PortalLink[]}>(`/api/admin/gigs/${id}/portal-links`,{immediate:canManageGigs.value})
const {data:reviewData}=await useFetch<{review:{rating:number,comment:string|null,authorName:string|null,createdAt:string}|null}>(`/api/admin/gigs/${id}/review`,{immediate:canManageGigs.value})
const {data:submissionData}=await useFetch<PortalSubmission>(`/api/admin/gigs/${id}/portal-submission`,{immediate:canManageGigs.value})
const hasActivePortalLink=computed(()=>Boolean(portalData.value?.links.some(link=>link.state==='active')))
const activePortalLink=computed(()=>portalData.value?.links.find(link=>link.state==='active')||null)

function addContact(){contacts.value.push({name:'',role:'',email:'',phone:'',notes:''});editingContacts.value=true}
function addTimeline(){timeline.value.push({time:'',title:'',description:''});editingPlanning.value=true}
function closeActionMenu(){if(actionMenu.value)actionMenu.value.open=false}
const {isDirty,markSaved}=useUnsavedChanges(()=>({form,contacts:contacts.value,timeline:timeline.value}))
const confirmAction=useConfirm();const chooseAction=useChoice()
const clientLabel=computed(()=>data.value?.gig.clientCompanyName||[data.value?.gig.clientFirstName,data.value?.gig.clientLastName].filter(Boolean).join(' ')||'Nog geen klant')
const assignedDjLabel=computed(()=>data.value?.options.djs.find(dj=>dj.id===data.value?.gig.assignedUserId)?.name||'Niet toegewezen')
const gigWhen=computed(()=>{
  const gig=data.value?.gig;if(!gig?.startsAt)return 'Nog geen datum'
  const tz='Europe/Amsterdam';const start=new Date(gig.startsAt)
  const day=new Intl.DateTimeFormat('nl-NL',{weekday:'short',day:'numeric',month:'long',year:'numeric',timeZone:tz}).format(start)
  const time=(d:Date)=>new Intl.DateTimeFormat('nl-NL',{hour:'2-digit',minute:'2-digit',timeZone:tz}).format(d)
  return gig.endsAt?`${day} · ${time(start)}–${time(new Date(gig.endsAt))}`:`${day} · ${time(start)}`
})
const deleteBlocked=computed(()=>!canDeleteGig.value||data.value?.gig.status!=='declined'||Boolean(data.value?.invoices.length))
type NextStep={title:string;hint?:string;action?:string;to?:string;run?:()=>void}
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
type TabKey='overview'|'planning'|'client'|'finance'|'more'
const tabs:Array<{key:TabKey;label:string}>=[{key:'overview',label:'Overzicht'},{key:'planning',label:'Planning'},{key:'client',label:'Klant'},{key:'finance',label:'Financieel'},{key:'more',label:'Meer'}]
const tab=ref<TabKey>('overview')
const titleInput=ref<HTMLInputElement|null>(null)
function moveTab(step:number){const index=tabs.findIndex(item=>item.key===tab.value);const next=tabs[(index+step+tabs.length)%tabs.length]!;tab.value=next.key;nextTick(()=>document.getElementById(`tab-${next.key}`)?.focus())}
function revealInvalid(event:Event){const key=(event.target as HTMLElement|null)?.closest<HTMLElement>('[data-tab]')?.dataset.tab as TabKey|undefined;if(key&&key!==tab.value)tab.value=key}
function focusEdit(){closeActionMenu();tab.value='overview';editingDetails.value=true;nextTick(()=>{titleInput.value?.focus();titleInput.value?.scrollIntoView({block:'center',behavior:'smooth'})})}
async function cancelGig(){
  closeActionMenu()
  if(!(await confirmAction({title:'Deze gig annuleren?',body:'De status wordt Geannuleerd en de gig wordt direct opgeslagen.',confirmLabel:'Gig annuleren',tone:'danger'})))return
  form.status='cancelled';await save()
}
const feeLabel=computed(()=>data.value?.gig.fee?money(Math.round(Number(data.value.gig.fee)*100),data.value.gig.currency):'Nog niet ingevuld')
function planningMoment(value:string|null){return value?new Intl.DateTimeFormat('nl-NL',{weekday:'short',day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'Europe/Amsterdam'}).format(new Date(value)):'Nog niet ingevuld'}
const planningRows=computed(()=>[{label:'Opbouw',value:planningMoment(data.value?.gig.loadInAt??null)},{label:'Start',value:planningMoment(data.value?.gig.startsAt??null)},{label:'Einde',value:planningMoment(data.value?.gig.endsAt??null)}])
const liveInvoices=computed(()=>data.value?.invoices.filter(invoice=>invoice.status!=='void')||[])
const totalInvoiced=computed(()=>liveInvoices.value.reduce((sum,invoice)=>sum+invoice.totalCents,0))
const totalPaid=computed(()=>liveInvoices.value.filter(invoice=>invoice.paymentStatus==='paid').reduce((sum,invoice)=>sum+invoice.totalCents,0))
const totalOpen=computed(()=>Math.max(0,totalInvoiced.value-totalPaid.value))
const stages=computed(()=>{
  const gig=data.value?.gig;if(!gig||(gig.status!=='lead'&&gig.status!=='booked'))return []
  const portalDone=hasActivePortalLink.value||Boolean(submissionData.value?.submission)
  const contractDone=submissionData.value?.status==='submitted'
  const paid=liveInvoices.value.length>0&&liveInvoices.value.every(invoice=>invoice.paymentStatus==='paid')
  const list=[
    {key:'booked',label:'Geboekt',icon:'lucide:check',done:gig.status==='booked'},
    {key:'portal',label:'Klant',icon:'lucide:link',done:portalDone},
    {key:'contract',label:'Contract',icon:'lucide:file-text',done:contractDone},
    {key:'invoice',label:'Factuur',icon:'lucide:credit-card',done:paid},
    {key:'review',label:'Review',icon:'lucide:star',done:false},
  ]
  const current=list.findIndex(stage=>!stage.done)
  return list.map((stage,index)=>({...stage,state:stage.done?'done':index===current?'current':'todo'}))
})
type EmailPlan={templateName:string;recipient:string|null;willSend:boolean;skipReason:string|null;delayMinutes:number;providerConfigured:boolean}
function emailPlan(template:'booking_accepted'|'client_portal_invitation'){return $fetch<EmailPlan>(`/api/admin/gigs/${id}/email-plan`,{query:{template}})}
function planTiming(plan:EmailPlan){const minutes=plan.delayMinutes;const when=minutes<=0?'direct':minutes%1440===0?`over ${minutes/1440} dag${minutes===1440?'':'en'}`:minutes%60===0?`over ${minutes/60} uur`:`over ${minutes} minuten`;return `${when}${plan.providerConfigured?'':' (zodra er een e-mailprovider is ingesteld)'}`}
async function save(){
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
      editingDetails.value=true;tab.value='overview'
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
    portalUrl.value=result.url;portalMessage.value=resend?'Er is een nieuwe uitnodiging gemaakt en oudere links zijn ingetrokken.':'Beveiligde link aangemaakt. Je kunt hem hieronder altijd opnieuw kopiëren.'
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
async function copyPortalUrl(url=portalUrl.value){
  if(!url)return
  await navigator.clipboard.writeText(url);portalMessage.value='Portaallink gekopieerd.'
}
function portalDate(value:string|null){return value?new Intl.DateTimeFormat('nl-NL',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value)):'Nooit'}
function answerValue(value:unknown){return Array.isArray(value)?value.join(', '):value===true?'Ja':value===false?'Nee':String(value??'—')}

useSeoMeta({title:()=>`${data.value?.gig.displayTitle||'Gig'} — DJ NightLight`,robots:'noindex, nofollow'})
</script>

<template>
<div v-if="data" class="detail" :class="{readonly:!canManageGigs}">
  <nav class="crumbs" aria-label="Kruimelpad"><NuxtLink to="/admin/gigs" class="back"><Icon name="lucide:arrow-left" aria-hidden="true" /> Gigs</NuxtLink></nav>

  <header class="hero">
    <div class="hero-copy">
      <div class="title-row"><h1>{{data.gig.displayTitle}}</h1><AdminStatusChip kind="gig" :status="data.gig.status" /></div>
      <div class="hero-meta">
        <span><Icon name="lucide:calendar" aria-hidden="true" />{{gigWhen}}</span>
        <span><Icon name="lucide:map-pin" aria-hidden="true" />{{data.gig.venueName||'Nog geen locatie'}}</span>
        <span><Icon name="lucide:users" aria-hidden="true" />{{clientLabel}}</span>
        <span><Icon name="lucide:wallet" aria-hidden="true" />{{feeLabel}}</span>
      </div>
    </div>
    <details v-if="canEdit" ref="actionMenu" class="action-menu">
      <summary class="secondary icon-button" aria-label="Meer acties" title="Meer acties"><Icon name="lucide:ellipsis" aria-hidden="true" /></summary>
      <div class="action-menu-popover" role="menu">
        <button type="button" role="menuitem" @click="focusEdit"><Icon name="lucide:pencil" aria-hidden="true" />Bewerken</button>
        <button type="button" role="menuitem" @click="duplicate"><Icon name="lucide:copy" aria-hidden="true" />Dupliceren</button>
        <button v-if="data.gig.status!=='cancelled'" type="button" role="menuitem" class="menu-danger" @click="cancelGig"><Icon name="lucide:circle-x" aria-hidden="true" />Annuleren</button>
        <button type="button" role="menuitem" class="menu-danger" :aria-disabled="deleteBlocked" @click="requestRemove"><Icon name="lucide:trash-2" aria-hidden="true" />Verwijderen</button>
      </div>
    </details>
  </header>

  <ol v-if="stages.length" class="stages" aria-label="Voortgang">
    <li v-for="stage in stages" :key="stage.key" class="stage" :data-state="stage.state" :aria-current="stage.state==='current'?'step':undefined">
      <span class="stage-dot"><Icon :name="stage.icon" aria-hidden="true" /></span><span>{{stage.label}}</span>
    </li>
  </ol>

  <div v-if="!canManageGigs" class="readonly-note">Deze gig is aan jou toegewezen. Als DJ kun je alleen meekijken; een manager of eigenaar kan de boekingsgegevens wijzigen.</div>

  <div class="tabs" role="tablist" aria-label="Gig onderdelen" @keydown.right.prevent="moveTab(1)" @keydown.left.prevent="moveTab(-1)">
    <button v-for="item in tabs" :id="`tab-${item.key}`" :key="item.key" type="button" role="tab" class="tab" :class="{active:tab===item.key}" :aria-selected="tab===item.key" :aria-controls="`panel-${item.key}`" :tabindex="tab===item.key?0:-1" @click="tab=item.key">{{item.label}}</button>
  </div>

  <form :inert="!canEdit||undefined" @submit.prevent="save" @invalid.capture="revealInvalid">
    <div v-show="tab==='overview'" id="panel-overview" class="tab-panel" data-tab="overview" role="tabpanel" aria-labelledby="tab-overview">
      <section v-if="nextStep&&canEdit" class="next-step">
        <div><span>Volgende stap</span><strong>{{nextStep.title}}</strong><small v-if="nextStep.hint">{{nextStep.hint}}</small></div>
        <NuxtLink v-if="nextStep.to" class="next-action" :to="nextStep.to">{{nextStep.action}}<Icon name="lucide:arrow-right" aria-hidden="true" /></NuxtLink>
        <button v-else-if="nextStep.run" type="button" class="next-action" :disabled="saving||portalBusy" @click="nextStep.run">{{nextStep.action}}<Icon name="lucide:arrow-right" aria-hidden="true" /></button>
      </section>

      <div class="dashboard-grid">
        <button type="button" class="dashboard-card" @click="tab='planning'">
          <span class="dashboard-icon"><Icon name="lucide:calendar-clock" aria-hidden="true" /></span><span><strong>Planning</strong><b>{{gigWhen}}</b><small>{{data.gig.loadInAt?'Opbouw gepland':'Opbouw nog niet gepland'}}</small></span><Icon name="lucide:chevron-right" class="chev" aria-hidden="true" />
        </button>
        <button type="button" class="dashboard-card" @click="tab='client'">
          <span class="dashboard-icon"><Icon name="lucide:users" aria-hidden="true" /></span><span><strong>Klant</strong><b>{{clientLabel}}</b><small>{{contacts.length?`${contacts.length} contact${contacts.length===1?'persoon':'personen'}`:'Geen contactpersoon'}}</small></span><Icon name="lucide:chevron-right" class="chev" aria-hidden="true" />
        </button>
        <button type="button" class="dashboard-card" @click="tab='client'">
          <span class="dashboard-icon"><Icon name="lucide:link" aria-hidden="true" /></span><span><strong>Klantportaal</strong><b :class="{'status-good':hasActivePortalLink}">{{hasActivePortalLink?'Actief':'Nog niet actief'}}</b><small>{{activePortalLink?.lastUsedAt?`Laatst geopend ${portalDate(activePortalLink.lastUsedAt)}`:'Nog niet geopend'}}</small></span><Icon name="lucide:chevron-right" class="chev" aria-hidden="true" />
        </button>
        <button type="button" class="dashboard-card" @click="tab='finance'">
          <span class="dashboard-icon"><Icon name="lucide:wallet-cards" aria-hidden="true" /></span><span><strong>Financieel</strong><b>{{feeLabel}}</b><small>{{liveInvoices.length?`${liveInvoices.length} factuur${liveInvoices.length===1?'':'en'}`:'Nog geen factuur'}}</small></span><Icon name="lucide:chevron-right" class="chev" aria-hidden="true" />
        </button>
      </div>

      <section v-if="reviewData?.review" class="quiet-card review-card"><p class="eyebrow">Review van de klant</p><strong>{{'★'.repeat(reviewData.review.rating)}}{{'☆'.repeat(5-reviewData.review.rating)}}</strong><span>{{reviewData.review.authorName||'Anoniem'}}</span><p v-if="reviewData.review.comment">“{{reviewData.review.comment}}”</p></section>

      <section v-if="editingDetails" class="edit-card">
        <div class="section-title"><div><p class="eyebrow">Giggegevens</p><h2>Bewerken</h2></div><button type="button" class="text-button" @click="editingDetails=false">Sluiten</button></div>
        <div class="grid">
          <label class="wide">Titel<input ref="titleInput" v-model="form.title" :placeholder="titlePlaceholder"></label>
          <label>Status<select v-model="form.status"><option value="lead">Lead</option><option value="booked">Geboekt</option><option value="declined">Afgewezen</option><option value="cancelled">Geannuleerd</option></select></label>
          <label>Soort evenement<input v-model="form.eventType"></label>
          <label>Klant<select v-model="form.clientId"><option value="">Geen klant</option><option v-for="c in data.options.clients" :key="c.id" :value="c.id">{{clientName(c)}}</option></select></label>
          <label>Locatie<select v-model="form.venueId"><option value="">Geen locatie</option><option v-for="v in data.options.venues" :key="v.id" :value="v.id">{{v.name}}{{v.city?` — ${v.city}`:''}}</option></select></label>
          <label>Toegewezen DJ<select v-model="form.assignedUserId"><option value="">Niet toegewezen</option><option v-for="dj in data.options.djs" :key="dj.id" :value="dj.id">{{dj.name}}</option></select></label>
          <label>Gage<input v-model="form.fee" inputmode="decimal"></label><label>Valuta<input v-model="form.currency" maxlength="3"></label><label>Bron<input v-model="form.source"></label>
        </div>
      </section>
    </div>

    <div v-show="tab==='planning'" id="panel-planning" class="tab-panel" data-tab="planning" role="tabpanel" aria-labelledby="tab-planning">
      <section class="quiet-card">
        <div class="section-title compact"><div><p class="eyebrow">Planning</p><h2>Datum & tijd</h2></div><button v-if="canEdit" type="button" class="icon-text" @click="editingPlanning=!editingPlanning"><Icon name="lucide:pencil" aria-hidden="true" />Bewerken</button></div>
        <dl class="clean-list"><div><dt>Start</dt><dd>{{planningMoment(data.gig.startsAt)}}</dd></div><div><dt>Einde</dt><dd>{{planningMoment(data.gig.endsAt)}}</dd></div></dl>
      </section>
      <section class="quiet-card"><p class="eyebrow">Locatie</p><div class="detail-line"><Icon name="lucide:map-pin" aria-hidden="true" /><div><strong>{{data.gig.venueName||'Nog geen locatie'}}</strong><span>Locatie wijzigen kan via Giggegevens.</span></div></div></section>
      <section class="quiet-card"><p class="eyebrow">Opbouw & afbouw</p><dl class="clean-list"><div><dt>Opbouw</dt><dd>{{planningMoment(data.gig.loadInAt)}}</dd></div><div><dt>Afbouw</dt><dd>{{data.gig.endsAt?planningMoment(data.gig.endsAt):'Nog niet ingevuld'}}</dd></div></dl></section>
      <section class="quiet-card">
        <div class="section-title compact"><div><p class="eyebrow">Timeline</p><h2>Draaiboek</h2></div><button v-if="canEdit" type="button" class="icon-text" @click="addTimeline"><Icon name="lucide:plus" aria-hidden="true" />Item toevoegen</button></div>
        <div v-if="!timeline.length" class="empty-copy">Nog geen items in de timeline.</div>
        <div v-else class="timeline-list"><div v-for="(item,index) in timeline" :key="index"><time>{{item.time||'—:—'}}</time><span><strong>{{item.title||'Naamloos item'}}</strong><small v-if="item.description">{{item.description}}</small></span></div></div>
      </section>
      <section v-if="editingPlanning" class="edit-card">
        <div class="section-title"><div><p class="eyebrow">Planning</p><h2>Bewerken</h2></div><button type="button" class="text-button" @click="editingPlanning=false">Sluiten</button></div>
        <div class="grid"><label>Opbouw<input v-model="form.loadInAt" type="datetime-local"></label><label>Start<input v-model="form.startsAt" type="datetime-local"></label><label>Einde<input v-model="form.endsAt" type="datetime-local"></label></div>
        <div v-for="(item,index) in timeline" :key="index" class="repeat-row timeline-row"><input v-model="item.time" type="time" aria-label="Tijd"><input v-model="item.title" placeholder="Openingsdans, start DJ…" required><input v-model="item.description" placeholder="Notities"><button type="button" aria-label="Item verwijderen" title="Item verwijderen" @click="timeline.splice(index,1)"><Icon name="lucide:x" aria-hidden="true" /></button></div>
      </section>
    </div>

    <div v-show="tab==='client'" id="panel-client" class="tab-panel" data-tab="client" role="tabpanel" aria-labelledby="tab-client">
      <section class="quiet-card"><p class="eyebrow">Klant</p><div class="detail-line"><Icon name="lucide:building-2" aria-hidden="true" /><div><strong>{{clientLabel}}</strong><span>{{data.gig.eventType||'Geen evenementtype ingevuld'}}</span></div></div></section>

      <section class="quiet-card">
        <div class="section-title compact"><div><p class="eyebrow">Personen</p><h2>Contactpersonen</h2></div><button v-if="canEdit" type="button" class="icon-text" @click="contacts.length?editingContacts=!editingContacts:addContact()"><Icon :name="contacts.length?'lucide:pencil':'lucide:plus'" aria-hidden="true" />{{contacts.length?'Bewerken':'Toevoegen'}}</button></div>
        <div v-if="!contacts.length" class="empty-state"><span class="empty-icon"><Icon name="lucide:users" aria-hidden="true" /></span><strong>Nog geen contactpersonen toegevoegd</strong><p>Voeg contactpersonen toe om sneller te communiceren en afspraken op één plek te bewaren.</p><button v-if="canEdit" type="button" class="primary with-icon" @click="addContact"><Icon name="lucide:plus" aria-hidden="true" />Contactpersoon toevoegen</button></div>
        <div v-else-if="!editingContacts" class="contact-list"><div v-for="(contact,index) in contacts" :key="index"><span class="avatar"><Icon name="lucide:user" aria-hidden="true" /></span><span><strong>{{contact.name||'Naamloos contact'}}</strong><small>{{contact.role||contact.email||contact.phone||'Geen details'}}</small></span></div></div>
        <div v-else><div v-for="(contact,index) in contacts" :key="index" class="contact-card"><div class="grid"><label>Naam<input v-model="contact.name" required></label><label>Rol<input v-model="contact.role" placeholder="Ceremoniemeester, locatie…"></label><label>E-mail<input v-model="contact.email" type="email"></label><label>Telefoon<input v-model="contact.phone"></label><label class="wide">Notities<input v-model="contact.notes"></label></div><button type="button" class="remove-small" @click="contacts.splice(index,1)">Contact verwijderen</button></div><button type="button" class="text-button with-icon" @click="addContact"><Icon name="lucide:plus" aria-hidden="true" />Nog een contactpersoon</button></div>
      </section>

      <section v-if="canEdit" class="quiet-card portal-card">
        <div class="section-title compact"><div><p class="eyebrow">Klantportaal</p><h2>{{hasActivePortalLink?'Actieve toegang':'Nog geen actieve toegang'}}</h2></div><span class="portal-state" :data-active="hasActivePortalLink"><i></i>{{hasActivePortalLink?'Actief':'Inactief'}}</span></div>
        <template v-if="activePortalLink">
          <p class="support-copy">Geldig tot {{portalDate(activePortalLink.expiresAt)}}<template v-if="activePortalLink.lastUsedAt"> · laatst geopend {{portalDate(activePortalLink.lastUsedAt)}}</template></p>
          <div class="portal-buttons"><a v-if="activePortalLink.url" class="secondary with-icon" :href="activePortalLink.url" target="_blank" rel="noreferrer"><Icon name="lucide:external-link" aria-hidden="true" />Openen</a><button v-if="activePortalLink.url" type="button" class="secondary with-icon" @click="copyPortalUrl(activePortalLink.url)"><Icon name="lucide:copy" aria-hidden="true" />Kopiëren</button><button type="button" class="primary" :disabled="portalBusy" @click="sendPortalInvitation">Nieuwe uitnodiging versturen</button></div>
          <button type="button" class="remove-small" @click="revokePortalLink(activePortalLink.id)">Link intrekken</button>
        </template>
        <template v-else><p class="support-copy">Maak een beveiligde link waarmee de klant het contract en muziekwensen kan invullen.</p><button type="button" class="primary" :disabled="portalBusy" @click="sendPortalInvitation">Uitnodiging versturen</button></template>
        <details class="portal-settings"><summary>Linkinstellingen</summary><div><label>Geldigheid (dagen)<input v-model.number="portalDays" type="number" min="1" max="365"></label><button type="button" class="secondary" :disabled="portalBusy" @click="createPortalLink(false)">Alleen link aanmaken</button></div></details>
        <div v-if="portalUrl" class="one-time-link"><div><strong>Nieuwe link aangemaakt</strong><span>De link is klaar om te delen.</span></div><button type="button" class="secondary with-icon" @click="copyPortalUrl()"><Icon name="lucide:copy" aria-hidden="true" />Kopiëren</button></div><p v-if="portalMessage" class="portal-message">{{portalMessage}}</p>
      </section>

      <section v-if="canEdit&&submissionData" class="quiet-card">
        <div class="section-title compact"><div><p class="eyebrow">Ingevuld portaal</p><h2>Contract & muziekwensen</h2></div><NuxtLink to="/admin/questionnaire" class="text-button">Template bewerken</NuxtLink></div>
        <div class="submission-status"><div><strong>{{labelFor(submissionStatusLabels,submissionData.status)}}</strong><span>Vragenlijstversie {{submissionData.templateVersion}}<template v-if="submissionData.submission?.submittedAt"> · {{portalDate(submissionData.submission.submittedAt)}}</template></span></div></div>
        <div v-if="submissionData.submission" class="answer-grid"><div v-for="field in submissionData.fields" :key="field.id"><span>{{field.label}}</span><strong>{{answerValue(submissionData.submission.answers[field.id])}}</strong></div><div><span>Geaccepteerd door</span><strong>{{submissionData.submission.acceptedName||'—'}}</strong></div></div><div v-else class="empty-copy">De klant heeft de vragenlijst nog niet ingediend.</div>
        <h3 class="subheading">Muziekwensen</h3><div v-if="!submissionData.wishes.length" class="empty-copy">Geen muziekwensen ingediend.</div><div v-for="wish in submissionData.wishes" :key="wish.id" class="wish-row"><span>{{labelFor(musicWishCategoryLabels,wish.category)}}</span><div><strong>{{[wish.artist,wish.title].filter(Boolean).join(' — ')||wish.note||'Naamloze wens'}}</strong><a v-if="wish.spotifyUrl" :href="wish.spotifyUrl" target="_blank" rel="noreferrer">Openen in Spotify</a><small v-if="wish.note">{{wish.note}}</small></div></div>
      </section>
    </div>

    <div v-show="tab==='finance'" id="panel-finance" class="tab-panel" data-tab="finance" role="tabpanel" aria-labelledby="tab-finance">
      <section class="quiet-card">
        <div class="section-title compact"><div><p class="eyebrow">Financieel</p><h2>Gage</h2></div><button v-if="canEdit" type="button" class="icon-text" @click="editingFinance=!editingFinance"><Icon name="lucide:pencil" aria-hidden="true" />Bewerken</button></div>
        <div class="money-hero">{{feeLabel}}</div><span class="support-copy">Valuta {{data.gig.currency}}</span>
      </section>
      <section v-if="editingFinance" class="edit-card"><div class="grid"><label>Gage<input v-model="form.fee" inputmode="decimal"></label><label>Valuta<input v-model="form.currency" maxlength="3"></label></div></section>
      <section v-if="canEdit" class="quiet-card invoice-card">
        <div class="section-title compact"><div><p class="eyebrow">Financiën</p><h2>Facturen</h2></div></div>
        <div v-if="!data.invoices.length" class="empty-copy">Nog geen facturen voor deze gig.</div>
        <NuxtLink v-for="invoice in data.invoices" :key="invoice.id" :to="`/admin/invoices/${invoice.id}`" class="invoice-row"><div class="invoice-main"><strong>{{invoice.invoiceNumber||'Conceptfactuur'}}</strong><span>{{invoice.status==='draft'?'Concept':`Uitgegeven ${invoiceDate(invoice.issueDate)} · vervalt ${invoiceDate(invoice.dueDate)}`}}</span></div><div class="invoice-statuses"><AdminStatusChip v-if="invoice.status==='finalized'" kind="payment" :status="invoice.paymentStatus" :provider="invoice.paymentProvider" /><AdminStatusChip v-else kind="invoice" :status="invoice.status" /><span class="stripe-state" :data-state="invoice.stripeStatus||invoice.paymentStatus">{{stripeLabel(invoice)}}</span></div><strong class="invoice-total">{{money(invoice.totalCents,invoice.currency)}}</strong></NuxtLink>
        <button type="button" class="primary invoice-cta" @click="createInvoice">Factuur aanmaken</button>
      </section>
      <section class="quiet-card"><p class="eyebrow">Overzicht</p><dl class="clean-list money-list"><div><dt>Totaal gefactureerd</dt><dd>{{money(totalInvoiced,data.gig.currency)}}</dd></div><div><dt>Totaal betaald</dt><dd>{{money(totalPaid,data.gig.currency)}}</dd></div><div><dt>Openstaand</dt><dd :class="{'danger-text':totalOpen>0}">{{money(totalOpen,data.gig.currency)}}</dd></div></dl></section>
    </div>

    <div v-show="tab==='more'" id="panel-more" class="tab-panel" data-tab="more" role="tabpanel" aria-labelledby="tab-more">
      <section class="quiet-card">
        <div class="section-title compact"><div><p class="eyebrow">Intern</p><h2>Interne notities</h2></div><button v-if="canEdit" type="button" class="icon-text" @click="editingInternal=!editingInternal"><Icon :name="form.internalNotes?'lucide:pencil':'lucide:plus'" aria-hidden="true" />{{form.internalNotes?'Bewerken':'Notitie toevoegen'}}</button></div>
        <p v-if="form.internalNotes&&!editingInternal" class="note-copy">{{form.internalNotes}}</p><div v-else-if="!editingInternal" class="empty-copy">Nog geen interne notities.</div><label v-if="editingInternal">Interne notities<textarea v-model="form.internalNotes" rows="5" /></label>
      </section>
      <section class="quiet-card">
        <div class="section-title compact"><div><p class="eyebrow">Zichtbaarheid</p><h2>Publieke agenda</h2></div><button v-if="canEdit" type="button" class="icon-text" @click="editingVisibility=!editingVisibility"><Icon name="lucide:pencil" aria-hidden="true" />Bewerken</button></div>
        <p class="support-copy">{{form.publicVisibility?'Deze gig staat in de publieke agenda.':'Deze gig is niet zichtbaar in de publieke agenda.'}}</p>
        <div v-if="editingVisibility" class="visibility-edit"><label class="checkbox"><input v-model="form.publicVisibility" type="checkbox"> Toon deze gig in de publieke agenda</label><div class="grid public-fields"><label>Publieke titel<input v-model="form.publicTitle" :placeholder="publicTitlePlaceholder"></label><label class="wide">Publieke beschrijving<textarea v-model="form.publicDescription" rows="3" /></label></div></div>
      </section>
    </div>

    <div v-if="canEdit&&(isDirty||message)" class="save-bar"><div><strong role="status">{{message||(isDirty?'Niet-opgeslagen wijzigingen':'Alles is opgeslagen')}}</strong><span>{{isDirty?'Wijzigingen worden pas bewaard na opslaan.':'Wijzig een veld om de gig bij te werken.'}}</span></div><button class="primary" type="submit" :disabled="saving">{{saving?'Opslaan…':'Gig opslaan'}}</button></div>
  </form>

  <div v-show="tab==='client'" class="tab-panel tab-extra" role="tabpanel" aria-labelledby="tab-client"><AdminGigEmails v-if="canEdit" :gig-id="id" :portal-url="portalUrl" /></div>

  <div v-show="tab==='more'" class="tab-panel tab-extra" role="tabpanel" aria-labelledby="tab-more">
    <section class="quiet-card activity"><div class="section-title compact"><div><p class="eyebrow">Activiteit</p><h2>Recente wijzigingen</h2></div></div><div v-if="!data.activity.length" class="empty-copy">Nog geen activiteit vastgelegd.</div><div v-else class="activity-list"><div v-for="item in data.activity" :key="item.id" class="activity-row"><span class="activity-dot"></span><div><strong>{{labelFor(activityActionLabels,item.action)}}<small v-if="item.actorName"> · {{item.actorName}}</small></strong><span>{{activityDate(item.createdAt)}}</span></div></div></div></section>
  </div>
</div>
</template>

<style scoped>
.detail{max-width:920px;margin-inline:auto}.back{display:inline-flex;align-items:center;gap:.35rem;min-height:2.5rem;margin-bottom:.65rem;color:var(--text-subtle);text-decoration:none}.hero{display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;margin-bottom:1rem}.hero-copy{min-width:0}.title-row{display:flex;align-items:center;gap:.75rem;flex-wrap:wrap}.title-row h1{margin:0;font-size:clamp(2rem,5vw,3.45rem);letter-spacing:-.04em}.hero-meta{display:flex;gap:.6rem 1.1rem;flex-wrap:wrap;margin-top:.7rem;color:var(--text-muted);font-size:.86rem}.hero-meta span{display:inline-flex;align-items:center;gap:.38rem}.hero-meta svg{color:#a855f7}.readonly-note{margin:.75rem 0;padding:.8rem 1rem;border:1px solid #302a38;border-radius:.8rem;background:#141119;color:#aaa3b4}
.action-menu{position:relative;flex:0 0 auto}.action-menu>summary{list-style:none}.action-menu>summary::-webkit-details-marker{display:none}.icon-button{display:grid;place-items:center;width:2.8rem;height:2.8rem;padding:0}.action-menu-popover{position:absolute;z-index:var(--z-raised);top:calc(100% + .45rem);right:0;min-width:12rem;padding:.35rem;border:1px solid var(--border);border-radius:.75rem;background:var(--surface-card);box-shadow:0 14px 40px rgba(0,0,0,.35)}.action-menu-popover button{display:flex;align-items:center;gap:.65rem;width:100%;padding:.72rem .75rem;border:0;border-radius:.55rem;background:transparent;color:var(--text);font:inherit;text-align:left;cursor:pointer}.action-menu-popover button:hover{background:var(--surface-input)}.action-menu-popover .menu-danger{color:#f0a5ad}.action-menu-popover .menu-danger[aria-disabled="true"]{opacity:.45;cursor:not-allowed}
.stages{display:grid;grid-template-columns:repeat(5,1fr);gap:0;margin:1rem 0 1.15rem;padding:0;list-style:none}.stage{position:relative;display:grid;justify-items:center;gap:.35rem;color:var(--text-subtle);font-size:.7rem;text-align:center}.stage:not(:last-child)::after{content:"";position:absolute;top:1rem;left:62%;right:-38%;height:1px;background:#332a3c}.stage-dot{position:relative;z-index:1;display:grid;place-items:center;width:2rem;height:2rem;border:1px solid #3a3243;border-radius:999px;background:#111015}.stage[data-state="done"] .stage-dot{border-color:#8b5cf6;background:#2a1744;color:#fff}.stage[data-state="current"] .stage-dot{border-color:#a855f7;color:#c084fc;box-shadow:0 0 0 3px rgba(168,85,247,.08)}.stage[data-state="done"]{color:var(--text)}
.tabs{position:sticky;top:0;z-index:5;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));margin:0 0 1rem;border-bottom:1px solid var(--border);background:color-mix(in srgb,var(--surface-page) 94%,transparent);backdrop-filter:blur(12px)}.tab{min-width:0;padding:.8rem .3rem;border:0;border-bottom:2px solid transparent;background:transparent;color:var(--text-subtle);font:inherit;font-size:.82rem;cursor:pointer}.tab.active{border-bottom-color:#a855f7;color:var(--text);font-weight:800}
.tab-panel{padding-top:.05rem}.next-step{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:1rem;margin-bottom:1rem;padding:1rem 1.05rem;border:1px solid #5b2b80;border-radius:1rem;background:linear-gradient(135deg,#1c1130,#2a1044)}.next-step span{display:block;color:#c9a7ef;font-size:.68rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase}.next-step strong{display:block;margin-top:.22rem;font-size:1.25rem}.next-step small{display:block;margin-top:.15rem;color:#b7a9c4}.next-action{display:inline-flex;align-items:center;justify-content:center;gap:.45rem;min-height:2.75rem;padding:.7rem .9rem;border:0;border-radius:.7rem;background:#fff;color:#17121f;font-weight:900;text-decoration:none;cursor:pointer}
.dashboard-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.7rem;margin-bottom:1rem}.dashboard-card{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:.8rem;min-width:0;padding:1rem;border:1px solid var(--border);border-radius:.9rem;background:var(--surface-card);color:var(--text);font:inherit;text-align:left;cursor:pointer}.dashboard-card:hover{border-color:#4b3b5c;background:color-mix(in srgb,var(--surface-card) 85%,#2a153d)}.dashboard-card>span:nth-child(2){min-width:0}.dashboard-card strong,.dashboard-card b,.dashboard-card small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dashboard-card strong{font-size:.76rem}.dashboard-card b{margin-top:.2rem;font-size:.96rem}.dashboard-card small{margin-top:.15rem;color:var(--text-subtle);font-size:.73rem}.dashboard-icon{display:grid;place-items:center;width:2.1rem;height:2.1rem;border-radius:.6rem;background:#20142e;color:#a855f7}.chev{color:var(--text-subtle)}.status-good{color:#72dc9a}
.quiet-card,.edit-card{margin-bottom:.85rem;padding:1.05rem;border:1px solid var(--border);border-radius:1rem;background:var(--surface-card)}.edit-card{border-color:#42334f;background:#151119}.eyebrow{margin:0;color:#aaa1b6;font-size:.68rem;font-weight:800;letter-spacing:.14em;text-transform:uppercase}.section-title{display:flex;align-items:flex-end;justify-content:space-between;gap:1rem;margin-bottom:.8rem}.section-title.compact{align-items:center}.section-title h2{margin:.14rem 0 0;font-size:1.16rem}.icon-text,.text-button,.remove-small{display:inline-flex;align-items:center;gap:.35rem;border:0;background:transparent;color:#bcb4c6;font:inherit;font-size:.78rem;cursor:pointer;text-decoration:none}.remove-small{margin-top:.7rem;color:#d9959f}.review-card>span{margin-left:.5rem;color:var(--text-subtle)}.review-card p:last-child{margin-bottom:0;color:var(--text-muted)}
.detail-line{display:flex;align-items:center;gap:.8rem;margin-top:.65rem}.detail-line>svg{width:1.25rem;height:1.25rem;color:#a855f7}.detail-line strong,.detail-line span{display:block}.detail-line span{margin-top:.15rem;color:var(--text-subtle);font-size:.78rem}.clean-list{margin:0}.clean-list>div{display:flex;justify-content:space-between;gap:1rem;padding:.65rem 0;border-top:1px solid var(--border)}.clean-list>div:first-child{border-top:0}.clean-list dt{color:var(--text-muted)}.clean-list dd{margin:0;color:var(--text);font-weight:700;text-align:right}.money-list dd{font-variant-numeric:tabular-nums}.danger-text{color:#ef8e9a!important}.money-hero{margin:.3rem 0;font-size:1.9rem;font-weight:900}.support-copy,.empty-copy{color:var(--text-subtle);font-size:.82rem;line-height:1.45}.empty-copy{padding:.55rem 0}.note-copy{margin:.6rem 0 0;white-space:pre-wrap;color:var(--text-muted);line-height:1.55}
.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.8rem}.wide{grid-column:1/-1}label{display:grid;gap:.35rem;color:var(--text-muted);font-size:.8rem}input,select,textarea{width:100%;border:1px solid var(--border-strong);border-radius:.65rem;padding:.72rem;background:var(--surface-input);color:var(--text)}.checkbox{display:flex;align-items:center;gap:.6rem}.checkbox input{width:auto}.public-fields{margin-top:.8rem}.repeat-row{display:grid;gap:.5rem;margin-top:.5rem}.timeline-row{grid-template-columns:7rem 1fr 1.5fr 2rem}.timeline-row button{border:0;border-radius:.55rem;background:#241a20;color:#eab4bc}.timeline-list>div{display:grid;grid-template-columns:4.5rem 1fr;gap:.8rem;padding:.7rem 0;border-top:1px solid var(--border)}.timeline-list>div:first-child{border-top:0}.timeline-list time{color:#a855f7;font-weight:800}.timeline-list strong,.timeline-list small{display:block}.timeline-list small{margin-top:.15rem;color:var(--text-subtle)}
.contact-list>div{display:flex;align-items:center;gap:.7rem;padding:.65rem 0;border-top:1px solid var(--border)}.contact-list>div:first-child{border-top:0}.avatar{display:grid;place-items:center;width:2rem;height:2rem;border-radius:999px;background:#21142f;color:#a855f7}.contact-list strong,.contact-list small{display:block}.contact-list small{margin-top:.1rem;color:var(--text-subtle)}.contact-card{margin-top:.7rem;padding:.9rem;border:1px solid #2b2531;border-radius:.8rem;background:#100e13}.empty-state{display:grid;justify-items:center;padding:1rem 0;text-align:center}.empty-state p{max-width:30rem;color:var(--text-subtle)}.empty-icon{display:grid;place-items:center;width:2.4rem;height:2.4rem;border:1px solid #3a2a4d;border-radius:999px;color:#a855f7}
.portal-state{display:inline-flex;align-items:center;gap:.35rem;color:var(--text-subtle);font-size:.75rem}.portal-state i{width:.55rem;height:.55rem;border-radius:999px;background:#6b6371}.portal-state[data-active="true"]{color:#7dde9d}.portal-state[data-active="true"] i{background:#22c55e}.portal-buttons{display:flex;flex-wrap:wrap;gap:.5rem;margin-top:.85rem}.portal-buttons a{display:inline-flex}.portal-settings{margin-top:.8rem;border-top:1px solid var(--border);padding-top:.7rem}.portal-settings summary{color:var(--text-subtle);font-size:.75rem;cursor:pointer}.portal-settings>div{display:grid;grid-template-columns:minmax(8rem,1fr) auto;align-items:end;gap:.6rem;margin-top:.7rem}.one-time-link{display:flex;justify-content:space-between;align-items:center;gap:.8rem;margin-top:.8rem;padding:.7rem;border:1px solid #2d2832;border-radius:.75rem;background:var(--surface-input)}.one-time-link strong,.one-time-link span{display:block}.one-time-link span,.portal-message{color:var(--text-subtle);font-size:.75rem}.submission-status{padding:.75rem;border-radius:.7rem;background:#18141d}.submission-status strong,.submission-status span{display:block}.submission-status span{margin-top:.15rem;color:var(--text-subtle);font-size:.76rem}.answer-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.6rem;margin-top:.8rem}.answer-grid div{padding:.7rem;border:1px solid var(--border);border-radius:.65rem}.answer-grid span,.answer-grid strong{display:block}.answer-grid span{color:var(--text-subtle);font-size:.72rem}.answer-grid strong{margin-top:.2rem}.subheading{margin:1.1rem 0 .45rem}.wish-row{display:grid;grid-template-columns:8rem 1fr;gap:.8rem;padding:.75rem 0;border-top:1px solid var(--border)}.wish-row>span{color:#967ca8;font-size:.72rem}.wish-row strong,.wish-row a,.wish-row small{display:block}.wish-row a{color:#b9b2c2;font-size:.75rem}.wish-row small{color:var(--text-subtle)}
.invoice-row{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:.8rem;align-items:center;padding:.8rem 0;border-top:1px solid var(--border);color:inherit;text-decoration:none}.invoice-main strong,.invoice-main span{display:block}.invoice-main span{margin-top:.15rem;color:var(--text-subtle);font-size:.75rem}.invoice-statuses{display:flex;gap:.4rem;align-items:center;flex-wrap:wrap}.stripe-state{padding:.28rem .5rem;border-radius:999px;background:#211b28;color:#aaa2b2;font-size:.72rem}.stripe-state[data-state="succeeded"]{background:#16382a;color:#8fe1ad}.stripe-state[data-state="failed"]{background:#351a20;color:#ffadb7}.stripe-state[data-state="pending"]{background:#352d16;color:#ead17a}.invoice-total{text-align:right}.invoice-cta{width:100%;margin-top:.8rem}
.activity-list{position:relative}.activity-row{position:relative;display:grid;grid-template-columns:auto 1fr;gap:.75rem;padding:.7rem 0}.activity-row:not(:last-child)::before{content:"";position:absolute;top:1.45rem;bottom:-.7rem;left:.31rem;width:1px;background:#3a2b4a}.activity-dot{position:relative;z-index:1;width:.65rem;height:.65rem;margin-top:.3rem;border-radius:999px;background:#a855f7}.activity-row strong,.activity-row>div>span{display:block}.activity-row>div>span{margin-top:.12rem;color:var(--text-subtle);font-size:.75rem}.activity-row small{font-size:inherit}.visibility-edit{margin-top:.8rem}
.primary,.secondary,.danger{border:0;border-radius:.65rem;padding:.72rem .9rem;font-weight:800;cursor:pointer}.primary{background:var(--button-primary-bg);color:var(--button-primary-fg)}.secondary{background:var(--button-secondary-bg);color:var(--button-secondary-fg)}.danger{background:var(--button-danger-bg);color:var(--button-danger-fg)}.with-icon{display:inline-flex;align-items:center;justify-content:center;gap:.4rem}.save-bar{position:sticky;bottom:1rem;z-index:var(--z-raised);display:flex;align-items:center;justify-content:space-between;gap:1rem;margin:1rem 0;padding:1rem 1.15rem;border:1px solid #4b395a;border-radius:1rem;background:rgba(20,17,25,.95);backdrop-filter:blur(14px)}.save-bar strong,.save-bar span{display:block}.save-bar span{margin-top:.2rem;color:var(--text-subtle);font-size:.75rem}.readonly form input,.readonly form select,.readonly form textarea,.readonly form button{pointer-events:none;opacity:.78}
@media(max-width:700px){.detail{padding-inline:.1rem}.hero{align-items:flex-start}.title-row{align-items:flex-start}.title-row h1{font-size:2rem}.hero-meta{display:grid;grid-template-columns:1fr;gap:.35rem}.stages{margin-top:.8rem}.stage{font-size:.62rem}.tabs{overflow:hidden}.tab{font-size:.72rem;padding:.75rem .12rem}.next-step{grid-template-columns:1fr}.next-action{width:100%}.dashboard-grid{grid-template-columns:1fr}.grid,.answer-grid,.portal-settings>div{grid-template-columns:1fr}.wide{grid-column:auto}.timeline-row{grid-template-columns:1fr}.invoice-row{grid-template-columns:1fr}.invoice-total{text-align:left}.portal-buttons{display:grid;grid-template-columns:1fr}.portal-buttons>*{width:100%}.one-time-link{align-items:stretch;flex-direction:column}.wish-row{grid-template-columns:1fr}.save-bar{align-items:stretch;flex-direction:column}.save-bar .primary{width:100%}}
</style>