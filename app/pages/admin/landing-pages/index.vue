<script setup lang="ts">
import { apiErrorMessage } from '~/utils/api-error'

definePageMeta({layout:'admin'})

type LandingPageRow={
  id:string;slug:string;navLabel:string;title:string;published:boolean;showInNavigation:boolean;indexable:boolean;ordering:number;updatedAt:string
}

const {data,status,refresh}=await useFetch<{pages:LandingPageRow[]}>('/api/admin/landing-pages')
const showCreate=ref(false)
const saving=ref(false)
const errorMessage=ref('')
const form=reactive({
  slug:'',navLabel:'',eyebrow:'DJ NightLight',title:'',intro:'',body:'',
  heroImageUrl:'',ctaLabel:'Boek NightLight',ctaHref:'/boeken',
  published:false,showInNavigation:false,indexable:true,
  seoTitle:'',seoDescription:'',seoImageUrl:'',ordering:100,
})

async function createPage(){
  saving.value=true;errorMessage.value=''
  try{
    const result=await $fetch<{page:{id:string}}>('/api/admin/landing-pages',{method:'POST',body:form})
    await refresh()
    await navigateTo(`/admin/landing-pages/${result.page.id}`)
  }catch(error:unknown){errorMessage.value=apiErrorMessage(error,'Landing page aanmaken is niet gelukt.')}
  finally{saving.value=false}
}

useSeoMeta({title:'Landing pages — DJ NightLight',robots:'noindex, nofollow'})
</script>

<template>
  <div class="landing-admin">
    <header class="page-header">
      <div><p class="eyebrow">Content</p><h1>Landing pages</h1><p>Publieke dienstpagina’s met losse instellingen voor publiceren, navigatie en indexering.</p></div>
      <button class="with-icon primary" type="button" @click="showCreate=!showCreate"><Icon :name="showCreate?'lucide:x':'lucide:plus'" aria-hidden="true" />{{showCreate?'Sluiten':'Nieuwe pagina'}}</button>
    </header>

    <form v-if="showCreate" class="create-card" @submit.prevent="createPage">
      <h2>Nieuwe landing page</h2>
      <div class="grid">
        <label>Slug<input v-model="form.slug" required placeholder="festival-dj"></label>
        <label>Label in navigatie<input v-model="form.navLabel" required></label>
        <label class="wide">Titel<input v-model="form.title" required></label>
        <label>Bovenregel<input v-model="form.eyebrow" required></label>
        <label>CTA-tekst<input v-model="form.ctaLabel" required></label>
        <label class="wide">Intro<textarea v-model="form.intro" rows="3" required/></label>
        <label class="wide">Tekst<textarea v-model="form.body" rows="5" required/></label>
        <label class="wide">SEO-titel<input v-model="form.seoTitle" required></label>
        <label class="wide">SEO-beschrijving<textarea v-model="form.seoDescription" rows="2" required/></label>
        <label>Volgorde<input v-model.number="form.ordering" type="number" min="0"></label>
      </div>
      <div class="toggles">
        <label><input v-model="form.published" type="checkbox"> Gepubliceerd</label>
        <label><input v-model="form.showInNavigation" type="checkbox"> Tonen in navigatie</label>
        <label><input v-model="form.indexable" type="checkbox"> Vindbaar in zoekmachines</label>
      </div>
      <p v-if="errorMessage" class="error">{{errorMessage}}</p>
      <button class="primary" type="submit" :disabled="saving">{{saving?'Aanmaken…':'Pagina aanmaken'}}</button>
    </form>

    <div v-if="status==='pending'" class="empty">Landing pages laden…</div>
    <div v-else-if="!data?.pages.length" class="empty">Nog geen landing pages.</div>
    <div v-else class="page-list">
      <NuxtLink v-for="page in data.pages" :key="page.id" :to="`/admin/landing-pages/${page.id}`" class="row">
        <div class="copy"><strong>{{page.navLabel}}</strong><span>/diensten/{{page.slug}}</span></div>
        <div class="flags">
          <span :class="{on:page.published}">{{page.published?'Gepubliceerd':'Concept'}}</span>
          <span :class="{on:page.showInNavigation}">{{page.showInNavigation?'In navigatie':'Niet in navigatie'}}</span>
          <span :class="{on:page.indexable}">{{page.indexable?'Index':'Noindex'}}</span>
        </div>
      </NuxtLink>
    </div>
  </div>
</template>

<style scoped>
.landing-admin{max-width:1000px;margin-inline:auto}.page-header{display:flex;align-items:end;justify-content:space-between;gap:1rem;margin-bottom:1.5rem}h1{margin:.2rem 0;font-size:clamp(2.5rem,6vw,4rem);letter-spacing:-.05em}.page-header p:last-child{margin:0;color:#8e8797}.primary{border:0;border-radius:.7rem;padding:.75rem 1rem;background:#fff;color:#09080b;font-weight:800;cursor:pointer}.create-card{margin-bottom:1rem;padding:1.2rem;border:1px solid #2b2631;border-radius:1rem;background:#100e14}.create-card h2{margin-top:0}.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:.8rem}.wide{grid-column:1/-1}label{display:grid;gap:.35rem;color:#aaa4b1;font-size:.8rem}input,textarea{width:100%;border:1px solid #332e39;border-radius:.65rem;padding:.72rem;background:#0b0a0d;color:#f6f3fa}.toggles{display:flex;gap:1rem;flex-wrap:wrap;margin:1rem 0}.toggles label{display:flex;align-items:center;gap:.4rem}.toggles input{width:auto}.page-list{overflow:hidden;border:1px solid #292530;border-radius:1rem}.row{display:flex;justify-content:space-between;gap:1rem;align-items:center;padding:1rem;border-bottom:1px solid #242029;text-decoration:none}.row:last-child{border-bottom:0}.row:hover{background:#141119}.copy strong,.copy span{display:block}.copy span{margin-top:.2rem;color:#76707d;font-size:.78rem}.flags{display:flex;gap:.35rem;flex-wrap:wrap;justify-content:flex-end}.flags span{padding:.2rem .45rem;border-radius:999px;background:#241f29;color:#77717e;font-size:.66rem;text-transform:uppercase}.flags span.on{background:#14251d;color:#9be6ba}.empty{padding:2rem;border:1px dashed #302a38;border-radius:1rem;color:#817a8b}.error{color:#ff9daa}@media(max-width:700px){.page-header{align-items:start;flex-direction:column}.grid{grid-template-columns:1fr}.wide{grid-column:auto}.row{align-items:start;flex-direction:column}.flags{justify-content:flex-start}.primary{width:100%}}
</style>
