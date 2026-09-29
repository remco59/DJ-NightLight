<script setup lang="ts">
definePageMeta({ layout: 'public' })

const route = useRoute()
const slug = String(route.params.slug)
const { data: site } = await useSiteContent()
const siteContent = computed(() => site.value?.content)

type LandingPage = {
  slug: string
  navLabel: string
  eyebrow: string
  title: string
  intro: string
  body: string
  heroImageUrl: string | null
  ctaLabel: string
  ctaHref: string
  indexable: boolean
  seoTitle: string
  seoDescription: string
  seoImageUrl: string | null
}

type Visual = { url: string, alt: string }

const { data } = await useFetch<{ page: LandingPage }>(`/api/public/landing-pages/${slug}`, {
  key: `landing-page-${slug}`,
})

if (!data.value) {
  throw createError({ statusCode: 404, statusMessage: 'Landing page not found' })
}

const page = computed(() => data.value!.page)
const paragraphs = computed(() => page.value.body.split(/\n{2,}/).map(value => value.trim()).filter(Boolean))
const externalCta = computed(() => /^https?:\/\//.test(page.value.ctaHref))

const weddingFallbacks: Visual[] = [
  {
    url: 'https://images.unsplash.com/photo-1769230383260-69026dbb3abf?auto=format&fit=crop&w=1600&q=85',
    alt: 'Dansend bruidspaar tussen warme feestlichten',
  },
  {
    url: 'https://images.unsplash.com/photo-1763630055101-2f6d6305dc38?auto=format&fit=crop&w=1600&q=85',
    alt: 'DJ achter de booth tijdens een feest',
  },
  {
    url: 'https://images.unsplash.com/photo-1768054485751-bab2eda850b8?auto=format&fit=crop&w=1600&q=85',
    alt: 'Dansvloer onder sfeervolle podiumlichten',
  },
  {
    url: 'https://images.unsplash.com/photo-1774301810239-99502e33180e?auto=format&fit=crop&w=1600&q=85',
    alt: 'DJ voor een volle dansvloer',
  },
]

const studentFallbacks: Visual[] = [
  {
    url: 'https://images.unsplash.com/photo-1774301810239-99502e33180e?auto=format&fit=crop&w=1600&q=85',
    alt: 'DJ voor een volle dansvloer',
  },
  {
    url: 'https://images.unsplash.com/photo-1768054485751-bab2eda850b8?auto=format&fit=crop&w=1600&q=85',
    alt: 'Publiek onder paarse en blauwe podiumlichten',
  },
  {
    url: 'https://images.unsplash.com/photo-1763630055101-2f6d6305dc38?auto=format&fit=crop&w=1600&q=85',
    alt: 'DJ booth midden in een druk feest',
  },
  {
    url: 'https://images.unsplash.com/photo-1769230383260-69026dbb3abf?auto=format&fit=crop&w=1600&q=85',
    alt: 'Feestend publiek onder warme verlichting',
  },
]

const isWedding = computed(() => /bruiloft|wedding/i.test(page.value.slug))
const isStudent = computed(() => /student/i.test(page.value.slug))
const fallbacks = computed(() => isWedding.value ? weddingFallbacks : studentFallbacks)

const uploadedVisuals = computed<Visual[]>(() => (siteContent.value?.gallery ?? [])
  .filter(image => Boolean(image.url))
  .map(image => ({
    url: image.url,
    alt: image.alt || 'DJ NightLight sfeerbeeld',
  })))

const heroVisual = computed<Visual>(() => page.value.heroImageUrl
  ? { url: page.value.heroImageUrl, alt: page.value.seoTitle || page.value.title }
  : uploadedVisuals.value[0] || fallbacks.value[0]!)

const galleryVisuals = computed<Visual[]>(() => {
  const candidates = [
    ...uploadedVisuals.value.filter(image => image.url !== heroVisual.value.url),
    ...fallbacks.value.filter(image => image.url !== heroVisual.value.url),
  ]

  const unique = candidates.filter((image, index, array) => array.findIndex(item => item.url === image.url) === index)
  return unique.slice(0, 4)
})

const presentation = computed(() => {
  if (isWedding.value) {
    return {
      benefits: [
        { icon: 'lucide:music-2', title: 'Muziek op maat', body: 'Van ontspannen diner tot volle dansvloer.' },
        { icon: 'lucide:users-round', title: 'Voor alle generaties', body: 'Een set die iedereen in beweging krijgt.' },
        { icon: 'lucide:heart', title: 'Zorgeloos genieten', body: 'Heldere afspraken en professionele setup.' },
      ],
      galleryTitle: 'Sfeerimpressie',
      closingEyebrow: 'Jullie avond, mijn focus',
      closingTitle: 'Laten we kennismaken.',
      closingBody: 'Ik denk graag met jullie mee over de invulling, muziekstijl en planning. Zo wordt het een avond die echt bij jullie past.',
      closingCta: 'Neem contact op',
    }
  }

  if (isStudent.value) {
    return {
      benefits: [
        { icon: 'lucide:zap', title: 'Energie van begin tot eind', body: 'Een set die de avond momentum blijft geven.' },
        { icon: 'lucide:users-round', title: 'Muziek die iedereen kent', body: 'Van meezingers tot de nieuwste clubtracks.' },
        { icon: 'lucide:star', title: 'Ervaring met studentenfeesten', body: 'Introducties, gala’s, verenigingen en themafeesten.' },
      ],
      galleryTitle: 'Sfeerimpressie',
      closingEyebrow: 'Van plan tot dansvloer',
      closingTitle: 'Lets make it happen.',
      closingBody: 'Vertel me meer over jullie feest, locatie en wensen. Ik denk graag mee over de perfecte invulling.',
      closingCta: 'Neem contact op',
    }
  }

  return {
    benefits: [
      { icon: 'lucide:music-2', title: 'Muziek op maat', body: 'Een set die past bij publiek, locatie en moment.' },
      { icon: 'lucide:users-round', title: 'Ervaring met publiek', body: 'Herkennen wanneer het tijd is om te schakelen.' },
      { icon: 'lucide:sparkles', title: 'Professionele uitstraling', body: 'Van voorbereiding tot laatste track verzorgd.' },
    ],
    galleryTitle: 'Sfeerimpressie',
    closingEyebrow: 'Samen iets neerzetten',
    closingTitle: 'Klaar voor jullie feest?',
    closingBody: 'Vertel me wat je in gedachten hebt. Ik denk graag mee over muziek, planning en sfeer.',
    closingCta: 'Neem contact op',
  }
})

const heroStyle = computed(() => ({
  backgroundImage: `linear-gradient(90deg, rgba(7,7,9,.97) 0%, rgba(7,7,9,.82) 35%, rgba(7,7,9,.26) 67%, rgba(7,7,9,.16) 100%), linear-gradient(0deg, rgba(7,7,9,.72), transparent 50%), url("${heroVisual.value.url}")`,
}))

useSeoMeta({
  title: () => page.value.seoTitle,
  description: () => page.value.seoDescription,
  robots: () => page.value.indexable ? 'index, follow' : 'noindex, follow',
  ogTitle: () => page.value.seoTitle,
  ogDescription: () => page.value.seoDescription,
  ogImage: () => page.value.seoImageUrl || page.value.heroImageUrl || heroVisual.value.url,
})
</script>

<template>
  <main>
    <section class="landing-hero" :style="heroStyle">
      <div class="public-container hero-inner">
        <div class="hero-copy">
          <p class="eyebrow">{{ page.eyebrow }}</p>
          <h1>{{ page.title }}</h1>
          <p class="intro">{{ page.intro }}</p>
          <a
            v-if="externalCta"
            class="public-button"
            :href="page.ctaHref"
            target="_blank"
            rel="noreferrer"
          >
            {{ page.ctaLabel }}
            <Icon name="lucide:arrow-up-right" aria-hidden="true" />
          </a>
          <NuxtLink v-else class="public-button" :to="page.ctaHref">
            {{ page.ctaLabel }}
            <Icon name="lucide:arrow-right" aria-hidden="true" />
          </NuxtLink>
        </div>
      </div>
    </section>

    <section class="benefits public-container" aria-label="Waarom DJ NightLight">
      <article v-for="benefit in presentation.benefits" :key="benefit.title">
        <span class="benefit-icon">
          <Icon :name="benefit.icon" aria-hidden="true" />
        </span>
        <div>
          <h2>{{ benefit.title }}</h2>
          <p>{{ benefit.body }}</p>
        </div>
      </article>
    </section>

    <section class="story public-container">
      <div class="story-copy">
        <p class="eyebrow">{{ siteContent?.publicCopy.landing.asideEyebrow || 'Mijn aanpak' }}</p>
        <h2>{{ siteContent?.publicCopy.landing.asideTitle || 'Een set die zich aanpast aan het moment.' }}</h2>
        <div class="body-copy">
          <p v-for="(paragraph, index) in paragraphs" :key="index">{{ paragraph }}</p>
        </div>
      </div>

      <figure class="story-visual">
        <img :src="galleryVisuals[0]?.url || heroVisual.url" :alt="galleryVisuals[0]?.alt || heroVisual.alt" loading="lazy">
      </figure>
    </section>

    <section class="gallery-shell">
      <div class="gallery-inner">
        <div class="gallery-heading">
          <p class="eyebrow">{{ presentation.galleryTitle }}</p>
          <NuxtLink to="/media">Bekijk meer <Icon name="lucide:arrow-right" aria-hidden="true" /></NuxtLink>
        </div>

        <div class="gallery-grid">
          <figure v-for="visual in galleryVisuals" :key="visual.url">
            <img :src="visual.url" :alt="visual.alt" loading="lazy">
          </figure>
        </div>
      </div>
    </section>

    <section class="closing public-container">
      <div class="closing-card">
        <div>
          <p class="eyebrow">{{ presentation.closingEyebrow }}</p>
          <h2>{{ presentation.closingTitle }}</h2>
          <p>{{ presentation.closingBody }}</p>
          <NuxtLink class="public-button" to="/boeken">
            {{ presentation.closingCta }}
            <Icon name="lucide:arrow-right" aria-hidden="true" />
          </NuxtLink>
        </div>

        <figure>
          <img
            :src="galleryVisuals[1]?.url || heroVisual.url"
            :alt="galleryVisuals[1]?.alt || heroVisual.alt"
            loading="lazy"
          >
        </figure>
      </div>
    </section>
  </main>
</template>

<style scoped>
.landing-hero {
  min-height: 72svh;
  display: grid;
  align-items: center;
  padding: 8rem 0 5rem;
  background-size: cover;
  background-position: center;
  border-bottom: 1px solid #28232e;
}

.hero-inner {
  width: 100%;
}

.hero-copy {
  max-width: 44rem;
}

.landing-hero h1 {
  max-width: 11ch;
  margin: .55rem 0 1rem;
  font-size: clamp(3.4rem, 7.2vw, 7rem);
  line-height: .9;
  letter-spacing: -.065em;
}

.intro {
  max-width: 38rem;
  margin: 0;
  color: #bbb5c0;
  font-size: clamp(1.02rem, 1.6vw, 1.22rem);
  line-height: 1.65;
}

.public-button {
  margin-top: 1.5rem;
}

.benefits {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0;
  padding-top: 1.3rem;
  padding-bottom: 1.3rem;
  border-bottom: 1px solid #27232c;
}

.benefits article {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 1rem;
  align-items: start;
  min-width: 0;
  padding: 1rem 2rem;
}

.benefits article:first-child {
  padding-left: 0;
}

.benefits article + article {
  border-left: 1px solid #2b2631;
}

.benefit-icon {
  width: 2.7rem;
  height: 2.7rem;
  display: grid;
  place-items: center;
  border: 1px solid #4e3b68;
  border-radius: .8rem;
  background: linear-gradient(145deg, rgba(107, 66, 167, .2), rgba(21, 18, 27, .22));
  color: #e7dcff;
}

.benefits h2 {
  margin: .05rem 0 .3rem;
  font-size: .98rem;
  letter-spacing: -.02em;
}

.benefits p {
  margin: 0;
  color: #8f8994;
  line-height: 1.5;
  font-size: .9rem;
}

.story {
  display: grid;
  grid-template-columns: minmax(0, .9fr) minmax(0, 1.1fr);
  gap: clamp(3rem, 7vw, 7rem);
  align-items: center;
  padding-top: 6.5rem;
  padding-bottom: 5.5rem;
}

.story-copy {
  max-width: 34rem;
}

.story h2 {
  max-width: 12ch;
  margin: .65rem 0 1.25rem;
  font-size: clamp(2.6rem, 4vw, 4.35rem);
  line-height: .96;
  letter-spacing: -.055em;
}

.body-copy {
  color: #aaa4af;
  font-size: 1.03rem;
  line-height: 1.75;
}

.body-copy p {
  margin: 0;
}

.body-copy p + p {
  margin-top: 1rem;
}

.story-visual {
  margin: 0;
  height: clamp(22rem, 34vw, 34rem);
  overflow: hidden;
  border: 1px solid #302a37;
  border-radius: 1rem;
  background: #111015;
}

.story-visual img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.gallery-shell {
  padding: 0 1.25rem 5.5rem;
}

.gallery-inner {
  width: min(100%, 71rem);
  margin: 0 auto;
}

.gallery-heading {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}

.gallery-heading p {
  margin: 0;
}

.gallery-heading a {
  display: inline-flex;
  align-items: center;
  gap: .35rem;
  color: #aaa4af;
  font-size: .85rem;
}

.gallery-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: .65rem;
}

.gallery-grid figure {
  margin: 0;
  aspect-ratio: 1.35 / 1;
  overflow: hidden;
  border: 1px solid #302a37;
  border-radius: .75rem;
  background: #111015;
}

.gallery-grid img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform .35s ease;
}

.gallery-grid figure:hover img {
  transform: scale(1.025);
}

.closing {
  padding-bottom: 7rem;
}

.closing-card {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(18rem, .7fr);
  gap: 2.5rem;
  align-items: stretch;
  max-width: 72rem;
  margin: 0 auto;
  padding: clamp(2rem, 4vw, 3.5rem);
  overflow: hidden;
  border: 1px solid #302a37;
  border-radius: 1rem;
  background:
    radial-gradient(circle at 20% 0%, rgba(101, 63, 148, .12), transparent 34%),
    #111015;
}

.closing-card > div {
  align-self: center;
  max-width: 34rem;
}

.closing-card h2 {
  margin: .55rem 0 .7rem;
  font-size: clamp(2.3rem, 3.8vw, 4rem);
  line-height: .97;
  letter-spacing: -.05em;
}

.closing-card p:not(.eyebrow) {
  margin: 0;
  color: #aaa4af;
  line-height: 1.65;
}

.closing-card figure {
  margin: 0;
  min-height: 19rem;
  overflow: hidden;
  border-radius: .75rem;
}

.closing-card img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

@media (max-width: 900px) {
  .landing-hero {
    min-height: 64svh;
    padding: 7rem 0 4rem;
    background-position: 62% center;
  }

  .benefits {
    grid-template-columns: 1fr;
    padding-top: .65rem;
    padding-bottom: .65rem;
  }

  .benefits article,
  .benefits article:first-child {
    padding: 1rem 0;
  }

  .benefits article + article {
    border-left: 0;
    border-top: 1px solid #27232c;
  }

  .story {
    grid-template-columns: 1fr;
    padding-top: 4.5rem;
    padding-bottom: 4rem;
  }

  .story-copy {
    max-width: 42rem;
  }

  .gallery-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .closing-card {
    grid-template-columns: 1fr;
  }

  .closing-card figure {
    min-height: 17rem;
  }
}

@media (max-width: 600px) {
  .landing-hero {
    min-height: 70svh;
    align-items: end;
    padding-bottom: 3rem;
    background-position: 68% center;
  }

  .landing-hero h1 {
    font-size: clamp(3rem, 15vw, 4.6rem);
  }

  .story-visual {
    height: 21rem;
  }

  .gallery-shell {
    padding-inline: 1rem;
  }

  .gallery-grid {
    display: flex;
    gap: .65rem;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    padding-bottom: .25rem;
  }

  .gallery-grid figure {
    flex: 0 0 76%;
    scroll-snap-align: start;
  }

  .closing {
    padding-bottom: 5rem;
  }

  .closing-card {
    padding: 1.35rem;
  }

  .closing-card figure {
    min-height: 14rem;
  }
}
</style>
