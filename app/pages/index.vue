<script setup lang="ts">
definePageMeta({ layout: 'public' })

const { data } = await useSiteContent()
const content = computed(() => data.value?.content)

const heroFallback = {
  url: 'https://images.unsplash.com/photo-1763630055101-2f6d6305dc38?auto=format&fit=crop&w=2200&q=85',
  alt: 'DJ achter de booth met dansend publiek',
}
const crowdFallback = {
  url: 'https://images.unsplash.com/photo-1768054485751-bab2eda850b8?auto=format&fit=crop&w=1800&q=85',
  alt: 'Publiek onder blauwe en paarse podiumlichten',
}
const weddingFallback = {
  url: 'https://images.unsplash.com/photo-1769230383260-69026dbb3abf?auto=format&fit=crop&w=1600&q=85',
  alt: 'Dansend bruidspaar tussen feestlichten en confetti',
}
const clubFallback = {
  url: 'https://images.unsplash.com/photo-1774301810239-99502e33180e?auto=format&fit=crop&w=1600&q=85',
  alt: 'DJ voor een volle dansvloer',
}
const fallbackVisuals = [crowdFallback, weddingFallback, clubFallback]

const uploadedVisuals = computed(() => (content.value?.gallery ?? [])
  .filter(image => Boolean(image.url))
  .map(image => ({ url: image.url, alt: image.alt || 'NightLight sfeerbeeld' })))

const heroVisual = computed(() => content.value?.heroImageUrl
  ? { url: content.value.heroImageUrl, alt: 'DJ NightLight tijdens een optreden' }
  : uploadedVisuals.value[0] || heroFallback)

const featureVisual = computed(() => content.value?.publicCopy.visuals.homeFeatureImageUrl
  ? { url: content.value.publicCopy.visuals.homeFeatureImageUrl, alt: content.value.publicCopy.visuals.homeFeatureAlt }
  : uploadedVisuals.value[1] || uploadedVisuals.value[0] || crowdFallback)

const aboutVisual = computed(() => content.value?.publicCopy.visuals.homeAboutImageUrl
  ? { url: content.value.publicCopy.visuals.homeAboutImageUrl, alt: content.value.publicCopy.visuals.homeAboutAlt }
  : heroVisual.value)

const serviceVisuals = computed(() => {
  const sources = uploadedVisuals.value.length >= 3 ? uploadedVisuals.value : fallbackVisuals.slice(1)
  return (content.value?.services ?? []).map((service, index) => service.imageUrl
    ? { url: service.imageUrl, alt: service.imageAlt || service.title }
    : sources[index % sources.length] || clubFallback)
})

const heroStyle = computed(() => ({
  backgroundImage: `linear-gradient(90deg, rgba(7,7,9,.96) 0%, rgba(7,7,9,.74) 42%, rgba(7,7,9,.22) 76%, rgba(7,7,9,.48) 100%), linear-gradient(0deg, rgba(7,7,9,.88), transparent 45%), url("${heroVisual.value.url}")`,
}))

useSeoMeta({
  title: () => content.value?.seoTitle || 'DJ NightLight',
  description: () => content.value?.seoDescription,
  ogTitle: () => content.value?.seoTitle,
  ogDescription: () => content.value?.seoDescription,
  ogImage: () => content.value?.seoImageUrl || content.value?.heroImageUrl || heroVisual.value.url,
})
</script>

<template>
  <div v-if="content">
    <section class="hero" :style="heroStyle">
      <div class="hero-noise" aria-hidden="true" />
      <div class="public-container hero-inner">
        <p class="eyebrow">{{ content.heroEyebrow }}</p>
        <h1>{{ content.heroTitle }}</h1>
        <p class="hero-copy">{{ content.heroBody }}</p>
        <div class="hero-actions">
          <NuxtLink class="public-button" to="/boeken">{{ content.heroCtaLabel }}</NuxtLink>
          <NuxtLink class="public-button secondary" to="/media">{{ content.publicCopy.home.secondaryCta }}</NuxtLink>
        </div>
      </div>
      <p class="hero-caption">{{ content.publicCopy.home.heroCaption }}</p>
      <div class="scroll-cue">{{ content.publicCopy.home.scrollLabel }}</div>
    </section>

    <section class="visual-beat" :aria-label="content.publicCopy.home.visualEyebrow">
      <div class="visual-heading public-container">
        <p class="eyebrow">{{ content.publicCopy.home.visualEyebrow }}</p>
        <p>{{ content.publicCopy.home.visualBody }}</p>
      </div>
      <figure>
        <img :src="featureVisual.url" :alt="featureVisual.alt" loading="lazy">
        <figcaption>
          <span>01</span>
          <strong>{{ content.publicCopy.home.visualCaption }}</strong>
        </figcaption>
      </figure>
    </section>

    <section class="statement public-container">
      <div class="statement-copy">
        <p class="eyebrow">{{ content.aboutEyebrow }}</p>
        <h2>{{ content.aboutTitle }}</h2>
        <p>{{ content.aboutBody }}</p>
        <NuxtLink to="/about">{{ content.publicCopy.home.aboutCta }}</NuxtLink>
      </div>
      <figure class="statement-visual">
        <img :src="aboutVisual.url" :alt="aboutVisual.alt" loading="lazy">
        <figcaption>{{ content.publicCopy.home.aboutImageCaption }}</figcaption>
      </figure>
    </section>

    <section class="services-shell">
      <div class="public-container services-heading">
        <p class="eyebrow">{{ content.publicCopy.home.servicesEyebrow }}</p>
        <p>{{ content.publicCopy.home.servicesBody }}</p>
      </div>

      <div class="services public-container">
        <article v-for="(service,index) in content.services" :key="service.title">
          <img :src="serviceVisuals[index]?.url" :alt="serviceVisuals[index]?.alt || service.title" loading="lazy">
          <div class="service-overlay" />
          <div class="service-copy">
            <span>0{{ index + 1 }}</span>
            <h3>{{ service.title }}</h3>
            <p>{{ service.body }}</p>
          </div>
        </article>
      </div>
    </section>

    <section class="proof-shell">
      <div class="proof public-container">
        <p class="eyebrow">{{ content.publicCopy.home.proofEyebrow }}</p>
        <div class="proof-main">
          <blockquote>“{{ content.publicCopy.home.proofQuote }}”</blockquote>
          <div class="proof-tags" aria-label="Soorten optredens">
            <span v-for="tag in content.publicCopy.home.proofTags" :key="tag">{{ tag }}</span>
          </div>
        </div>
      </div>
    </section>

    <section class="cta">
      <div class="public-container cta-inner">
        <div>
          <p class="eyebrow">{{ content.bookingEyebrow }}</p>
          <h2>{{ content.bookingTitle }}</h2>
        </div>
        <div class="cta-copy">
          <p>{{ content.bookingBody }}</p>
          <NuxtLink class="public-button" to="/boeken">{{ content.publicCopy.home.bookingCta }}</NuxtLink>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.hero{position:relative;min-height:96svh;display:grid;align-items:end;padding:8rem 0 4.5rem;background-size:cover;background-position:center 42%;overflow:hidden}.hero::before{content:"";position:absolute;inset:0;background:radial-gradient(circle at 78% 36%,rgba(120,72,255,.2),transparent 36%);pointer-events:none}.hero-noise{position:absolute;inset:0;opacity:.12;pointer-events:none;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.22'/%3E%3C/svg%3E")}.hero-inner{position:relative;z-index:1;padding-bottom:clamp(1rem,4vh,4rem)}.hero h1{max-width:11ch;margin:.45rem 0 1.25rem;font-size:clamp(3.6rem,9vw,8rem);line-height:.86;letter-spacing:-.07em;text-wrap:balance}.hero-copy{max-width:40rem;margin:0;color:#c1bbc6;font-size:clamp(1rem,1.45vw,1.2rem);line-height:1.58;text-shadow:0 1px 1.5rem rgba(0,0,0,.75)}.hero-actions{display:flex;gap:.65rem;margin-top:2rem}.hero-caption{position:absolute;z-index:1;right:clamp(1rem,4vw,3.5rem);bottom:4.8rem;margin:0;max-width:16rem;color:#8f8996;font-size:.72rem;line-height:1.5;text-align:right;text-transform:uppercase;letter-spacing:.12em}.scroll-cue{position:absolute;z-index:1;right:clamp(1rem,4vw,3.5rem);bottom:2rem;color:#77717d;font-size:.68rem;letter-spacing:.12em;text-transform:uppercase}

.visual-beat{padding:5.5rem 0 2rem}.visual-heading{display:flex;justify-content:space-between;gap:2rem;align-items:end;margin-bottom:1.4rem}.visual-heading>p:last-child{max-width:31rem;margin:0;color:#8f8995;font-size:.94rem;line-height:1.55}.visual-beat figure{position:relative;width:100%;margin:0;overflow:hidden;background:#111014}.visual-beat img{display:block;width:100%;height:min(68vh,52rem);object-fit:cover;filter:saturate(.9) contrast(1.04)}.visual-beat figure::after{content:"";position:absolute;inset:0;background:linear-gradient(0deg,rgba(7,7,9,.75),transparent 52%)}.visual-beat figcaption{position:absolute;z-index:1;left:max(clamp(1.2rem,4vw,4rem),calc((100vw - 1400px)/2));right:max(clamp(1.2rem,4vw,4rem),calc((100vw - 1400px)/2));bottom:clamp(1.5rem,4vw,3.5rem);display:flex;align-items:end;justify-content:space-between;gap:1rem}.visual-beat figcaption span{font-size:.7rem;color:#aaa3af}.visual-beat figcaption strong{max-width:22ch;font-size:clamp(1.3rem,2.5vw,2.35rem);line-height:1.03;letter-spacing:-.04em;text-align:right}

.statement{display:grid;grid-template-columns:minmax(17rem,.72fr) minmax(0,1.18fr);gap:clamp(3rem,8vw,8rem);align-items:start;padding:8rem 0 7rem}.statement-copy{grid-column:2;max-width:48rem;padding-top:clamp(1rem,5vw,4.5rem)}.statement h2{max-width:17ch;margin:.55rem 0 1.35rem;font-size:clamp(2.15rem,3.9vw,3.85rem);line-height:1;letter-spacing:-.05em;text-wrap:balance}.cta h2{max-width:13ch;margin:.4rem 0 0;font-size:clamp(2.8rem,5.4vw,5.2rem);line-height:.94;letter-spacing:-.06em;text-wrap:balance}.statement-copy>p:last-of-type{max-width:42rem;color:#aaa4af;font-size:1rem;line-height:1.78}.statement-copy>a{display:inline-block;margin-top:1.15rem;color:#d6d1db}.statement-visual{grid-column:1;grid-row:1;margin:0;background:transparent}.statement-visual img{display:block;width:100%;aspect-ratio:4/5;object-fit:cover;border-radius:.35rem}.statement-visual figcaption{max-width:28rem;margin:.85rem 0 0;color:#817b86;font-size:.78rem;line-height:1.55}

.services-shell{padding:1.5rem 0 6rem}.services-heading{display:flex;justify-content:space-between;gap:2rem;align-items:end;margin-bottom:1.5rem}.services-heading>p:last-child{max-width:30rem;margin:0;color:#8f8995;font-size:.94rem;line-height:1.55}.services{display:grid;grid-template-columns:repeat(3,1fr);gap:.9rem}.services article{position:relative;min-height:27rem;overflow:hidden;border-radius:1rem;background:#111014}.services article::after{content:"";position:absolute;inset:0;border:1px solid rgba(255,255,255,.08);border-radius:inherit;pointer-events:none}.services img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transition:transform .7s cubic-bezier(.2,.7,.2,1)}.services article:hover img{transform:scale(1.035)}.service-overlay{position:absolute;inset:0;background:linear-gradient(0deg,rgba(7,7,9,.94) 4%,rgba(7,7,9,.52) 48%,rgba(7,7,9,.08) 78%)}.service-copy{position:absolute;z-index:1;left:1.4rem;right:1.4rem;bottom:1.5rem}.service-copy span{color:#aaa3af;font-size:.68rem}.service-copy h3{margin:2.6rem 0 .65rem;font-size:clamp(1.5rem,2vw,2.05rem);line-height:1;letter-spacing:-.04em}.service-copy p{margin:0;color:#b0aab5;font-size:.94rem;line-height:1.55}

.proof-shell{border-top:1px solid #252129;border-bottom:1px solid #1a181d;background:#09090b}.proof{display:grid;grid-template-columns:minmax(10rem,.35fr) minmax(0,1fr);gap:clamp(2rem,8vw,8rem);align-items:start;padding:5.75rem 0 6.25rem}.proof>.eyebrow{margin-top:.45rem}.proof-main{max-width:62rem}.proof blockquote{max-width:25ch;margin:0 0 2.75rem;font-size:clamp(2rem,3.6vw,3.55rem);line-height:1.04;letter-spacing:-.045em;font-weight:800}.proof-tags{display:flex;gap:.65rem;flex-wrap:wrap}.proof-tags span{padding:.62rem .85rem;border:1px solid #302b34;border-radius:999px;color:#aaa4af;font-size:.78rem}

.cta{padding:6.5rem 0;background:radial-gradient(circle at 76% 50%,rgba(100,54,218,.21),transparent 31%),linear-gradient(180deg,#09080b,#08080a)}.cta-inner{display:grid;grid-template-columns:1fr .68fr;gap:clamp(2rem,8vw,8rem);align-items:end}.cta h2{margin-bottom:0}.cta-copy p{max-width:38rem;color:#aaa4af;line-height:1.7}.cta-copy .public-button{margin-top:1rem}

@media(max-width:900px){.statement{grid-template-columns:minmax(14rem,.7fr) minmax(0,1fr);gap:2.5rem;padding:5.5rem 0}.statement-copy{padding-top:1rem}.proof{grid-template-columns:1fr;gap:1.25rem}.services{grid-template-columns:1fr 1fr}.services article:last-child{grid-column:1/-1;min-height:25rem}.cta-inner{grid-template-columns:1fr}.hero-caption{display:none}}
@media(max-width:700px){.hero{min-height:88svh;padding:7rem 0 3.25rem;background-position:64% center}.hero::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,rgba(7,7,9,.8),rgba(7,7,9,.2))}.hero-inner{z-index:2}.hero h1{font-size:clamp(3.25rem,16vw,5.8rem)}.hero-actions{align-items:stretch;flex-direction:column;max-width:18rem}.scroll-cue{display:none}.visual-beat{padding-top:3.75rem}.visual-heading,.services-heading{display:block}.visual-heading>p:last-child,.services-heading>p:last-child{margin-top:.7rem}.visual-beat img{height:52vh}.visual-beat figcaption{display:block;left:1.2rem;right:1.2rem;bottom:1.2rem}.visual-beat figcaption strong{display:block;max-width:18ch;margin-top:.5rem;text-align:left}.statement{grid-template-columns:1fr;padding:4.75rem 0}.statement-copy{grid-column:1;grid-row:1;padding-top:0}.statement-visual{grid-column:1;grid-row:2;max-width:80%;margin-left:auto}.statement-visual img{aspect-ratio:4/5}.services-shell{padding-bottom:4rem}.services{grid-template-columns:1fr}.services article,.services article:last-child{grid-column:auto;min-height:24rem}.proof{padding:4rem 0 4.75rem}.proof blockquote{margin-bottom:2rem}.cta{padding:4.75rem 0}}
@media(prefers-reduced-motion:reduce){.services img{transition:none}}
</style>
