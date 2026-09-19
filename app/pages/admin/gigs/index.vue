<script setup lang="ts">
import { apiErrorMessage } from '~/utils/api-error'

definePageMeta({ layout: 'admin' })
const route = useRoute()

type ClientOption = { id:string; type:'person'|'company'; firstName:string|null; lastName:string|null; companyName:string|null }
type VenueOption = { id:string; name:string; city:string|null }
type GigRow = {
  id:string; title:string; eventType:string|null; status:'lead'|'booked'|'declined'|'cancelled';
  startsAt:string|null; endsAt:string|null; fee:string|null; currency:string; publicVisibility:boolean;
  clientId:string|null; venueId:string|null; clientFirstName:string|null; clientLastName:string|null;
  clientCompanyName:string|null; venueName:string|null; venueCity:string|null
}
type GigListResponse = { gigs:GigRow[]; options:{clients:ClientOption[];venues:VenueOption[];eventTypes:string[]} }

const filters=reactive({search:'',status:'',timing:'',eventType:'',public:'',clientId:'',venueId:'',startDate:'',endDate:''})
const showCreate=ref(route.query.new==='1')
const saving=ref(false);const formError=ref('')
const form=reactive({
  title:'',eventType:'',clientId:'',venueId:'',status:'lead' as GigRow['status'],
  startsAt:'',endsAt:'',loadInAt:'',fee:'',currency:'EUR',source:'',
  publicVisibility:false,publicTitle:'',publicDescription:'',internalNotes:''
})

const query=computed(()=>Object.fromEntries(Object.entries(filters).filter(([,value])=>value!=='') ))
const {data,status,refresh}=await useFetch<GigListResponse>('/api/admin/gigs',{query})

function clientName(client:ClientOption){return client.companyName||[client.firstName,client.lastName].filter(Boolean).join(' ')||'Unnamed client'}
function rowClient(gig:GigRow){return gig.clientCompanyName||[gig.clientFirstName,gig.clientLastName].filter(Boolean).join(' ')||'No client'}
function formatDate(value:string|null){return value?new Intl.DateTimeFormat('nl-NL',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value)):'Date not set'}
function money(value:string|null,currency:string){return value?new Intl.NumberFormat('nl-NL',{style:'currency',currency}).format(Number(value)):'—'}
function iso(value:string){return value?new Date(value).toISOString():null}

async function createGig(){
  saving.value=true;formError.value=''
  try{
    const result=await $fetch<{gig:{id:string}}>('/api/admin/gigs',{method:'POST',body:{
      ...form,
      clientId:form.clientId||null,venueId:form.venueId||null,
      startsAt:iso(form.startsAt),endsAt:iso(form.endsAt),loadInAt:iso(form.loadInAt),
      fee:form.fee||null,contacts:[],timeline:[],
    }})
    await refresh()
    await navigateTo(`/admin/gigs/${result.gig.id}`)
  }catch(error:unknown){formError.value=apiErrorMessage(error,'Could not create gig.')}
  finally{saving.value=false}
}

useSeoMeta({title:'Gigs — DJ NightLight',robots:'noindex, nofollow'})
</script>

<template><div class="gigs-page">
<header class="page-header"><div><p class="eyebrow">Operations</p><h1>Gigs</h1><p>Leads, bookings and your complete planning.</p></div><button class="primary" @click="showCreate=!showCreate">{{showCreate?'Close':'New gig'}}</button></header>

<form v-if="showCreate" class="create-card" @submit.prevent="createGig"><h2>New gig</h2><div class="form-grid">
<label class="wide">Title<input v-model="form.title" required placeholder="Wedding Jansen, Club Night…"></label><label>Event type<input v-model="form.eventType" placeholder="Wedding, club…"></label><label>Status<select v-model="form.status"><option value="lead">Lead</option><option value="booked">Booked</option><option value="declined">Declined</option><option value="cancelled">Cancelled</option></select></label>
<label>Client<select v-model="form.clientId"><option value="">No client yet</option><option v-for="c in data?.options.clients||[]" :key="c.id" :value="c.id">{{clientName(c)}}</option></select></label><label>Venue<select v-model="form.venueId"><option value="">No venue yet</option><option v-for="v in data?.options.venues||[]" :key="v.id" :value="v.id">{{v.name}}{{v.city?` — ${v.city}`:''}}</option></select></label>
<label>Start<input v-model="form.startsAt" type="datetime-local"></label><label>End<input v-model="form.endsAt" type="datetime-local"></label><label>Load-in<input v-model="form.loadInAt" type="datetime-local"></label><label>Fee<input v-model="form.fee" inputmode="decimal" placeholder="750.00"></label>
<label>Source<input v-model="form.source" placeholder="Referral, website…"></label><label class="checkbox"><input v-model="form.publicVisibility" type="checkbox"> Show in public agenda</label><label class="wide">Internal notes<textarea v-model="form.internalNotes" rows="3"/></label></div><p v-if="formError" class="error">{{formError}}</p><button class="primary" type="submit" :disabled="saving">{{saving?'Saving…':'Create gig'}}</button></form>

<section class="filters">
<input v-model="filters.search" type="search" placeholder="Search gigs, clients or venues…"><select v-model="filters.status"><option value="">All statuses</option><option value="lead">Lead</option><option value="booked">Booked</option><option value="declined">Declined</option><option value="cancelled">Cancelled</option></select><select v-model="filters.timing"><option value="">Any date</option><option value="upcoming">Upcoming</option><option value="past">Past</option></select><select v-model="filters.public"><option value="">Public + private</option><option value="true">Public</option><option value="false">Private</option></select>
<select v-model="filters.eventType"><option value="">All event types</option><option v-for="type in data?.options.eventTypes||[]" :key="type" :value="type">{{type}}</option></select><select v-model="filters.clientId"><option value="">All clients</option><option v-for="c in data?.options.clients||[]" :key="c.id" :value="c.id">{{clientName(c)}}</option></select><select v-model="filters.venueId"><option value="">All venues</option><option v-for="v in data?.options.venues||[]" :key="v.id" :value="v.id">{{v.name}}</option></select><input v-model="filters.startDate" type="date" aria-label="From date"><input v-model="filters.endDate" type="date" aria-label="To date">
</section>

<div v-if="status==='pending'" class="empty">Loading gigs…</div><div v-else-if="!data?.gigs.length" class="empty">No gigs match these filters.</div>
<div v-else class="gig-list"><NuxtLink v-for="gig in data.gigs" :key="gig.id" :to="`/admin/gigs/${gig.id}`" class="gig-row"><div class="date"><strong>{{gig.startsAt?new Date(gig.startsAt).getDate():'—'}}</strong><span>{{gig.startsAt?new Date(gig.startsAt).toLocaleDateString('en',{month:'short'}):'TBD'}}</span></div><div class="main"><div class="title-line"><strong>{{gig.title}}</strong><span class="status" :data-status="gig.status">{{gig.status}}</span><span v-if="gig.publicVisibility" class="public">Public</span></div><span>{{rowClient(gig)}} · {{gig.venueName||'No venue'}} · {{gig.eventType||'Event type not set'}}</span></div><div class="right"><strong>{{money(gig.fee,gig.currency)}}</strong><span>{{formatDate(gig.startsAt)}}</span></div></NuxtLink></div>
</div></template>

<style scoped>
.gigs-page{max-width:1180px;margin-inline:auto}.page-header{display:flex;align-items:end;justify-content:space-between;gap:1rem;margin-bottom:1.5rem}h1{margin:.2rem 0;font-size:clamp(2.5rem,6vw,4rem);letter-spacing:-.05em}.page-header p:last-child{margin:0;color:#8e8797}.primary{border:0;border-radius:.7rem;padding:.75rem 1rem;background:#fff;color:#09080b;font-weight:800;cursor:pointer}.create-card{padding:1.3rem;margin-bottom:1rem;border:1px solid #2b2631;border-radius:1rem;background:#100e14}.create-card h2{margin-top:0}.form-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:.8rem;margin-bottom:1rem}.wide{grid-column:1/-1}label{display:grid;gap:.35rem;color:#aaa4b1;font-size:.8rem}input,select,textarea{width:100%;border:1px solid #332e39;border-radius:.65rem;padding:.7rem;background:#0b0a0d;color:#f6f3fa}.checkbox{display:flex;align-items:center;gap:.6rem}.checkbox input{width:auto}.filters{display:grid;grid-template-columns:2fr repeat(3,1fr);gap:.55rem;margin-bottom:1rem}.gig-list{overflow:hidden;border:1px solid #292530;border-radius:1rem}.gig-row{display:grid;grid-template-columns:3.2rem minmax(0,1fr) auto;gap:1rem;align-items:center;padding:.95rem 1rem;border-bottom:1px solid #242029;text-decoration:none}.gig-row:last-child{border-bottom:0}.gig-row:hover{background:#141119}.date{display:grid;place-items:center;padding:.45rem;border-radius:.7rem;background:#1c1822}.date span{font-size:.62rem;color:#8d8696;text-transform:uppercase}.main{min-width:0}.title-line{display:flex;align-items:center;gap:.45rem;min-width:0}.main>span,.right span{display:block;color:#817a8b;font-size:.78rem}.status,.public{padding:.18rem .4rem;border-radius:999px;font-size:.65rem;text-transform:uppercase}.status{background:#27222e;color:#b8afc2}.status[data-status=booked]{background:#14251d;color:#9be6ba}.status[data-status=declined],.status[data-status=cancelled]{background:#2a181c;color:#e7a2ad}.public{background:#1a2030;color:#aebff8}.right{text-align:right}.right strong{display:block}.empty{padding:2rem;border:1px dashed #302a38;border-radius:1rem;color:#817a8b}.error{color:#ff9c9c}@media(max-width:900px){.filters{grid-template-columns:repeat(2,1fr)}}@media(max-width:650px){.page-header{align-items:start;flex-direction:column}.page-header .primary{width:100%}.form-grid,.filters{grid-template-columns:1fr}.wide{grid-column:auto}.gig-row{grid-template-columns:3.2rem minmax(0,1fr)}.right{grid-column:2;text-align:left}.title-line{flex-wrap:wrap}}
</style>
