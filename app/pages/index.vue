<script setup lang="ts">
definePageMeta({ layout: 'public' })
const { data } = await useSiteContent()
const content = computed(() => data.value?.content)

const heroStyle = computed(() => content.value?.heroImageUrl
  ? { backgroundImage: `linear-gradient(90deg, rgba(7,7,9,.92), rgba(7,7,9,.42)), url("${content.value.heroImageUrl}")` }
  : undefined)

useSeoMeta({
  title: () => content.value?.seoTitle || 'DJ NightLight',
  description: () => content.value?.seoDescription,
  ogTitle: () => content.value?.seoTitle,
  ogDescription: () => content.value?.seoDescription,
  ogImage: () => content.value?.seoImageUrl || undefined,
})
</script>

<template>
  <div v-if="content">
    <section class="hero" :style="heroStyle">
      <div class="public-container hero-inner">
        <p class="eyebrow">{{ content.heroEyebrow }}</p>
        <h1>{{ content.heroTitle }}</h1>
        <p class="hero-copy">{{ content.heroBody }}</p>
        <div class="hero-actions">
          <NuxtLink class="public-button" to="/boeken">{{ content.heroCtaLabel }}</NuxtLink>
          <NuxtLink class="public-button secondary" to="/media">Bekijk media</NuxtLink>
        </div>
      </div>
      <div class="scroll-cue">Scroll ↓</div>
    </section>

    <section class="statement public-container">
      <p class="eyebrow">{{ content.aboutEyebrow }}</p>
      <h2>{{ content.aboutTitle }}</h2>
      <p>{{ content.aboutBody }}</p>
      <NuxtLink to="/about">Meer over NightLight →</NuxtLink>
    </section>

    <section class="services public-container">
      <article v-for="(service,index) in content.services" :key="service.title">
        <span>0{{ index + 1 }}</span>
        <h3>{{ service.title }}</h3>
        <p>{{ service.body }}</p>
      </article>
    </section>

    <section class="cta">
      <div class="public-container">
        <p class="eyebrow">{{ content.bookingEyebrow }}</p>
        <h2>{{ content.bookingTitle }}</h2>
        <p>{{ content.bookingBody }}</p>
        <NuxtLink class="public-button" to="/boeken">Vertel over je feest</NuxtLink>
      </div>
    </section>
  </div>
</template>

<style scoped>
.hero{position:relative;min-height:100svh;display:grid;align-items:end;padding:8rem 0 5rem;background-size:cover;background-position:center;overflow:hidden}.hero::before{content:"";position:absolute;width:55vw;height:55vw;right:-12vw;top:2vh;border-radius:50%;background:radial-gradient(circle,rgba(123,77,255,.24),transparent 67%);filter:blur(5px);pointer-events:none}.hero-inner{position:relative;z-index:1}.hero h1{max-width:12ch;margin:.4rem 0 1.3rem;font-size:clamp(4rem,12vw,10rem);line-height:.82;letter-spacing:-.075em}.hero-copy{max-width:41rem;margin:0;color:#b8b2bd;font-size:clamp(1rem,2vw,1.3rem);line-height:1.55}.hero-actions{display:flex;gap:.65rem;margin-top:2rem}.scroll-cue{position:absolute;right:clamp(1rem,4vw,3.5rem);bottom:2rem;color:#66616b;font-size:.7rem;letter-spacing:.12em;text-transform:uppercase}.statement{padding:8rem 0}.statement h2,.cta h2{max-width:13ch;margin:.4rem 0 1.4rem;font-size:clamp(2.8rem,7vw,6rem);line-height:.95;letter-spacing:-.06em}.statement>p:last-of-type{max-width:48rem;color:#9d97a3;font-size:1.08rem;line-height:1.75}.statement>a{display:inline-block;margin-top:1rem;color:#d6d1db}.services{display:grid;grid-template-columns:repeat(3,1fr);border-top:1px solid #252129;border-bottom:1px solid #252129}.services article{min-height:20rem;padding:1.5rem;border-right:1px solid #252129}.services article:last-child{border-right:0}.services span{color:#5f5964;font-size:.7rem}.services h3{margin:6rem 0 .7rem;font-size:1.7rem;letter-spacing:-.04em}.services p{color:#8f8995;line-height:1.65}.cta{padding:9rem 0;background:radial-gradient(circle at 70% 50%,rgba(85,46,180,.18),transparent 35%)}.cta p:not(.eyebrow){max-width:40rem;color:#97919d;line-height:1.7}.cta .public-button{margin-top:1.3rem}@media(max-width:760px){.hero{padding-bottom:3.5rem}.hero-actions{align-items:stretch;flex-direction:column}.scroll-cue{display:none}.statement{padding:5rem 0}.services{grid-template-columns:1fr}.services article{min-height:auto;border-right:0;border-bottom:1px solid #252129}.services article:last-child{border-bottom:0}.services h3{margin:3rem 0 .7rem}.cta{padding:6rem 0}}
</style>
