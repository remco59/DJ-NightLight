<script setup lang="ts">
import { apiErrorMessage } from '~/utils/api-error'
import type { PublicSiteContent } from '~/types/site-content'

definePageMeta({ layout: 'admin' })

type PageKey = 'home' | 'about' | 'media' | 'agenda' | 'booking' | 'shared'
type PickerAsset = { altText: string, title: string }

const pages: Array<{ key: PageKey, label: string, hint: string, href: string }> = [
  { key: 'home', label: 'Homepage', hint: 'Hero, secties & CTA', href: '/' },
  { key: 'about', label: 'Over', hint: 'Verhaal & principes', href: '/about' },
  { key: 'media', label: 'Media', hint: 'Showreel & galerij', href: '/media' },
  { key: 'agenda', label: 'Agenda', hint: 'Status, lijst & lege staat', href: '/agenda' },
  { key: 'booking', label: 'Boeken', hint: 'Intro, formulier & bevestiging', href: '/boeken' },
  { key: 'shared', label: 'Algemeen & SEO', hint: 'Navigatie, footer & metadata', href: '/' },
]

const { data } = await useFetch<{ content: PublicSiteContent }>('/api/admin/content')
if (!data.value) throw createError({ statusCode: 500, statusMessage: 'Website-inhoud laden is niet gelukt' })

const form = reactive({
  ...data.value.content,
  services: data.value.content.services.map(item => ({ ...item })),
  gallery: data.value.content.gallery.map(item => ({ ...item })),
  publicCopy: structuredClone(data.value.content.publicCopy),
})

const activePage = ref<PageKey>('home')
const saving = ref(false)
const message = ref('Geen niet-opgeslagen wijzigingen.')
const messageKind = ref<'idle' | 'dirty' | 'saving' | 'success' | 'error'>('idle')

const activePageMeta = computed(() => pages.find(page => page.key === activePage.value) ?? pages[0]!)

watch(
  form,
  () => {
    if (saving.value) return
    messageKind.value = 'dirty'
    message.value = 'Niet-opgeslagen wijzigingen.'
  },
  { deep: true },
)

function selectPage(page: PageKey) {
  activePage.value = page
  if (import.meta.client) window.scrollTo({ top: 0, behavior: 'smooth' })
}

function addService() {
  form.services.push({ title: '', body: '', imageUrl: null, imageAlt: '' })
}

function moveService(index: number, direction: -1 | 1) {
  const target = index + direction
  if (target < 0 || target >= form.services.length) return
  const [item] = form.services.splice(index, 1)
  if (item) form.services.splice(target, 0, item)
}

function addImage() {
  form.gallery.push({ url: '', alt: '' })
}

function moveImage(index: number, direction: -1 | 1) {
  const target = index + direction
  if (target < 0 || target >= form.gallery.length) return
  const [item] = form.gallery.splice(index, 1)
  if (item) form.gallery.splice(target, 0, item)
}

function applyGalleryAsset(image: { url: string, alt: string }, asset: PickerAsset) {
  if (!image.alt) image.alt = asset.altText || asset.title || ''
}

function updateStringList(list: string[], event: Event) {
  const values = (event.target as HTMLTextAreaElement).value
    .split('\n')
    .map(value => value.trim())
    .filter(Boolean)
  list.splice(0, list.length, ...values)
}

function addPrinciple() {
  form.publicCopy.about.principles.push({ title: 'Nieuw principe', body: 'Beschrijf dit principe.' })
}

async function save() {
  saving.value = true
  messageKind.value = 'saving'
  message.value = 'Website opslaan…'
  try {
    await $fetch('/api/admin/content', { method: 'PUT', body: form })
    messageKind.value = 'success'
    message.value = 'Website opgeslagen. De wijzigingen zijn live.'
    await refreshNuxtData('nightlight-site-content')
  } catch (error: unknown) {
    messageKind.value = 'error'
    message.value = apiErrorMessage(error, 'Website-inhoud opslaan is niet gelukt.')
  } finally {
    saving.value = false
  }
}

useSeoMeta({ title: 'Website-inhoud — DJ NightLight', robots: 'noindex, nofollow' })
</script>

<template>
  <form class="content-editor" novalidate @submit.prevent="save">
    <header class="editor-topbar">
      <div class="topbar-title">
        <p class="eyebrow">Website-editor</p>
        <h1>{{ activePageMeta.label }}</h1>
        <p>{{ activePageMeta.hint }}</p>
      </div>

      <div class="save-status" :class="'is-' + messageKind" aria-live="polite">
        <span class="status-dot" />
        {{ message }}
      </div>

      <div class="topbar-actions">
        <NuxtLink :to="activePageMeta.href" target="_blank" class="secondary-button">
          Pagina bekijken <Icon name="lucide:external-link" aria-hidden="true" />
        </NuxtLink>
        <button class="primary-button" type="submit" :disabled="saving">
          {{ saving ? 'Opslaan…' : 'Website opslaan' }}
        </button>
      </div>
    </header>

    <div class="editor-shell">
      <aside class="page-sidebar">
        <div class="sidebar-label">
          <span>Pagina’s</span>
          <small>Bewerk de inhoud waar bezoekers hem zien</small>
        </div>

        <nav aria-label="Pagina’s van de publieke website">
          <button
            v-for="page in pages"
            :key="page.key"
            type="button"
            :class="{ active: activePage === page.key }"
            @click="selectPage(page.key)"
          >
            <span>{{ page.label }}</span>
            <small>{{ page.hint }}</small>
          </button>
        </nav>

        <div class="sidebar-note">
          <strong>Landing pages</strong>
          <p>Landing pages per dienst bewerk je in de aparte editor voor Landing pages.</p>
          <NuxtLink to="/admin/landing-pages">Landing pages openen <Icon name="lucide:arrow-right" aria-hidden="true" /></NuxtLink>
        </div>
      </aside>

      <main class="page-workspace">
        <section v-if="activePage === 'home'" class="page-editor">
          <div class="page-intro">
            <p class="eyebrow">Publieke pagina · /</p>
            <h2>Homepage</h2>
            <p>De secties staan in dezelfde volgorde als op de publieke homepage. Open alleen het deel waar je aan werkt.</p>
          </div>

          <details class="editor-section" open>
            <summary>
              <span><strong>Hero</strong><small>Openingstekst, afbeelding en hoofdknoppen</small></span>
              <b>01</b>
            </summary>
            <div class="section-body">
              <div class="field-grid two">
                <label>Bovenregel<input v-model="form.heroEyebrow"></label>
                <label>Hoofdknop<input v-model="form.heroCtaLabel"></label>
              </div>
              <label>Kop<textarea v-model="form.heroTitle" rows="3" /></label>
              <label>Introtekst<textarea v-model="form.heroBody" rows="5" /></label>
              <AdminMediaPicker
                v-model="form.heroImageUrl"
                label="Hero-afbeelding"
                description="Grote achtergrondafbeelding achter de openingstekst."
              />
              <div class="field-grid two">
                <label>Tweede knop<input v-model="form.publicCopy.home.secondaryCta"></label>
                <label>Scrolltekst<input v-model="form.publicCopy.home.scrollLabel"></label>
              </div>
              <label>Bijschrift afbeelding<input v-model="form.publicCopy.home.heroCaption"></label>
            </div>
          </details>

          <details class="editor-section">
            <summary>
              <span><strong>Uitgelicht beeld</strong><small>Groot beeldmoment direct onder de hero</small></span>
              <b>02</b>
            </summary>
            <div class="section-body">
              <label>Bovenregel<input v-model="form.publicCopy.home.visualEyebrow"></label>
              <label>Ondersteunende tekst<textarea v-model="form.publicCopy.home.visualBody" rows="4" /></label>
              <AdminMediaPicker v-model="form.publicCopy.visuals.homeFeatureImageUrl" label="Uitgelichte afbeelding" />
              <div class="field-grid two">
                <label>Bijschrift afbeelding<input v-model="form.publicCopy.home.visualCaption"></label>
                <label>Alt-tekst afbeelding<input v-model="form.publicCopy.visuals.homeFeatureAlt"></label>
              </div>
            </div>
          </details>

          <details class="editor-section">
            <summary>
              <span><strong>Teaser Over</strong><small>Introductie van NightLight op de homepage</small></span>
              <b>03</b>
            </summary>
            <div class="section-body">
              <p class="section-note">De kop en tekst worden gedeeld met de Over-pagina. Als je ze hier wijzigt, veranderen ze op beide plekken.</p>
              <label>Bovenregel<input v-model="form.aboutEyebrow"></label>
              <label>Kop<input v-model="form.aboutTitle"></label>
              <label>Tekst<textarea v-model="form.aboutBody" rows="6" /></label>
              <AdminMediaPicker v-model="form.publicCopy.visuals.homeAboutImageUrl" label="Afbeelding Over op homepage" />
              <div class="field-grid two">
                <label>Linktekst<input v-model="form.publicCopy.home.aboutCta"></label>
                <label>Bijschrift afbeelding<input v-model="form.publicCopy.home.aboutImageCaption"></label>
              </div>
              <label>Alt-tekst afbeelding<input v-model="form.publicCopy.visuals.homeAboutAlt"></label>
            </div>
          </details>

          <details class="editor-section">
            <summary>
              <span><strong>Diensten</strong><small>Dienstkaarten en introductie op de homepage</small></span>
              <b>04</b>
            </summary>
            <div class="section-body">
              <div class="field-grid two">
                <label>Bovenregel sectie<input v-model="form.publicCopy.home.servicesEyebrow"></label>
                <label>Intro sectie<textarea v-model="form.publicCopy.home.servicesBody" rows="3" /></label>
              </div>

              <div class="subsection-heading">
                <div>
                  <h3>Dienstkaarten</h3>
                  <p>Deze kaarten staan op de homepage. Volledige dienstpagina’s bewerk je onder Landing pages.</p>
                </div>
                <button type="button" class="secondary-button" @click="addService"><Icon name="lucide:plus" aria-hidden="true" /> Dienst toevoegen</button>
              </div>

              <div class="repeat-list">
                <article v-for="(service, index) in form.services" :key="index" class="repeat-card">
                  <div class="repeat-top">
                    <strong>Dienst {{ index + 1 }}</strong>
                    <div>
                      <button type="button" :disabled="index === 0" aria-label="Omhoog" title="Omhoog" @click="moveService(index, -1)"><Icon name="lucide:arrow-up" aria-hidden="true" /></button>
                      <button type="button" :disabled="index === form.services.length - 1" aria-label="Omlaag" title="Omlaag" @click="moveService(index, 1)"><Icon name="lucide:arrow-down" aria-hidden="true" /></button>
                      <button type="button" class="danger-text" @click="form.services.splice(index, 1)">Verwijderen</button>
                    </div>
                  </div>
                  <label>Titel<input v-model="service.title"></label>
                  <label>Beschrijving<textarea v-model="service.body" rows="4" /></label>
                  <AdminMediaPicker
                    v-model="service.imageUrl"
                    label="Afbeelding kaart"
                    description="Optionele eigen afbeelding voor deze dienst."
                  />
                  <label>Alt-tekst afbeelding<input v-model="service.imageAlt"></label>
                </article>
              </div>
            </div>
          </details>

          <details class="editor-section">
            <summary>
              <span><strong>Social proof</strong><small>Quote en labels voor soorten evenementen</small></span>
              <b>05</b>
            </summary>
            <div class="section-body">
              <label>Bovenregel<input v-model="form.publicCopy.home.proofEyebrow"></label>
              <label>Quote<textarea v-model="form.publicCopy.home.proofQuote" rows="4" /></label>
              <label>
                Tags · één per regel
                <textarea
                  :value="form.publicCopy.home.proofTags.join('\n')"
                  rows="6"
                  @input="updateStringList(form.publicCopy.home.proofTags, $event)"
                />
              </label>
            </div>
          </details>

          <details class="editor-section">
            <summary>
              <span><strong>Afsluitende boekings-CTA</strong><small>Laatste call to action op de homepage</small></span>
              <b>06</b>
            </summary>
            <div class="section-body">
              <p class="section-note">Deze introtekst wordt ook bovenaan de Boeken-pagina gebruikt.</p>
              <label>Bovenregel<input v-model="form.bookingEyebrow"></label>
              <label>Kop<input v-model="form.bookingTitle"></label>
              <label>Tekst<textarea v-model="form.bookingBody" rows="5" /></label>
              <label>Knoptekst<input v-model="form.publicCopy.home.bookingCta"></label>
            </div>
          </details>
        </section>

        <section v-else-if="activePage === 'about'" class="page-editor">
          <div class="page-intro">
            <p class="eyebrow">Publieke pagina · /about</p>
            <h2>Over</h2>
            <p>Bewerk de Over-pagina in dezelfde volgorde als bezoekers erdoorheen gaan.</p>
          </div>

          <details class="editor-section" open>
            <summary>
              <span><strong>Intro</strong><small>Paginatitel, openingstekst en openingsafbeelding</small></span>
              <b>01</b>
            </summary>
            <div class="section-body">
              <p class="section-note">De hoofdkop en tekst worden ook gebruikt in de Over-teaser op de homepage.</p>
              <label>Bovenregel<input v-model="form.aboutEyebrow"></label>
              <label>Kop<input v-model="form.aboutTitle"></label>
              <label>Openingstekst<textarea v-model="form.aboutBody" rows="6" /></label>
              <AdminMediaPicker v-model="form.publicCopy.visuals.aboutLeadImageUrl" label="Openingsafbeelding" />
              <div class="field-grid two">
                <label>Bovenregel afbeelding<input v-model="form.publicCopy.about.imageEyebrow"></label>
                <label>Bijschrift afbeelding<input v-model="form.publicCopy.about.imageCaption"></label>
              </div>
              <label>Alt-tekst afbeelding<input v-model="form.publicCopy.visuals.aboutLeadAlt"></label>
            </div>
          </details>

          <details class="editor-section">
            <summary>
              <span><strong>Verhaal</strong><small>Sectie met het uitgebreide verhaal</small></span>
              <b>02</b>
            </summary>
            <div class="section-body">
              <label>Titel verhaal<textarea v-model="form.publicCopy.about.storyTitle" rows="3" /></label>
              <label>Alinea 1<textarea v-model="form.publicCopy.about.storyBody1" rows="5" /></label>
              <label>Alinea 2<textarea v-model="form.publicCopy.about.storyBody2" rows="5" /></label>
            </div>
          </details>

          <details class="editor-section">
            <summary>
              <span><strong>Sfeerbeeld</strong><small>Afbeelding over de volle breedte met quote</small></span>
              <b>03</b>
            </summary>
            <div class="section-body">
              <AdminMediaPicker v-model="form.publicCopy.visuals.aboutRoomImageUrl" label="Sfeerafbeelding" />
              <label>Alt-tekst afbeelding<input v-model="form.publicCopy.visuals.aboutRoomAlt"></label>
              <label>Bovenregel<input v-model="form.publicCopy.about.momentEyebrow"></label>
              <label>Quote<textarea v-model="form.publicCopy.about.momentQuote" rows="3" /></label>
              <label>Ondersteunende tekst<textarea v-model="form.publicCopy.about.momentBody" rows="4" /></label>
            </div>
          </details>

          <details class="editor-section">
            <summary>
              <span><strong>Principes</strong><small>Genummerde waarden of werkprincipes</small></span>
              <b>04</b>
            </summary>
            <div class="section-body">
              <div class="field-grid two">
                <label>Bovenregel<input v-model="form.publicCopy.about.principlesEyebrow"></label>
                <label>Titel<input v-model="form.publicCopy.about.principlesTitle"></label>
              </div>

              <div class="repeat-list">
                <article v-for="(principle, index) in form.publicCopy.about.principles" :key="index" class="repeat-card">
                  <div class="repeat-top">
                    <strong>Principe {{ index + 1 }}</strong>
                    <button type="button" class="danger-text" @click="form.publicCopy.about.principles.splice(index, 1)">Verwijderen</button>
                  </div>
                  <label>Titel<input v-model="principle.title"></label>
                  <label>Tekst<textarea v-model="principle.body" rows="3" /></label>
                </article>
              </div>
              <button type="button" class="secondary-button add-button" @click="addPrinciple"><Icon name="lucide:plus" aria-hidden="true" /> Principe toevoegen</button>
            </div>
          </details>

          <details class="editor-section">
            <summary>
              <span><strong>Afsluitende CTA</strong><small>Afsluitende uitnodiging om NightLight te boeken</small></span>
              <b>05</b>
            </summary>
            <div class="section-body">
              <label>Bovenregel<input v-model="form.publicCopy.about.ctaEyebrow"></label>
              <label>Titel<textarea v-model="form.publicCopy.about.ctaTitle" rows="3" /></label>
              <label>Knoptekst<input v-model="form.publicCopy.about.ctaLabel"></label>
            </div>
          </details>
        </section>

        <section v-else-if="activePage === 'media'" class="page-editor">
          <div class="page-intro">
            <p class="eyebrow">Publieke pagina · /media</p>
            <h2>Media</h2>
            <p>Beheer de intro, de uitgelichte showreel en de galerij, los van de andere pagina’s.</p>
          </div>

          <details class="editor-section" open>
            <summary>
              <span><strong>Intro</strong><small>Paginatitel, beschrijving en labels voor soorten media</small></span>
              <b>01</b>
            </summary>
            <div class="section-body">
              <label>Bovenregel<input v-model="form.mediaEyebrow"></label>
              <label>Kop<input v-model="form.mediaTitle"></label>
              <label>Tekst<textarea v-model="form.mediaBody" rows="5" /></label>
              <label>
                Labels soorten media · één per regel
                <textarea
                  :value="form.publicCopy.media.typeLabels.join('\n')"
                  rows="5"
                  @input="updateStringList(form.publicCopy.media.typeLabels, $event)"
                />
              </label>
            </div>
          </details>

          <details class="editor-section">
            <summary>
              <span><strong>Showreel</strong><small>Link naar uitgelichte video, afbeelding en ondersteunende tekst</small></span>
              <b>02</b>
            </summary>
            <div class="section-body">
              <label>Showreel-URL<input v-model="form.showreelUrl" type="url" placeholder="https://…"></label>
              <AdminMediaPicker v-model="form.publicCopy.visuals.mediaShowreelImageUrl" label="Achtergrondafbeelding showreel" />
              <label>Alt-tekst afbeelding<input v-model="form.publicCopy.visuals.mediaShowreelAlt"></label>
              <div class="field-grid two">
                <label>Bovenregel<input v-model="form.publicCopy.media.showreelEyebrow"></label>
                <label>Tekst externe link<input v-model="form.publicCopy.media.showreelExternalLabel"></label>
              </div>
              <label>Titel<input v-model="form.publicCopy.media.showreelTitle"></label>
              <label>Tekst<textarea v-model="form.publicCopy.media.showreelBody" rows="4" /></label>
            </div>
          </details>

          <details class="editor-section">
            <summary>
              <span><strong>Galerij</strong><small>Afbeeldingen, bijschriften en teksten voor aantallen</small></span>
              <b>03</b>
            </summary>
            <div class="section-body">
              <div class="field-grid three">
                <label>Bovenregel galerij<input v-model="form.publicCopy.media.galleryEyebrow"></label>
                <label>Woord voor één afbeelding<input v-model="form.publicCopy.media.imageSingular"></label>
                <label>Woord voor meerdere afbeeldingen<input v-model="form.publicCopy.media.imagePlural"></label>
              </div>

              <div class="subsection-heading">
                <div>
                  <h3>Afbeeldingen galerij</h3>
                  <p>De volgorde hier is de volgorde op de publieke mediapagina.</p>
                </div>
                <button type="button" class="secondary-button" @click="addImage"><Icon name="lucide:plus" aria-hidden="true" /> Afbeelding toevoegen</button>
              </div>

              <div class="repeat-list gallery-list">
                <article v-for="(image, index) in form.gallery" :key="index + '-' + image.url" class="repeat-card">
                  <div class="repeat-top">
                    <strong>Afbeelding {{ index + 1 }}</strong>
                    <div>
                      <button type="button" :disabled="index === 0" aria-label="Omhoog" title="Omhoog" @click="moveImage(index, -1)"><Icon name="lucide:arrow-up" aria-hidden="true" /></button>
                      <button type="button" :disabled="index === form.gallery.length - 1" aria-label="Omlaag" title="Omlaag" @click="moveImage(index, 1)"><Icon name="lucide:arrow-down" aria-hidden="true" /></button>
                      <button type="button" class="danger-text" @click="form.gallery.splice(index, 1)">Verwijderen</button>
                    </div>
                  </div>
                  <AdminMediaPicker
                    :model-value="image.url || null"
                    label="Afbeelding galerij"
                    @update:model-value="image.url = $event || ''"
                    @selected="applyGalleryAsset(image, $event)"
                  />
                  <label>Alt-tekst<input v-model="image.alt"></label>
                </article>
              </div>

              <button v-if="!form.gallery.length" type="button" class="empty-add" @click="addImage">
                + Add your first gallery image
              </button>
            </div>
          </details>

          <details class="editor-section">
            <summary>
              <span><strong>Lege staat & lightbox</strong><small>Tekst als er geen afbeeldingen zijn en bij het bekijken van één afbeelding</small></span>
              <b>04</b>
            </summary>
            <div class="section-body">
              <label>Bovenregel lege staat<input v-model="form.publicCopy.media.emptyEyebrow"></label>
              <label>Titel lege staat<textarea v-model="form.publicCopy.media.emptyTitle" rows="3" /></label>
              <label>Tekst lege staat<textarea v-model="form.publicCopy.media.emptyBody" rows="4" /></label>
              <label>
                Extra regels lege staat · één per regel
                <textarea
                  :value="form.publicCopy.media.emptyMeta.join('\n')"
                  rows="5"
                  @input="updateStringList(form.publicCopy.media.emptyMeta, $event)"
                />
              </label>
              <label>Sluittekst lightbox<input v-model="form.publicCopy.media.closeLabel"></label>
            </div>
          </details>
        </section>

        <section v-else-if="activePage === 'agenda'" class="page-editor">
          <div class="page-intro">
            <p class="eyebrow">Publieke pagina · /agenda</p>
            <h2>Agenda</h2>
            <p>Hier beheer je alleen de paginateksten; de publieke gigs komen nog steeds uit je gigs.</p>
          </div>

          <details class="editor-section" open>
            <summary>
              <span><strong>Intro</strong><small>Paginatitel en ondersteunende tekst</small></span>
              <b>01</b>
            </summary>
            <div class="section-body">
              <label>Bovenregel<input v-model="form.agendaEyebrow"></label>
              <label>Kop<input v-model="form.agendaTitle"></label>
              <label>Tekst<textarea v-model="form.agendaBody" rows="5" /></label>
            </div>
          </details>

          <details class="editor-section">
            <summary>
              <span><strong>Statusblok</strong><small>Blok met het actuele aantal naast de intro</small></span>
              <b>02</b>
            </summary>
            <div class="section-body">
              <label>Bovenregel status<input v-model="form.publicCopy.agenda.statusEyebrow"></label>
              <label>Laadtekst<input v-model="form.publicCopy.agenda.loadingLabel"></label>
              <div class="field-grid two">
                <label>Eén datum<input v-model="form.publicCopy.agenda.dateSingular"></label>
                <label>Meerdere datums<input v-model="form.publicCopy.agenda.datePlural"></label>
              </div>
              <label>Uitleg status<textarea v-model="form.publicCopy.agenda.statusBody" rows="4" /></label>
            </div>
          </details>

          <details class="editor-section">
            <summary>
              <span><strong>Lege staat</strong><small>Zichtbaar als er geen publieke gigs zijn</small></span>
              <b>03</b>
            </summary>
            <div class="section-body">
              <label>Markeringstekst<input v-model="form.publicCopy.agenda.emptyMarkerLabel"></label>
              <label>Bovenregel<input v-model="form.publicCopy.agenda.emptyEyebrow"></label>
              <label>Titel<input v-model="form.publicCopy.agenda.emptyTitle"></label>
              <label>Tekst<textarea v-model="form.publicCopy.agenda.emptyBody" rows="5" /></label>
              <label>Knoptekst<input v-model="form.publicCopy.agenda.emptyCta"></label>
            </div>
          </details>

          <details class="editor-section">
            <summary>
              <span><strong>Teksten gig-lijst</strong><small>Teksten rond de automatische lijst met gigs</small></span>
              <b>04</b>
            </summary>
            <div class="section-body">
              <label>Bovenregel lijst<input v-model="form.publicCopy.agenda.listEyebrow"></label>
            </div>
          </details>

          <details class="editor-section">
            <summary>
              <span><strong>Footer-CTA</strong><small>Afsluitende uitnodiging om te boeken</small></span>
              <b>05</b>
            </summary>
            <div class="section-body">
              <label>Bovenregel<input v-model="form.publicCopy.agenda.footerEyebrow"></label>
              <label>Titel<textarea v-model="form.publicCopy.agenda.footerTitle" rows="3" /></label>
              <label>Tekst<textarea v-model="form.publicCopy.agenda.footerBody" rows="4" /></label>
              <label>Knoptekst<input v-model="form.publicCopy.agenda.footerCta"></label>
            </div>
          </details>
        </section>

        <section v-else-if="activePage === 'booking'" class="page-editor">
          <div class="page-intro">
            <p class="eyebrow">Publieke pagina · /boeken</p>
            <h2>Boeken</h2>
            <p>Bewerk de publieke aanvraagpagina, van de openingstekst tot de meldingen van het formulier.</p>
          </div>

          <details class="editor-section" open>
            <summary>
              <span><strong>Intro & direct contact</strong><small>Paginakop en contactgegevens</small></span>
              <b>01</b>
            </summary>
            <div class="section-body">
              <p class="section-note">De introtekst wordt ook gebruikt in de afsluitende CTA op de homepage.</p>
              <label>Bovenregel<input v-model="form.bookingEyebrow"></label>
              <label>Kop<input v-model="form.bookingTitle"></label>
              <label>Tekst<textarea v-model="form.bookingBody" rows="5" /></label>
              <div class="field-grid two">
                <label>E-mail<input v-model="form.contactEmail" type="email"></label>
                <label>Telefoon<input v-model="form.contactPhone"></label>
              </div>
            </div>
          </details>

          <details class="editor-section">
            <summary>
              <span><strong>Formulierlabels</strong><small>Veldnamen die bezoekers in het aanvraagformulier zien</small></span>
              <b>02</b>
            </summary>
            <div class="section-body">
              <div class="field-grid two">
                <label>Naam<input v-model="form.publicCopy.booking.nameLabel"></label>
                <label>Bedrijf<input v-model="form.publicCopy.booking.companyLabel"></label>
                <label>E-mail<input v-model="form.publicCopy.booking.emailLabel"></label>
                <label>Telefoon<input v-model="form.publicCopy.booking.phoneLabel"></label>
                <label>Soort evenement<input v-model="form.publicCopy.booking.eventTypeLabel"></label>
                <label>Datum<input v-model="form.publicCopy.booking.dateLabel"></label>
                <label>Locatie<input v-model="form.publicCopy.booking.locationLabel"></label>
                <label>Tekst voor optioneel<input v-model="form.publicCopy.booking.optionalLabel"></label>
              </div>
              <label>Label bericht<input v-model="form.publicCopy.booking.messageLabel"></label>
            </div>
          </details>

          <details class="editor-section">
            <summary>
              <span><strong>Voorbeeldteksten & verzendknop</strong><small>Hulptekst in de velden en tekst op de verzendknop</small></span>
              <b>03</b>
            </summary>
            <div class="section-body">
              <label>Voorbeeldtekst soort evenement<input v-model="form.publicCopy.booking.eventTypePlaceholder"></label>
              <label>Voorbeeldtekst locatie<input v-model="form.publicCopy.booking.locationPlaceholder"></label>
              <label>Voorbeeldtekst bericht<textarea v-model="form.publicCopy.booking.messagePlaceholder" rows="3" /></label>
              <div class="field-grid two">
                <label>Verzendknop<input v-model="form.publicCopy.booking.submitLabel"></label>
                <label>Knop tijdens verzenden<input v-model="form.publicCopy.booking.sendingLabel"></label>
              </div>
            </div>
          </details>

          <details class="editor-section">
            <summary>
              <span><strong>Bevestiging & foutmelding</strong><small>Melding nadat de bezoeker het formulier verstuurt</small></span>
              <b>04</b>
            </summary>
            <div class="section-body">
              <label>Bovenregel bevestiging<input v-model="form.publicCopy.booking.successEyebrow"></label>
              <label>Titel bevestiging<input v-model="form.publicCopy.booking.successTitle"></label>
              <label>Tekst bevestiging<textarea v-model="form.publicCopy.booking.successBody" rows="4" /></label>
              <label>Standaard foutmelding<textarea v-model="form.publicCopy.booking.errorFallback" rows="4" /></label>
            </div>
          </details>
        </section>

        <section v-else class="page-editor">
          <div class="page-intro">
            <p class="eyebrow">Gedeeld op de hele publieke site</p>
            <h2>Algemeen & SEO</h2>
            <p>Navigatie, footer, sociale links en metadata staan hier, los van de afzonderlijke pagina’s.</p>
          </div>

          <details class="editor-section" open>
            <summary>
              <span><strong>Identiteit & navigatie</strong><small>Merknaam, menuteksten en teksten voor het mobiele menu</small></span>
              <b>01</b>
            </summary>
            <div class="section-body">
              <label>Merknaam<input v-model="form.brandName"></label>
              <div class="field-grid three">
                <label>Home<input v-model="form.publicCopy.navigation.home"></label>
                <label>Over<input v-model="form.publicCopy.navigation.about"></label>
                <label>Media<input v-model="form.publicCopy.navigation.media"></label>
                <label>Agenda<input v-model="form.publicCopy.navigation.agenda"></label>
                <label>Boeken<input v-model="form.publicCopy.navigation.booking"></label>
                <label>Menu<input v-model="form.publicCopy.navigation.menu"></label>
                <label>Sluiten<input v-model="form.publicCopy.navigation.close"></label>
              </div>
              <div class="field-grid two">
                <label>Bovenregel boeken (mobiel)<input v-model="form.publicCopy.navigation.mobileEyebrow"></label>
                <label>Boekknop (mobiel)<input v-model="form.publicCopy.navigation.mobileBooking"></label>
              </div>
            </div>
          </details>

          <details class="editor-section">
            <summary>
              <span><strong>Footer</strong><small>Afsluitende CTA en linkteksten op de hele site</small></span>
              <b>02</b>
            </summary>
            <div class="section-body">
              <label>Bovenregel<input v-model="form.publicCopy.footer.eyebrow"></label>
              <label>Titel<textarea v-model="form.publicCopy.footer.title" rows="3" /></label>
              <div class="field-grid two">
                <label>CTA-tekst<input v-model="form.publicCopy.footer.cta"></label>
                <label>Locatie<input v-model="form.publicCopy.footer.location"></label>
              </div>
              <div class="field-grid three">
                <label>Tekst Instagram<input v-model="form.publicCopy.footer.instagram"></label>
                <label>Tekst Spotify<input v-model="form.publicCopy.footer.spotify"></label>
                <label>Tekst e-mail<input v-model="form.publicCopy.footer.email"></label>
              </div>
            </div>
          </details>

          <details class="editor-section">
            <summary>
              <span><strong>Contact & sociale links</strong><small>De echte bestemmingen die op de site worden gebruikt</small></span>
              <b>03</b>
            </summary>
            <div class="section-body">
              <div class="field-grid two">
                <label>E-mail<input v-model="form.contactEmail" type="email"></label>
                <label>Telefoon<input v-model="form.contactPhone"></label>
                <label>Instagram-URL<input v-model="form.instagramUrl" type="url" placeholder="https://…"></label>
                <label>Spotify-URL<input v-model="form.spotifyUrl" type="url" placeholder="https://…"></label>
              </div>
            </div>
          </details>

          <details class="editor-section">
            <summary>
              <span><strong>SEO & delen</strong><small>Standaard zoekresultaat en voorbeeld bij het delen van links</small></span>
              <b>04</b>
            </summary>
            <div class="section-body">
              <label>Standaardtitel<input v-model="form.seoTitle"></label>
              <label>Beschrijving<textarea v-model="form.seoDescription" rows="4" /></label>
              <AdminMediaPicker
                v-model="form.seoImageUrl"
                label="Afbeelding voor delen"
                description="Gebruikt voor linkvoorbeelden. Is deze leeg, dan wordt de hero-afbeelding gebruikt."
              />
            </div>
          </details>

          <details class="editor-section">
            <summary>
              <span><strong>Gedeeld blok landing pages</strong><small>Gedeelde CTA in de zijbalk van landing pages voor diensten</small></span>
              <b>05</b>
            </summary>
            <div class="section-body">
              <p class="section-note">De inhoud per landing page staat in Back office <Icon name="lucide:chevron-right" aria-hidden="true" /> Landing pages. Dit is alleen het blok dat ze allemaal delen.</p>
              <label>Bovenregel<input v-model="form.publicCopy.landing.asideEyebrow"></label>
              <label>Titel<input v-model="form.publicCopy.landing.asideTitle"></label>
              <label>Tekst<textarea v-model="form.publicCopy.landing.asideBody" rows="4" /></label>
              <label>Knoptekst<input v-model="form.publicCopy.landing.asideCta"></label>
            </div>
          </details>
        </section>
      </main>
    </div>
  </form>
</template>

<style scoped>
.content-editor {
  width: 100%;
  max-width: 1320px;
  margin: 0 auto;
}

.editor-topbar {
  position: sticky;
  top: -2rem;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 1.25rem;
  flex-wrap: wrap;
  margin: -2rem calc(clamp(1.25rem, 4vw, 3.5rem) * -1) 1.5rem;
  padding: 1.15rem clamp(1.25rem, 4vw, 3.5rem);
  border-bottom: 1px solid #26222c;
  background: rgba(10, 9, 13, .95);
  backdrop-filter: blur(16px);
}

.topbar-title {
  min-width: 14rem;
}

.eyebrow {
  margin: 0;
  color: #7f7788;
  font-size: .67rem;
  font-weight: 800;
  letter-spacing: .12em;
  text-transform: uppercase;
}

.topbar-title h1 {
  margin: .2rem 0 .1rem;
  font-size: clamp(1.65rem, 3vw, 2.25rem);
  letter-spacing: -.045em;
}

.topbar-title > p:last-child {
  margin: 0;
  color: #827b89;
  font-size: .78rem;
}

.save-status {
  display: flex;
  align-items: center;
  gap: .5rem;
  color: #928b99;
  font-size: .78rem;
  font-weight: 650;
}

.status-dot {
  width: .45rem;
  height: .45rem;
  border-radius: 50%;
  background: #615a68;
}

.save-status.is-dirty .status-dot { background: #d7aa6a; }
.save-status.is-saving .status-dot { background: #b8a9d5; box-shadow: 0 0 0 .25rem rgba(184, 169, 213, .08); }
.save-status.is-success { color: #9bd2a9; }
.save-status.is-success .status-dot { background: #78c68d; }
.save-status.is-error { color: #ef9fad; }
.save-status.is-error .status-dot { background: #e27e90; }

.topbar-actions {
  display: flex;
  gap: .55rem;
  margin-left: auto;
}

.primary-button,
.secondary-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 2.45rem;
  border-radius: .65rem;
  padding: .62rem .85rem;
  font-size: .78rem;
  font-weight: 800;
  text-decoration: none;
  cursor: pointer;
}

.primary-button {
  border: 0;
  background: #fff;
  color: #09080b;
}

.primary-button:disabled {
  opacity: .55;
  cursor: not-allowed;
}

.secondary-button {
  border: 1px solid #393340;
  background: #151219;
  color: #d3ccd8;
}

.editor-shell {
  display: grid;
  grid-template-columns: 230px minmax(0, 1fr);
  gap: 1.25rem;
  align-items: start;
}

.page-sidebar {
  position: sticky;
  top: 6.2rem;
  border: 1px solid #29242f;
  border-radius: 1rem;
  background: #100e14;
  overflow: hidden;
}

.sidebar-label {
  display: grid;
  gap: .18rem;
  padding: .9rem .9rem .75rem;
  border-bottom: 1px solid #29242f;
}

.sidebar-label span {
  color: #d8d2de;
  font-size: .78rem;
  font-weight: 800;
}

.sidebar-label small {
  color: #6f6876;
  font-size: .67rem;
}

.page-sidebar nav {
  display: grid;
  gap: .18rem;
  padding: .45rem;
}

.page-sidebar nav button {
  display: grid;
  gap: .15rem;
  width: 100%;
  border: 0;
  border-radius: .7rem;
  padding: .7rem .75rem;
  background: transparent;
  color: #a7a0ae;
  text-align: left;
  cursor: pointer;
}

.page-sidebar nav button:hover {
  background: #17141b;
}

.page-sidebar nav button.active {
  background: #211a29;
  color: #fff;
}

.page-sidebar nav span {
  font-size: .8rem;
  font-weight: 800;
}

.page-sidebar nav small {
  color: #716a78;
  font-size: .65rem;
}

.page-sidebar nav button.active small {
  color: #a79caf;
}

.sidebar-note {
  padding: .85rem .9rem 1rem;
  border-top: 1px solid #29242f;
}

.sidebar-note strong {
  color: #bbb4c2;
  font-size: .72rem;
}

.sidebar-note p {
  margin: .3rem 0 .55rem;
  color: #777080;
  font-size: .67rem;
  line-height: 1.5;
}

.sidebar-note a {
  color: #aaa0b5;
  font-size: .68rem;
}

.page-workspace {
  min-width: 0;
}

.page-editor {
  width: 100%;
  max-width: 920px;
}

.page-intro {
  margin-bottom: 1rem;
  padding: .4rem .2rem .9rem;
}

.page-intro h2 {
  margin: .25rem 0 .35rem;
  font-size: clamp(2.2rem, 4.5vw, 3.7rem);
  letter-spacing: -.055em;
}

.page-intro > p:last-child {
  max-width: 45rem;
  margin: 0;
  color: #8f8896;
  font-size: .86rem;
  line-height: 1.6;
}

.editor-section {
  margin-bottom: .75rem;
  border: 1px solid #2b2631;
  border-radius: .9rem;
  background: #100e14;
  overflow: hidden;
}

.editor-section summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  min-height: 4.3rem;
  padding: .85rem 1rem;
  cursor: pointer;
  list-style: none;
}

.editor-section summary::-webkit-details-marker {
  display: none;
}

.editor-section summary > span {
  display: grid;
  gap: .15rem;
}

.editor-section summary strong {
  color: #e1dbe6;
  font-size: .86rem;
}

.editor-section summary small {
  color: #77707f;
  font-size: .68rem;
  font-weight: 500;
}

.editor-section summary b {
  display: grid;
  min-width: 2rem;
  height: 2rem;
  place-items: center;
  border: 1px solid #312b36;
  border-radius: .55rem;
  color: #706978;
  font-size: .64rem;
}

.editor-section[open] summary {
  border-bottom: 1px solid #29242f;
  background: #131017;
}

.editor-section[open] summary b {
  color: #b9aec4;
  border-color: #463a50;
}

.section-body {
  display: grid;
  gap: .9rem;
  padding: 1rem;
}

.section-body label,
.repeat-card label {
  display: grid;
  gap: .38rem;
  color: #a9a2b0;
  font-size: .76rem;
}

.section-body input,
.section-body textarea,
.repeat-card input,
.repeat-card textarea {
  width: 100%;
  border: 1px solid #332e39;
  border-radius: .65rem;
  padding: .72rem .75rem;
  background: #0b0a0d;
  color: #f6f3fa;
  font: inherit;
}

.section-body textarea,
.repeat-card textarea {
  resize: vertical;
  line-height: 1.5;
}

.section-body input:focus,
.section-body textarea:focus,
.repeat-card input:focus,
.repeat-card textarea:focus {
  outline: 2px solid rgba(181, 153, 219, .22);
  outline-offset: 1px;
  border-color: #645570;
}

.field-grid {
  display: grid;
  gap: .8rem;
}

.field-grid.two { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.field-grid.three { grid-template-columns: repeat(3, minmax(0, 1fr)); }

.section-note {
  margin: 0;
  padding: .75rem .85rem;
  border: 1px solid #302a36;
  border-radius: .7rem;
  background: #0d0b10;
  color: #817988;
  font-size: .7rem;
  line-height: 1.55;
}

.subsection-heading {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 1rem;
  margin-top: .25rem;
  padding-top: .9rem;
  border-top: 1px solid #28232d;
}

.subsection-heading h3 {
  margin: 0 0 .2rem;
  font-size: .9rem;
}

.subsection-heading p {
  margin: 0;
  color: #76707d;
  font-size: .69rem;
  line-height: 1.45;
}

.repeat-list {
  display: grid;
  gap: .7rem;
}

.repeat-card {
  display: grid;
  gap: .75rem;
  padding: .9rem;
  border: 1px solid #2b2631;
  border-radius: .8rem;
  background: #0d0b10;
}

.repeat-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: .8rem;
}

.repeat-top strong {
  color: #d8d2dd;
  font-size: .75rem;
}

.repeat-top > div {
  display: flex;
  align-items: center;
  gap: .25rem;
}

.repeat-top button {
  border: 0;
  border-radius: .45rem;
  padding: .35rem .45rem;
  background: #19151e;
  color: #918999;
  font-size: .68rem;
  cursor: pointer;
}

.repeat-top button:disabled {
  opacity: .3;
  cursor: not-allowed;
}

.repeat-top .danger-text,
.danger-text {
  border: 0;
  background: transparent;
  color: #dc8b99;
  cursor: pointer;
}

.add-button {
  justify-self: start;
}

.empty-add {
  min-height: 7rem;
  border: 1px dashed #43394b;
  border-radius: .8rem;
  background: #0d0b10;
  color: #aaa2b2;
  cursor: pointer;
}

@media (max-width: 1050px) {
  .editor-topbar {
    top: 0;
    margin-top: -1.5rem;
  }

  .editor-shell {
    grid-template-columns: 1fr;
  }

  .page-sidebar {
    position: static;
  }

  .page-sidebar nav {
    display: flex;
    overflow-x: auto;
    padding: .45rem;
  }

  .page-sidebar nav button {
    min-width: 9rem;
  }

  .sidebar-label,
  .sidebar-note {
    display: none;
  }

  .page-editor {
    max-width: none;
  }
}

@media (max-width: 720px) {
  .editor-topbar {
    align-items: flex-start;
    margin-inline: -1.25rem;
    padding-inline: 1.25rem;
  }

  .topbar-title {
    width: 100%;
  }

  .save-status {
    order: 3;
    width: 100%;
  }

  .topbar-actions {
    margin-left: 0;
  }

  .field-grid.two,
  .field-grid.three {
    grid-template-columns: 1fr;
  }

  .subsection-heading {
    align-items: stretch;
    flex-direction: column;
  }

  .subsection-heading .secondary-button {
    width: 100%;
  }

  .repeat-top {
    align-items: flex-start;
    flex-direction: column;
  }

  .repeat-top > div {
    width: 100%;
  }
}
</style>
