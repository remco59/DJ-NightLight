<script setup lang="ts">
import {
  defaultLandingPageSections,
  landingPageSectionsSchema,
  type LandingPageSections,
} from '~~/shared/schemas/landing-page'
import { responsiveImage } from '~~/shared/responsive-image'

definePageMeta({ layout: 'public' })

const route = useRoute()
const slug = String(route.params.slug)

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
  sections: LandingPageSections | Record<string, never>
}

type Visual = { url: string, alt: string }

const { data } = await useFetch<{ page: LandingPage }>(`/api/public/landing-pages/${slug}`, {
  key: `landing-page-${slug}`,
})

if (!data.value) {
  throw createError({ statusCode: 404, statusMessage: 'Deze pagina bestaat niet (meer)' })
}

const page = computed(() => data.value!.page)
const parsedSections = computed(() => landingPageSectionsSchema.safeParse(page.value.sections))
const sections = computed(() => parsedSections.value.success
  ? parsedSections.value.data
  : defaultLandingPageSections(page.value.slug))

const paragraphs = computed(() => page.value.body.split(/\n{2,}/).map(value => value.trim()).filter(Boolean))
const isExternal = (href: string) => /^https?:\/\//.test(href)

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

// The site's own photos come before stock, so a page without configured
// images still shows real NightLight nights.
const { data: siteData } = await useSiteContent()
const sitePhotos = computed<Visual[]>(() => {
  const content = siteData.value?.content
  if (!content) return []
  return [
    ...content.gallery.filter(image => Boolean(image.url)).map(image => ({ url: image.url, alt: image.alt || 'NightLight sfeerbeeld' })),
    ...(content.heroImageUrl ? [{ url: content.heroImageUrl, alt: 'DJ NightLight tijdens een optreden' }] : []),
    ...content.services.filter(service => Boolean(service.imageUrl)).map(service => ({ url: service.imageUrl!, alt: service.imageAlt || service.title })),
  ]
})
const fallbacks = computed(() => sitePhotos.value.length
  ? sitePhotos.value
  : isWedding.value ? weddingFallbacks : studentFallbacks)

const heroVisual = computed<Visual>(() => page.value.heroImageUrl
  ? { url: page.value.heroImageUrl, alt: page.value.seoTitle || page.value.title }
  : fallbacks.value[0]!)

const galleryVisuals = computed<Visual[]>(() => {
  const configured = sections.value.galleryImages
    .filter(image => Boolean(image.url))
    .map((image, index) => ({
      url: image.url!,
      alt: image.alt || `Sfeerbeeld ${index + 1} van DJ NightLight`,
    }))

  const candidates = [
    ...configured,
    ...fallbacks.value.filter(image => image.url !== heroVisual.value.url),
  ]
  return candidates
    .filter((image, index, array) => array.findIndex(item => item.url === image.url) === index)
    .slice(0, 4)
})

const storyVisual = computed<Visual>(() => sections.value.storyImageUrl
  ? { url: sections.value.storyImageUrl, alt: sections.value.storyTitle }
  : galleryVisuals.value[0] || heroVisual.value)

const closingVisual = computed<Visual>(() => sections.value.closingImageUrl
  ? { url: sections.value.closingImageUrl, alt: sections.value.closingTitle }
  : galleryVisuals.value[1] || storyVisual.value)

const heroImage = computed(() => responsiveImage(heroVisual.value.url, 1920))

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
    <section class="landing-hero">
      <img class="hero-media" v-bind="heroImage" sizes="100vw" :alt="heroVisual.alt" fetchpriority="high">
      <div class="hero-shade" aria-hidden="true" />
      <div class="public-container hero-inner">
        <div class="hero-copy">
          <p class="eyebrow">{{ page.eyebrow }}</p>
          <h1>{{ page.title }}</h1>
          <p class="intro">{{ page.intro }}</p>
          <a
            v-if="isExternal(page.ctaHref)"
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

    <section class="benefits public-container" aria-label="Voordelen">
      <article v-for="benefit in sections.benefits" :key="benefit.title">
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
        <p class="eyebrow">{{ sections.storyEyebrow }}</p>
        <h2>{{ sections.storyTitle }}</h2>
        <div class="body-copy">
          <p v-for="(paragraph, index) in paragraphs" :key="index">{{ paragraph }}</p>
        </div>
      </div>

      <figure class="story-visual">
        <img v-bind="responsiveImage(storyVisual.url, 1280)" sizes="(max-width: 900px) 100vw, 45vw" :alt="storyVisual.alt" loading="lazy">
      </figure>
    </section>

    <section class="gallery-shell">
      <div class="gallery-inner">
        <div class="gallery-heading">
          <p class="eyebrow">{{ sections.galleryTitle }}</p>
          <a
            v-if="isExternal(sections.galleryCtaHref)"
            :href="sections.galleryCtaHref"
            target="_blank"
            rel="noreferrer"
          >
            {{ sections.galleryCtaLabel }} <Icon name="lucide:arrow-up-right" aria-hidden="true" />
          </a>
          <NuxtLink v-else :to="sections.galleryCtaHref">
            {{ sections.galleryCtaLabel }} <Icon name="lucide:arrow-right" aria-hidden="true" />
          </NuxtLink>
        </div>

        <div class="gallery-grid" :style="{ '--gallery-columns': Math.min(galleryVisuals.length, 4) }">
          <figure v-for="visual in galleryVisuals" :key="visual.url">
            <img v-bind="responsiveImage(visual.url, 640)" sizes="(max-width: 600px) 50vw, 25vw" :alt="visual.alt" loading="lazy">
          </figure>
        </div>
      </div>
    </section>

    <section class="closing public-container">
      <div class="closing-card">
        <div>
          <p class="eyebrow">{{ sections.closingEyebrow }}</p>
          <h2>{{ sections.closingTitle }}</h2>
          <p>{{ sections.closingBody }}</p>
          <a
            v-if="isExternal(sections.closingCtaHref)"
            class="public-button"
            :href="sections.closingCtaHref"
            target="_blank"
            rel="noreferrer"
          >
            {{ sections.closingCtaLabel }}
            <Icon name="lucide:arrow-up-right" aria-hidden="true" />
          </a>
          <NuxtLink v-else class="public-button" :to="sections.closingCtaHref">
            {{ sections.closingCtaLabel }}
            <Icon name="lucide:arrow-right" aria-hidden="true" />
          </NuxtLink>
        </div>

        <figure>
          <img v-bind="responsiveImage(closingVisual.url, 1280)" sizes="(max-width: 900px) 100vw, 40vw" :alt="closingVisual.alt" loading="lazy">
        </figure>
      </div>
    </section>
  </main>
</template>

<style scoped>
.landing-hero {
  position: relative;
  min-height: 72svh;
  display: grid;
  align-items: center;
  padding: 8rem 0 5rem;
  overflow: hidden;
  background: #08080b;
  border-bottom: 1px solid #28232e;
}

.hero-media {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.hero-shade {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(90deg, rgba(7, 7, 9, .97) 0%, rgba(7, 7, 9, .82) 35%, rgba(7, 7, 9, .26) 67%, rgba(7, 7, 9, .16) 100%),
    linear-gradient(0deg, rgba(7, 7, 9, .72), transparent 50%);
}

.hero-inner {
  position: relative;
  z-index: 1;
}

.hero-copy {
  max-width: 44rem;
}

.landing-hero h1 {
  max-width: 11ch;
  margin: .55rem 0 1rem;
  font-size: clamp(3.4rem, 7.2vw, 7rem);
  line-height: .9;
  letter-spacing: -.04em;
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
  border-left: 1px solid var(--border);
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
  letter-spacing: -.04em;
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
  min-height: 2.75rem;
  gap: .35rem;
  color: #aaa4af;
  font-size: .85rem;
}

.gallery-grid {
  display: grid;
  grid-template-columns: repeat(var(--gallery-columns, 4), 1fr);
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
  letter-spacing: -.04em;
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
  }

  .hero-media {
    object-position: 62% center;
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
  }

  .hero-media {
    object-position: 68% center;
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
