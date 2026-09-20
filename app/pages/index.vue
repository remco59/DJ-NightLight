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

const featureVisual = computed(() => uploadedVisuals.value[1] || uploadedVisuals.value[0] || crowdFallback)

const serviceVisuals = computed(() => {
  const sources = uploadedVisuals.value.length >= 3 ? uploadedVisuals.value : fallbackVisuals.slice(1)
  return (content.value?.services ?? []).map((_, index) => sources[index % sources.length] || clubFallback)
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
          <NuxtLink class="public-button secondary" to="/media">Bekijk media</NuxtLink>
        </div>
      </div>
      <p class="hero-caption">NightLight · van achtergrond naar dansvloer</p>
      <div class="scroll-cue">Scroll ↓</div>
    </section>

    <section class="visual-beat public-container" aria-label="NightLight in de zaal">
      <div class="visual-heading">
        <p class="eyebrow">NightLight in de zaal</p>
        <p>De avond in beeld — donker, dichtbij en midden in de energie.</p>
      </div>
      <figure>
        <img :src="featureVisual.url" :alt="featureVisual.alt" loading="lazy">
        <figcaption>
          <span>01</span>
          <strong>Lees de ruimte. Bouw het moment.</strong>
        </figcaption>
      </figure>
    </section>

    <section class="statement public-container">
      <div class="statement-copy">
        <p class="eyebrow">{{ content.aboutEyebrow }}</p>
        <h2>{{ content.aboutTitle }}</h2>
        <p>{{ content.aboutBody }}</p>
        <NuxtLink to="/about">Meer over NightLight →</NuxtLink>
      </div>
      <figure class="statement-visual">
        <img :src="heroVisual.url" :alt="heroVisual.alt" loading="lazy">
        <figcaption>Geen vaste setlist. Wel een duidelijke lijn door de avond.</figcaption>
      </figure>
    </section>

    <section class="services-shell">
      <div class="public-container services-heading">
        <p class="eyebrow">Voor elke zaal een andere energie</p>
        <p>De muziek verandert met het publiek. De aandacht voor opbouw blijft hetzelfde.</p>
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

    <section class="proof public-container">
      <p class="eyebrow">NightLight</p>
      <blockquote>“Niet vooraf bepalen waar de avond heen moet. Eerst voelen waar de zaal klaar voor is.”</blockquote>
      <div class="proof-tags" aria-label="Soorten optredens">
        <span>Bruiloften</span>
        <span>Clubs</span>
        <span>Studentenfeesten</span>
        <span>Bedrijfsfeesten</span>
        <span>Privé-events</span>
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
          <NuxtLink class="public-button" to="/boeken">Vertel over je feest</NuxtLink>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.hero{position:relative;min-height:100svh;display:grid;align-items:end;padding:9rem 0 5rem;background-size:cover;background-position:center 42%;overflow:hidden}.hero::before{content:"";position:absolute;inset:0;background:radial-gradient(circle at 78% 36%,rgba(120,72,255,.2),transparent 36%);pointer-events:none}.hero-noise{position:absolute;inset:0;opacity:.12;pointer-events:none;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.22'/%3E%3C/svg%3E")}.hero-inner{position:relative;z-index:1;padding-bottom:clamp(1rem,4vh,4rem)}.hero h1{max-width:11ch;margin:.45rem 0 1.4rem;font-size:clamp(4rem,10.5vw,9.5rem);line-height:.84;letter-spacing:-.075em;text-wrap:balance}.hero-copy{max-width:43rem;margin:0;color:#c1bbc6;font-size:clamp(1.05rem,1.7vw,1.32rem);line-height:1.58;text-shadow:0 1px 1.5rem rgba(0,0,0,.75)}.hero-actions{display:flex;gap:.65rem;margin-top:2rem}.hero-caption{position:absolute;z-index:1;right:clamp(1rem,4vw,3.5rem);bottom:4.8rem;margin:0;max-width:16rem;color:#8f8996;font-size:.72rem;line-height:1.5;text-align:right;text-transform:uppercase;letter-spacing:.12em}.scroll-cue{position:absolute;z-index:1;right:clamp(1rem,4vw,3.5rem);bottom:2rem;color:#77717d;font-size:.68rem;letter-spacing:.12em;text-transform:uppercase}

.visual-beat{padding:7rem 0 2rem}.visual-heading{display:flex;justify-content:space-between;gap:2rem;align-items:end;margin-bottom:1.4rem}.visual-heading>p:last-child{max-width:34rem;margin:0;color:#8f8995;line-height:1.55}.visual-beat figure{position:relative;margin:0;overflow:hidden;border-radius:1.2rem;background:#111014}.visual-beat img{display:block;width:100%;height:min(68vh,52rem);object-fit:cover;filter:saturate(.9) contrast(1.04)}.visual-beat figure::after{content:"";position:absolute;inset:0;background:linear-gradient(0deg,rgba(7,7,9,.78),transparent 48%)}.visual-beat figcaption{position:absolute;z-index:1;left:clamp(1.2rem,3vw,2.5rem);right:clamp(1.2rem,3vw,2.5rem);bottom:clamp(1.2rem,3vw,2.2rem);display:flex;align-items:end;justify-content:space-between;gap:1rem}.visual-beat figcaption span{font-size:.7rem;color:#aaa3af}.visual-beat figcaption strong{max-width:13ch;font-size:clamp(1.6rem,4vw,3.4rem);line-height:.95;letter-spacing:-.05em;text-align:right}

.statement{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(20rem,.7fr);gap:clamp(3rem,8vw,8rem);align-items:center;padding:9rem 0}.statement h2,.cta h2{max-width:12ch;margin:.4rem 0 1.4rem;font-size:clamp(3rem,6.8vw,6.2rem);line-height:.93;letter-spacing:-.065em;text-wrap:balance}.statement-copy>p:last-of-type{max-width:44rem;color:#9d97a3;font-size:1.08rem;line-height:1.75}.statement-copy>a{display:inline-block;margin-top:1rem;color:#d6d1db}.statement-visual{position:relative;margin:0;overflow:hidden;border-radius:1rem;min-height:34rem;background:#111014}.statement-visual img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}.statement-visual::after{content:"";position:absolute;inset:0;background:linear-gradient(0deg,rgba(7,7,9,.82),transparent 48%)}.statement-visual figcaption{position:absolute;z-index:1;left:1.2rem;right:1.2rem;bottom:1.1rem;color:#d5d0d9;font-size:.85rem;line-height:1.45}

.services-shell{padding:2rem 0 8rem}.services-heading{display:flex;justify-content:space-between;gap:2rem;align-items:end;margin-bottom:1.5rem}.services-heading>p:last-child{max-width:32rem;margin:0;color:#8f8995;line-height:1.55}.services{display:grid;grid-template-columns:repeat(3,1fr);gap:.9rem}.services article{position:relative;min-height:34rem;overflow:hidden;border-radius:1rem;background:#111014}.services article::after{content:"";position:absolute;inset:0;border:1px solid rgba(255,255,255,.08);border-radius:inherit;pointer-events:none}.services img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transition:transform .7s cubic-bezier(.2,.7,.2,1)}.services article:hover img{transform:scale(1.035)}.service-overlay{position:absolute;inset:0;background:linear-gradient(0deg,rgba(7,7,9,.94) 4%,rgba(7,7,9,.52) 48%,rgba(7,7,9,.08) 78%)}.service-copy{position:absolute;z-index:1;left:1.4rem;right:1.4rem;bottom:1.5rem}.service-copy span{color:#aaa3af;font-size:.68rem}.service-copy h3{margin:3.8rem 0 .7rem;font-size:clamp(1.7rem,2.5vw,2.4rem);line-height:1;letter-spacing:-.045em}.service-copy p{margin:0;color:#b0aab5;line-height:1.6}

.proof{padding:7rem 0 9rem;border-top:1px solid #252129}.proof blockquote{max-width:17ch;margin:1rem 0 3rem;font-size:clamp(2.6rem,6vw,5.8rem);line-height:.98;letter-spacing:-.06em;font-weight:800}.proof-tags{display:flex;gap:.65rem;flex-wrap:wrap}.proof-tags span{padding:.62rem .85rem;border:1px solid #302b34;border-radius:999px;color:#aaa4af;font-size:.78rem}

.cta{padding:9rem 0;background:radial-gradient(circle at 76% 50%,rgba(100,54,218,.21),transparent 31%),linear-gradient(180deg,#09080b,#08080a)}.cta-inner{display:grid;grid-template-columns:1fr .68fr;gap:clamp(2rem,8vw,8rem);align-items:end}.cta h2{margin-bottom:0}.cta-copy p{max-width:38rem;color:#aaa4af;line-height:1.7}.cta-copy .public-button{margin-top:1rem}

@media(max-width:900px){.statement{grid-template-columns:1fr}.statement-visual{min-height:28rem}.services{grid-template-columns:1fr 1fr}.services article:last-child{grid-column:1/-1;min-height:28rem}.cta-inner{grid-template-columns:1fr}.hero-caption{display:none}}
@media(max-width:700px){.hero{min-height:92svh;padding:8rem 0 3.5rem;background-position:64% center}.hero::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,rgba(7,7,9,.8),rgba(7,7,9,.2))}.hero-inner{z-index:2}.hero-actions{align-items:stretch;flex-direction:column;max-width:18rem}.scroll-cue{display:none}.visual-beat{padding-top:4.5rem}.visual-heading,.services-heading{display:block}.visual-heading>p:last-child,.services-heading>p:last-child{margin-top:.75rem}.visual-beat img{height:55vh}.visual-beat figcaption{display:block}.visual-beat figcaption strong{display:block;margin-top:.5rem;text-align:left}.statement{padding:6rem 0}.statement-visual{min-height:24rem}.services-shell{padding-bottom:5rem}.services{grid-template-columns:1fr}.services article,.services article:last-child{grid-column:auto;min-height:28rem}.proof{padding:5rem 0 6rem}.cta{padding:6rem 0}}
@media(prefers-reduced-motion:reduce){.services img{transition:none}}
</style>
