<script setup lang="ts">
import { apiErrorMessage } from '~/utils/api-error'
import type { PublicSiteContent } from '~/types/site-content'

definePageMeta({layout:'admin'})
const {data}=await useFetch<{content:PublicSiteContent}>('/api/admin/content')
if(!data.value)throw createError({statusCode:500,statusMessage:'Could not load website content'})

const form=reactive({
  ...data.value.content,
  services:data.value.content.services.map(item=>({...item})),
  gallery:data.value.content.gallery.map(item=>({...item})),
})
const saving=ref(false);const message=ref('')

function addService(){form.services.push({title:'',body:''})}
function addImage(){form.gallery.push({url:'',alt:''})}
async function save(){
  saving.value=true;message.value=''
  try{await $fetch('/api/admin/content',{method:'PUT',body:form});message.value='Website content saved.';refreshNuxtData('nightlight-site-content')}
  catch(error:unknown){message.value=apiErrorMessage(error,'Could not save website content.')}
  finally{saving.value=false}
}
useSeoMeta({title:'Website content — DJ NightLight',robots:'noindex, nofollow'})
</script>
<template><div class="content-editor"><header><div><p class="eyebrow">Content</p><h1>Website</h1><p>Public copy, links, gallery and SEO without editing code.</p></div><NuxtLink to="/" target="_blank" class="preview">Open website ↗</NuxtLink></header>
<form @submit.prevent="save">
<section class="card"><p class="eyebrow">Brand & hero</p><div class="grid"><label>Brand name<input v-model="form.brandName" required></label><label>Eyebrow<input v-model="form.heroEyebrow" required></label><label class="wide">Hero title<input v-model="form.heroTitle" required></label><label class="wide">Hero text<textarea v-model="form.heroBody" rows="4" required/></label><label>Hero image URL<input v-model="form.heroImageUrl" type="url"></label><label>CTA label<input v-model="form.heroCtaLabel" required></label></div></section>
<section class="card"><p class="eyebrow">About</p><div class="grid"><label>Eyebrow<input v-model="form.aboutEyebrow" required></label><label class="wide">Title<input v-model="form.aboutTitle" required></label><label class="wide">Body<textarea v-model="form.aboutBody" rows="6" required/></label></div></section>
<section class="card"><div class="section-title"><div><p class="eyebrow">Services</p><h2>Homepage service blocks</h2></div><button type="button" @click="addService">+ Add</button></div><div v-for="(service,index) in form.services" :key="index" class="repeat"><input v-model="service.title" placeholder="Title" required><textarea v-model="service.body" rows="3" placeholder="Description" required/><button type="button" @click="form.services.splice(index,1)">Remove</button></div></section>
<section class="card"><p class="eyebrow">Media</p><div class="grid"><label>Eyebrow<input v-model="form.mediaEyebrow" required></label><label class="wide">Title<input v-model="form.mediaTitle" required></label><label class="wide">Body<textarea v-model="form.mediaBody" rows="4" required/></label><label class="wide">Showreel URL<input v-model="form.showreelUrl" type="url"></label></div><div class="section-title gallery-title"><h2>Gallery</h2><button type="button" @click="addImage">+ Add image</button></div><div v-for="(image,index) in form.gallery" :key="index" class="repeat image-row"><input v-model="image.url" type="url" placeholder="Image URL" required><input v-model="image.alt" placeholder="Alt text"><button type="button" @click="form.gallery.splice(index,1)">Remove</button></div></section>
<section class="card"><p class="eyebrow">Agenda</p><div class="grid"><label>Eyebrow<input v-model="form.agendaEyebrow" required></label><label class="wide">Title<input v-model="form.agendaTitle" required></label><label class="wide">Body<textarea v-model="form.agendaBody" rows="3" required/></label></div></section>
<section class="card"><p class="eyebrow">Booking</p><div class="grid"><label>Eyebrow<input v-model="form.bookingEyebrow" required></label><label class="wide">Title<input v-model="form.bookingTitle" required></label><label class="wide">Body<textarea v-model="form.bookingBody" rows="3" required/></label><label>E-mail<input v-model="form.contactEmail" type="email"></label><label>Phone<input v-model="form.contactPhone"></label><label>Instagram URL<input v-model="form.instagramUrl" type="url"></label><label>Spotify URL<input v-model="form.spotifyUrl" type="url"></label></div></section>
<section class="card"><p class="eyebrow">SEO</p><div class="grid"><label class="wide">Default title<input v-model="form.seoTitle" required></label><label class="wide">Description<textarea v-model="form.seoDescription" rows="3" required/></label><label class="wide">Social image URL<input v-model="form.seoImageUrl" type="url"></label></div></section>
<div class="save-bar"><span>{{message||'Changes become public after saving.'}}</span><button class="primary" type="submit" :disabled="saving">{{saving?'Saving…':'Save website'}}</button></div>
</form></div></template>
<style scoped>
.content-editor{max-width:950px;margin-inline:auto}header{display:flex;align-items:end;justify-content:space-between;gap:1rem;margin-bottom:1.5rem}h1{margin:.2rem 0;font-size:clamp(2.5rem,6vw,4rem);letter-spacing:-.05em}header p:last-child{margin:0;color:#8e8797}.preview{color:#aaa4b0}.card{margin-bottom:1rem;padding:1.25rem;border:1px solid #2b2631;border-radius:1rem;background:#100e14}.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:.8rem}.wide{grid-column:1/-1}label{display:grid;gap:.35rem;color:#aaa4b1;font-size:.8rem}input,textarea{width:100%;border:1px solid #332e39;border-radius:.65rem;padding:.72rem;background:#0b0a0d;color:#f6f3fa}.section-title{display:flex;justify-content:space-between;align-items:end;gap:1rem}.section-title h2{margin:.2rem 0}.section-title button,.repeat button{border:0;background:transparent;color:#b8b1c0;cursor:pointer}.repeat{display:grid;grid-template-columns:1fr 2fr auto;gap:.6rem;align-items:start;margin-top:.7rem;padding-top:.7rem;border-top:1px solid #28232d}.repeat button{color:#d7949f;padding:.7rem}.image-row{grid-template-columns:2fr 1fr auto}.gallery-title{margin-top:1.2rem}.save-bar{position:sticky;bottom:1rem;display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:1rem;border:1px solid #37313e;border-radius:1rem;background:rgba(20,17,25,.95);backdrop-filter:blur(12px);color:#918a98}.primary{border:0;border-radius:.65rem;padding:.75rem 1rem;background:#fff;color:#09080b;font-weight:800}@media(max-width:700px){header{align-items:start;flex-direction:column}.grid,.repeat,.image-row{grid-template-columns:1fr}.wide{grid-column:auto}.save-bar{align-items:stretch;flex-direction:column}.primary{width:100%}}
</style>
