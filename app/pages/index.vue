<script setup lang="ts">
definePageMeta({ layout: 'public' })

const { data } = await useSiteContent()
const content = computed(() => data.value?.content)

type RecentGig = {
  title: string
  description: string | null
  startsAt: string
  venue: string | null
  city: string | null
}

const { data: recentGigData } = await useFetch<{ gigs: RecentGig[] }>('/api/public/recent-gigs', {
  key: 'home-recent-gigs',
})

function recentGigDate(value: string) {
  return new Intl.DateTimeFormat('nl-NL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value)).replace('.', '')
}

function recentGigLocation(gig: RecentGig) {
  // A gig without a public title is already named after its venue.
  return [gig.venue === gig.title ? null : gig.venue, gig.city].filter(Boolean).join(' · ')
}

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
      <div class="hero-electric" aria-hidden="true" />
      <div class="public-container hero-inner">
        <p class="eyebrow">{{ content.heroEyebrow }}</p>
        <h1>{{ content.heroTitle }}</h1>
        <p class="hero-copy">{{ content.heroBody }}</p>
        <div class="hero-actions">
          <NuxtLink class="public-button" to="/boeken">{{ content.heroCtaLabel }} <Icon name="lucide:arrow-right" aria-hidden="true" /></NuxtLink>
          <NuxtLink class="public-button secondary" to="/media">{{ content.publicCopy.home.secondaryCta }}</NuxtLink>
        </div>
      </div>
      <p class="hero-caption">{{ content.publicCopy.home.heroCaption }}</p>
      <div class="scroll-cue">{{ content.publicCopy.home.scrollLabel }} <Icon name="lucide:arrow-down" aria-hidden="true" /></div>
    </section>

    <section class="visual-beat" :aria-label="content.publicCopy.home.visualEyebrow">
      <div class="visual-heading public-container">
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
        <h2>{{ content.aboutTitle }}</h2>
        <p>{{ content.aboutBody }}</p>
        <NuxtLink to="/about">{{ content.publicCopy.home.aboutCta }} <Icon name="lucide:arrow-right" aria-hidden="true" /></NuxtLink>
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
        <article v-for="(service,index) in content.services" :key="service.title" class="service-story" :class="{ featured: index === 0 }">
          <div class="service-image">
            <img :src="serviceVisuals[index]?.url" :alt="serviceVisuals[index]?.alt || service.title" loading="lazy">
          </div>
          <div class="service-copy">
            <span>0{{ index + 1 }}</span>
            <h3>{{ service.title }}</h3>
            <p>{{ service.body }}</p>
          </div>
        </article>
      </div>
    </section>

    <section v-if="recentGigData?.gigs.length" class="recent-nights public-container" aria-labelledby="recent-nights-title">
      <div class="recent-nights-intro">
        <p class="eyebrow">Recent gedraaid</p>
        <h2 id="recent-nights-title">Een paar recente openbare boekingen.</h2>
        <p>Alleen boekingen die je zelf als openbaar markeert worden hier getoond.</p>
      </div>

      <div class="recent-nights-list">
        <article v-for="(gig,index) in recentGigData.gigs" :key="`${gig.startsAt}-${gig.title}`" class="recent-night">
          <div class="recent-night-meta">
            <span>0{{ index + 1 }}</span>
            <time :datetime="gig.startsAt">{{ recentGigDate(gig.startsAt) }}</time>
          </div>
          <div>
            <p v-if="recentGigLocation(gig)" class="recent-night-location">{{ recentGigLocation(gig) }}</p>
            <h3>{{ gig.title }}</h3>
            <p v-if="gig.description" class="recent-night-description">{{ gig.description }}</p>
          </div>
        </article>
      </div>
    </section>

    <section class="proof-shell">
      <div class="proof public-container">
        <p class="eyebrow">{{ content.publicCopy.home.proofEyebrow }}</p>
        <div class="proof-main">
          <blockquote>“{{ content.publicCopy.home.proofQuote }}”</blockquote>
          <ul class="proof-types" aria-label="Soorten optredens">
            <li v-for="tag in content.publicCopy.home.proofTags" :key="tag">{{ tag }}</li>
          </ul>
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
          <NuxtLink class="public-button" to="/boeken">{{ content.publicCopy.home.bookingCta }} <Icon name="lucide:arrow-right" aria-hidden="true" /></NuxtLink>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.hero{position:relative;min-height:96svh;display:grid;align-items:end;padding:8rem 0 4.5rem;background-size:cover;background-position:center 42%;overflow:hidden}.hero::before{content:"";position:absolute;inset:0;background:radial-gradient(circle at 78% 36%,rgba(120,72,255,.2),transparent 36%);pointer-events:none}.hero-noise{position:absolute;inset:0;opacity:.12;pointer-events:none;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.22'/%3E%3C/svg%3E")}.hero-electric{position:absolute;z-index:1;top:4.3rem;left:-3rem;width:min(30rem,45vw);height:9rem;background:url("/brand/logo/wordmark-arcs.webp") left center/contain no-repeat;opacity:.13;filter:drop-shadow(0 0 1.2rem rgba(157,92,255,.3));pointer-events:none}.hero-inner{position:relative;z-index:1;padding-bottom:clamp(1rem,4vh,4rem)}.hero h1{max-width:11ch;margin:.45rem 0 1.25rem;font-size:clamp(3.6rem,9vw,8rem);line-height:.86;letter-spacing:-.07em;text-wrap:balance}.hero-copy{max-width:40rem;margin:0;color:#c1bbc6;font-size:clamp(1rem,1.45vw,1.2rem);line-height:1.58;text-shadow:0 1px 1.5rem rgba(0,0,0,.75)}.hero-actions{display:flex;gap:.65rem;margin-top:2rem}.hero-caption{position:absolute;z-index:1;right:clamp(1rem,4vw,3.5rem);bottom:4.8rem;margin:0;max-width:16rem;color:#8f8996;font-size:.72rem;line-height:1.5;text-align:right;text-transform:uppercase;letter-spacing:.12em}.scroll-cue{position:absolute;z-index:1;right:clamp(1rem,4vw,3.5rem);bottom:2rem;color:#77717d;font-size:.68rem;letter-spacing:.12em;text-transform:uppercase}

.visual-beat{position:relative;padding:5.5rem 0 2rem}.visual-beat::before{content:"";position:absolute;top:3.35rem;right:0;width:min(8rem,22vw);height:1px;background:linear-gradient(90deg,transparent,var(--electric-accent));box-shadow:0 0 .65rem rgba(157,92,255,.28)}.visual-heading{display:flex;justify-content:flex-end;margin-bottom:1.4rem}.visual-heading>p{max-width:31rem;margin:0;color:#8f8995;font-size:.94rem;line-height:1.55}.visual-beat figure{position:relative;width:100%;margin:0;overflow:hidden;background:#111014}.visual-beat img{display:block;width:100%;height:min(68vh,52rem);object-fit:cover;filter:saturate(.9) contrast(1.04)}.visual-beat figure::after{content:"";position:absolute;inset:0;background:linear-gradient(0deg,rgba(7,7,9,.75),transparent 52%)}.visual-beat figcaption{position:absolute;z-index:1;left:max(clamp(1.2rem,4vw,4rem),calc((100vw - 1400px)/2));right:max(clamp(1.2rem,4vw,4rem),calc((100vw - 1400px)/2));bottom:clamp(1.5rem,4vw,3.5rem);display:flex;align-items:end;justify-content:space-between;gap:1rem}.visual-beat figcaption span{font-size:.7rem;color:#aaa3af}.visual-beat figcaption strong{max-width:22ch;font-size:clamp(1.3rem,2.5vw,2.35rem);line-height:1.03;letter-spacing:-.04em;text-align:right}

.statement{display:grid;grid-template-columns:minmax(17rem,.72fr) minmax(0,1.18fr);gap:clamp(3rem,8vw,8rem);align-items:start;padding:8rem 0 7rem}.statement-copy{grid-column:2;max-width:48rem;padding-top:clamp(1rem,5vw,4.5rem)}.statement h2{max-width:17ch;margin:0 0 1.35rem;font-size:clamp(2.15rem,3.9vw,3.85rem);line-height:1;letter-spacing:-.05em;text-wrap:balance}.cta h2{max-width:13ch;margin:.4rem 0 0;font-size:clamp(2.8rem,5.4vw,5.2rem);line-height:.94;letter-spacing:-.06em;text-wrap:balance}.statement-copy>p:last-of-type{max-width:42rem;color:#aaa4af;font-size:1rem;line-height:1.78}.statement-copy>a{display:inline-block;margin-top:1.15rem;padding-bottom:.18rem;border-bottom:1px solid rgba(157,92,255,.36);color:#d6d1db;text-decoration:none}.statement-visual{grid-column:1;grid-row:1;margin:0;background:transparent}.statement-visual img{display:block;width:100%;aspect-ratio:4/5;object-fit:cover;border-radius:.35rem}.statement-visual figcaption{max-width:28rem;margin:.85rem 0 0;color:#817b86;font-size:.78rem;line-height:1.55}

.services-shell{padding:1.5rem 0 7rem}.services-heading{display:flex;justify-content:space-between;gap:2rem;align-items:end;margin-bottom:2rem}.services-heading>p:last-child{max-width:30rem;margin:0;color:#8f8995;font-size:.94rem;line-height:1.55}.services{display:grid;grid-template-columns:minmax(0,1.08fr) minmax(22rem,.92fr);grid-template-rows:repeat(2,minmax(0,1fr));gap:2.5rem clamp(2.5rem,5vw,5rem)}.service-story{display:grid;grid-template-columns:minmax(9rem,.82fr) minmax(0,1.18fr);gap:1.35rem;align-items:start;padding-top:1rem;border-top:1px solid #2b2730;transition:border-color .25s ease}.service-story:hover{border-top-color:rgba(157,92,255,.34)}.service-story.featured{grid-row:1/3;grid-template-columns:1fr;grid-template-rows:auto auto;gap:1.25rem}.service-image{overflow:hidden;background:#111014}.service-image img{display:block;width:100%;height:100%;min-height:13rem;object-fit:cover;transition:transform .7s cubic-bezier(.2,.7,.2,1)}.service-story:not(.featured) .service-image{aspect-ratio:4/3}.service-story.featured .service-image{aspect-ratio:4/5;max-height:42rem}.service-story:hover .service-image img{transform:scale(1.025)}.service-copy{align-self:start}.service-copy span{display:block;margin-bottom:1.1rem;color:#716b77;font-size:.68rem;letter-spacing:.08em}.service-copy h3{margin:0 0 .7rem;font-size:clamp(1.45rem,2.3vw,2.25rem);line-height:1;letter-spacing:-.045em}.service-story.featured .service-copy h3{font-size:clamp(2rem,3.3vw,3.35rem)}.service-copy p{max-width:34rem;margin:0;color:#a7a1ac;font-size:.94rem;line-height:1.62}

.recent-nights{display:grid;grid-template-columns:minmax(16rem,.58fr) minmax(0,1.2fr);gap:clamp(3rem,8vw,8rem);padding:3rem 0 7rem}.recent-nights-intro{position:sticky;top:7rem;align-self:start}.recent-nights-intro h2{margin:.65rem 0 1rem;font-size:clamp(2rem,3.4vw,3.4rem);line-height:1;letter-spacing:-.05em}.recent-nights-intro>p:last-child{max-width:28rem;margin:0;color:#8e8893;line-height:1.65}.recent-nights-list{border-top:1px solid #2a2630}.recent-night{display:grid;grid-template-columns:8.5rem minmax(0,1fr);gap:clamp(1rem,3vw,2.5rem);padding:2rem 0 2.2rem;border-bottom:1px solid #2a2630}.recent-night-meta{display:flex;flex-direction:column;gap:.45rem;color:#716b77;font-size:.72rem;letter-spacing:.08em;text-transform:uppercase}.recent-night-meta span{color:var(--electric-accent);text-shadow:0 0 .7rem rgba(157,92,255,.18)}.recent-night-location{margin:0 0 .45rem;color:#817a87;font-size:.76rem;letter-spacing:.05em;text-transform:uppercase}.recent-night h3{margin:0;font-size:clamp(1.55rem,2.7vw,2.65rem);line-height:1;letter-spacing:-.045em}.recent-night-description{max-width:46rem;margin:.75rem 0 0;color:#aaa4af;line-height:1.65}

.proof-shell{border-top:1px solid #252129;border-bottom:1px solid #1a181d;background:radial-gradient(circle at 82% 30%,rgba(109,40,217,.07),transparent 24rem),#09090b}.proof{display:grid;grid-template-columns:minmax(10rem,.35fr) minmax(0,1fr);gap:clamp(2rem,8vw,8rem);align-items:start;padding:5.75rem 0 6.25rem}.proof>.eyebrow{margin-top:.45rem}.proof-main{max-width:62rem}.proof blockquote{max-width:25ch;margin:0 0 2.75rem;font-size:clamp(2rem,3.6vw,3.55rem);line-height:1.04;letter-spacing:-.045em;font-weight:800}.proof-types{display:flex;flex-wrap:wrap;gap:.45rem 0;margin:0;padding:0;list-style:none;color:#7f7884;font-size:.78rem;letter-spacing:.035em}.proof-types li+li::before{content:"·";margin:0 .7rem;color:#4f4953}

.cta{padding:6.5rem 0;background:radial-gradient(circle at 76% 50%,rgba(100,54,218,.21),transparent 31%),linear-gradient(180deg,#09080b,#08080a)}.cta-inner{display:grid;grid-template-columns:1fr .68fr;gap:clamp(2rem,8vw,8rem);align-items:end}.cta h2{margin-bottom:0}.cta-copy p{max-width:38rem;color:#aaa4af;line-height:1.7}.cta-copy .public-button{margin-top:1rem}

@media(max-width:900px){.statement{grid-template-columns:minmax(14rem,.7fr) minmax(0,1fr);gap:2.5rem;padding:5.5rem 0}.statement-copy{padding-top:1rem}.recent-nights{grid-template-columns:1fr;gap:2rem;padding-bottom:5.5rem}.recent-nights-intro{position:static;max-width:38rem}.proof{grid-template-columns:1fr;gap:1.25rem}.services{grid-template-columns:1fr;grid-template-rows:auto;gap:2.5rem}.service-story.featured{grid-row:auto;grid-template-columns:minmax(15rem,.8fr) minmax(0,1.2fr);grid-template-rows:auto}.service-story.featured .service-image{aspect-ratio:4/5;max-height:31rem}.cta-inner{grid-template-columns:1fr}.hero-caption{display:none}}
@media(max-width:700px){.hero{min-height:88svh;padding:7rem 0 3.25rem;background-position:64% center}.hero::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,rgba(7,7,9,.8),rgba(7,7,9,.2))}.hero-inner{z-index:2}.hero h1{font-size:clamp(3.25rem,16vw,5.8rem)}.hero-actions{align-items:stretch;flex-direction:column;max-width:18rem}.scroll-cue{display:none}.visual-beat{padding-top:3.75rem}.visual-heading,.services-heading{display:block}.visual-heading>p,.services-heading>p:last-child{margin-top:.7rem}.visual-beat img{height:52vh}.visual-beat figcaption{display:block;left:1.2rem;right:1.2rem;bottom:1.2rem}.visual-beat figcaption strong{display:block;max-width:18ch;margin-top:.5rem;text-align:left}.statement{grid-template-columns:1fr;padding:4.75rem 0}.statement-copy{grid-column:1;grid-row:1;padding-top:0}.statement-visual{grid-column:1;grid-row:2;max-width:80%;margin-left:auto}.statement-visual img{aspect-ratio:4/5}.services-shell{padding-bottom:4rem}.recent-night{grid-template-columns:1fr;gap:.9rem}.recent-night-meta{flex-direction:row;justify-content:space-between}.recent-nights{padding-top:1rem}.services{grid-template-columns:1fr;gap:2.25rem}.service-story,.service-story.featured{grid-template-columns:1fr;grid-template-rows:auto;gap:1rem}.service-story:not(.featured) .service-image,.service-story.featured .service-image{aspect-ratio:16/10;max-height:none}.service-copy span{margin-bottom:.7rem}.proof{padding:4rem 0 4.75rem}.proof blockquote{margin-bottom:2rem}.cta{padding:4.75rem 0}}
@media(prefers-reduced-motion:reduce){.services img,.service-story{transition:none}}
</style>
