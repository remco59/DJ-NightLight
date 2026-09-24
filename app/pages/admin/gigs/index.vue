<script setup lang="ts">
import type { Ref } from 'vue'
import { gigEndFromDuration } from '~~/shared/gig-duration'
import { apiErrorMessage } from '~/utils/api-error'

definePageMeta({ layout: 'admin' })
const route = useRoute()
const { user } = useUserSession()
const canManageGigs = computed(() => user.value?.role === 'owner' || user.value?.role === 'manager')
const removalNotice = computed(() => route.query.removed === 'archive'
  ? 'Gig archived because financial records are linked to it. Invoice and payment history was kept.'
  : route.query.removed === 'delete' ? 'Gig permanently deleted.' : '')

type ClientOption = { id:string; type:'person'|'company'; firstName:string|null; lastName:string|null; companyName:string|null }
type VenueOption = { id:string; name:string; city:string|null }
type DjOption = { id:string; name:string; email:string }
type GigRow = {
  id:string; title:string; eventType:string|null; status:'lead'|'booked'|'declined'|'cancelled';
  startsAt:string|null; endsAt:string|null; fee:string|null; currency:string; publicVisibility:boolean;
  clientId:string|null; venueId:string|null; clientFirstName:string|null; clientLastName:string|null;
  clientCompanyName:string|null; venueName:string|null; venueCity:string|null; assignedUserId:string|null
}
type GigListResponse = { gigs:GigRow[]; options:{clients:ClientOption[];venues:VenueOption[];djs:DjOption[];eventTypes:string[]} }

const filters=reactive({search:'',status:'',timing:'',eventType:'',public:'',clientId:'',venueId:'',assignedUserId:'',startDate:'',endDate:''})
const showAdvancedFilters=ref(false)
const dateMode=ref('')
const sort=ref<'date_desc'|'date_asc'>('date_desc')
const showCreate=ref(route.query.new==='1')
const saving=ref(false)
const formError=ref('')
const form=reactive({
  title:'',eventType:'',clientId:'',venueId:'',assignedUserId:'',status:'lead' as GigRow['status'],
  startsAt:'',durationHours:'4',loadInAt:'',fee:'',currency:'EUR',source:'',
  publicVisibility:false,publicTitle:'',publicDescription:'',internalNotes:''
})

const clientSearch=ref('')
const venueSearch=ref('')
const clientPickerOpen=ref(false)
const venuePickerOpen=ref(false)
const showClientCreate=ref(false)
const showVenueCreate=ref(false)
const clientSaving=ref(false)
const venueSaving=ref(false)
const clientError=ref('')
const venueError=ref('')
const newClient=reactive({type:'person' as 'person'|'company',firstName:'',lastName:'',companyName:'',email:'',phone:''})
const newVenue=reactive({name:'',city:'',address:''})

watch(dateMode,value=>{
  if(value==='custom')filters.timing=''
  else{
    filters.timing=value
    filters.startDate=''
    filters.endDate=''
  }
})

const query=computed(()=>({
  ...Object.fromEntries(Object.entries(filters).filter(([,value])=>value!=='')),
  sort:sort.value,
}))
const {data,status,refresh}=await useFetch<GigListResponse>('/api/admin/gigs',{query})

const activeAdvancedCount=computed(()=>[
  filters.eventType,
  filters.public,
  filters.clientId,
  filters.venueId,
  canManageGigs.value?filters.assignedUserId:'',
].filter(Boolean).length)
const hasActiveFilters=computed(()=>Object.values(filters).some(Boolean))
const dateFilterLabel=computed(()=>{
  if(filters.timing==='upcoming')return 'Date: Upcoming'
  if(filters.timing==='past')return 'Date: Past'
  if(filters.startDate||filters.endDate)return `Date: ${filters.startDate||'Any'} – ${filters.endDate||'Any'}`
  return ''
})

function clientName(client:ClientOption){return client.companyName||[client.firstName,client.lastName].filter(Boolean).join(' ')||'Unnamed client'}
function venueName(venue:VenueOption){return venue.city?`${venue.name} — ${venue.city}`:venue.name}
function assignedName(gig:GigRow){return data.value?.options.djs.find(d=>d.id===gig.assignedUserId)?.name||'Unassigned'}
function rowClient(gig:GigRow){return gig.clientCompanyName||[gig.clientFirstName,gig.clientLastName].filter(Boolean).join(' ')||'No client'}
function formatDate(value:string|null){return value?new Intl.DateTimeFormat('nl-NL',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value)):'Date not set'}
function money(value:string|null,currency:string){return value?new Intl.NumberFormat('nl-NL',{style:'currency',currency}).format(Number(value)):'—'}
function iso(value:string){return value?new Date(value).toISOString():null}
function normalize(value:string){return value.trim().toLocaleLowerCase()}
function statusLabel(value:string){return value?value.charAt(0).toUpperCase()+value.slice(1):''}
function selectedClientLabel(){const client=data.value?.options.clients.find(item=>item.id===filters.clientId);return client?clientName(client):'Client'}
function selectedVenueLabel(){return data.value?.options.venues.find(item=>item.id===filters.venueId)?.name||'Venue'}
function selectedDjLabel(){return data.value?.options.djs.find(item=>item.id===filters.assignedUserId)?.name||'DJ'}
function clearDateFilter(){dateMode.value='';filters.timing='';filters.startDate='';filters.endDate=''}
function clearAllFilters(){
  Object.assign(filters,{search:'',status:'',timing:'',eventType:'',public:'',clientId:'',venueId:'',assignedUserId:'',startDate:'',endDate:''})
  dateMode.value=''
}

const filteredClients=computed(()=>{
  const needle=normalize(clientSearch.value)
  const clients=data.value?.options.clients||[]
  if(!needle)return clients
  return clients.filter(client=>normalize(clientName(client)).includes(needle))
})
const filteredVenues=computed(()=>{
  const needle=normalize(venueSearch.value)
  const venues=data.value?.options.venues||[]
  if(!needle)return venues
  return venues.filter(venue=>normalize(venueName(venue)).includes(needle))
})

function openCreate(){showCreate.value=true}
async function closeCreate(){
  showCreate.value=false
  clientPickerOpen.value=false
  venuePickerOpen.value=false
  showClientCreate.value=false
  showVenueCreate.value=false
  if(route.query.new==='1'){
    const nextQuery={...route.query}
    delete nextQuery.new
    await navigateTo({path:route.path,query:nextQuery},{replace:true})
  }
}
const clientInput=ref<HTMLInputElement|null>(null)
const venueInput=ref<HTMLInputElement|null>(null)
const clientCreatePanel=ref<HTMLElement|null>(null)
const venueCreatePanel=ref<HTMLElement|null>(null)
const clientActive=ref(0)
const venueActive=ref(0)
// Typing a name that isn't selected yet offers "Create …" as the first option.
const clientCanCreate=computed(()=>!form.clientId&&!!clientSearch.value.trim())
const venueCanCreate=computed(()=>!form.venueId&&!!venueSearch.value.trim())
const clientOffset=computed(()=>clientCanCreate.value?1:0)
const venueOffset=computed(()=>venueCanCreate.value?1:0)

// Enter picks the first match when there is one, otherwise it creates a new record.
function defaultActive(canCreate:boolean,matches:number){return canCreate&&matches?1:0}
function resetClientActive(){clientActive.value=defaultActive(clientCanCreate.value,filteredClients.value.length)}
function resetVenueActive(){venueActive.value=defaultActive(venueCanCreate.value,filteredVenues.value.length)}
function openClientPicker(){clientPickerOpen.value=true;resetClientActive()}
function openVenuePicker(){venuePickerOpen.value=true;resetVenueActive()}
function onClientInput(){form.clientId='';openClientPicker()}
function onVenueInput(){form.venueId='';openVenuePicker()}

function onPickerKeydown(event:KeyboardEvent,open:Ref<boolean>,active:Ref<number>,total:number,choose:(index:number)=>void,listId:string,reset:()=>void){
  if(event.key==='ArrowDown'||event.key==='ArrowUp'){
    event.preventDefault()
    if(!open.value){open.value=true;reset();return}
    if(!total)return
    active.value=(active.value+(event.key==='ArrowDown'?1:-1)+total)%total
    nextTick(()=>document.getElementById(`${listId}-${active.value}`)?.scrollIntoView({block:'nearest'}))
  }else if(event.key==='Enter'&&open.value){
    event.preventDefault()
    if(total)choose(active.value)
  }else if(event.key==='Escape'&&open.value){
    event.preventDefault()
    event.stopPropagation()
    open.value=false
  }
}
function chooseClient(index:number){
  if(clientCanCreate.value&&index===0)return startClientCreate()
  const client=filteredClients.value[index-clientOffset.value]
  if(client)selectClient(client)
}
function chooseVenue(index:number){
  if(venueCanCreate.value&&index===0)return startVenueCreate()
  const venue=filteredVenues.value[index-venueOffset.value]
  if(venue)selectVenue(venue)
}
function onClientKeydown(event:KeyboardEvent){
  onPickerKeydown(event,clientPickerOpen,clientActive,clientOffset.value+filteredClients.value.length,chooseClient,'gig-client-options',resetClientActive)
}
function onVenueKeydown(event:KeyboardEvent){
  onPickerKeydown(event,venuePickerOpen,venueActive,venueOffset.value+filteredVenues.value.length,chooseVenue,'gig-venue-options',resetVenueActive)
}

function selectClient(client:ClientOption){
  form.clientId=client.id
  clientSearch.value=clientName(client)
  clientPickerOpen.value=false
  showClientCreate.value=false
}
function clearClient(){
  form.clientId=''
  clientSearch.value=''
  clientInput.value?.focus()
  openClientPicker()
}
function selectVenue(venue:VenueOption){
  form.venueId=venue.id
  venueSearch.value=venueName(venue)
  venuePickerOpen.value=false
  showVenueCreate.value=false
}
function clearVenue(){
  form.venueId=''
  venueSearch.value=''
  venueInput.value?.focus()
  openVenuePicker()
}

function startClientCreate(){
  const name=clientSearch.value.trim()
  const [firstName='',...lastName]=name.split(/\s+/)
  // Prefill both shapes so switching the type keeps the typed name.
  Object.assign(newClient,{type:'person',firstName,lastName:lastName.join(' '),companyName:name,email:'',phone:''})
  clientError.value=''
  clientPickerOpen.value=false
  showClientCreate.value=true
  nextTick(()=>clientCreatePanel.value?.querySelector<HTMLInputElement>('input[type=email]')?.focus())
}
function startVenueCreate(){
  Object.assign(newVenue,{name:venueSearch.value.trim(),city:'',address:''})
  venueError.value=''
  venuePickerOpen.value=false
  showVenueCreate.value=true
  nextTick(()=>venueCreatePanel.value?.querySelector<HTMLInputElement>('input[name=city]')?.focus())
}
function cancelClientCreate(){showClientCreate.value=false;clientInput.value?.focus()}
function cancelVenueCreate(){showVenueCreate.value=false;venueInput.value?.focus()}
// Enter inside the inline create panel creates the record instead of submitting the gig.
function onCreatePanelEnter(event:KeyboardEvent,create:()=>void){
  if((event.target as HTMLElement).tagName!=='INPUT')return
  event.preventDefault()
  create()
}

async function createClient(){
  if(clientSaving.value)return
  clientSaving.value=true
  clientError.value=''
  try{
    const body=newClient.type==='company'?{...newClient,firstName:'',lastName:''}:{...newClient,companyName:''}
    const result=await $fetch<{client:ClientOption}>('/api/admin/clients',{method:'POST',body})
    await refresh()
    selectClient(result.client)
    Object.assign(newClient,{type:'person',firstName:'',lastName:'',companyName:'',email:'',phone:''})
  }catch(error:unknown){clientError.value=apiErrorMessage(error,'Could not create client.')}
  finally{clientSaving.value=false}
}

async function createVenue(){
  if(venueSaving.value)return
  venueSaving.value=true
  venueError.value=''
  try{
    const result=await $fetch<{venue:VenueOption}>('/api/admin/venues',{method:'POST',body:newVenue})
    await refresh()
    selectVenue(result.venue)
    Object.assign(newVenue,{name:'',city:'',address:''})
  }catch(error:unknown){venueError.value=apiErrorMessage(error,'Could not create venue.')}
  finally{venueSaving.value=false}
}

async function createGig(){
  saving.value=true
  formError.value=''
  try{
    const endsAt=gigEndFromDuration(form.startsAt,form.durationHours)
    const result=await $fetch<{gig:{id:string}}>('/api/admin/gigs',{method:'POST',body:{
      ...form,
      durationHours:undefined,
      clientId:form.clientId||null,venueId:form.venueId||null,assignedUserId:form.assignedUserId||null,
      startsAt:iso(form.startsAt),endsAt:endsAt?.toISOString()||null,loadInAt:iso(form.loadInAt),
      fee:form.fee||null,contacts:[],timeline:[],
    }})
    await refresh()
    await navigateTo(`/admin/gigs/${result.gig.id}`)
  }catch(error:unknown){formError.value=apiErrorMessage(error,'Could not create gig.')}
  finally{saving.value=false}
}

watch(()=>route.query.new,value=>{if(value==='1')showCreate.value=true})
useSeoMeta({title:'Gigs — DJ NightLight',robots:'noindex, nofollow'})
</script>

<template>
  <div class="gigs-page">
    <header class="page-header">
      <div><p class="eyebrow">Operations</p><h1>Gigs</h1><p>Leads, bookings and your complete planning.</p></div>
      <button v-if="canManageGigs" class="with-icon primary" type="button" @click="openCreate"><Icon name="lucide:plus" aria-hidden="true" />New gig</button>
    </header>
    <div v-if="removalNotice" class="notice">{{removalNotice}}</div>

    <Teleport to="body">
      <div v-if="showCreate&&canManageGigs" class="modal-backdrop" @click.self="closeCreate">
        <section class="modal-card" role="dialog" aria-modal="true" aria-labelledby="new-gig-title" @keydown.esc="closeCreate">
          <header class="modal-header">
            <div><p class="eyebrow">New booking</p><h2 id="new-gig-title">Create gig</h2><p>Plan the essentials now. You can add the rest later.</p></div>
            <button class="icon-button" type="button" aria-label="Close new gig modal" @click="closeCreate"><Icon name="lucide:x" aria-hidden="true" /></button>
          </header>

          <form class="modal-form" @submit.prevent="createGig">
            <section class="form-section">
              <div class="section-heading"><strong>Basics</strong><span>What is the booking?</span></div>
              <div class="form-grid">
                <label class="wide">Title<input v-model="form.title" required autofocus placeholder="Wedding Jansen, Club Night…"></label>
                <label>Event type<input v-model="form.eventType" placeholder="Wedding, club…"></label>
                <label>Status<select v-model="form.status"><option value="lead">Lead</option><option value="booked">Booked</option><option value="declined">Declined</option><option value="cancelled">Cancelled</option></select></label>
              </div>
            </section>

            <section class="form-section">
              <div class="section-heading"><strong>Client & venue</strong><span>Search existing records or create them without leaving this gig.</span></div>
              <div class="form-grid relation-grid">
                <div class="field">
                  <label class="field-label" for="gig-client-search">Client</label>
                  <div class="picker">
                    <div class="picker-input-row">
                      <input
                        id="gig-client-search"
                        ref="clientInput"
                        v-model="clientSearch"
                        type="search"
                        role="combobox"
                        aria-autocomplete="list"
                        aria-controls="gig-client-options"
                        :aria-expanded="clientPickerOpen"
                        :aria-activedescendant="clientPickerOpen&&(clientCanCreate||filteredClients.length)?`gig-client-options-${clientActive}`:undefined"
                        autocomplete="off"
                        placeholder="Search or create a client…"
                        @focus="openClientPicker"
                        @blur="clientPickerOpen=false"
                        @input="onClientInput"
                        @keydown="onClientKeydown"
                      >
                      <button v-if="form.clientId" class="text-button" type="button" @click="clearClient">Clear</button>
                    </div>
                    <div v-if="clientPickerOpen" id="gig-client-options" class="picker-menu" role="listbox">
                      <button v-if="clientCanCreate" id="gig-client-options-0" class="picker-option create-option" type="button" role="option" :aria-selected="clientActive===0" :data-active="clientActive===0" @mouseenter="clientActive=0" @mousedown.prevent="startClientCreate">
                        <strong><Icon name="lucide:plus" aria-hidden="true" />Create “{{clientSearch.trim()}}”</strong><span>New client</span>
                      </button>
                      <button v-for="(client,index) in filteredClients" :id="`gig-client-options-${index+clientOffset}`" :key="client.id" class="picker-option" type="button" role="option" :aria-selected="clientActive===index+clientOffset" :data-active="clientActive===index+clientOffset" :data-selected="form.clientId===client.id" @mouseenter="clientActive=index+clientOffset" @mousedown.prevent="selectClient(client)">
                        <strong>{{clientName(client)}}</strong><span>{{client.type==='company'?'Company':'Person'}}</span>
                      </button>
                      <div v-if="!clientCanCreate&&!filteredClients.length" class="picker-empty">Start typing to add a client.</div>
                    </div>
                  </div>
                  <div v-if="showClientCreate" ref="clientCreatePanel" class="inline-create" @keydown.enter="onCreatePanelEnter($event,createClient)">
                    <div class="inline-create-header"><strong>New client</strong><button class="text-button" type="button" @click="cancelClientCreate">Cancel</button></div>
                    <div class="compact-grid">
                      <label>Type<select v-model="newClient.type"><option value="person">Person</option><option value="company">Company</option></select></label>
                      <label v-if="newClient.type==='company'">Company name<input v-model="newClient.companyName" placeholder="Company"></label>
                      <template v-else><label>First name<input v-model="newClient.firstName"></label><label>Last name<input v-model="newClient.lastName"></label></template>
                      <label>Email<input v-model="newClient.email" type="email"></label>
                      <label>Phone<input v-model="newClient.phone" type="tel"></label>
                    </div>
                    <p v-if="clientError" class="error">{{clientError}}</p>
                    <button class="secondary" type="button" :disabled="clientSaving" @click="createClient">{{clientSaving?'Creating…':'Create & select client'}}</button>
                  </div>
                </div>

                <div class="field">
                  <label class="field-label" for="gig-venue-search">Venue</label>
                  <div class="picker">
                    <div class="picker-input-row">
                      <input
                        id="gig-venue-search"
                        ref="venueInput"
                        v-model="venueSearch"
                        type="search"
                        role="combobox"
                        aria-autocomplete="list"
                        aria-controls="gig-venue-options"
                        :aria-expanded="venuePickerOpen"
                        :aria-activedescendant="venuePickerOpen&&(venueCanCreate||filteredVenues.length)?`gig-venue-options-${venueActive}`:undefined"
                        autocomplete="off"
                        placeholder="Search or create a venue…"
                        @focus="openVenuePicker"
                        @blur="venuePickerOpen=false"
                        @input="onVenueInput"
                        @keydown="onVenueKeydown"
                      >
                      <button v-if="form.venueId" class="text-button" type="button" @click="clearVenue">Clear</button>
                    </div>
                    <div v-if="venuePickerOpen" id="gig-venue-options" class="picker-menu" role="listbox">
                      <button v-if="venueCanCreate" id="gig-venue-options-0" class="picker-option create-option" type="button" role="option" :aria-selected="venueActive===0" :data-active="venueActive===0" @mouseenter="venueActive=0" @mousedown.prevent="startVenueCreate">
                        <strong><Icon name="lucide:plus" aria-hidden="true" />Create “{{venueSearch.trim()}}”</strong><span>New venue</span>
                      </button>
                      <button v-for="(venue,index) in filteredVenues" :id="`gig-venue-options-${index+venueOffset}`" :key="venue.id" class="picker-option" type="button" role="option" :aria-selected="venueActive===index+venueOffset" :data-active="venueActive===index+venueOffset" :data-selected="form.venueId===venue.id" @mouseenter="venueActive=index+venueOffset" @mousedown.prevent="selectVenue(venue)">
                        <strong>{{venue.name}}</strong><span>{{venue.city||'City not set'}}</span>
                      </button>
                      <div v-if="!venueCanCreate&&!filteredVenues.length" class="picker-empty">Start typing to add a venue.</div>
                    </div>
                  </div>
                  <div v-if="showVenueCreate" ref="venueCreatePanel" class="inline-create" @keydown.enter="onCreatePanelEnter($event,createVenue)">
                    <div class="inline-create-header"><strong>New venue</strong><button class="text-button" type="button" @click="cancelVenueCreate">Cancel</button></div>
                    <div class="compact-grid">
                      <label>Name<input v-model="newVenue.name" placeholder="Venue name"></label>
                      <label>City<input v-model="newVenue.city" name="city"></label>
                      <label class="wide">Address<input v-model="newVenue.address"></label>
                    </div>
                    <p v-if="venueError" class="error">{{venueError}}</p>
                    <button class="secondary" type="button" :disabled="venueSaving" @click="createVenue">{{venueSaving?'Creating…':'Create & select venue'}}</button>
                  </div>
                </div>

                <label class="wide">Assigned DJ<select v-model="form.assignedUserId"><option value="">Unassigned</option><option v-for="dj in data?.options.djs||[]" :key="dj.id" :value="dj.id">{{dj.name}}</option></select></label>
              </div>
            </section>

            <section class="form-section">
              <div class="section-heading"><strong>Timing</strong><span>Duration automatically determines the end time.</span></div>
              <div class="form-grid timing-grid">
                <label>Start<input v-model="form.startsAt" type="datetime-local"></label>
                <label>Duration (hours)<input v-model="form.durationHours" type="number" min="0.25" step="0.25" inputmode="decimal" placeholder="4"></label>
                <label>Load-in<input v-model="form.loadInAt" type="datetime-local"></label>
              </div>
            </section>

            <section class="form-section">
              <div class="section-heading"><strong>Details</strong><span>Optional commercial and internal information.</span></div>
              <div class="form-grid">
                <label>Fee<input v-model="form.fee" inputmode="decimal" placeholder="750.00"></label>
                <label>Source<input v-model="form.source" placeholder="Referral, website…"></label>
                <label class="checkbox wide"><input v-model="form.publicVisibility" type="checkbox"> Show in public agenda</label>
                <label class="wide">Internal notes<textarea v-model="form.internalNotes" rows="3"/></label>
              </div>
            </section>

            <p v-if="formError" class="error modal-error">{{formError}}</p>
            <footer class="modal-actions">
              <button class="secondary" type="button" @click="closeCreate">Cancel</button>
              <button class="primary" type="submit" :disabled="saving">{{saving?'Saving…':'Create gig'}}</button>
            </footer>
          </form>
        </section>
      </div>
    </Teleport>

    <AdminFilterBar
      has-advanced
      :advanced-open="showAdvancedFilters"
      :active-advanced-count="activeAdvancedCount"
      :has-active-filters="hasActiveFilters"
      :results-label="`${data?.gigs.length ?? 0} gigs`"
      @toggle-advanced="showAdvancedFilters = !showAdvancedFilters"
      @clear-all="clearAllFilters"
    >
      <template #primary>
        <input v-model="filters.search" type="search" placeholder="Search gigs, clients or venues…">
        <select v-model="filters.status" aria-label="Status">
          <option value="">All statuses</option>
          <option value="lead">Lead</option>
          <option value="booked">Booked</option>
          <option value="declined">Declined</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select v-model="dateMode" aria-label="Date">
          <option value="">Any date</option>
          <option value="upcoming">Upcoming</option>
          <option value="past">Past</option>
          <option value="custom">Custom range</option>
        </select>
        <input v-if="dateMode==='custom'" v-model="filters.startDate" type="date" aria-label="From date">
        <input v-if="dateMode==='custom'" v-model="filters.endDate" type="date" aria-label="To date">
      </template>

      <template #advanced>
        <label>Event type
          <select v-model="filters.eventType">
            <option value="">All event types</option>
            <option v-for="type in data?.options.eventTypes||[]" :key="type" :value="type">{{type}}</option>
          </select>
        </label>
        <label>Client
          <select v-model="filters.clientId">
            <option value="">All clients</option>
            <option v-for="client in data?.options.clients||[]" :key="client.id" :value="client.id">{{clientName(client)}}</option>
          </select>
        </label>
        <label>Venue
          <select v-model="filters.venueId">
            <option value="">All venues</option>
            <option v-for="venue in data?.options.venues||[]" :key="venue.id" :value="venue.id">{{venue.name}}</option>
          </select>
        </label>
        <label>Visibility
          <select v-model="filters.public">
            <option value="">Public + private</option>
            <option value="true">Public</option>
            <option value="false">Private</option>
          </select>
        </label>
        <label v-if="canManageGigs">Assigned DJ
          <select v-model="filters.assignedUserId">
            <option value="">All DJs</option>
            <option v-for="dj in data?.options.djs||[]" :key="dj.id" :value="dj.id">{{dj.name}}</option>
          </select>
        </label>
      </template>

      <template #chips>
        <AdminFilterChip v-if="filters.search" :label="`Search: ${filters.search}`" @remove="filters.search=''" />
        <AdminFilterChip v-if="filters.status" :label="`Status: ${statusLabel(filters.status)}`" @remove="filters.status=''" />
        <AdminFilterChip v-if="dateFilterLabel" :label="dateFilterLabel" @remove="clearDateFilter" />
        <AdminFilterChip v-if="filters.eventType" :label="`Event type: ${filters.eventType}`" @remove="filters.eventType=''" />
        <AdminFilterChip v-if="filters.clientId" :label="`Client: ${selectedClientLabel()}`" @remove="filters.clientId=''" />
        <AdminFilterChip v-if="filters.venueId" :label="`Venue: ${selectedVenueLabel()}`" @remove="filters.venueId=''" />
        <AdminFilterChip v-if="filters.public" :label="`Visibility: ${filters.public==='true'?'Public':'Private'}`" @remove="filters.public=''" />
        <AdminFilterChip v-if="canManageGigs&&filters.assignedUserId" :label="`DJ: ${selectedDjLabel()}`" @remove="filters.assignedUserId=''" />
      </template>

      <template #toolbar>
        <label class="sort-control">
          <span>Sort by</span>
          <select v-model="sort" aria-label="Sort gigs">
            <option value="date_desc">Date (newest first)</option>
            <option value="date_asc">Date (oldest first)</option>
          </select>
        </label>
      </template>
    </AdminFilterBar>

    <div v-if="status==='pending'" class="empty">Loading gigs…</div><div v-else-if="!data?.gigs.length" class="empty">No gigs match these filters.</div>
    <div v-else class="gig-list"><NuxtLink v-for="gig in data.gigs" :key="gig.id" :to="`/admin/gigs/${gig.id}`" class="gig-row"><div class="date"><strong>{{gig.startsAt?new Date(gig.startsAt).getDate():'—'}}</strong><span>{{gig.startsAt?new Date(gig.startsAt).toLocaleDateString('en',{month:'short'}):'TBD'}}</span></div><div class="main"><div class="title-line"><strong>{{gig.title}}</strong><span class="status" :data-status="gig.status">{{gig.status}}</span><span v-if="gig.publicVisibility" class="public">Public</span></div><span>{{rowClient(gig)}} · {{gig.venueName||'No venue'}} · {{gig.eventType||'Event type not set'}} · {{assignedName(gig)}}</span></div><div class="right"><strong>{{money(gig.fee,gig.currency)}}</strong><span>{{formatDate(gig.startsAt)}}</span></div></NuxtLink></div>
  </div>
</template>

<style scoped>
.gigs-page{max-width:1180px;margin-inline:auto}.notice{margin-bottom:1rem;padding:.85rem 1rem;border:1px solid #324137;border-radius:.8rem;background:#121b16;color:#b8d7c2}.page-header{display:flex;align-items:end;justify-content:space-between;gap:1rem;margin-bottom:1.5rem}h1{margin:.2rem 0;font-size:clamp(2.5rem,6vw,4rem);letter-spacing:-.05em}.page-header p:last-child{margin:0;color:#8e8797}.primary,.secondary,.icon-button,.text-button,.picker-option{font:inherit}.primary{border:0;border-radius:.7rem;padding:.75rem 1rem;background:#fff;color:#09080b;font-weight:800;cursor:pointer}.secondary{border:1px solid #393240;border-radius:.7rem;padding:.7rem .95rem;background:#17131c;color:#f6f3fa;font-weight:700;cursor:pointer}.primary:disabled,.secondary:disabled{opacity:.55;cursor:not-allowed}label,.field{display:grid;gap:.35rem;color:#aaa4b1;font-size:.8rem}input,select,textarea{width:100%;border:1px solid #332e39;border-radius:.65rem;padding:.7rem;background:#0b0a0d;color:#f6f3fa}.wide{grid-column:1/-1}.checkbox{display:flex;align-items:center;gap:.6rem}.checkbox input{width:auto}.sort-control{display:flex;align-items:center;gap:.55rem;color:#8e8797;font-size:.78rem}.sort-control span{white-space:nowrap}.gig-list{overflow:hidden;border:1px solid #292530;border-radius:1rem}.gig-row{display:grid;grid-template-columns:3.2rem minmax(0,1fr) auto;gap:1rem;align-items:center;padding:.95rem 1rem;border-bottom:1px solid #242029;text-decoration:none}.gig-row:last-child{border-bottom:0}.gig-row:hover{background:#141119}.date{display:grid;place-items:center;padding:.45rem;border-radius:.7rem;background:#1c1822}.date span{font-size:.62rem;color:#8d8696;text-transform:uppercase}.main{min-width:0}.title-line{display:flex;align-items:center;gap:.45rem;min-width:0}.main>span,.right span{display:block;color:#817a8b;font-size:.78rem}.status,.public{padding:.18rem .4rem;border-radius:999px;font-size:.65rem;text-transform:uppercase}.status{background:#27222e;color:#b8afc2}.status[data-status=booked]{background:#14251d;color:#9be6ba}.status[data-status=declined],.status[data-status=cancelled]{background:#2a181c;color:#e7a2ad}.public{background:#1a2030;color:#aebff8}.right{text-align:right}.right strong{display:block}.empty{padding:2rem;border:1px dashed #302a38;border-radius:1rem;color:#817a8b}.error{color:#ff9c9c}

.modal-backdrop{position:fixed;inset:0;z-index:1000;display:grid;place-items:center;padding:1rem;background:rgba(4,3,6,.78);backdrop-filter:blur(10px)}.modal-card{width:min(940px,100%);max-height:calc(100dvh - 2rem);overflow:auto;border:1px solid #342d3b;border-radius:1.2rem;background:#0d0b10;box-shadow:0 28px 100px rgba(0,0,0,.6)}.modal-header{position:sticky;top:0;z-index:4;display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;padding:1.25rem 1.35rem;border-bottom:1px solid #27222d;background:rgba(13,11,16,.96);backdrop-filter:blur(12px)}.modal-header h2{margin:.12rem 0 .2rem;font-size:1.8rem;letter-spacing:-.035em}.modal-header p:last-child{margin:0;color:#837b8c;font-size:.86rem}.icon-button{display:grid;width:2.35rem;height:2.35rem;place-items:center;border:1px solid #342e3b;border-radius:.7rem;background:#151119;color:#c8c0d0;font-size:1.15rem;cursor:pointer}.modal-form{padding:0 1.35rem 1.35rem}.form-section{display:grid;grid-template-columns:10rem minmax(0,1fr);gap:1.2rem;padding:1.25rem 0;border-bottom:1px solid #211d25}.section-heading{display:grid;align-content:start;gap:.25rem}.section-heading strong{color:#f4eff8}.section-heading span{color:#777080;font-size:.75rem;line-height:1.45}.form-grid,.compact-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.8rem}.timing-grid{grid-template-columns:1.35fr .8fr 1.35fr}.relation-grid{align-items:start}.field-label{color:#aaa4b1}.picker{position:relative}.picker-input-row{display:flex;gap:.45rem}.picker-input-row input{min-width:0}.text-button{border:1px solid #332e39;border-radius:.65rem;padding:0 .7rem;background:#151119;color:#aaa3b3;cursor:pointer}.picker-menu{position:absolute;z-index:7;top:calc(100% + .35rem);left:0;right:0;max-height:15rem;overflow:auto;padding:.35rem;border:1px solid #39313f;border-radius:.75rem;background:#131017;box-shadow:0 16px 45px rgba(0,0,0,.45)}.picker-option{display:flex;width:100%;align-items:center;justify-content:space-between;gap:.75rem;border:0;border-radius:.55rem;padding:.65rem .7rem;background:transparent;color:#f4eff8;text-align:left;cursor:pointer}.picker-option[data-active=true],.picker-option[data-selected=true]{background:#211a29}.picker-option strong{display:flex;align-items:center;gap:.45rem;min-width:0;overflow-wrap:anywhere}.create-option strong{color:#d7c6ef}.picker-option span{color:#81798a;font-size:.72rem}.picker-empty{padding:.8rem;color:#777080;font-size:.78rem}.inline-create-header{display:flex;align-items:center;justify-content:space-between;gap:.75rem;color:#f4eff8;font-size:.82rem}.inline-create-header .text-button{padding:.35rem .6rem;font-size:.72rem}.inline-create{display:grid;gap:.75rem;margin-top:.35rem;padding:.8rem;border:1px solid #302938;border-radius:.8rem;background:#121016}.compact-grid{gap:.6rem}.compact-grid label{font-size:.75rem}.inline-create .secondary{justify-self:start;font-size:.78rem}.modal-error{margin:1rem 0 0}.modal-actions{position:sticky;bottom:-1.35rem;z-index:4;display:flex;justify-content:flex-end;gap:.65rem;margin:0 -1.35rem -1.35rem;padding:1rem 1.35rem;border-top:1px solid #27222d;background:rgba(13,11,16,.96);backdrop-filter:blur(12px)}

@media(max-width:900px){.form-section{grid-template-columns:1fr;gap:.75rem}.section-heading{max-width:34rem}.timing-grid{grid-template-columns:repeat(2,1fr)}}
@media(max-width:650px){.page-header{align-items:start;flex-direction:column}.page-header .primary{width:100%}.form-grid,.compact-grid,.timing-grid{grid-template-columns:1fr}.wide{grid-column:auto}.gig-row{grid-template-columns:3.2rem minmax(0,1fr)}.right{grid-column:2;text-align:left}.title-line{flex-wrap:wrap}.modal-backdrop{padding:0}.modal-card{width:100%;height:100dvh;max-height:none;border:0;border-radius:0}.modal-header{padding:1rem}.modal-form{padding:0 1rem 1rem}.form-section{padding:1rem 0}.modal-actions{bottom:-1rem;margin:0 -1rem -1rem;padding:1rem}.modal-actions .primary,.modal-actions .secondary{flex:1}}
</style>
