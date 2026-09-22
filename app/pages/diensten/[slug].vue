<script setup lang="ts">
definePageMeta({layout:'public'})
const route=useRoute()
const slug=String(route.params.slug)
const {data:site}=await useSiteContent()
const siteContent=computed(()=>site.value?.content)

type LandingPage = {
  slug:string
  navLabel:string
  eyebrow:string
  title:string
  intro:string
  body:string
  heroImageUrl:string|null
  ctaLabel:string
  ctaHref:string
  indexable:boolean
  seoTitle:string
  seoDescription:string
  seoImageUrl:string|null
}

const {data}=await useFetch<{page:LandingPage}>(`/api/public/landing-pages/${slug}`,{
  key:`landing-page-${slug}`,
})

if(!data.value){
  throw createError({statusCode:404,statusMessage:'Landing page not found'})
}

const page=computed(()=>data.value!.page)
const paragraphs=computed(()=>page.value.body.split(/\n{2,}/).map(value=>value.trim()).filter(Boolean))
const heroStyle=computed(()=>page.value.heroImageUrl
  ? {backgroundImage:`linear-gradient(90deg,rgba(7,7,9,.94),rgba(7,7,9,.5)),url("${page.value.heroImageUrl}")`}
  : undefined)
const externalCta=computed(()=>/^https?:\/\//.test(page.value.ctaHref))

useSeoMeta({
  title:()=>page.value.seoTitle,
  description:()=>page.value.seoDescription,
  robots:()=>page.value.indexable?'index, follow':'noindex, follow',
  ogTitle:()=>page.value.seoTitle,
  ogDescription:()=>page.value.seoDescription,
  ogImage:()=>page.value.seoImageUrl||undefined,
})
</script>

<template>
  <main>
    <section class="landing-hero" :style="heroStyle">
      <div class="public-container">
        <p class="eyebrow">{{page.eyebrow}}</p>
        <h1>{{page.title}}</h1>
        <p class="intro">{{page.intro}}</p>
        <a v-if="externalCta" class="public-button" :href="page.ctaHref" target="_blank" rel="noreferrer">{{page.ctaLabel}}</a>
        <NuxtLink v-else class="public-button" :to="page.ctaHref">{{page.ctaLabel}}</NuxtLink>
      </div>
    </section>

    <section class="landing-body public-container">
      <div class="body-copy">
        <p v-for="(paragraph,index) in paragraphs" :key="index">{{paragraph}}</p>
      </div>
      <aside>
        <span>{{ siteContent?.publicCopy.landing.asideEyebrow }}</span>
        <strong>{{ siteContent?.publicCopy.landing.asideTitle }}</strong>
        <p>{{ siteContent?.publicCopy.landing.asideBody }}</p>
        <NuxtLink to="/boeken">{{ siteContent?.publicCopy.landing.asideCta }}</NuxtLink>
      </aside>
    </section>
  </main>
</template>

<style scoped>
.landing-hero{min-height:78svh;display:grid;align-items:end;padding:10rem 0 5rem;background-size:cover;background-position:center}.landing-hero h1{max-width:13ch;margin:.4rem 0 1.2rem;font-size:clamp(3.5rem,9vw,8rem);line-height:.88;letter-spacing:-.07em}.intro{max-width:42rem;color:#aaa4af;font-size:clamp(1.05rem,2vw,1.3rem);line-height:1.65}.public-button{margin-top:1.4rem}.landing-body{display:grid;grid-template-columns:1.3fr .7fr;gap:clamp(2rem,8vw,8rem);padding-top:7rem;padding-bottom:8rem}.body-copy{font-size:clamp(1.08rem,2vw,1.3rem);line-height:1.8;color:#aaa4af}.body-copy p:first-child{margin-top:0}.landing-body aside{align-self:start;padding:1.3rem;border-left:1px solid #302b34}.landing-body aside span{color:#6e6873;font-size:.7rem;letter-spacing:.1em;text-transform:uppercase}.landing-body aside strong{display:block;margin:.7rem 0;font-size:1.35rem}.landing-body aside p{color:#85808a;line-height:1.6}.landing-body aside a{display:inline-block;margin-top:.7rem;color:#c8c2cc}@media(max-width:760px){.landing-hero{min-height:70svh;padding-bottom:3rem}.landing-body{grid-template-columns:1fr;padding-top:4rem;padding-bottom:5rem}.landing-body aside{border-left:0;border-top:1px solid #302b34}}
</style>
