<script setup lang="ts">
import { apiErrorMessage } from '~/utils/api-error'

definePageMeta({ layout: 'admin' })

type VenueListItem = { id:string; name:string; city:string|null; address:string|null; contactName:string|null; contactEmail:string|null; gigCount:number }
const emptyFilters={search:'',city:'',hasGigs:'',hasContact:''}
const sortOptions=['name_asc','name_desc','gigs_desc']
// Filters and sorting are remembered in a cookie so they survive a reload (and work during SSR).
const saved=useCookie<{filters?:Partial<typeof emptyFilters>;sort?:string}>('admin-venue-filters',{maxAge:60*60*24*365,sameSite:'lax',default:()=>({})})
const savedFilters=Object.fromEntries(Object.entries(saved.value?.filters??{}).filter(([key,value])=>key in emptyFilters&&typeof value==='string'))
const filters=reactive({...emptyFilters,...savedFilters})
const sort=ref(sortOptions.includes(saved.value?.sort??'')?saved.value!.sort as string:'name_asc')
const showAdvancedFilters=ref(false)
watch([filters,sort],()=>{saved.value={filters:{...filters},sort:sort.value}},{deep:true})
const activeAdvancedCount=computed(()=>[filters.hasGigs,filters.hasContact].filter(Boolean).length)
const hasActiveFilters=computed(()=>Object.values(filters).some(Boolean))
function clearAllFilters(){Object.assign(filters,emptyFilters)}
const showCreate=ref(false); const saving=ref(false); const formError=ref('')
const form=reactive({name:'',address:'',city:'',contactName:'',contactEmail:'',contactPhone:'',website:'',parkingNotes:'',technicalNotes:'',notes:''})
const {data,status,refresh}=await useFetch<{venues:VenueListItem[];options:{cities:string[]}}>('/api/admin/venues',{query:computed(()=>({...Object.fromEntries(Object.entries(filters).filter(([,value])=>value!=='')),sort:sort.value}))})
async function createVenue(){
  saving.value=true;formError.value=''
  try{const result=await $fetch<{venue:VenueListItem}>('/api/admin/venues',{method:'POST',body:form});await refresh();showCreate.value=false;await navigateTo(`/admin/venues/${result.venue.id}`)}
  catch(error:unknown){formError.value=apiErrorMessage(error,'Locatie aanmaken is niet gelukt.')}finally{saving.value=false}
}
useSeoMeta({title:'Locaties — DJ NightLight',robots:'noindex, nofollow'})
</script>

<template><div class="entity-page">
<header class="page-header"><div><p class="eyebrow">Relaties</p><h1>Locaties</h1><p>Locaties, contactpersonen en praktische notities.</p></div><button class="with-icon primary" @click="showCreate=!showCreate"><Icon :name="showCreate?'lucide:x':'lucide:plus'" aria-hidden="true" />{{showCreate?'Sluiten':'Nieuwe locatie'}}</button></header>
<form v-if="showCreate" class="editor-card" @submit.prevent="createVenue"><h2>Nieuwe locatie</h2><div class="grid">
<label>Naam<input v-model="form.name" required></label><label>Plaats<input v-model="form.city"></label><label class="wide">Adres<input v-model="form.address"></label>
<label>Contactpersoon<input v-model="form.contactName"></label><label>E-mail contactpersoon<input v-model="form.contactEmail" type="email"></label><label>Telefoon contactpersoon<input v-model="form.contactPhone"></label><label>Website<input v-model="form.website" type="url"></label>
<label class="wide">Parkeren / opbouw<textarea v-model="form.parkingNotes" rows="2"/></label><label class="wide">Technische notities<textarea v-model="form.technicalNotes" rows="2"/></label><label class="wide">Algemene notities<textarea v-model="form.notes" rows="2"/></label></div>
<p v-if="formError" class="error">{{formError}}</p><button class="primary" type="submit" :disabled="saving">{{saving?'Opslaan…':'Locatie aanmaken'}}</button></form>
<AdminFilterBar has-advanced :advanced-open="showAdvancedFilters" :active-advanced-count="activeAdvancedCount" :has-active-filters="hasActiveFilters" :results-label="`${data?.venues.length??0} ${(data?.venues.length??0)===1?'locatie':'locaties'}`" @toggle-advanced="showAdvancedFilters=!showAdvancedFilters" @clear-all="clearAllFilters">
<template #primary><input v-model="filters.search" type="search" aria-label="Zoek locaties" placeholder="Zoek op locatie, plaats of contactpersoon…"><select v-model="filters.city" aria-label="Plaats"><option value="">Alle plaatsen</option><option v-for="city in data?.options.cities||[]" :key="city" :value="city">{{city}}</option></select></template>
<template #advanced>
<label>Gigs<select v-model="filters.hasGigs"><option value="">Met en zonder gigs</option><option value="true">Met gigs</option><option value="false">Zonder gigs</option></select></label>
<label>Contactpersoon<select v-model="filters.hasContact"><option value="">Met en zonder contact</option><option value="true">Met contactgegevens</option><option value="false">Zonder contactgegevens</option></select></label>
</template>
<template #chips>
<AdminFilterChip v-if="filters.search" :label="`Zoeken: ${filters.search}`" @remove="filters.search=''" />
<AdminFilterChip v-if="filters.city" :label="`Plaats: ${filters.city}`" @remove="filters.city=''" />
<AdminFilterChip v-if="filters.hasGigs" :label="filters.hasGigs==='true'?'Met gigs':'Zonder gigs'" @remove="filters.hasGigs=''" />
<AdminFilterChip v-if="filters.hasContact" :label="filters.hasContact==='true'?'Met contactgegevens':'Zonder contactgegevens'" @remove="filters.hasContact=''" />
</template>
<template #toolbar><label class="sort-control"><span>Sorteren op</span><select v-model="sort" aria-label="Locaties sorteren"><option value="name_asc">Naam (A–Z)</option><option value="name_desc">Naam (Z–A)</option><option value="gigs_desc">Aantal gigs (meeste eerst)</option></select></label></template>
</AdminFilterBar>
<div v-if="status==='pending'&&!data" class="empty">Locaties laden…</div><div v-else-if="!data?.venues.length" class="empty">Geen locaties gevonden{{hasActiveFilters?' met deze filters':''}}.</div>
<div v-else class="list"><NuxtLink v-for="venue in data.venues" :key="venue.id" :to="`/admin/venues/${venue.id}`" class="row"><div class="marker"><Icon name="lucide:map-pin" aria-hidden="true" /></div><div class="copy"><strong>{{venue.name}}</strong><span>{{venue.city||venue.address||venue.contactName||'Geen details ingesteld'}}</span></div><span class="count">{{venue.gigCount}} {{venue.gigCount===1?'gig':'gigs'}}</span></NuxtLink></div>
</div></template>
<style scoped>
.entity-page{max-width:1050px;margin-inline:auto}.page-header{display:flex;justify-content:space-between;align-items:end;gap:1rem;margin-bottom:1.5rem}h1{margin:.2rem 0;font-size:clamp(2.5rem,6vw,4rem);letter-spacing:-.04em}.page-header p:last-child{margin:0;color:var(--text-subtle)}.primary{border:0;border-radius:.7rem;padding:.75rem 1rem;background:var(--button-primary-bg);color:var(--button-primary-fg);font-weight:800;cursor:pointer}.editor-card{margin-bottom:1.2rem;padding:1.3rem;border:1px solid var(--border);border-radius:1rem;background:var(--surface-card)}.editor-card h2{margin-top:0}.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:.9rem;margin-bottom:1rem}label{display:grid;gap:.4rem;color:var(--text-muted);font-size:.82rem}input,textarea{width:100%;border:1px solid var(--border-strong);border-radius:.65rem;padding:.75rem;background:var(--surface-input);color:var(--text)}.wide{grid-column:1/-1}.sort-control{display:flex;align-items:center;gap:.55rem;color:var(--text-subtle);font-size:.78rem}.sort-control span{white-space:nowrap}.toolbar{display:flex;align-items:center;justify-content:space-between;gap:1rem;margin-bottom:.8rem}.toolbar input{max-width:28rem}.toolbar span,.count{color:var(--text-subtle);font-size:.82rem}.list{border:1px solid #292530;border-radius:1rem;overflow:hidden}.row{display:grid;grid-template-columns:2.6rem minmax(0,1fr) auto;gap:.9rem;align-items:center;padding:.9rem 1rem;border-bottom:1px solid #242029;text-decoration:none}.row:last-child{border-bottom:0}.row:hover{background:#141119}.marker{display:grid;width:2.6rem;height:2.6rem;place-items:center;border-radius:.7rem;background:#211b29;color:#c7b5de;font-size:1.15rem}.copy{min-width:0}.copy strong,.copy span{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.copy span{color:#817a8b;font-size:.8rem}.empty{padding:2rem;border:1px dashed #302a38;border-radius:1rem;color:#817a8b}.error{color:#ff9c9c}@media(max-width:650px){.page-header{align-items:start;flex-direction:column}.grid{grid-template-columns:1fr}.wide{grid-column:auto}.toolbar{align-items:stretch;flex-direction:column}.row{grid-template-columns:2.6rem minmax(0,1fr)}.count{grid-column:2}.primary{width:100%}}
</style>
