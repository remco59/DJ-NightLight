<script setup lang="ts">
import { invoiceStatusLabels, labelFor } from '~~/shared/labels'

definePageMeta({layout:'admin'})
type ClientOption={id:string;firstName:string|null;lastName:string|null;companyName:string|null}
type Invoice={id:string;invoiceNumber:string|null;status:string;paymentStatus:string;paymentProvider:string|null;issueDate:string;dueDate:string;totalCents:number;currency:string;gigId:string;gigTitle:string;clientFirstName:string|null;clientLastName:string|null;clientCompanyName:string|null}

const emptyFilters={search:'',status:'',payment:'',clientId:'',startDate:'',endDate:''}
const statusTabs=[{value:'',label:'Alle'},{value:'draft',label:'Concepten'},{value:'finalized',label:'Definitief'},{value:'void',label:'Vervallen'}]
const paymentLabels:Record<string,string>={unpaid:'Onbetaald',pending:'In afwachting',paid:'Betaald',failed:'Mislukt',overdue:'Te laat'}
const sortOptions=['date_desc','date_asc','amount_desc','amount_asc']
// Filters and sorting are remembered in a cookie so they survive a reload (and work during SSR).
const saved=useCookie<{filters?:Partial<typeof emptyFilters>;sort?:string}>('admin-invoice-filters',{maxAge:60*60*24*365,sameSite:'lax',default:()=>({})})
const savedFilters=Object.fromEntries(Object.entries(saved.value?.filters??{}).filter(([key,value])=>key in emptyFilters&&typeof value==='string'))
const filters=reactive({...emptyFilters,...savedFilters})
const sort=ref(sortOptions.includes(saved.value?.sort??'')?saved.value!.sort as string:'date_desc')
const showAdvancedFilters=ref(false)
watch([filters,sort],()=>{saved.value={filters:{...filters},sort:sort.value}},{deep:true})

const query=computed(()=>({...Object.fromEntries(Object.entries(filters).filter(([,value])=>value!=='')),sort:sort.value}))
const {data,status}=await useFetch<{invoices:Invoice[];options:{clients:ClientOption[]}}>('/api/admin/invoices',{query})

const activeAdvancedCount=computed(()=>[filters.payment,filters.clientId,filters.startDate||filters.endDate].filter(Boolean).length)
const hasActiveFilters=computed(()=>Object.values(filters).some(Boolean))
const dateFilterLabel=computed(()=>filters.startDate||filters.endDate?`Factuurdatum: ${filters.startDate||'Elke'} – ${filters.endDate||'Elke'}`:'')
function clientName(item:{clientFirstName?:string|null;clientLastName?:string|null;clientCompanyName?:string|null;companyName?:string|null;firstName?:string|null;lastName?:string|null}){return item.clientCompanyName||item.companyName||[item.clientFirstName??item.firstName,item.clientLastName??item.lastName].filter(Boolean).join(' ')||'Klant'}
function selectedClientLabel(){const client=data.value?.options.clients.find(item=>item.id===filters.clientId);return client?clientName(client):'Klant'}
function money(cents:number,currency:string){return new Intl.NumberFormat('nl-NL',{style:'currency',currency}).format(cents/100)}
function clearAllFilters(){Object.assign(filters,emptyFilters)}
useSeoMeta({title:'Facturen — DJ NightLight',robots:'noindex, nofollow'})
</script>
<template><div class="invoices"><header><p class="eyebrow">Financiën</p><h1>Facturen</h1><p>Maak facturen aan vanuit een gig en maak ze hier definitief.</p></header>
<nav class="status-tabs" aria-label="Facturen per status"><button v-for="tab in statusTabs" :key="tab.value" type="button" :aria-pressed="filters.status===tab.value" @click="filters.status=tab.value">{{tab.label}}</button></nav>
<AdminFilterBar has-advanced :advanced-open="showAdvancedFilters" :active-advanced-count="activeAdvancedCount" :has-active-filters="hasActiveFilters" :results-label="`${data?.invoices.length??0} ${(data?.invoices.length??0)===1?'factuur':'facturen'}`" @toggle-advanced="showAdvancedFilters=!showAdvancedFilters" @clear-all="clearAllFilters">
<template #primary><input v-model="filters.search" type="search" aria-label="Zoek facturen" placeholder="Zoek factuurnummer, gig of klant…"></template>
<template #advanced>
<label>Betaling<select v-model="filters.payment"><option value="">Alle betaalstatussen</option><option v-for="(label,value) in paymentLabels" :key="value" :value="value">{{label}}</option></select></label>
<label>Klant<select v-model="filters.clientId"><option value="">Alle klanten</option><option v-for="client in data?.options.clients||[]" :key="client.id" :value="client.id">{{clientName(client)}}</option></select></label>
<label>Factuurdatum vanaf<input v-model="filters.startDate" type="date"></label>
<label>Factuurdatum tot<input v-model="filters.endDate" type="date"></label>
</template>
<template #chips>
<AdminFilterChip v-if="filters.search" :label="`Zoeken: ${filters.search}`" @remove="filters.search=''" />
<AdminFilterChip v-if="filters.status" :label="`Status: ${labelFor(invoiceStatusLabels,filters.status)}`" @remove="filters.status=''" />
<AdminFilterChip v-if="filters.payment" :label="`Betaling: ${paymentLabels[filters.payment]||filters.payment}`" @remove="filters.payment=''" />
<AdminFilterChip v-if="filters.clientId" :label="`Klant: ${selectedClientLabel()}`" @remove="filters.clientId=''" />
<AdminFilterChip v-if="dateFilterLabel" :label="dateFilterLabel" @remove="filters.startDate='';filters.endDate=''" />
</template>
<template #toolbar><label class="sort-control"><span>Sorteren op</span><select v-model="sort" aria-label="Facturen sorteren"><option value="date_desc">Datum (nieuwste eerst)</option><option value="date_asc">Datum (oudste eerst)</option><option value="amount_desc">Bedrag (hoogste eerst)</option><option value="amount_asc">Bedrag (laagste eerst)</option></select></label></template>
</AdminFilterBar>
<div v-if="status==='pending'&&!data" class="empty">Facturen laden…</div><div v-else-if="!data?.invoices.length" class="empty">{{hasActiveFilters?'Geen facturen gevonden met deze filters.':'Nog geen facturen. Open een gig om er een aan te maken.'}}</div><NuxtLink v-for="invoice in data?.invoices||[]" :key="invoice.id" :to="`/admin/invoices/${invoice.id}`" class="row"><div><strong>{{invoice.invoiceNumber||'Conceptfactuur'}}</strong><span>{{invoice.gigTitle}} · {{clientName(invoice)}}</span></div><div class="states"><AdminStatusChip kind="invoice" :status="invoice.status" /><AdminStatusChip v-if="invoice.status==='finalized'" kind="payment" :status="invoice.paymentStatus" :provider="invoice.paymentProvider" /></div><strong>{{money(invoice.totalCents,invoice.currency)}}</strong></NuxtLink></div></template>
<style scoped>.invoices{max-width:1000px;margin-inline:auto}header{margin-bottom:1.5rem}h1{margin:.2rem 0;font-size:clamp(2.5rem,6vw,4.5rem);letter-spacing:-.04em}header>p:last-child{color:var(--text-subtle)}.status-tabs{display:flex;gap:.35rem;margin-bottom:.85rem;overflow-x:auto;scrollbar-width:none}.status-tabs button{flex:0 0 auto;min-height:2.5rem;border:1px solid var(--border);border-radius:999px;padding:.45rem .95rem;background:transparent;color:#b8b2c1;font:inherit;font-weight:700;font-size:.84rem;cursor:pointer}.status-tabs button:hover{color:#fff;border-color:#3d3646}.status-tabs button[aria-pressed="true"]{border-color:var(--text);background:var(--text);color:#0b0910}.sort-control{display:flex;align-items:center;gap:.55rem;color:var(--text-subtle);font-size:.78rem}.sort-control span{white-space:nowrap}.row{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:1rem;align-items:center;padding:1rem;border:1px solid var(--border);border-radius:.85rem;margin-bottom:.6rem;background:var(--surface-card);text-decoration:none}.row div:first-child strong,.row div:first-child span{display:block}.row div:first-child span{color:var(--text-subtle);font-size:.78rem}.states{display:flex;gap:.35rem}.empty{padding:2rem;border:1px dashed #302a36;border-radius:1rem;color:var(--text-subtle)}@media(max-width:650px){.row{grid-template-columns:1fr}.states{order:3}}</style>
