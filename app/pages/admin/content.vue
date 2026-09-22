<script setup lang="ts">
import { apiErrorMessage } from '~/utils/api-error'
import type { PublicSiteContent } from '~/types/site-content'

definePageMeta({ layout: 'admin' })

type PageKey = 'home' | 'about' | 'media' | 'agenda' | 'booking' | 'shared'
type PickerAsset = { altText: string, title: string }

const pages: Array<{ key: PageKey, label: string, hint: string, href: string }> = [
  { key: 'home', label: 'Homepage', hint: 'Hero, sections & CTA', href: '/' },
  { key: 'about', label: 'About', hint: 'Story & principles', href: '/about' },
  { key: 'media', label: 'Media', hint: 'Showreel & gallery', href: '/media' },
  { key: 'agenda', label: 'Agenda', hint: 'Status, list & empty state', href: '/agenda' },
  { key: 'booking', label: 'Booking', hint: 'Intro, form & success', href: '/boeken' },
  { key: 'shared', label: 'Shared & SEO', hint: 'Navigation, footer & metadata', href: '/' },
]

const { data } = await useFetch<{ content: PublicSiteContent }>('/api/admin/content')
if (!data.value) throw createError({ statusCode: 500, statusMessage: 'Could not load website content' })

const form = reactive({
  ...data.value.content,
  services: data.value.content.services.map(item => ({ ...item })),
  gallery: data.value.content.gallery.map(item => ({ ...item })),
  publicCopy: structuredClone(data.value.content.publicCopy),
})

const activePage = ref<PageKey>('home')
const saving = ref(false)
const message = ref('No unsaved changes.')
const messageKind = ref<'idle' | 'dirty' | 'saving' | 'success' | 'error'>('idle')

const activePageMeta = computed(() => pages.find(page => page.key === activePage.value) ?? pages[0]!)

watch(
  form,
  () => {
    if (saving.value) return
    messageKind.value = 'dirty'
    message.value = 'Unsaved changes.'
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
  form.publicCopy.about.principles.push({ title: 'New principle', body: 'Describe this principle.' })
}

async function save() {
  saving.value = true
  messageKind.value = 'saving'
  message.value = 'Saving website…'
  try {
    await $fetch('/api/admin/content', { method: 'PUT', body: form })
    messageKind.value = 'success'
    message.value = 'Website saved. Changes are public.'
    await refreshNuxtData('nightlight-site-content')
  } catch (error: unknown) {
    messageKind.value = 'error'
    message.value = apiErrorMessage(error, 'Could not save website content.')
  } finally {
    saving.value = false
  }
}

useSeoMeta({ title: 'Website content — DJ NightLight', robots: 'noindex, nofollow' })
</script>

<template>
  <form class="content-editor" novalidate @submit.prevent="save">
    <header class="editor-topbar">
      <div class="topbar-title">
        <p class="eyebrow">Website editor</p>
        <h1>{{ activePageMeta.label }}</h1>
        <p>{{ activePageMeta.hint }}</p>
      </div>

      <div class="save-status" :class="'is-' + messageKind" aria-live="polite">
        <span class="status-dot" />
        {{ message }}
      </div>

      <div class="topbar-actions">
        <NuxtLink :to="activePageMeta.href" target="_blank" class="secondary-button">
          View page ↗
        </NuxtLink>
        <button class="primary-button" type="submit" :disabled="saving">
          {{ saving ? 'Saving…' : 'Save website' }}
        </button>
      </div>
    </header>

    <div class="editor-shell">
      <aside class="page-sidebar">
        <div class="sidebar-label">
          <span>Pages</span>
          <small>Edit content where visitors see it</small>
        </div>

        <nav aria-label="Public website pages">
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
          <p>Individual service landing pages stay in the dedicated Landing pages editor.</p>
          <NuxtLink to="/admin/landing-pages">Open landing pages →</NuxtLink>
        </div>
      </aside>

      <main class="page-workspace">
        <section v-if="activePage === 'home'" class="page-editor">
          <div class="page-intro">
            <p class="eyebrow">Public page · /</p>
            <h2>Homepage</h2>
            <p>Sections are ordered exactly like the public homepage. Open only the part you are working on.</p>
          </div>

          <details class="editor-section" open>
            <summary>
              <span><strong>Hero</strong><small>Opening copy, image and primary actions</small></span>
              <b>01</b>
            </summary>
            <div class="section-body">
              <div class="field-grid two">
                <label>Eyebrow<input v-model="form.heroEyebrow"></label>
                <label>Primary button<input v-model="form.heroCtaLabel"></label>
              </div>
              <label>Headline<textarea v-model="form.heroTitle" rows="3" /></label>
              <label>Intro text<textarea v-model="form.heroBody" rows="5" /></label>
              <AdminMediaPicker
                v-model="form.heroImageUrl"
                label="Hero image"
                description="Large background image behind the opening copy."
              />
              <div class="field-grid two">
                <label>Secondary button<input v-model="form.publicCopy.home.secondaryCta"></label>
                <label>Scroll label<input v-model="form.publicCopy.home.scrollLabel"></label>
              </div>
              <label>Image caption<input v-model="form.publicCopy.home.heroCaption"></label>
            </div>
          </details>

          <details class="editor-section">
            <summary>
              <span><strong>Feature visual</strong><small>Large visual moment directly below the hero</small></span>
              <b>02</b>
            </summary>
            <div class="section-body">
              <label>Eyebrow<input v-model="form.publicCopy.home.visualEyebrow"></label>
              <label>Supporting text<textarea v-model="form.publicCopy.home.visualBody" rows="4" /></label>
              <AdminMediaPicker v-model="form.publicCopy.visuals.homeFeatureImageUrl" label="Feature image" />
              <div class="field-grid two">
                <label>Image caption<input v-model="form.publicCopy.home.visualCaption"></label>
                <label>Image alt text<input v-model="form.publicCopy.visuals.homeFeatureAlt"></label>
              </div>
            </div>
          </details>

          <details class="editor-section">
            <summary>
              <span><strong>About teaser</strong><small>Homepage introduction to NightLight</small></span>
              <b>03</b>
            </summary>
            <div class="section-body">
              <p class="section-note">The heading and body are shared with the About page. Editing them here changes both locations.</p>
              <label>Eyebrow<input v-model="form.aboutEyebrow"></label>
              <label>Heading<input v-model="form.aboutTitle"></label>
              <label>Body<textarea v-model="form.aboutBody" rows="6" /></label>
              <AdminMediaPicker v-model="form.publicCopy.visuals.homeAboutImageUrl" label="Homepage About image" />
              <div class="field-grid two">
                <label>Link label<input v-model="form.publicCopy.home.aboutCta"></label>
                <label>Image caption<input v-model="form.publicCopy.home.aboutImageCaption"></label>
              </div>
              <label>Image alt text<input v-model="form.publicCopy.visuals.homeAboutAlt"></label>
            </div>
          </details>

          <details class="editor-section">
            <summary>
              <span><strong>Services</strong><small>Homepage service cards and introduction</small></span>
              <b>04</b>
            </summary>
            <div class="section-body">
              <div class="field-grid two">
                <label>Section eyebrow<input v-model="form.publicCopy.home.servicesEyebrow"></label>
                <label>Section intro<textarea v-model="form.publicCopy.home.servicesBody" rows="3" /></label>
              </div>

              <div class="subsection-heading">
                <div>
                  <h3>Service cards</h3>
                  <p>These cards appear on the homepage. Full service pages are edited under Landing pages.</p>
                </div>
                <button type="button" class="secondary-button" @click="addService">+ Add service</button>
              </div>

              <div class="repeat-list">
                <article v-for="(service, index) in form.services" :key="index" class="repeat-card">
                  <div class="repeat-top">
                    <strong>Service {{ index + 1 }}</strong>
                    <div>
                      <button type="button" :disabled="index === 0" @click="moveService(index, -1)">↑</button>
                      <button type="button" :disabled="index === form.services.length - 1" @click="moveService(index, 1)">↓</button>
                      <button type="button" class="danger-text" @click="form.services.splice(index, 1)">Remove</button>
                    </div>
                  </div>
                  <label>Title<input v-model="service.title"></label>
                  <label>Description<textarea v-model="service.body" rows="4" /></label>
                  <AdminMediaPicker
                    v-model="service.imageUrl"
                    label="Card image"
                    description="Optional dedicated image for this service."
                  />
                  <label>Image alt text<input v-model="service.imageAlt"></label>
                </article>
              </div>
            </div>
          </details>

          <details class="editor-section">
            <summary>
              <span><strong>Social proof</strong><small>Quote and event-type chips</small></span>
              <b>05</b>
            </summary>
            <div class="section-body">
              <label>Eyebrow<input v-model="form.publicCopy.home.proofEyebrow"></label>
              <label>Quote<textarea v-model="form.publicCopy.home.proofQuote" rows="4" /></label>
              <label>
                Tags · one per line
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
              <span><strong>Closing booking CTA</strong><small>Final homepage call to action</small></span>
              <b>06</b>
            </summary>
            <div class="section-body">
              <p class="section-note">This intro copy is also used at the top of the Booking page.</p>
              <label>Eyebrow<input v-model="form.bookingEyebrow"></label>
              <label>Heading<input v-model="form.bookingTitle"></label>
              <label>Body<textarea v-model="form.bookingBody" rows="5" /></label>
              <label>Button label<input v-model="form.publicCopy.home.bookingCta"></label>
            </div>
          </details>
        </section>

        <section v-else-if="activePage === 'about'" class="page-editor">
          <div class="page-intro">
            <p class="eyebrow">Public page · /about</p>
            <h2>About</h2>
            <p>Edit the About page in the same order visitors move through it.</p>
          </div>

          <details class="editor-section" open>
            <summary>
              <span><strong>Intro</strong><small>Page title, lead copy and opening image</small></span>
              <b>01</b>
            </summary>
            <div class="section-body">
              <p class="section-note">The main heading and body are also reused in the homepage About teaser.</p>
              <label>Eyebrow<input v-model="form.aboutEyebrow"></label>
              <label>Heading<input v-model="form.aboutTitle"></label>
              <label>Lead copy<textarea v-model="form.aboutBody" rows="6" /></label>
              <AdminMediaPicker v-model="form.publicCopy.visuals.aboutLeadImageUrl" label="Lead image" />
              <div class="field-grid two">
                <label>Image eyebrow<input v-model="form.publicCopy.about.imageEyebrow"></label>
                <label>Image caption<input v-model="form.publicCopy.about.imageCaption"></label>
              </div>
              <label>Image alt text<input v-model="form.publicCopy.visuals.aboutLeadAlt"></label>
            </div>
          </details>

          <details class="editor-section">
            <summary>
              <span><strong>Story</strong><small>Long-form story section</small></span>
              <b>02</b>
            </summary>
            <div class="section-body">
              <label>Story title<textarea v-model="form.publicCopy.about.storyTitle" rows="3" /></label>
              <label>Paragraph 1<textarea v-model="form.publicCopy.about.storyBody1" rows="5" /></label>
              <label>Paragraph 2<textarea v-model="form.publicCopy.about.storyBody2" rows="5" /></label>
            </div>
          </details>

          <details class="editor-section">
            <summary>
              <span><strong>Moment visual</strong><small>Full-width room image and quote</small></span>
              <b>03</b>
            </summary>
            <div class="section-body">
              <AdminMediaPicker v-model="form.publicCopy.visuals.aboutRoomImageUrl" label="Room image" />
              <label>Image alt text<input v-model="form.publicCopy.visuals.aboutRoomAlt"></label>
              <label>Eyebrow<input v-model="form.publicCopy.about.momentEyebrow"></label>
              <label>Quote<textarea v-model="form.publicCopy.about.momentQuote" rows="3" /></label>
              <label>Supporting text<textarea v-model="form.publicCopy.about.momentBody" rows="4" /></label>
            </div>
          </details>

          <details class="editor-section">
            <summary>
              <span><strong>Principles</strong><small>Numbered values or working principles</small></span>
              <b>04</b>
            </summary>
            <div class="section-body">
              <div class="field-grid two">
                <label>Eyebrow<input v-model="form.publicCopy.about.principlesEyebrow"></label>
                <label>Title<input v-model="form.publicCopy.about.principlesTitle"></label>
              </div>

              <div class="repeat-list">
                <article v-for="(principle, index) in form.publicCopy.about.principles" :key="index" class="repeat-card">
                  <div class="repeat-top">
                    <strong>Principle {{ index + 1 }}</strong>
                    <button type="button" class="danger-text" @click="form.publicCopy.about.principles.splice(index, 1)">Remove</button>
                  </div>
                  <label>Title<input v-model="principle.title"></label>
                  <label>Body<textarea v-model="principle.body" rows="3" /></label>
                </article>
              </div>
              <button type="button" class="secondary-button add-button" @click="addPrinciple">+ Add principle</button>
            </div>
          </details>

          <details class="editor-section">
            <summary>
              <span><strong>Final CTA</strong><small>Closing prompt to book NightLight</small></span>
              <b>05</b>
            </summary>
            <div class="section-body">
              <label>Eyebrow<input v-model="form.publicCopy.about.ctaEyebrow"></label>
              <label>Title<textarea v-model="form.publicCopy.about.ctaTitle" rows="3" /></label>
              <label>Button label<input v-model="form.publicCopy.about.ctaLabel"></label>
            </div>
          </details>
        </section>

        <section v-else-if="activePage === 'media'" class="page-editor">
          <div class="page-intro">
            <p class="eyebrow">Public page · /media</p>
            <h2>Media</h2>
            <p>Manage the page intro, featured showreel and gallery without mixing them with other pages.</p>
          </div>

          <details class="editor-section" open>
            <summary>
              <span><strong>Intro</strong><small>Page title, description and media-type chips</small></span>
              <b>01</b>
            </summary>
            <div class="section-body">
              <label>Eyebrow<input v-model="form.mediaEyebrow"></label>
              <label>Heading<input v-model="form.mediaTitle"></label>
              <label>Body<textarea v-model="form.mediaBody" rows="5" /></label>
              <label>
                Media type chips · one per line
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
              <span><strong>Showreel</strong><small>Featured video link, image and supporting copy</small></span>
              <b>02</b>
            </summary>
            <div class="section-body">
              <label>Showreel URL<input v-model="form.showreelUrl" type="url" placeholder="https://…"></label>
              <AdminMediaPicker v-model="form.publicCopy.visuals.mediaShowreelImageUrl" label="Showreel background image" />
              <label>Image alt text<input v-model="form.publicCopy.visuals.mediaShowreelAlt"></label>
              <div class="field-grid two">
                <label>Eyebrow<input v-model="form.publicCopy.media.showreelEyebrow"></label>
                <label>External-link label<input v-model="form.publicCopy.media.showreelExternalLabel"></label>
              </div>
              <label>Title<input v-model="form.publicCopy.media.showreelTitle"></label>
              <label>Body<textarea v-model="form.publicCopy.media.showreelBody" rows="4" /></label>
            </div>
          </details>

          <details class="editor-section">
            <summary>
              <span><strong>Gallery</strong><small>Image pool, captions and count labels</small></span>
              <b>03</b>
            </summary>
            <div class="section-body">
              <div class="field-grid three">
                <label>Gallery eyebrow<input v-model="form.publicCopy.media.galleryEyebrow"></label>
                <label>Singular image word<input v-model="form.publicCopy.media.imageSingular"></label>
                <label>Plural image word<input v-model="form.publicCopy.media.imagePlural"></label>
              </div>

              <div class="subsection-heading">
                <div>
                  <h3>Gallery images</h3>
                  <p>The order here is the order used on the public media page.</p>
                </div>
                <button type="button" class="secondary-button" @click="addImage">+ Add image</button>
              </div>

              <div class="repeat-list gallery-list">
                <article v-for="(image, index) in form.gallery" :key="index + '-' + image.url" class="repeat-card">
                  <div class="repeat-top">
                    <strong>Image {{ index + 1 }}</strong>
                    <div>
                      <button type="button" :disabled="index === 0" @click="moveImage(index, -1)">↑</button>
                      <button type="button" :disabled="index === form.gallery.length - 1" @click="moveImage(index, 1)">↓</button>
                      <button type="button" class="danger-text" @click="form.gallery.splice(index, 1)">Remove</button>
                    </div>
                  </div>
                  <AdminMediaPicker
                    :model-value="image.url || null"
                    label="Gallery image"
                    @update:model-value="image.url = $event || ''"
                    @selected="applyGalleryAsset(image, $event)"
                  />
                  <label>Alt text<input v-model="image.alt"></label>
                </article>
              </div>

              <button v-if="!form.gallery.length" type="button" class="empty-add" @click="addImage">
                + Add your first gallery image
              </button>
            </div>
          </details>

          <details class="editor-section">
            <summary>
              <span><strong>Empty & lightbox states</strong><small>Copy shown when there are no images and when viewing one</small></span>
              <b>04</b>
            </summary>
            <div class="section-body">
              <label>Empty-state eyebrow<input v-model="form.publicCopy.media.emptyEyebrow"></label>
              <label>Empty-state title<textarea v-model="form.publicCopy.media.emptyTitle" rows="3" /></label>
              <label>Empty-state body<textarea v-model="form.publicCopy.media.emptyBody" rows="4" /></label>
              <label>
                Empty-state meta · one per line
                <textarea
                  :value="form.publicCopy.media.emptyMeta.join('\n')"
                  rows="5"
                  @input="updateStringList(form.publicCopy.media.emptyMeta, $event)"
                />
              </label>
              <label>Lightbox close label<input v-model="form.publicCopy.media.closeLabel"></label>
            </div>
          </details>
        </section>

        <section v-else-if="activePage === 'agenda'" class="page-editor">
          <div class="page-intro">
            <p class="eyebrow">Public page · /agenda</p>
            <h2>Agenda</h2>
            <p>Only the page copy is managed here; public gig data still comes from your gigs.</p>
          </div>

          <details class="editor-section" open>
            <summary>
              <span><strong>Intro</strong><small>Page title and supporting text</small></span>
              <b>01</b>
            </summary>
            <div class="section-body">
              <label>Eyebrow<input v-model="form.agendaEyebrow"></label>
              <label>Heading<input v-model="form.agendaTitle"></label>
              <label>Body<textarea v-model="form.agendaBody" rows="5" /></label>
            </div>
          </details>

          <details class="editor-section">
            <summary>
              <span><strong>Status panel</strong><small>Live count block beside the page intro</small></span>
              <b>02</b>
            </summary>
            <div class="section-body">
              <label>Status eyebrow<input v-model="form.publicCopy.agenda.statusEyebrow"></label>
              <label>Loading label<input v-model="form.publicCopy.agenda.loadingLabel"></label>
              <div class="field-grid two">
                <label>One date<input v-model="form.publicCopy.agenda.dateSingular"></label>
                <label>Multiple dates<input v-model="form.publicCopy.agenda.datePlural"></label>
              </div>
              <label>Status explanation<textarea v-model="form.publicCopy.agenda.statusBody" rows="4" /></label>
            </div>
          </details>

          <details class="editor-section">
            <summary>
              <span><strong>Empty state</strong><small>Shown when there are no public gigs</small></span>
              <b>03</b>
            </summary>
            <div class="section-body">
              <label>Marker label<input v-model="form.publicCopy.agenda.emptyMarkerLabel"></label>
              <label>Eyebrow<input v-model="form.publicCopy.agenda.emptyEyebrow"></label>
              <label>Title<input v-model="form.publicCopy.agenda.emptyTitle"></label>
              <label>Body<textarea v-model="form.publicCopy.agenda.emptyBody" rows="5" /></label>
              <label>Button label<input v-model="form.publicCopy.agenda.emptyCta"></label>
            </div>
          </details>

          <details class="editor-section">
            <summary>
              <span><strong>Gig list labels</strong><small>Labels surrounding the dynamic list of gigs</small></span>
              <b>04</b>
            </summary>
            <div class="section-body">
              <label>List eyebrow<input v-model="form.publicCopy.agenda.listEyebrow"></label>
              <div class="field-grid two">
                <label>One moment<input v-model="form.publicCopy.agenda.momentSingular"></label>
                <label>Multiple moments<input v-model="form.publicCopy.agenda.momentPlural"></label>
              </div>
            </div>
          </details>

          <details class="editor-section">
            <summary>
              <span><strong>Footer CTA</strong><small>Closing booking prompt</small></span>
              <b>05</b>
            </summary>
            <div class="section-body">
              <label>Eyebrow<input v-model="form.publicCopy.agenda.footerEyebrow"></label>
              <label>Title<textarea v-model="form.publicCopy.agenda.footerTitle" rows="3" /></label>
              <label>Body<textarea v-model="form.publicCopy.agenda.footerBody" rows="4" /></label>
              <label>Button label<input v-model="form.publicCopy.agenda.footerCta"></label>
            </div>
          </details>
        </section>

        <section v-else-if="activePage === 'booking'" class="page-editor">
          <div class="page-intro">
            <p class="eyebrow">Public page · /boeken</p>
            <h2>Booking</h2>
            <p>Edit the public inquiry page, from the opening pitch through form feedback.</p>
          </div>

          <details class="editor-section" open>
            <summary>
              <span><strong>Intro & direct contact</strong><small>Page heading and contact details</small></span>
              <b>01</b>
            </summary>
            <div class="section-body">
              <p class="section-note">The intro copy is also used by the closing CTA on the homepage.</p>
              <label>Eyebrow<input v-model="form.bookingEyebrow"></label>
              <label>Heading<input v-model="form.bookingTitle"></label>
              <label>Body<textarea v-model="form.bookingBody" rows="5" /></label>
              <div class="field-grid two">
                <label>Email<input v-model="form.contactEmail" type="email"></label>
                <label>Phone<input v-model="form.contactPhone"></label>
              </div>
            </div>
          </details>

          <details class="editor-section">
            <summary>
              <span><strong>Form labels</strong><small>Field names visitors see in the inquiry form</small></span>
              <b>02</b>
            </summary>
            <div class="section-body">
              <div class="field-grid two">
                <label>Name<input v-model="form.publicCopy.booking.nameLabel"></label>
                <label>Company<input v-model="form.publicCopy.booking.companyLabel"></label>
                <label>Email<input v-model="form.publicCopy.booking.emailLabel"></label>
                <label>Phone<input v-model="form.publicCopy.booking.phoneLabel"></label>
                <label>Event type<input v-model="form.publicCopy.booking.eventTypeLabel"></label>
                <label>Date<input v-model="form.publicCopy.booking.dateLabel"></label>
                <label>Location<input v-model="form.publicCopy.booking.locationLabel"></label>
                <label>Optional label<input v-model="form.publicCopy.booking.optionalLabel"></label>
              </div>
              <label>Message label<input v-model="form.publicCopy.booking.messageLabel"></label>
            </div>
          </details>

          <details class="editor-section">
            <summary>
              <span><strong>Placeholders & submit state</strong><small>Guidance inside fields and submit button copy</small></span>
              <b>03</b>
            </summary>
            <div class="section-body">
              <label>Event-type placeholder<input v-model="form.publicCopy.booking.eventTypePlaceholder"></label>
              <label>Location placeholder<input v-model="form.publicCopy.booking.locationPlaceholder"></label>
              <label>Message placeholder<textarea v-model="form.publicCopy.booking.messagePlaceholder" rows="3" /></label>
              <div class="field-grid two">
                <label>Submit button<input v-model="form.publicCopy.booking.submitLabel"></label>
                <label>Sending button<input v-model="form.publicCopy.booking.sendingLabel"></label>
              </div>
            </div>
          </details>

          <details class="editor-section">
            <summary>
              <span><strong>Success & error states</strong><small>Feedback after the visitor submits</small></span>
              <b>04</b>
            </summary>
            <div class="section-body">
              <label>Success eyebrow<input v-model="form.publicCopy.booking.successEyebrow"></label>
              <label>Success title<input v-model="form.publicCopy.booking.successTitle"></label>
              <label>Success body<textarea v-model="form.publicCopy.booking.successBody" rows="4" /></label>
              <label>Error fallback<textarea v-model="form.publicCopy.booking.errorFallback" rows="4" /></label>
            </div>
          </details>
        </section>

        <section v-else class="page-editor">
          <div class="page-intro">
            <p class="eyebrow">Shared across the public site</p>
            <h2>Shared & SEO</h2>
            <p>Global navigation, footer, social links and metadata live here instead of being mixed into individual pages.</p>
          </div>

          <details class="editor-section" open>
            <summary>
              <span><strong>Site identity & navigation</strong><small>Brand name, desktop labels and mobile menu copy</small></span>
              <b>01</b>
            </summary>
            <div class="section-body">
              <label>Brand name<input v-model="form.brandName"></label>
              <div class="field-grid three">
                <label>Home<input v-model="form.publicCopy.navigation.home"></label>
                <label>About<input v-model="form.publicCopy.navigation.about"></label>
                <label>Media<input v-model="form.publicCopy.navigation.media"></label>
                <label>Agenda<input v-model="form.publicCopy.navigation.agenda"></label>
                <label>Booking<input v-model="form.publicCopy.navigation.booking"></label>
                <label>Menu<input v-model="form.publicCopy.navigation.menu"></label>
                <label>Close<input v-model="form.publicCopy.navigation.close"></label>
              </div>
              <div class="field-grid two">
                <label>Mobile booking eyebrow<input v-model="form.publicCopy.navigation.mobileEyebrow"></label>
                <label>Mobile booking CTA<input v-model="form.publicCopy.navigation.mobileBooking"></label>
              </div>
            </div>
          </details>

          <details class="editor-section">
            <summary>
              <span><strong>Footer</strong><small>Closing site-wide CTA and link labels</small></span>
              <b>02</b>
            </summary>
            <div class="section-body">
              <label>Eyebrow<input v-model="form.publicCopy.footer.eyebrow"></label>
              <label>Title<textarea v-model="form.publicCopy.footer.title" rows="3" /></label>
              <div class="field-grid two">
                <label>CTA label<input v-model="form.publicCopy.footer.cta"></label>
                <label>Location<input v-model="form.publicCopy.footer.location"></label>
              </div>
              <div class="field-grid three">
                <label>Instagram label<input v-model="form.publicCopy.footer.instagram"></label>
                <label>Spotify label<input v-model="form.publicCopy.footer.spotify"></label>
                <label>Email label<input v-model="form.publicCopy.footer.email"></label>
              </div>
            </div>
          </details>

          <details class="editor-section">
            <summary>
              <span><strong>Contact & social links</strong><small>Actual destinations used around the site</small></span>
              <b>03</b>
            </summary>
            <div class="section-body">
              <div class="field-grid two">
                <label>Email<input v-model="form.contactEmail" type="email"></label>
                <label>Phone<input v-model="form.contactPhone"></label>
                <label>Instagram URL<input v-model="form.instagramUrl" type="url" placeholder="https://…"></label>
                <label>Spotify URL<input v-model="form.spotifyUrl" type="url" placeholder="https://…"></label>
              </div>
            </div>
          </details>

          <details class="editor-section">
            <summary>
              <span><strong>SEO & sharing</strong><small>Default search result and social-link preview</small></span>
              <b>04</b>
            </summary>
            <div class="section-body">
              <label>Default title<input v-model="form.seoTitle"></label>
              <label>Description<textarea v-model="form.seoDescription" rows="4" /></label>
              <AdminMediaPicker
                v-model="form.seoImageUrl"
                label="Social sharing image"
                description="Used for link previews. Falls back to the hero image when empty."
              />
            </div>
          </details>

          <details class="editor-section">
            <summary>
              <span><strong>Landing-page shared panel</strong><small>Shared sidebar CTA used by service landing pages</small></span>
              <b>05</b>
            </summary>
            <div class="section-body">
              <p class="section-note">Individual landing-page content stays in Admin → Landing pages. This is only the panel shared by all of them.</p>
              <label>Eyebrow<input v-model="form.publicCopy.landing.asideEyebrow"></label>
              <label>Title<input v-model="form.publicCopy.landing.asideTitle"></label>
              <label>Body<textarea v-model="form.publicCopy.landing.asideBody" rows="4" /></label>
              <label>Button label<input v-model="form.publicCopy.landing.asideCta"></label>
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
