<script setup lang="ts">
import { apiErrorMessage } from '~/utils/api-error'
import type { PublicSiteContent } from '~/types/site-content'

definePageMeta({ layout: 'admin' })

type SectionKey = 'hero' | 'about' | 'services' | 'media' | 'agenda' | 'booking' | 'seo' | 'full'
type PickerAsset = { altText: string, title: string }

const sections: Array<{ key: SectionKey, label: string, hint: string }> = [
  { key: 'hero', label: 'Hero', hint: 'First screen' },
  { key: 'about', label: 'About', hint: 'Introduction' },
  { key: 'services', label: 'Services', hint: 'Service cards' },
  { key: 'media', label: 'Media', hint: 'Showreel & gallery' },
  { key: 'agenda', label: 'Agenda', hint: 'Public shows' },
  { key: 'booking', label: 'Booking', hint: 'Call to action' },
  { key: 'seo', label: 'SEO & sharing', hint: 'Search & social' },
  { key: 'full', label: 'All site copy', hint: 'Navigation, footer & details' },
]

const { data } = await useFetch<{ content: PublicSiteContent }>('/api/admin/content')
if (!data.value) throw createError({ statusCode: 500, statusMessage: 'Could not load website content' })

const form = reactive({
  ...data.value.content,
  services: data.value.content.services.map(item => ({ ...item })),
  gallery: data.value.content.gallery.map(item => ({ ...item })),
  publicCopy: structuredClone(data.value.content.publicCopy),
})

const activeSection = ref<SectionKey>('hero')
const saving = ref(false)
const message = ref('')
const messageKind = ref<'idle' | 'saving' | 'success' | 'error'>('idle')

const heroPreviewStyle = computed(() => ({
  backgroundImage: form.heroImageUrl
    ? `linear-gradient(90deg,rgba(7,7,9,.94),rgba(7,7,9,.35)),url("${form.heroImageUrl}")`
    : 'linear-gradient(135deg,#17111f,#09080b 62%)',
}))

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

function handleInvalid() {
  messageKind.value = 'error'
  message.value = 'Please fix the highlighted field before saving.'
}

async function save() {
  saving.value = true
  messageKind.value = 'saving'
  message.value = 'Saving website…'
  try {
    await $fetch('/api/admin/content', { method: 'PUT', body: form })
    messageKind.value = 'success'
    message.value = 'Website saved. Your changes are now public.'
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
  <div class="content-editor">
    <header class="page-header">
      <div>
        <p class="eyebrow">Content</p>
        <h1>Website editor</h1>
        <p>Edit the site by visible section. The preview shows the hierarchy and media used on the public page.</p>
      </div>
      <NuxtLink to="/" target="_blank" class="open-site">Open website ↗</NuxtLink>
    </header>

    <form @submit.prevent="save" @invalid.capture="handleInvalid">
      <div class="editor-shell">
        <nav class="section-nav" aria-label="Website sections">
          <button
            v-for="section in sections"
            :key="section.key"
            type="button"
            :class="{ active: activeSection === section.key }"
            @click="activeSection = section.key"
          >
            <span>{{ section.label }}</span>
            <small>{{ section.hint }}</small>
          </button>
        </nav>

        <main class="workspace">
          <section v-if="activeSection === 'hero'" class="section-workspace">
            <div class="section-heading">
              <div>
                <p class="eyebrow">01 · First screen</p>
                <h2>Hero</h2>
                <p>This is the first thing visitors see. Keep the title short, the image strong and the main action obvious.</p>
              </div>
            </div>

            <div class="edit-preview-grid">
              <div class="fields">
                <label>Brand name<input v-model="form.brandName" required></label>
                <label>Eyebrow<input v-model="form.heroEyebrow" required></label>
                <label>Hero title<input v-model="form.heroTitle" required></label>
                <label>Hero text<textarea v-model="form.heroBody" rows="5" required /></label>
                <label>CTA label<input v-model="form.heroCtaLabel" required></label>
                <AdminMediaPicker
                  v-model="form.heroImageUrl"
                  label="Hero image"
                  description="Large background image behind the opening copy."
                />
              </div>

              <div class="preview-panel">
                <div class="preview-label"><span>Live structure preview</span><small>Hero</small></div>
                <div class="hero-preview" :style="heroPreviewStyle">
                  <div>
                    <small>{{ form.heroEyebrow }}</small>
                    <h3>{{ form.heroTitle || 'Hero title' }}</h3>
                    <p>{{ form.heroBody || 'Hero text' }}</p>
                    <span class="fake-button">{{ form.heroCtaLabel || 'Call to action' }}</span>
                  </div>
                </div>
                <p class="preview-note">The public site adds the full background treatment, gradients and responsive sizing.</p>
              </div>
            </div>
          </section>

          <section v-else-if="activeSection === 'about'" class="section-workspace">
            <div class="section-heading">
              <div>
                <p class="eyebrow">02 · Introduction</p>
                <h2>About</h2>
                <p>Introduces NightLight after the visual opening section.</p>
              </div>
            </div>

            <div class="edit-preview-grid">
              <div class="fields">
                <label>Eyebrow<input v-model="form.aboutEyebrow" required></label>
                <label>Title<input v-model="form.aboutTitle" required></label>
                <label>Body<textarea v-model="form.aboutBody" rows="8" required /></label>
              </div>
              <div class="preview-panel">
                <div class="preview-label"><span>Live structure preview</span><small>About</small></div>
                <div class="copy-preview">
                  <small>{{ form.aboutEyebrow }}</small>
                  <h3>{{ form.aboutTitle || 'About title' }}</h3>
                  <p>{{ form.aboutBody || 'About copy' }}</p>
                  <span class="preview-link">Meer over NightLight →</span>
                </div>
              </div>
            </div>
          </section>

          <section v-else-if="activeSection === 'services'" class="section-workspace">
            <div class="section-heading">
              <div>
                <p class="eyebrow">03 · Homepage cards</p>
                <h2>Services</h2>
                <p>Each item becomes a visual card on the homepage. Gallery images are reused as card backgrounds.</p>
              </div>
              <button type="button" class="secondary" @click="addService">+ Add service</button>
            </div>

            <div class="services-editor">
              <article v-for="(service, index) in form.services" :key="index" class="repeat-card">
                <div class="repeat-top">
                  <strong>Service {{ index + 1 }}</strong>
                  <div>
                    <button type="button" :disabled="index === 0" @click="moveService(index, -1)">↑</button>
                    <button type="button" :disabled="index === form.services.length - 1" @click="moveService(index, 1)">↓</button>
                    <button type="button" class="danger-text" @click="form.services.splice(index, 1)">Remove</button>
                  </div>
                </div>
                <label>Title<input v-model="service.title" placeholder="e.g. Weddings" required></label>
                <label>Description<textarea v-model="service.body" rows="4" placeholder="What makes this service fit the event?" required /></label>
                <AdminMediaPicker
                  v-model="service.imageUrl"
                  label="Card image"
                  description="Optional dedicated image for this service card."
                />
                <label>Image alt text<input v-model="service.imageAlt" placeholder="Describe the service image"></label>
              </article>
            </div>

            <div class="preview-panel wide-preview">
              <div class="preview-label"><span>Live structure preview</span><small>Services</small></div>
              <div class="service-preview-grid">
                <article v-for="(service, index) in form.services" :key="index">
                  <span>0{{ index + 1 }}</span>
                  <h3>{{ service.title || 'Service title' }}</h3>
                  <p>{{ service.body || 'Service description' }}</p>
                </article>
              </div>
            </div>
          </section>

          <section v-else-if="activeSection === 'media'" class="section-workspace">
            <div class="section-heading">
              <div>
                <p class="eyebrow">04 · Showreel & gallery</p>
                <h2>Media</h2>
                <p>Controls the media introduction and the image pool used throughout the public website.</p>
              </div>
              <button type="button" class="secondary" @click="addImage">+ Add gallery image</button>
            </div>

            <div class="edit-preview-grid top-align">
              <div class="fields">
                <label>Eyebrow<input v-model="form.mediaEyebrow" required></label>
                <label>Title<input v-model="form.mediaTitle" required></label>
                <label>Body<textarea v-model="form.mediaBody" rows="5" required /></label>
                <label>Showreel URL<input v-model="form.showreelUrl" type="url" placeholder="https://…" /></label>
              </div>
              <div class="preview-panel">
                <div class="preview-label"><span>Live structure preview</span><small>Media intro</small></div>
                <div class="copy-preview compact-copy">
                  <small>{{ form.mediaEyebrow }}</small>
                  <h3>{{ form.mediaTitle || 'Media title' }}</h3>
                  <p>{{ form.mediaBody || 'Media description' }}</p>
                  <span v-if="form.showreelUrl" class="preview-link">Showreel linked ↗</span>
                </div>
              </div>
            </div>

            <div class="subheading">
              <div>
                <h3>Gallery images</h3>
                <p>The order matters: the homepage also reuses these images for its feature and service visuals.</p>
              </div>
            </div>

            <div class="gallery-editor">
              <article v-for="(image, index) in form.gallery" :key="`${index}-${image.url}`" class="gallery-card">
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
                <label>Alt text<input v-model="image.alt" placeholder="Describe the image for accessibility"></label>
              </article>

              <button v-if="!form.gallery.length" type="button" class="empty-gallery" @click="addImage">
                <span>＋</span>
                <strong>Add your first gallery image</strong>
                <small>Select an existing Media image or upload one directly.</small>
              </button>
            </div>

            <div v-if="form.gallery.length" class="preview-panel wide-preview">
              <div class="preview-label"><span>Image order preview</span><small>Gallery pool</small></div>
              <div class="gallery-preview">
                <img
                  v-for="(image, index) in form.gallery.slice(0, 6)"
                  :key="index"
                  :src="image.url"
                  :alt="image.alt"
                >
              </div>
            </div>
          </section>

          <section v-else-if="activeSection === 'agenda'" class="section-workspace">
            <div class="section-heading">
              <div>
                <p class="eyebrow">05 · Public shows</p>
                <h2>Agenda</h2>
                <p>Intro copy shown above public bookings. Private gigs remain excluded automatically.</p>
              </div>
            </div>

            <div class="edit-preview-grid">
              <div class="fields">
                <label>Eyebrow<input v-model="form.agendaEyebrow" required></label>
                <label>Title<input v-model="form.agendaTitle" required></label>
                <label>Body<textarea v-model="form.agendaBody" rows="5" required /></label>
              </div>
              <div class="preview-panel">
                <div class="preview-label"><span>Live structure preview</span><small>Agenda</small></div>
                <div class="copy-preview">
                  <small>{{ form.agendaEyebrow }}</small>
                  <h3>{{ form.agendaTitle || 'Agenda title' }}</h3>
                  <p>{{ form.agendaBody || 'Agenda description' }}</p>
                  <div class="fake-event"><span>24 OCT</span><strong>Example public gig</strong></div>
                </div>
              </div>
            </div>
          </section>

          <section v-else-if="activeSection === 'booking'" class="section-workspace">
            <div class="section-heading">
              <div>
                <p class="eyebrow">06 · Call to action</p>
                <h2>Booking</h2>
                <p>The final homepage call-to-action plus the public contact links used around the site.</p>
              </div>
            </div>

            <div class="edit-preview-grid top-align">
              <div class="fields">
                <label>Eyebrow<input v-model="form.bookingEyebrow" required></label>
                <label>Title<input v-model="form.bookingTitle" required></label>
                <label>Body<textarea v-model="form.bookingBody" rows="5" required /></label>
                <div class="two-fields">
                  <label>E-mail<input v-model="form.contactEmail" type="email"></label>
                  <label>Phone<input v-model="form.contactPhone"></label>
                </div>
                <label>Instagram URL<input v-model="form.instagramUrl" type="url" placeholder="https://…"></label>
                <label>Spotify URL<input v-model="form.spotifyUrl" type="url" placeholder="https://…"></label>
              </div>
              <div class="preview-panel">
                <div class="preview-label"><span>Live structure preview</span><small>Booking CTA</small></div>
                <div class="booking-preview">
                  <small>{{ form.bookingEyebrow }}</small>
                  <h3>{{ form.bookingTitle || 'Booking title' }}</h3>
                  <p>{{ form.bookingBody || 'Booking description' }}</p>
                  <span class="fake-button">Vertel over je feest</span>
                </div>
              </div>
            </div>
          </section>

          <section v-else-if="activeSection === 'seo'" class="section-workspace">
            <div class="section-heading">
              <div>
                <p class="eyebrow">07 · Search & sharing</p>
                <h2>SEO & social sharing</h2>
                <p>Controls how the website is described in search engines and when a link is shared.</p>
              </div>
            </div>

            <div class="edit-preview-grid top-align">
              <div class="fields">
                <label>Default title<input v-model="form.seoTitle" required></label>
                <label>Description<textarea v-model="form.seoDescription" rows="5" required /></label>
                <AdminMediaPicker
                  v-model="form.seoImageUrl"
                  label="Social sharing image"
                  description="Used for link previews. Falls back to the hero image when empty."
                />
              </div>
              <div class="preview-panel">
                <div class="preview-label"><span>Share preview</span><small>Open Graph</small></div>
                <div class="social-preview">
                  <img v-if="form.seoImageUrl || form.heroImageUrl" :src="form.seoImageUrl || form.heroImageUrl || ''" alt="">
                  <div v-else class="social-placeholder">NightLight</div>
                  <div>
                    <small>nightlight.remcoland.nl</small>
                    <strong>{{ form.seoTitle || 'DJ NightLight' }}</strong>
                    <p>{{ form.seoDescription || 'Website description' }}</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section v-else class="section-workspace full-editor">
            <div class="section-heading">
              <div>
                <p class="eyebrow">08 · Complete public site</p>
                <h2>All site copy & visuals</h2>
                <p>Everything that was previously hardcoded on the public website can be changed here. One item per line is used for list fields.</p>
              </div>
            </div>

            <details class="copy-group" open>
              <summary>Navigation & footer</summary>
              <div class="fields copy-fields">
                <div class="two-fields">
                  <label>Home label<input v-model="form.publicCopy.navigation.home" required></label>
                  <label>About label<input v-model="form.publicCopy.navigation.about" required></label>
                  <label>Media label<input v-model="form.publicCopy.navigation.media" required></label>
                  <label>Agenda label<input v-model="form.publicCopy.navigation.agenda" required></label>
                  <label>Booking label<input v-model="form.publicCopy.navigation.booking" required></label>
                  <label>Menu label<input v-model="form.publicCopy.navigation.menu" required></label>
                  <label>Close label<input v-model="form.publicCopy.navigation.close" required></label>
                </div>
                <label>Mobile booking eyebrow<input v-model="form.publicCopy.navigation.mobileEyebrow" required></label>
                <label>Mobile booking CTA<input v-model="form.publicCopy.navigation.mobileBooking" required></label>
                <label>Footer eyebrow<input v-model="form.publicCopy.footer.eyebrow" required></label>
                <label>Footer title<textarea v-model="form.publicCopy.footer.title" rows="3" required /></label>
                <label>Footer CTA<input v-model="form.publicCopy.footer.cta" required></label>
                <label>Footer location<input v-model="form.publicCopy.footer.location" required></label>
                <div class="two-fields">
                  <label>Instagram link label<input v-model="form.publicCopy.footer.instagram" required></label>
                  <label>Spotify link label<input v-model="form.publicCopy.footer.spotify" required></label>
                  <label>Email link label<input v-model="form.publicCopy.footer.email" required></label>
                </div>
              </div>
            </details>

            <details class="copy-group">
              <summary>Homepage details & visuals</summary>
              <div class="fields copy-fields">
                <label>Secondary hero CTA<input v-model="form.publicCopy.home.secondaryCta" required></label>
                <label>Hero caption<input v-model="form.publicCopy.home.heroCaption" required></label>
                <label>Scroll label<input v-model="form.publicCopy.home.scrollLabel" required></label>
                <label>Visual section eyebrow<input v-model="form.publicCopy.home.visualEyebrow" required></label>
                <label>Visual section body<textarea v-model="form.publicCopy.home.visualBody" rows="3" required /></label>
                <label>Visual image caption<input v-model="form.publicCopy.home.visualCaption" required></label>
                <AdminMediaPicker v-model="form.publicCopy.visuals.homeFeatureImageUrl" label="Homepage feature image" />
                <label>Feature image alt text<input v-model="form.publicCopy.visuals.homeFeatureAlt"></label>
                <label>About link label<input v-model="form.publicCopy.home.aboutCta" required></label>
                <label>About image caption<input v-model="form.publicCopy.home.aboutImageCaption" required></label>
                <AdminMediaPicker v-model="form.publicCopy.visuals.homeAboutImageUrl" label="Homepage About image" />
                <label>Homepage About image alt text<input v-model="form.publicCopy.visuals.homeAboutAlt"></label>
                <label>Services eyebrow<input v-model="form.publicCopy.home.servicesEyebrow" required></label>
                <label>Services intro<textarea v-model="form.publicCopy.home.servicesBody" rows="3" required /></label>
                <label>Proof eyebrow<input v-model="form.publicCopy.home.proofEyebrow" required></label>
                <label>Proof quote<textarea v-model="form.publicCopy.home.proofQuote" rows="4" required /></label>
                <label>Proof tags — one per line<textarea :value="form.publicCopy.home.proofTags.join('\n')" rows="6" required @input="updateStringList(form.publicCopy.home.proofTags, $event)" /></label>
                <label>Homepage booking CTA<input v-model="form.publicCopy.home.bookingCta" required></label>
              </div>
            </details>

            <details class="copy-group">
              <summary>About page details & visuals</summary>
              <div class="fields copy-fields">
                <AdminMediaPicker v-model="form.publicCopy.visuals.aboutLeadImageUrl" label="About lead image" />
                <label>Lead image alt text<input v-model="form.publicCopy.visuals.aboutLeadAlt"></label>
                <label>Lead image eyebrow<input v-model="form.publicCopy.about.imageEyebrow" required></label>
                <label>Lead image caption<input v-model="form.publicCopy.about.imageCaption" required></label>
                <label>Story title<textarea v-model="form.publicCopy.about.storyTitle" rows="3" required /></label>
                <label>Story paragraph 1<textarea v-model="form.publicCopy.about.storyBody1" rows="4" required /></label>
                <label>Story paragraph 2<textarea v-model="form.publicCopy.about.storyBody2" rows="4" required /></label>
                <AdminMediaPicker v-model="form.publicCopy.visuals.aboutRoomImageUrl" label="About room image" />
                <label>Room image alt text<input v-model="form.publicCopy.visuals.aboutRoomAlt"></label>
                <label>Moment eyebrow<input v-model="form.publicCopy.about.momentEyebrow" required></label>
                <label>Moment quote<textarea v-model="form.publicCopy.about.momentQuote" rows="3" required /></label>
                <label>Moment body<textarea v-model="form.publicCopy.about.momentBody" rows="3" required /></label>
                <label>Principles eyebrow<input v-model="form.publicCopy.about.principlesEyebrow" required></label>
                <label>Principles title<input v-model="form.publicCopy.about.principlesTitle" required></label>
                <div class="principle-editor">
                  <article v-for="(principle,index) in form.publicCopy.about.principles" :key="index" class="repeat-card">
                    <div class="repeat-top"><strong>Principle {{ index + 1 }}</strong><button type="button" class="danger-text" @click="form.publicCopy.about.principles.splice(index,1)">Remove</button></div>
                    <label>Title<input v-model="principle.title" required></label>
                    <label>Body<textarea v-model="principle.body" rows="3" required /></label>
                  </article>
                  <button type="button" class="secondary" @click="addPrinciple">+ Add principle</button>
                </div>
                <label>Final CTA eyebrow<input v-model="form.publicCopy.about.ctaEyebrow" required></label>
                <label>Final CTA title<textarea v-model="form.publicCopy.about.ctaTitle" rows="3" required /></label>
                <label>Final CTA button<input v-model="form.publicCopy.about.ctaLabel" required></label>
              </div>
            </details>

            <details class="copy-group">
              <summary>Media page details</summary>
              <div class="fields copy-fields">
                <label>Media type chips — one per line<textarea :value="form.publicCopy.media.typeLabels.join('\n')" rows="4" required @input="updateStringList(form.publicCopy.media.typeLabels, $event)" /></label>
                <AdminMediaPicker v-model="form.publicCopy.visuals.mediaShowreelImageUrl" label="Showreel background image" />
                <label>Showreel image alt text<input v-model="form.publicCopy.visuals.mediaShowreelAlt"></label>
                <label>Showreel eyebrow<input v-model="form.publicCopy.media.showreelEyebrow" required></label>
                <label>External-link label<input v-model="form.publicCopy.media.showreelExternalLabel" required></label>
                <label>Showreel title<input v-model="form.publicCopy.media.showreelTitle" required></label>
                <label>Showreel body<input v-model="form.publicCopy.media.showreelBody" required></label>
                <label>Gallery eyebrow<input v-model="form.publicCopy.media.galleryEyebrow" required></label>
                <div class="two-fields"><label>Singular image word<input v-model="form.publicCopy.media.imageSingular" required></label><label>Plural image word<input v-model="form.publicCopy.media.imagePlural" required></label></div>
                <label>Empty-state eyebrow<input v-model="form.publicCopy.media.emptyEyebrow" required></label>
                <label>Empty-state title<textarea v-model="form.publicCopy.media.emptyTitle" rows="3" required /></label>
                <label>Empty-state body<textarea v-model="form.publicCopy.media.emptyBody" rows="4" required /></label>
                <label>Empty-state meta — one per line<textarea :value="form.publicCopy.media.emptyMeta.join('\n')" rows="4" required @input="updateStringList(form.publicCopy.media.emptyMeta, $event)" /></label>
                <label>Lightbox close label<input v-model="form.publicCopy.media.closeLabel" required></label>
              </div>
            </details>

            <details class="copy-group">
              <summary>Agenda page details</summary>
              <div class="fields copy-fields">
                <label>Status eyebrow<input v-model="form.publicCopy.agenda.statusEyebrow" required></label>
                <label>Loading label<input v-model="form.publicCopy.agenda.loadingLabel" required></label>
                <div class="two-fields"><label>One date<input v-model="form.publicCopy.agenda.dateSingular" required></label><label>Multiple dates<input v-model="form.publicCopy.agenda.datePlural" required></label></div>
                <label>Status explanation<textarea v-model="form.publicCopy.agenda.statusBody" rows="3" required /></label>
                <label>Empty marker<input v-model="form.publicCopy.agenda.emptyMarkerLabel" required></label>
                <label>Empty eyebrow<input v-model="form.publicCopy.agenda.emptyEyebrow" required></label>
                <label>Empty title<input v-model="form.publicCopy.agenda.emptyTitle" required></label>
                <label>Empty body<textarea v-model="form.publicCopy.agenda.emptyBody" rows="4" required /></label>
                <label>Empty CTA<input v-model="form.publicCopy.agenda.emptyCta" required></label>
                <label>List eyebrow<input v-model="form.publicCopy.agenda.listEyebrow" required></label>
                <div class="two-fields"><label>One moment<input v-model="form.publicCopy.agenda.momentSingular" required></label><label>Multiple moments<input v-model="form.publicCopy.agenda.momentPlural" required></label></div>
                <label>Footer eyebrow<input v-model="form.publicCopy.agenda.footerEyebrow" required></label>
                <label>Footer title<textarea v-model="form.publicCopy.agenda.footerTitle" rows="3" required /></label>
                <label>Footer body<textarea v-model="form.publicCopy.agenda.footerBody" rows="3" required /></label>
                <label>Footer CTA<input v-model="form.publicCopy.agenda.footerCta" required></label>
              </div>
            </details>

            <details class="copy-group">
              <summary>Landing-page shared panel</summary>
              <div class="fields copy-fields">
                <label>Eyebrow<input v-model="form.publicCopy.landing.asideEyebrow" required></label>
                <label>Title<input v-model="form.publicCopy.landing.asideTitle" required></label>
                <label>Body<textarea v-model="form.publicCopy.landing.asideBody" rows="4" required /></label>
                <label>CTA<input v-model="form.publicCopy.landing.asideCta" required></label>
              </div>
            </details>

            <details class="copy-group">
              <summary>Booking form details</summary>
              <div class="fields copy-fields">
                <label>Success eyebrow<input v-model="form.publicCopy.booking.successEyebrow" required></label>
                <label>Success title<input v-model="form.publicCopy.booking.successTitle" required></label>
                <label>Success body<textarea v-model="form.publicCopy.booking.successBody" rows="3" required /></label>
                <div class="two-fields">
                  <label>Name label<input v-model="form.publicCopy.booking.nameLabel" required></label>
                  <label>Company label<input v-model="form.publicCopy.booking.companyLabel" required></label>
                  <label>Email label<input v-model="form.publicCopy.booking.emailLabel" required></label>
                  <label>Phone label<input v-model="form.publicCopy.booking.phoneLabel" required></label>
                  <label>Event type label<input v-model="form.publicCopy.booking.eventTypeLabel" required></label>
                  <label>Date label<input v-model="form.publicCopy.booking.dateLabel" required></label>
                  <label>Location label<input v-model="form.publicCopy.booking.locationLabel" required></label>
                  <label>Optional label<input v-model="form.publicCopy.booking.optionalLabel" required></label>
                </div>
                <label>Message label<input v-model="form.publicCopy.booking.messageLabel" required></label>
                <label>Event-type placeholder<input v-model="form.publicCopy.booking.eventTypePlaceholder" required></label>
                <label>Location placeholder<input v-model="form.publicCopy.booking.locationPlaceholder" required></label>
                <label>Message placeholder<textarea v-model="form.publicCopy.booking.messagePlaceholder" rows="3" required /></label>
                <label>Submit button<input v-model="form.publicCopy.booking.submitLabel" required></label>
                <label>Sending button<input v-model="form.publicCopy.booking.sendingLabel" required></label>
                <label>Error fallback<textarea v-model="form.publicCopy.booking.errorFallback" rows="3" required /></label>
              </div>
            </details>
          </section>
        </main>
      </div>

      <div class="save-bar">
        <span class="save-message" :class="`is-${messageKind}`" aria-live="polite">{{ message || 'Changes become public after saving.' }}</span>
        <div>
          <NuxtLink to="/" target="_blank">Preview full site ↗</NuxtLink>
          <button class="primary" type="submit" :disabled="saving">{{ saving ? 'Saving…' : 'Save website' }}</button>
        </div>
      </div>
    </form>
  </div>
</template>

<style scoped>
.content-editor{max-width:1380px;margin-inline:auto}.page-header{display:flex;align-items:end;justify-content:space-between;gap:1.5rem;margin-bottom:1.4rem}.page-header h1{margin:.2rem 0;font-size:clamp(2.5rem,5vw,4rem);letter-spacing:-.05em}.page-header>div>p:last-child{max-width:46rem;margin:0;color:#8e8797;line-height:1.55}.open-site{flex:none;color:#b9b0c1}.eyebrow{margin:0;color:#8b8293;font-size:.68rem;font-weight:800;letter-spacing:.12em;text-transform:uppercase}

.editor-shell{display:grid;grid-template-columns:220px minmax(0,1fr);gap:1rem;align-items:start}.section-nav{position:sticky;top:1rem;display:grid;gap:.35rem;padding:.55rem;border:1px solid #2b2631;border-radius:1rem;background:#100e14}.section-nav button{display:grid;gap:.15rem;width:100%;border:0;border-radius:.7rem;padding:.72rem .78rem;background:transparent;color:#aaa4b1;text-align:left;cursor:pointer}.section-nav button:hover{background:#17131b}.section-nav button.active{background:#211a29;color:#fff}.section-nav span{font-size:.82rem;font-weight:800}.section-nav small{color:#777080;font-size:.67rem}.section-nav button.active small{color:#a69cad}

.workspace{min-width:0}.section-workspace{padding:1.3rem;border:1px solid #2b2631;border-radius:1rem;background:#100e14}.section-heading{display:flex;align-items:end;justify-content:space-between;gap:1rem;padding-bottom:1.1rem;border-bottom:1px solid #27222d}.section-heading h2{margin:.25rem 0 .35rem;font-size:clamp(1.7rem,3vw,2.4rem);letter-spacing:-.04em}.section-heading>div>p:last-child{max-width:48rem;margin:0;color:#8e8797;font-size:.85rem;line-height:1.55}.secondary{border:1px solid #3b3442;border-radius:.65rem;padding:.68rem .8rem;background:#18141d;color:#d7d0dc;font-weight:700;cursor:pointer}

.edit-preview-grid{display:grid;grid-template-columns:minmax(0,.95fr) minmax(320px,1.05fr);gap:1rem;align-items:center;margin-top:1rem}.edit-preview-grid.top-align{align-items:start}.fields{display:grid;gap:.9rem;padding:1rem;border:1px solid #28232d;border-radius:.85rem;background:#0d0b10}.fields label,.repeat-card label,.gallery-card label{display:grid;gap:.38rem;color:#aaa4b1;font-size:.78rem}.fields input,.fields textarea,.repeat-card input,.repeat-card textarea,.gallery-card input{width:100%;border:1px solid #332e39;border-radius:.65rem;padding:.72rem;background:#0b0a0d;color:#f6f3fa}.two-fields{display:grid;grid-template-columns:1fr 1fr;gap:.7rem}

.preview-panel{overflow:hidden;border:1px solid #332d39;border-radius:.9rem;background:#0b0a0d}.preview-label{display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:.65rem .8rem;border-bottom:1px solid #28232d;color:#9c94a3;font-size:.67rem;text-transform:uppercase;letter-spacing:.08em}.preview-label small{color:#696270}.preview-note{margin:0;padding:.7rem .8rem;border-top:1px solid #242027;color:#716a78;font-size:.68rem;line-height:1.45}

.hero-preview{min-height:420px;display:flex;align-items:end;padding:2rem;background-position:center;background-size:cover}.hero-preview>div{max-width:29rem}.hero-preview small,.copy-preview>small,.booking-preview>small{color:#c5b5db;font-size:.65rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase}.hero-preview h3{max-width:10ch;margin:.45rem 0 .8rem;font-size:clamp(2.4rem,4vw,4.3rem);line-height:.88;letter-spacing:-.065em}.hero-preview p{max-width:34rem;color:#c0bac5;font-size:.82rem;line-height:1.55}.fake-button{display:inline-block;margin-top:.8rem;padding:.62rem .78rem;border-radius:.55rem;background:#fff;color:#0a090c;font-size:.7rem;font-weight:800}

.copy-preview{padding:clamp(1.4rem,4vw,2.6rem)}.copy-preview h3,.booking-preview h3{max-width:14ch;margin:.45rem 0 .85rem;font-size:clamp(2rem,3.5vw,3.6rem);line-height:.95;letter-spacing:-.055em}.copy-preview p,.booking-preview p{max-width:36rem;margin:0;color:#9e97a5;font-size:.84rem;line-height:1.68}.preview-link{display:inline-block;margin-top:1rem;color:#c6b5db;font-size:.75rem}.compact-copy h3{font-size:clamp(1.8rem,3vw,3rem)}

.services-editor{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.8rem;margin-top:1rem}.repeat-card,.gallery-card{display:grid;gap:.75rem;padding:1rem;border:1px solid #2b2631;border-radius:.85rem;background:#0d0b10}.repeat-top{display:flex;align-items:center;justify-content:space-between;gap:.8rem}.repeat-top strong{color:#ded8e3;font-size:.8rem}.repeat-top>div{display:flex;align-items:center;gap:.25rem}.repeat-top button{border:0;border-radius:.45rem;padding:.35rem .45rem;background:#19151e;color:#918999;font-size:.7rem;cursor:pointer}.repeat-top button:disabled{opacity:.3;cursor:not-allowed}.repeat-top .danger-text{background:transparent;color:#d9909d}.wide-preview{margin-top:1rem}.service-preview-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.6rem;padding:.8rem}.service-preview-grid article{min-height:14rem;display:flex;flex-direction:column;justify-content:end;padding:1rem;border-radius:.7rem;background:linear-gradient(180deg,#21192b,#111015)}.service-preview-grid span{color:#8f8798;font-size:.65rem}.service-preview-grid h3{margin:1.4rem 0 .45rem;font-size:1.25rem;letter-spacing:-.035em}.service-preview-grid p{margin:0;color:#9a93a1;font-size:.72rem;line-height:1.5}

.subheading{display:flex;justify-content:space-between;gap:1rem;margin-top:1.4rem}.subheading h3{margin:0 0 .25rem;font-size:1.1rem}.subheading p{margin:0;color:#827b89;font-size:.75rem}.gallery-editor{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.8rem;margin-top:.8rem}.empty-gallery{grid-column:1/-1;display:grid;place-items:center;gap:.35rem;min-height:12rem;border:1px dashed #42394a;border-radius:.85rem;background:#0d0b10;color:#aaa3b3;cursor:pointer}.empty-gallery>span{font-size:1.7rem}.empty-gallery strong{color:#d8d2dd}.empty-gallery small{color:#777080}.gallery-preview{display:grid;grid-template-columns:repeat(3,1fr);gap:.4rem;padding:.65rem}.gallery-preview img{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:.5rem;background:#17141b}

.fake-event{display:grid;grid-template-columns:3.5rem 1fr;gap:.7rem;align-items:center;margin-top:1.2rem;padding:.8rem;border-top:1px solid #2a252f}.fake-event span{color:#8e8796;font-size:.62rem}.fake-event strong{font-size:.78rem}.booking-preview{min-height:360px;padding:2rem;background:radial-gradient(circle at 82% 42%,rgba(100,54,218,.25),transparent 34%),#09080b}.social-preview{overflow:hidden;margin:1rem;border:1px solid #302a36;border-radius:.75rem;background:#151219}.social-preview>img,.social-placeholder{display:grid;width:100%;aspect-ratio:1.91/1;place-items:center;object-fit:cover;background:linear-gradient(135deg,#24162f,#0d0b10);color:#d7c9e9;font-size:2rem;font-weight:900}.social-preview>div:last-child{display:grid;gap:.25rem;padding:.8rem}.social-preview small{color:#777080;font-size:.65rem}.social-preview strong{font-size:.82rem}.social-preview p{margin:0;color:#928a9a;font-size:.7rem;line-height:1.45}

.copy-group{margin-top:1rem;border:1px solid #2b2631;border-radius:.85rem;background:#0d0b10}.copy-group summary{padding:1rem;color:#ddd7e2;font-size:.9rem;font-weight:800;cursor:pointer}.copy-group[open] summary{border-bottom:1px solid #28232d}.copy-group .fields{border:0;border-radius:0;background:transparent}.copy-fields{padding:1rem}.principle-editor{display:grid;gap:.75rem}.principle-editor>.secondary{justify-self:start}.full-editor .copy-group textarea{resize:vertical}

.save-bar{position:sticky;z-index:20;bottom:1rem;display:flex;align-items:center;justify-content:space-between;gap:1rem;margin-top:1rem;padding:.9rem 1rem;border:1px solid #3a3341;border-radius:1rem;background:rgba(20,17,25,.96);backdrop-filter:blur(14px);box-shadow:0 18px 60px rgba(0,0,0,.3);color:#918a98;font-size:.8rem}.save-message{font-weight:650}.save-message.is-saving{color:#d8d1df}.save-message.is-success{color:#9ed7ad}.save-message.is-error{color:#f0a8b4}.save-bar>div{display:flex;align-items:center;gap:.8rem}.save-bar a{color:#a99eb3;font-size:.75rem}.primary{border:0;border-radius:.65rem;padding:.75rem 1rem;background:#fff;color:#09080b;font-weight:800;cursor:pointer}.primary:disabled{opacity:.55;cursor:not-allowed}

@media(max-width:1050px){.editor-shell{grid-template-columns:1fr}.section-nav{position:static;display:flex;overflow:auto;padding:.45rem}.section-nav button{min-width:8.5rem}.edit-preview-grid{grid-template-columns:1fr}.services-editor,.gallery-editor{grid-template-columns:1fr}.preview-panel{order:2}}
@media(max-width:700px){.page-header{align-items:start;flex-direction:column}.page-header h1{font-size:2.6rem}.section-workspace{padding:.9rem}.section-heading{align-items:start;flex-direction:column}.section-heading .secondary{width:100%}.section-nav{margin-inline:-.2rem}.section-nav button{min-width:7.8rem}.hero-preview{min-height:330px;padding:1.3rem}.hero-preview h3{font-size:2.8rem}.service-preview-grid{grid-template-columns:1fr}.service-preview-grid article{min-height:9rem}.gallery-preview{grid-template-columns:1fr 1fr}.two-fields{grid-template-columns:1fr}.save-bar{align-items:stretch;flex-direction:column}.save-bar>div{justify-content:space-between}.save-bar .primary{flex:1}}
</style>
