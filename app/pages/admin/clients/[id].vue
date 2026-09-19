<script setup lang="ts">
import { apiErrorMessage } from '~/utils/api-error'

definePageMeta({ layout: 'admin' })
const route = useRoute()
const id = String(route.params.id)

type Client = {
  id:string; type:'person'|'company'; firstName:string|null; lastName:string|null; companyName:string|null;
  email:string|null; phone:string|null; billingAddress:string|null; notes:string|null
}
type HistoryItem = { id:string; title:string; status:string; startsAt:string|Date|null; fee:string|null; currency:string; venueName:string|null }

const { data, refresh } = await useFetch<{ client:Client, history:HistoryItem[] }>(`/api/admin/clients/${id}`)
if (!data.value) throw createError({ statusCode:404, statusMessage:'Client not found' })

const form = reactive({
  type: data.value.client.type,
  firstName: data.value.client.firstName || '',
  lastName: data.value.client.lastName || '',
  companyName: data.value.client.companyName || '',
  email: data.value.client.email || '',
  phone: data.value.client.phone || '',
  billingAddress: data.value.client.billingAddress || '',
  notes: data.value.client.notes || '',
})
const saving=ref(false)
const message=ref('')

async function save(){
  saving.value=true; message.value=''
  try{
    await $fetch(`/api/admin/clients/${id}`,{method:'PUT',body:form})
    await refresh(); message.value='Saved.'
  }catch(error:unknown){message.value=apiErrorMessage(error,'Could not save.')}
  finally{saving.value=false}
}
async function remove(){
  if(!confirm('Delete this client permanently?')) return
  try{
    await $fetch(`/api/admin/clients/${id}`,{method:'DELETE'})
    await navigateTo('/admin/clients')
  }catch(error:unknown){message.value=apiErrorMessage(error,'Could not delete client.')}
}
function dateLabel(value:string|Date|null){return value?new Intl.DateTimeFormat('nl-NL',{dateStyle:'medium'}).format(new Date(value)):'No date'}

useSeoMeta({title:'Client — DJ NightLight',robots:'noindex, nofollow'})
</script>

<template>
  <div v-if="data" class="detail-page">
    <NuxtLink to="/admin/clients" class="back">← Clients</NuxtLink>
    <header><div><p class="eyebrow">Client</p><h1>{{ data.client.companyName || [data.client.firstName,data.client.lastName].filter(Boolean).join(' ') }}</h1></div><button class="danger" type="button" @click="remove">Delete</button></header>
    <form class="editor" @submit.prevent="save">
      <div class="grid">
        <label>Type<select v-model="form.type"><option value="person">Person</option><option value="company">Company</option></select></label>
        <label v-if="form.type==='company'">Company name<input v-model="form.companyName"></label>
        <template v-else><label>First name<input v-model="form.firstName"></label><label>Last name<input v-model="form.lastName"></label></template>
        <label>Email<input v-model="form.email" type="email"></label>
        <label>Phone<input v-model="form.phone"></label>
        <label class="wide">Billing address<textarea v-model="form.billingAddress" rows="2"/></label>
        <label class="wide">Notes<textarea v-model="form.notes" rows="4"/></label>
      </div>
      <div class="form-actions"><button class="primary" type="submit" :disabled="saving">{{saving?'Saving…':'Save changes'}}</button><span>{{message}}</span></div>
    </form>

    <section class="history">
      <div class="section-heading"><p class="eyebrow">History</p><h2>Gigs</h2></div>
      <p v-if="!data.history.length" class="empty">No gigs connected to this client yet.</p>
      <NuxtLink v-for="gig in data.history" :key="gig.id" :to="`/admin/gigs/${gig.id}`" class="gig">
        <div><strong>{{gig.title}}</strong><span>{{gig.venueName||'Venue not set'}}</span></div><div class="meta"><span>{{dateLabel(gig.startsAt)}}</span><span>{{gig.status}}</span></div>
      </NuxtLink>
    </section>
  </div>
</template>

<style scoped>
.detail-page{max-width:900px;margin-inline:auto}.back{display:inline-block;margin-bottom:1.2rem;color:#8e8797;text-decoration:none}header{display:flex;justify-content:space-between;align-items:end;gap:1rem;margin-bottom:1.5rem}h1{margin:.2rem 0;font-size:clamp(2.2rem,6vw,4rem);letter-spacing:-.05em}.editor,.history{padding:1.3rem;border:1px solid #2b2631;border-radius:1rem;background:#100e14}.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:.9rem}label{display:grid;gap:.4rem;color:#aaa4b1;font-size:.82rem}input,select,textarea{width:100%;border:1px solid #332e39;border-radius:.65rem;padding:.75rem;background:#0b0a0d;color:#f6f3fa}.wide{grid-column:1/-1}.form-actions{display:flex;align-items:center;gap:1rem;margin-top:1rem;color:#8e8797}.primary,.danger{border:0;border-radius:.65rem;padding:.72rem .9rem;font-weight:800;cursor:pointer}.primary{background:#fff;color:#09080b}.danger{background:#2a1519;color:#ffabb5}.history{margin-top:1rem}.section-heading h2{margin:.2rem 0 1rem}.gig{display:flex;justify-content:space-between;gap:1rem;padding:.9rem 0;border-top:1px solid #26212c;text-decoration:none}.gig strong,.gig span{display:block}.gig span{color:#7f7888;font-size:.8rem}.meta{text-align:right}.empty{color:#817a8b}@media(max-width:650px){header{align-items:start;flex-direction:column}.grid{grid-template-columns:1fr}.wide{grid-column:auto}.gig{align-items:start;flex-direction:column}.meta{text-align:left}.danger{width:100%}}
</style>
