<script setup lang="ts">
import { apiErrorMessage } from '~/utils/api-error'

definePageMeta({ layout: 'admin' })

type VenueListItem = { id:string; name:string; city:string|null; address:string|null; contactName:string|null; contactEmail:string|null; gigCount:number }
const search=ref(''); const showCreate=ref(false); const saving=ref(false); const formError=ref('')
const form=reactive({name:'',address:'',city:'',contactName:'',contactEmail:'',contactPhone:'',website:'',parkingNotes:'',technicalNotes:'',notes:''})
const {data,status,refresh}=await useFetch<{venues:VenueListItem[]}>('/api/admin/venues',{query:computed(()=>({search:search.value||undefined}))})
async function createVenue(){
  saving.value=true;formError.value=''
  try{const result=await $fetch<{venue:VenueListItem}>('/api/admin/venues',{method:'POST',body:form});await refresh();showCreate.value=false;await navigateTo(`/admin/venues/${result.venue.id}`)}
  catch(error:unknown){formError.value=apiErrorMessage(error,'Could not create venue.')}finally{saving.value=false}
}
useSeoMeta({title:'Venues — DJ NightLight',robots:'noindex, nofollow'})
</script>

<template><div class="entity-page">
<header class="page-header"><div><p class="eyebrow">Operations</p><h1>Venues</h1><p>Locations, contacts and practical notes.</p></div><button class="primary" @click="showCreate=!showCreate">{{showCreate?'Close':'New venue'}}</button></header>
<form v-if="showCreate" class="editor-card" @submit.prevent="createVenue"><h2>New venue</h2><div class="grid">
<label>Name<input v-model="form.name" required></label><label>City<input v-model="form.city"></label><label class="wide">Address<input v-model="form.address"></label>
<label>Contact name<input v-model="form.contactName"></label><label>Contact email<input v-model="form.contactEmail" type="email"></label><label>Contact phone<input v-model="form.contactPhone"></label><label>Website<input v-model="form.website" type="url"></label>
<label class="wide">Parking / load-in<textarea v-model="form.parkingNotes" rows="2"/></label><label class="wide">Technical notes<textarea v-model="form.technicalNotes" rows="2"/></label><label class="wide">General notes<textarea v-model="form.notes" rows="2"/></label></div>
<p v-if="formError" class="error">{{formError}}</p><button class="primary" type="submit" :disabled="saving">{{saving?'Saving…':'Create venue'}}</button></form>
<div class="toolbar"><input v-model="search" type="search" placeholder="Search venue, city or contact…"><span>{{data?.venues.length??0}} venues</span></div>
<div v-if="status==='pending'" class="empty">Loading venues…</div><div v-else-if="!data?.venues.length" class="empty">No venues found.</div>
<div v-else class="list"><NuxtLink v-for="venue in data.venues" :key="venue.id" :to="`/admin/venues/${venue.id}`" class="row"><div class="marker">⌖</div><div class="copy"><strong>{{venue.name}}</strong><span>{{venue.city||venue.address||venue.contactName||'Details not set'}}</span></div><span class="count">{{venue.gigCount}} {{venue.gigCount===1?'gig':'gigs'}}</span></NuxtLink></div>
</div></template>
<style scoped>
.entity-page{max-width:1050px;margin-inline:auto}.page-header{display:flex;justify-content:space-between;align-items:end;gap:1rem;margin-bottom:1.5rem}h1{margin:.2rem 0;font-size:clamp(2.5rem,6vw,4rem);letter-spacing:-.05em}.page-header p:last-child{margin:0;color:#8e8797}.primary{border:0;border-radius:.7rem;padding:.75rem 1rem;background:#fff;color:#09080b;font-weight:800;cursor:pointer}.editor-card{margin-bottom:1.2rem;padding:1.3rem;border:1px solid #2b2631;border-radius:1rem;background:#100e14}.editor-card h2{margin-top:0}.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:.9rem;margin-bottom:1rem}label{display:grid;gap:.4rem;color:#aaa4b1;font-size:.82rem}input,textarea{width:100%;border:1px solid #332e39;border-radius:.65rem;padding:.75rem;background:#0b0a0d;color:#f6f3fa}.wide{grid-column:1/-1}.toolbar{display:flex;align-items:center;justify-content:space-between;gap:1rem;margin-bottom:.8rem}.toolbar input{max-width:28rem}.toolbar span,.count{color:#777080;font-size:.82rem}.list{border:1px solid #292530;border-radius:1rem;overflow:hidden}.row{display:grid;grid-template-columns:2.6rem minmax(0,1fr) auto;gap:.9rem;align-items:center;padding:.9rem 1rem;border-bottom:1px solid #242029;text-decoration:none}.row:last-child{border-bottom:0}.row:hover{background:#141119}.marker{display:grid;width:2.6rem;height:2.6rem;place-items:center;border-radius:.7rem;background:#211b29}.copy{min-width:0}.copy strong,.copy span{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.copy span{color:#817a8b;font-size:.8rem}.empty{padding:2rem;border:1px dashed #302a38;border-radius:1rem;color:#817a8b}.error{color:#ff9c9c}@media(max-width:650px){.page-header{align-items:start;flex-direction:column}.grid{grid-template-columns:1fr}.wide{grid-column:auto}.toolbar{align-items:stretch;flex-direction:column}.row{grid-template-columns:2.6rem minmax(0,1fr)}.count{grid-column:2}.primary{width:100%}}
</style>
