<script setup lang="ts">
import { apiErrorMessage } from '~/utils/api-error'
import {
  defaultLandingPageSections,
  landingPageSectionsSchema,
  type LandingPageSections,
} from '~~/shared/schemas/landing-page'

definePageMeta({ layout: 'admin' })
const route = useRoute()
const id = String(route.params.id)

type LandingPage = {
  id: string
  slug: string
  navLabel: string
  eyebrow: string
  title: string
  intro: string
  body: string
  heroImageUrl: string | null
  ctaLabel: string
  ctaHref: string
  published: boolean
  showInNavigation: boolean
  indexable: boolean
  seoTitle: string
  seoDescription: string
  seoImageUrl: string | null
  ordering: number
  sections: LandingPageSections | Record<string, never>
}

const { data, refresh } = await useFetch<{ page: LandingPage }>(`/api/admin/landing-pages/${id}`)
if (!data.value) throw createError({ statusCode: 404, statusMessage: 'Landing page niet gevonden' })

const p = data.value.page
const parsedSections = landingPageSectionsSchema.safeParse(p.sections)
const form = reactive({
  slug: p.slug,
  navLabel: p.navLabel,
  eyebrow: p.eyebrow,
  title: p.title,
  intro: p.intro,
  body: p.body,
  heroImageUrl: p.heroImageUrl,
  ctaLabel: p.ctaLabel,
  ctaHref: p.ctaHref,
  published: p.published,
  showInNavigation: p.showInNavigation,
  indexable: p.indexable,
  seoTitle: p.seoTitle,
  seoDescription: p.seoDescription,
  seoImageUrl: p.seoImageUrl,
  ordering: p.ordering,
  sections: structuredClone(parsedSections.success ? parsedSections.data : defaultLandingPageSections(p.slug)),
})

const saving = ref(false)
const message = ref('')

async function save() {
  saving.value = true
  message.value = ''
  try {
    await $fetch(`/api/admin/landing-pages/${id}`, { method: 'PUT', body: form })
    await refresh()
    await refreshNuxtData('landing-navigation')
    message.value = 'Landing page opgeslagen.'
  } catch (error: unknown) {
    message.value = apiErrorMessage(error, 'Landing page opslaan is niet gelukt.')
  } finally {
    saving.value = false
  }
}

async function remove() {
  if (!confirm('Deze landing page definitief verwijderen?')) return
  try {
    await $fetch(`/api/admin/landing-pages/${id}`, { method: 'DELETE' })
    await refreshNuxtData('landing-navigation')
    await navigateTo('/admin/landing-pages')
  } catch (error: unknown) {
    message.value = apiErrorMessage(error, 'Landing page verwijderen is niet gelukt.')
  }
}

useSeoMeta({
  title: () => `${form.navLabel || 'Landing page'} — DJ NightLight`,
  robots: 'noindex, nofollow',
})
</script>

<template>
  <div class="editor">
    <div class="topline">
      <NuxtLink to="/admin/landing-pages">
        <Icon name="lucide:arrow-left" aria-hidden="true" /> Landing pages
      </NuxtLink>
      <div class="actions">
        <NuxtLink v-if="form.published" :to="`/diensten/${form.slug}`" target="_blank">
          Voorbeeld <Icon name="lucide:external-link" aria-hidden="true" />
        </NuxtLink>
        <button class="with-icon danger" type="button" @click="remove">
          <Icon name="lucide:trash-2" aria-hidden="true" /> Verwijderen
        </button>
      </div>
    </div>

    <header>
      <p class="eyebrow">Landing page</p>
      <h1>{{ form.navLabel }}</h1>
      <p>/diensten/{{ form.slug }}</p>
    </header>

    <form @submit.prevent="save">
      <section class="card">
        <div class="section-heading">
          <div><p class="eyebrow">Publicatie</p><h2>Zichtbaarheid</h2></div>
        </div>
        <div class="toggles">
          <label><input v-model="form.published" type="checkbox"><span><strong>Gepubliceerd</strong><small>Bepaalt of de publieke URL bestaat.</small></span></label>
          <label><input v-model="form.showInNavigation" type="checkbox"><span><strong>Tonen in navigatie</strong><small>Los van publiceren.</small></span></label>
          <label><input v-model="form.indexable" type="checkbox"><span><strong>Vindbaar in zoekmachines</strong><small>Los van zichtbaarheid in de navigatie.</small></span></label>
        </div>
      </section>

      <section class="card">
        <div class="section-heading">
          <div><p class="eyebrow">01 · Hero</p><h2>Opening van de pagina</h2></div>
          <small>Alles boven de eerste scheidingslijn.</small>
        </div>
        <div class="grid">
          <label>Slug<input v-model="form.slug" required></label>
          <label>Label in navigatie<input v-model="form.navLabel" required></label>
          <label>Bovenregel<input v-model="form.eyebrow" required></label>
          <label>Volgorde<input v-model.number="form.ordering" type="number" min="0"></label>
          <label class="wide">Titel<input v-model="form.title" required></label>
          <label class="wide">Intro<textarea v-model="form.intro" rows="3" required /></label>
          <div class="wide media-picker-field">
            <AdminMediaPicker
              v-model="form.heroImageUrl"
              label="Hero-afbeelding"
              description="Kies een afbeelding uit de mediabibliotheek of upload een nieuwe."
              upload-tags="website,landing-page,hero"
            />
          </div>
          <label>CTA-tekst<input v-model="form.ctaLabel" required></label>
          <label>CTA-bestemming<input v-model="form.ctaHref" required placeholder="/boeken"></label>
        </div>
      </section>

      <section class="card">
        <div class="section-heading">
          <div><p class="eyebrow">02 · Voordelen</p><h2>Drie korte redenen</h2></div>
          <small>Deze drie items staan direct onder de hero.</small>
        </div>
        <div class="benefit-editors">
          <article v-for="(benefit, index) in form.sections.benefits" :key="index">
            <div class="benefit-number">0{{ index + 1 }}</div>
            <div class="grid">
              <label>Icon<small>Lucide-naam, bijvoorbeeld lucide:music-2</small><input v-model="benefit.icon" required></label>
              <label>Titel<input v-model="benefit.title" required></label>
              <label class="wide">Tekst<textarea v-model="benefit.body" rows="2" required /></label>
            </div>
          </article>
        </div>
      </section>

      <section class="card">
        <div class="section-heading">
          <div><p class="eyebrow">03 · Verhaal</p><h2>Mijn aanpak</h2></div>
          <small>Tekst en grote ondersteunende foto.</small>
        </div>
        <div class="grid">
          <label>Bovenregel<input v-model="form.sections.storyEyebrow" required></label>
          <label>Titel<input v-model="form.sections.storyTitle" required></label>
          <label class="wide">Tekst<textarea v-model="form.body" rows="7" required /></label>
          <div class="wide media-picker-field">
            <AdminMediaPicker
              v-model="form.sections.storyImageUrl"
              label="Afbeelding bij verhaal"
              description="Grote foto naast de tekst. Leeg laten gebruikt de hero als fallback."
              upload-tags="website,landing-page,story"
            />
          </div>
        </div>
      </section>

      <section class="card">
        <div class="section-heading">
          <div><p class="eyebrow">04 · Sfeerimpressie</p><h2>Fotogalerij</h2></div>
          <small>Vier compacte beelden, zoals in het goedgekeurde ontwerp.</small>
        </div>
        <div class="grid">
          <label>Galerijtitel<input v-model="form.sections.galleryTitle" required></label>
          <label>Linktekst<input v-model="form.sections.galleryCtaLabel" required></label>
          <label class="wide">Linkbestemming<input v-model="form.sections.galleryCtaHref" required></label>
        </div>
        <div class="gallery-editors">
          <article v-for="(image, index) in form.sections.galleryImages" :key="index">
            <strong>Afbeelding {{ index + 1 }}</strong>
            <AdminMediaPicker
              v-model="image.url"
              :label="`Sfeerbeeld ${index + 1}`"
              description="Kies uit de mediabibliotheek of upload een nieuw beeld."
              upload-tags="website,landing-page,gallery"
            />
            <label>Alt-tekst<input v-model="image.alt" placeholder="Beschrijf kort wat er op de foto staat"></label>
          </article>
        </div>
      </section>

      <section class="card">
        <div class="section-heading">
          <div><p class="eyebrow">05 · Afsluiting</p><h2>Laatste call to action</h2></div>
          <small>De rustige afsluitende kaart onderaan de pagina.</small>
        </div>
        <div class="grid">
          <label>Bovenregel<input v-model="form.sections.closingEyebrow" required></label>
          <label>Titel<input v-model="form.sections.closingTitle" required></label>
          <label class="wide">Tekst<textarea v-model="form.sections.closingBody" rows="3" required /></label>
          <label>Knoptekst<input v-model="form.sections.closingCtaLabel" required></label>
          <label>Knopbestemming<input v-model="form.sections.closingCtaHref" required></label>
          <div class="wide media-picker-field">
            <AdminMediaPicker
              v-model="form.sections.closingImageUrl"
              label="Afsluitende afbeelding"
              description="Foto aan de rechterkant van de afsluitende CTA."
              upload-tags="website,landing-page,closing"
            />
          </div>
        </div>
      </section>

      <section class="card">
        <div class="section-heading">
          <div><p class="eyebrow">06 · SEO</p><h2>Zoeken en delen</h2></div>
        </div>
        <div class="grid">
          <label class="wide">SEO-titel<input v-model="form.seoTitle" required></label>
          <label class="wide">SEO-beschrijving<textarea v-model="form.seoDescription" rows="3" required /></label>
          <div class="wide media-picker-field">
            <AdminMediaPicker
              v-model="form.seoImageUrl"
              label="Social-afbeelding"
              description="Afbeelding voor social previews en delen. Externe URL blijft mogelijk."
              upload-tags="website,landing-page,seo"
            />
          </div>
        </div>
      </section>

      <div class="save-bar">
        <span>{{ message || 'Alle zichtbare onderdelen van deze landing page zijn hier te beheren.' }}</span>
        <button class="primary" type="submit" :disabled="saving">{{ saving ? 'Opslaan…' : 'Pagina opslaan' }}</button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.editor{max-width:980px;margin-inline:auto}.topline{display:flex;justify-content:space-between;gap:1rem;margin-bottom:1rem}.topline>a,.actions a{color:#8e8797;text-decoration:none}.actions{display:flex;gap:.8rem;align-items:center}header{margin-bottom:1.5rem}h1{margin:.2rem 0;font-size:clamp(2.4rem,6vw,4rem);letter-spacing:-.04em}header>p:last-child{margin:.2rem 0;color:#716b78;font-family:monospace}.card{margin-bottom:1rem;padding:1.3rem;border:1px solid #2b2631;border-radius:1rem;background:#100e14}.section-heading{display:flex;align-items:end;justify-content:space-between;gap:1rem;margin-bottom:1.1rem}.section-heading .eyebrow{margin:0}.section-heading h2{margin:.25rem 0 0;font-size:1.25rem}.section-heading>small{max-width:24rem;color:#77717e;text-align:right;line-height:1.45}.toggles{display:grid;grid-template-columns:repeat(3,1fr);gap:.7rem}.toggles label{display:flex;align-items:start;gap:.6rem;padding:.9rem;border:1px solid #2b2631;border-radius:.8rem}.toggles input{width:auto;margin-top:.15rem}.toggles strong,.toggles small{display:block}.toggles small{margin-top:.25rem;color:#77717e;line-height:1.45}.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:.8rem}.wide{grid-column:1/-1}.media-picker-field{padding-top:.2rem}label{display:grid;gap:.35rem;color:#aaa4b1;font-size:.8rem}label>small{color:#716b78;font-size:.68rem}input,textarea{width:100%;border:1px solid #332e39;border-radius:.65rem;padding:.72rem;background:#0b0a0d;color:#f6f3fa}.benefit-editors{display:grid;grid-template-columns:repeat(3,1fr);gap:.7rem}.benefit-editors article{position:relative;padding:1rem;border:1px solid #29242f;border-radius:.8rem;background:#0c0a0f}.benefit-editors .grid{grid-template-columns:1fr}.benefit-editors .wide{grid-column:auto}.benefit-number{margin-bottom:.8rem;color:#7357a1;font-size:.7rem;font-weight:800;letter-spacing:.12em}.gallery-editors{display:grid;grid-template-columns:repeat(2,1fr);gap:.8rem;margin-top:1rem}.gallery-editors article{display:grid;gap:.75rem;padding:1rem;border:1px solid #29242f;border-radius:.8rem;background:#0c0a0f}.gallery-editors article>strong{font-size:.82rem}.save-bar{position:sticky;z-index:10;bottom:1rem;display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:1rem;border:1px solid #37313e;border-radius:1rem;background:rgba(20,17,25,.95);backdrop-filter:blur(12px);color:#918a98}.primary,.danger{border:0;border-radius:.65rem;padding:.72rem .9rem;font-weight:800;cursor:pointer}.primary{background:#fff;color:#09080b}.danger{background:#2a1519;color:#ffabb5}@media(max-width:850px){.benefit-editors{grid-template-columns:1fr}.gallery-editors{grid-template-columns:1fr}}@media(max-width:750px){.toggles,.grid{grid-template-columns:1fr}.wide{grid-column:auto}.topline,.section-heading{align-items:start;flex-direction:column}.section-heading>small{text-align:left}.save-bar{align-items:stretch;flex-direction:column}.primary{width:100%}}
</style>
