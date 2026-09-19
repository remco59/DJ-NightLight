<script setup lang="ts">
import { apiErrorMessage } from '~/utils/api-error'

definePageMeta({layout:'admin'})
const route=useRoute()
const id=String(route.params.id)

type LandingPage={
  id:string;slug:string;navLabel:string;eyebrow:string;title:string;intro:string;body:string;
  heroImageUrl:string|null;ctaLabel:string;ctaHref:string;published:boolean;showInNavigation:boolean;
  indexable:boolean;seoTitle:string;seoDescription:string;seoImageUrl:string|null;ordering:number
}

const {data,refresh}=await useFetch<{page:LandingPage}>(`/api/admin/landing-pages/${id}`)
if(!data.value)throw createError({statusCode:404,statusMessage:'Landing page not found'})

const p=data.value.page
const form=reactive({
  slug:p.slug,navLabel:p.navLabel,eyebrow:p.eyebrow,title:p.title,intro:p.intro,body:p.body,
  heroImageUrl:p.heroImageUrl||'',ctaLabel:p.ctaLabel,ctaHref:p.ctaHref,
  published:p.published,showInNavigation:p.showInNavigation,indexable:p.indexable,
  seoTitle:p.seoTitle,seoDescription:p.seoDescription,seoImageUrl:p.seoImageUrl||'',ordering:p.ordering,
})
const saving=ref(false)
const message=ref('')

async function save(){
  saving.value=true;message.value=''
  try{
    await $fetch(`/api/admin/landing-pages/${id}`,{method:'PUT',body:form})
    await refresh()
    await refreshNuxtData('landing-navigation')
    message.value='Landing page saved.'
  }catch(error:unknown){message.value=apiErrorMessage(error,'Could not save landing page.')}
  finally{saving.value=false}
}
async function remove(){
  if(!confirm('Delete this landing page permanently?'))return
  try{await $fetch(`/api/admin/landing-pages/${id}`,{method:'DELETE'});await refreshNuxtData('landing-navigation');await navigateTo('/admin/landing-pages')}
  catch(error:unknown){message.value=apiErrorMessage(error,'Could not delete landing page.')}
}

useSeoMeta({title:()=>`${form.navLabel||'Landing page'} — DJ NightLight`,robots:'noindex, nofollow'})
</script>

<template>
  <div class="editor">
    <div class="topline"><NuxtLink to="/admin/landing-pages">← Landing pages</NuxtLink><div class="actions"><NuxtLink v-if="form.published" :to="`/diensten/${form.slug}`" target="_blank">Preview ↗</NuxtLink><button class="danger" type="button" @click="remove">Delete</button></div></div>
    <header><p class="eyebrow">Landing page</p><h1>{{form.navLabel}}</h1><p>/diensten/{{form.slug}}</p></header>

    <form @submit.prevent="save">
      <section class="card"><p class="eyebrow">Publishing</p><div class="toggles"><label><input v-model="form.published" type="checkbox"><span><strong>Published</strong><small>Controls whether the public URL exists.</small></span></label><label><input v-model="form.showInNavigation" type="checkbox"><span><strong>Show in navigation</strong><small>Independent from publishing.</small></span></label><label><input v-model="form.indexable" type="checkbox"><span><strong>Search indexable</strong><small>Independent from navigation visibility.</small></span></label></div></section>

      <section class="card"><p class="eyebrow">Page</p><div class="grid"><label>Slug<input v-model="form.slug" required></label><label>Navigation label<input v-model="form.navLabel" required></label><label>Eyebrow<input v-model="form.eyebrow" required></label><label>Order<input v-model.number="form.ordering" type="number" min="0"></label><label class="wide">Title<input v-model="form.title" required></label><label class="wide">Intro<textarea v-model="form.intro" rows="3" required/></label><label class="wide">Body<textarea v-model="form.body" rows="8" required/></label><label class="wide">Hero image URL<input v-model="form.heroImageUrl" type="url"></label></div></section>

      <section class="card"><p class="eyebrow">Call to action</p><div class="grid"><label>CTA label<input v-model="form.ctaLabel" required></label><label>CTA destination<input v-model="form.ctaHref" required placeholder="/boeken"></label></div></section>

      <section class="card"><p class="eyebrow">SEO</p><div class="grid"><label class="wide">SEO title<input v-model="form.seoTitle" required></label><label class="wide">SEO description<textarea v-model="form.seoDescription" rows="3" required/></label><label class="wide">Social image URL<input v-model="form.seoImageUrl" type="url"></label></div></section>

      <div class="save-bar"><span>{{message||'Publishing, navigation and search indexing are separate controls.'}}</span><button class="primary" type="submit" :disabled="saving">{{saving?'Saving…':'Save page'}}</button></div>
    </form>
  </div>
</template>

<style scoped>
.editor{max-width:900px;margin-inline:auto}.topline{display:flex;justify-content:space-between;gap:1rem;margin-bottom:1rem}.topline>a,.actions a{color:#8e8797;text-decoration:none}.actions{display:flex;gap:.8rem;align-items:center}header{margin-bottom:1.5rem}h1{margin:.2rem 0;font-size:clamp(2.4rem,6vw,4rem);letter-spacing:-.05em}header>p:last-child{margin:.2rem 0;color:#716b78;font-family:monospace}.card{margin-bottom:1rem;padding:1.2rem;border:1px solid #2b2631;border-radius:1rem;background:#100e14}.toggles{display:grid;grid-template-columns:repeat(3,1fr);gap:.7rem}.toggles label{display:flex;align-items:start;gap:.6rem;padding:.9rem;border:1px solid #2b2631;border-radius:.8rem}.toggles input{width:auto;margin-top:.15rem}.toggles strong,.toggles small{display:block}.toggles small{margin-top:.25rem;color:#77717e;line-height:1.45}.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:.8rem}.wide{grid-column:1/-1}label{display:grid;gap:.35rem;color:#aaa4b1;font-size:.8rem}input,textarea{width:100%;border:1px solid #332e39;border-radius:.65rem;padding:.72rem;background:#0b0a0d;color:#f6f3fa}.save-bar{position:sticky;bottom:1rem;display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:1rem;border:1px solid #37313e;border-radius:1rem;background:rgba(20,17,25,.95);backdrop-filter:blur(12px);color:#918a98}.primary,.danger{border:0;border-radius:.65rem;padding:.72rem .9rem;font-weight:800;cursor:pointer}.primary{background:#fff;color:#09080b}.danger{background:#2a1519;color:#ffabb5}@media(max-width:750px){.toggles,.grid{grid-template-columns:1fr}.wide{grid-column:auto}.topline{align-items:start;flex-direction:column}.save-bar{align-items:stretch;flex-direction:column}.primary{width:100%}}
</style>
