<script setup lang="ts">
import type { QuestionnaireField } from '~~/shared/questionnaire'
import { musicWishCategories } from '~~/shared/questionnaire'
import { musicWishCategoryLabels } from '~~/shared/labels'
import { dutchDateTime, dutchFullDate } from '~~/shared/dutch-date'
import { apiErrorMessage } from '~/utils/api-error'

const route = useRoute()
const token = String(route.params.token || '')
type Wish = { category: typeof musicWishCategories[number], artist: string | null, title: string | null, spotifyUrl: string | null, note: string | null, ordering: number }
type Answer = string | number | boolean | string[]
type PortalData = {
  gig: { id: string, title: string, eventType: string | null, status: string, startsAt: string | null, endsAt: string | null, imageUrl: string | null, venue: { name: string, city: string | null } | null }
  client: { name: string | null }
  expiresAt: string
  finished: boolean
  reviewOpen: boolean
  review: { rating: number, comment: string | null, createdAt: string } | null
  questionnaire: { version: number, fields: QuestionnaireField[], answers: Record<string, Answer>, status: 'not_started' | 'draft' | 'submitted', acceptedName: string | null, submittedAt: string | null }
  wishes: Wish[]
  invoice: { id:string, invoiceNumber:string|null, totalCents:number, currency:string, status:'draft'|'finalized', paymentStatus:'unpaid'|'pending'|'paid'|'failed', dueDate:string, paymentRecordStatus:string|null, paidAt:string|null } | null
}

const { data, error, refresh } = await useFetch<PortalData>(`/api/client/portal/${encodeURIComponent(token)}`)
const { data: siteData } = await useSiteContent()
const contact = computed(() => ({ email: siteData.value?.content.contactEmail || null, phone: siteData.value?.content.contactPhone || null }))
const answers = reactive<Record<string, Answer>>({ ...(data.value?.questionnaire.answers || {}) })
for (const field of data.value?.questionnaire.fields || []) {
  if (answers[field.id] === undefined) answers[field.id] = field.type === 'multi_select' ? [] : field.type === 'checkbox' || field.type === 'acknowledgement' ? false : ''
}

const acceptedName = ref(data.value?.questionnaire.acceptedName || '')
const wishes = ref<Wish[]>((data.value?.wishes || []).map(wish => ({ ...wish })))
const submitting = ref(false)
const message = ref('')
const paymentBusy = ref(false)
// Stripe redirects back with ?payment=success|cancelled; the webhook (not this param) decides the real status.
const paymentReturn = computed(() => {
  const value = Array.isArray(route.query.payment) ? route.query.payment[0] : route.query.payment
  return value === 'success' || value === 'cancelled' ? value : null
})
const categoryLabels = musicWishCategoryLabels as Record<Wish['category'], string>
const confirming = ref(false)
const reviewRating = ref(0)
const reviewHover = ref(0)
const reviewComment = ref('')
const reviewName = ref('')
const reviewBusy = ref(false)
const reviewMessage = ref('')

const categoryMeta: Record<Wish['category'], { icon: string, description: string }> = {
  must_play: { icon: 'lucide:heart', description: 'Nummers die er zeker bij moeten komen.' },
  nice_to_have: { icon: 'lucide:sparkles', description: 'Nummers die altijd leuk zijn.' },
  do_not_play: { icon: 'lucide:ban', description: 'Nummers die je liever niet hoort.' },
  special_moment: { icon: 'lucide:party-popper', description: 'Bijv. openingsdans, taartmoment of entree.' },
}

const questionnaireComplete = computed(() => {
  if (data.value?.questionnaire.status === 'submitted') return true
  const fields = data.value?.questionnaire.fields || []
  return fields.every((field) => {
    if (!field.required) return true
    const value = answers[field.id]
    if (Array.isArray(value)) return value.length > 0
    if (typeof value === 'boolean') return value
    return value !== undefined && value !== null && String(value).trim() !== ''
  }) && acceptedName.value.trim().length > 0
})

const completedSteps = computed(() => {
  if (data.value?.questionnaire.status === 'submitted') return 3
  return questionnaireComplete.value ? 1 : 0
})

const progressLabel = computed(() => data.value?.questionnaire.status === 'submitted' ? 'Alles afgerond' : questionnaireComplete.value ? 'Nog 2 stappen te gaan' : 'Nog 3 stappen te gaan')

// After the gig, an unpaid invoice is the main call to action on the page.
const invoiceProminent = computed(() => {
  const invoice = data.value?.invoice
  return !!data.value?.finished && invoice?.status === 'finalized' && (invoice.paymentStatus === 'unpaid' || invoice.paymentStatus === 'failed')
})

function formatDate(value: string | null) {
  if (!value) return 'Datum volgt nog'
  return dutchDateTime(value)
}
function formatDueDate(value: string) {
  return dutchFullDate(`${value}T12:00:00Z`)
}
function invoiceAmount() {
  if (!data.value?.invoice) return ''
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: data.value.invoice.currency }).format(data.value.invoice.totalCents / 100)
}
function invoiceStatusLabel() {
  const invoice = data.value?.invoice
  if (!invoice) return ''
  if (invoice.paymentStatus === 'paid') return 'Betaling ontvangen'
  if (invoice.paymentStatus === 'pending') return 'Betaling wordt verwerkt'
  if (invoice.paymentStatus === 'failed') return 'Betaling mislukt'
  return `Te betalen vóór ${formatDueDate(invoice.dueDate)}`
}
function addWish(category: Wish['category'] = 'nice_to_have') {
  wishes.value.push({ category, artist: '', title: '', spotifyUrl: '', note: '', ordering: wishes.value.length })
  nextTick(() => document.getElementById(`wish-${wishes.value.length - 1}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
}
function setAnswer(field: QuestionnaireField, event: Event) {
  const value = (event.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value
  answers[field.id] = field.type === 'number' && value !== '' ? Number(value) : value
}
function goToMusic() {
  document.getElementById('music-wishes')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
async function submit() {
  if (!confirming.value) { confirming.value = true; return }
  confirming.value = false
  submitting.value = true
  message.value = ''
  try {
    await $fetch(`/api/client/portal/${encodeURIComponent(token)}/submit`, { method: 'POST', body: {
      answers,
      acceptedName: acceptedName.value,
      wishes: wishes.value.map((wish, ordering) => ({ ...wish, ordering })),
    } })
    await refresh()
    message.value = 'Bedankt! Je gegevens en muziekwensen zijn verstuurd.'
  } catch (submitError: unknown) {
    message.value = apiErrorMessage(submitError, 'Versturen is niet gelukt. Probeer het opnieuw of neem contact op.')
  } finally {
    submitting.value = false
  }
}
async function submitReview() {
  if (!reviewRating.value) { reviewMessage.value = 'Kies eerst een aantal sterren.'; return }
  reviewBusy.value = true
  reviewMessage.value = ''
  try {
    await $fetch(`/api/client/portal/${encodeURIComponent(token)}/review`, { method: 'POST', body: {
      rating: reviewRating.value,
      comment: reviewComment.value,
      authorName: reviewName.value,
    } })
    await refresh()
  } catch (reviewError: unknown) {
    reviewMessage.value = apiErrorMessage(reviewError, 'Je review versturen is niet gelukt. Probeer het opnieuw.')
  } finally {
    reviewBusy.value = false
  }
}
async function payInvoice() {
  paymentBusy.value = true
  message.value = ''
  try {
    const result = await $fetch<{url:string}>(`/api/client/portal/${encodeURIComponent(token)}/checkout`, { method: 'POST' })
    window.location.assign(result.url)
  } catch (paymentError: unknown) {
    message.value = apiErrorMessage(paymentError, 'De betaling kon niet worden gestart. Probeer het later opnieuw.')
  } finally {
    paymentBusy.value = false
  }
}

useSeoMeta({ title: 'Jouw boeking — DJ NightLight', robots: 'noindex, nofollow' })
</script>

<template>
  <main id="main" class="portal-shell">
    <nav class="portal-nav">
      <NuxtLink to="/" class="portal-brand">DJ NightLight</NuxtLink>
    </nav>

    <section v-if="error" class="surface error-card">
      <p class="eyebrow">Klantportaal</p>
      <h1>Deze link werkt niet meer</h1>
      <p>De link is verlopen of al gebruikt. Vraag om een nieuwe uitnodiging, dan stuur ik je die zo snel mogelijk.</p>
      <p v-if="contact.email || contact.phone" class="error-contact">
        <a v-if="contact.email" :href="`mailto:${contact.email}`"><Icon name="lucide:mail" aria-hidden="true" />{{ contact.email }}</a>
        <a v-if="contact.phone" :href="`tel:${contact.phone}`"><Icon name="lucide:phone" aria-hidden="true" />{{ contact.phone }}</a>
      </p>
    </section>

    <template v-else-if="data">
      <header class="portal-hero" :class="{ 'has-image': data.gig.imageUrl }">
        <img v-if="data.gig.imageUrl" class="hero-image" :src="data.gig.imageUrl" alt="">
        <div v-if="data.gig.imageUrl" class="hero-image-scrim" aria-hidden="true" />

        <div class="hero-copy">
          <p class="eyebrow">Jouw boeking</p>
          <h1>{{ data.gig.title }}</h1>
          <div class="hero-meta">
            <span><Icon name="lucide:calendar-days" aria-hidden="true" />{{ formatDate(data.gig.startsAt) }}</span>
            <span><Icon name="lucide:map-pin" aria-hidden="true" />{{ data.gig.venue?.name || 'Locatie volgt nog' }}<template v-if="data.gig.venue?.city"> · {{ data.gig.venue.city }}</template></span>
          </div>
        </div>

        <div v-if="!data.finished" class="progress-card">
          <div class="progress-copy">
            <Icon name="lucide:clipboard-check" aria-hidden="true" />
            <strong>{{ progressLabel }}</strong>
            <span>{{ completedSteps }} van 3</span>
          </div>
          <div class="progress-track" aria-hidden="true"><span :style="{ width: `${(completedSteps / 3) * 100}%` }" /></div>
        </div>
      </header>

      <section v-if="data.invoice?.status === 'finalized'" class="summary-grid" :class="{ 'is-prominent': invoiceProminent, 'is-paid': data.invoice.paymentStatus === 'paid' }">
        <article class="surface summary-card invoice-card">
          <div class="summary-icon"><Icon :name="data.invoice.paymentStatus === 'paid' ? 'lucide:check' : 'lucide:file-text'" aria-hidden="true" /></div>
          <div class="invoice-copy">
            <p class="eyebrow">Factuur {{ data.invoice.invoiceNumber }}</p>
            <strong v-if="data.invoice.paymentStatus === 'paid'" class="invoice-paid"><Icon name="lucide:check" aria-hidden="true" />Betaald</strong>
            <strong class="invoice-amount">{{ invoiceAmount() }}</strong>
            <span class="invoice-status" :class="`status-${data.invoice.paymentStatus}`"><i />{{ invoiceStatusLabel() }}</span>
            <p v-if="paymentReturn === 'cancelled' && data.invoice.paymentStatus !== 'paid' && data.invoice.paymentStatus !== 'pending'" class="payment-notice" role="status">Je betaling is niet afgerond. Er is niets afgeschreven, je kunt het opnieuw proberen.</p>
            <p v-else-if="paymentReturn === 'success' && data.invoice.paymentStatus !== 'paid'" class="payment-notice" role="status">Bedankt! We verwerken je betaling. Dit kan even duren, dan zie je hier dat de factuur is betaald.</p>
          </div>
          <div class="invoice-actions">
            <button v-if="data.invoice.paymentStatus !== 'paid' && data.invoice.paymentStatus !== 'pending'" type="button" :class="invoiceProminent ? 'primary-action' : 'secondary-action'" :disabled="paymentBusy" @click="payInvoice">
              {{ paymentBusy ? 'Betaalpagina openen…' : 'Veilig betalen' }} <Icon name="lucide:arrow-right" aria-hidden="true" />
            </button>
            <a class="ghost-action" :href="`/api/client/portal/${encodeURIComponent(token)}/invoice-pdf`" download><Icon name="lucide:download" aria-hidden="true" />PDF</a>
          </div>
        </article>
      </section>

      <section v-if="!data.finished && data.questionnaire.status === 'submitted'" class="submitted-banner">
        <Icon name="lucide:circle-check" aria-hidden="true" />
        <div><strong>Alles is verstuurd</strong><span>Je gegevens zijn ontvangen op {{ formatDate(data.questionnaire.submittedAt) }}.</span></div>
      </section>

      <section v-if="data.finished" id="review" class="surface step-section review-card">
        <div v-if="data.review" class="review-done">
          <Icon name="lucide:circle-check" aria-hidden="true" />
          <div>
            <strong>Bedankt voor je review!</strong>
            <span class="review-stars-static" :aria-label="`${data.review.rating} van 5 sterren`"><Icon v-for="n in 5" :key="n" name="lucide:star" :class="{ on: n <= data.review.rating }" aria-hidden="true" /></span>
            <p v-if="data.review.comment">“{{ data.review.comment }}”</p>
          </div>
        </div>
        <form v-else-if="data.reviewOpen" @submit.prevent="submitReview">
          <p class="eyebrow">Review</p>
          <h2>Hoe heb je NightLight ervaren?</h2>
          <p class="review-intro">Bedankt dat ik erbij mocht zijn! Een review helpt mij enorm.</p>
          <div class="star-picker" role="radiogroup" aria-label="Beoordeling">
            <button v-for="n in 5" :key="n" type="button" role="radio" :aria-checked="reviewRating === n" :aria-label="`${n} ${n === 1 ? 'ster' : 'sterren'}`" :class="{ on: n <= (reviewHover || reviewRating) }" @click="reviewRating = n" @mouseenter="reviewHover = n" @mouseleave="reviewHover = 0">
              <Icon name="lucide:star" aria-hidden="true" />
            </button>
          </div>
          <label>Jouw ervaring (optioneel)<textarea v-model="reviewComment" rows="4" maxlength="2000" /></label>
          <label>Je naam (optioneel)<input v-model="reviewName" maxlength="200" autocomplete="name"></label>
          <p v-if="reviewMessage" class="message" role="status">{{ reviewMessage }}</p>
          <div class="submit-actions"><button class="primary-action" :disabled="reviewBusy || !reviewRating">{{ reviewBusy ? 'Versturen…' : 'Review versturen' }} <Icon v-if="!reviewBusy" name="lucide:arrow-right" aria-hidden="true" /></button></div>
        </form>
      </section>

      <form v-else @submit.prevent="submit">
        <section class="surface step-section" :class="{ complete: questionnaireComplete }">
          <div class="step-header">
            <span class="step-number"><Icon v-if="questionnaireComplete" name="lucide:check" aria-hidden="true" /><template v-else>1</template></span>
            <div class="step-title">
              <div class="step-title-row"><h2>Gegevens van het feest</h2><span class="status-pill" :class="{ done: questionnaireComplete }">{{ questionnaireComplete ? 'Compleet' : 'Nog niet compleet' }}</span></div>
              <p>Vertel ons wat meer over het feest.</p>
            </div>
          </div>

          <div class="field-grid">
            <label v-for="field in data.questionnaire.fields" :key="field.id" :class="{ wide: field.type === 'long_text' || field.type === 'acknowledgement' || field.type === 'checkbox' }">
              <span>{{ field.label }}<b v-if="field.required" aria-hidden="true"> *</b></span>
              <small v-if="field.helpText">{{ field.helpText }}</small>
              <textarea v-if="field.type === 'long_text'" :value="String(answers[field.id] ?? '')" rows="4" :required="field.required" :disabled="data.questionnaire.status === 'submitted'" @input="setAnswer(field, $event)" />
              <select v-else-if="field.type === 'select'" :value="String(answers[field.id] ?? '')" :required="field.required" :disabled="data.questionnaire.status === 'submitted'" @change="setAnswer(field, $event)">
                <option value="">Kies…</option><option v-for="option in field.options" :key="option" :value="option">{{ option }}</option>
              </select>
              <span v-else-if="field.type === 'multi_select'" class="option-list"><label v-for="option in field.options" :key="option"><input v-model="answers[field.id]" type="checkbox" :value="option" :disabled="data.questionnaire.status === 'submitted'"> {{ option }}</label></span>
              <span v-else-if="field.type === 'checkbox' || field.type === 'acknowledgement'" class="check-line"><input v-model="answers[field.id]" type="checkbox" :required="field.required" :disabled="data.questionnaire.status === 'submitted'"><span>Ja, ik bevestig dit</span></span>
              <input v-else :value="String(answers[field.id] ?? '')" :type="field.type === 'short_text' ? 'text' : field.type" :required="field.required" :disabled="data.questionnaire.status === 'submitted'" @input="setAnswer(field, $event)">
            </label>
          </div>

          <label class="signature">Je volledige naam als akkoord <b aria-hidden="true">*</b><input v-model="acceptedName" required :disabled="data.questionnaire.status === 'submitted'"></label>
          <button v-if="data.questionnaire.status !== 'submitted'" type="button" class="primary-action section-action" @click="goToMusic">Doorgaan naar muziekwensen <Icon name="lucide:arrow-right" aria-hidden="true" /></button>
        </section>

        <section id="music-wishes" class="surface step-section">
          <div class="step-header">
            <span class="step-number">2</span>
            <div class="step-title">
              <div class="step-title-row"><h2>Muziekwensen</h2><span class="wish-count">{{ wishes.length }} {{ wishes.length === 1 ? 'wens' : 'wensen' }} toegevoegd</span></div>
              <p>Voeg nummers, artiesten of belangrijke momenten toe. Je kunt dit tot het versturen aanpassen.</p>
            </div>
          </div>

          <div v-if="data.questionnaire.status !== 'submitted'" class="wish-category-grid">
            <button v-for="category in musicWishCategories" :key="category" type="button" class="wish-category" @click="addWish(category)">
              <Icon :name="categoryMeta[category].icon" aria-hidden="true" />
              <strong>{{ categoryLabels[category] }}</strong>
              <span>{{ categoryMeta[category].description }}</span>
            </button>
          </div>

          <div v-if="!wishes.length" class="empty-wishes">
            <Icon name="lucide:music-2" aria-hidden="true" />
            <div><strong>Nog geen muziekwensen toegevoegd</strong><span>Kies een van de opties hierboven om je eerste wens toe te voegen.</span></div>
          </div>

          <article v-for="(wish, index) in wishes" :id="`wish-${index}`" :key="index" class="wish-card">
            <div class="wish-head">
              <div><span class="wish-type-icon"><Icon :name="categoryMeta[wish.category].icon" aria-hidden="true" /></span><strong>Wens {{ index + 1 }}</strong></div>
              <button v-if="data.questionnaire.status !== 'submitted'" type="button" @click="wishes.splice(index, 1)"><Icon name="lucide:trash-2" aria-hidden="true" /> Verwijderen</button>
            </div>
            <div class="field-grid">
              <label>Soort wens<select v-model="wish.category" :disabled="data.questionnaire.status === 'submitted'"><option v-for="category in musicWishCategories" :key="category" :value="category">{{ categoryLabels[category] }}</option></select></label>
              <label>Artiest<input v-model="wish.artist" :disabled="data.questionnaire.status === 'submitted'"></label>
              <label>Titel<input v-model="wish.title" :disabled="data.questionnaire.status === 'submitted'"></label>
              <label>Spotify-link<input v-model="wish.spotifyUrl" type="url" placeholder="https://open.spotify.com/track/…" :disabled="data.questionnaire.status === 'submitted'"></label>
              <label class="wide">Toelichting of speciaal moment<textarea v-model="wish.note" rows="2" :disabled="data.questionnaire.status === 'submitted'" /></label>
            </div>
          </article>
        </section>

        <section v-if="data.questionnaire.status !== 'submitted'" class="surface step-section review-section">
          <div class="step-header">
            <span class="step-number muted">3</span>
            <div class="step-title"><h2>Controleren & versturen</h2><p>Bekijk je gegevens en stuur alles in één keer naar ons.</p></div>
          </div>

          <div class="review-list">
            <div><Icon name="lucide:calendar-days" aria-hidden="true" /><span><strong>Boekingsgegevens</strong><small>{{ formatDate(data.gig.startsAt) }} · {{ data.gig.venue?.name || 'Locatie volgt nog' }}</small></span><Icon name="lucide:check-circle-2" class="review-ok" aria-hidden="true" /></div>
            <div v-if="data.invoice?.status === 'finalized'"><Icon name="lucide:file-text" aria-hidden="true" /><span><strong>Factuur</strong><small>{{ invoiceAmount() }} · {{ invoiceStatusLabel() }}</small></span><Icon name="lucide:check-circle-2" class="review-ok" aria-hidden="true" /></div>
            <div><Icon name="lucide:users" aria-hidden="true" /><span><strong>Gegevens van het feest</strong><small>{{ questionnaireComplete ? 'Compleet' : 'Nog niet compleet' }}</small></span><Icon :name="questionnaireComplete ? 'lucide:check-circle-2' : 'lucide:circle'" :class="{ 'review-ok': questionnaireComplete }" aria-hidden="true" /></div>
            <div><Icon name="lucide:headphones" aria-hidden="true" /><span><strong>Muziekwensen</strong><small>{{ wishes.length }} {{ wishes.length === 1 ? 'wens' : 'wensen' }} toegevoegd</small></span><Icon name="lucide:circle" aria-hidden="true" /></div>
          </div>

          <div v-if="confirming" class="confirm-box" role="alert"><Icon name="lucide:shield-check" aria-hidden="true" /><div><strong>Alles klopt?</strong><span>Na versturen kun je je antwoorden en wensen niet meer via deze link aanpassen.</span></div></div>
          <div class="submit-actions">
            <button v-if="confirming" type="button" class="secondary-action" @click="confirming = false">Nog even aanpassen</button>
            <button class="primary-action" :disabled="submitting || !questionnaireComplete">{{ submitting ? 'Versturen…' : confirming ? 'Ja, verstuur alles' : 'Alles controleren & versturen' }} <Icon v-if="!submitting" name="lucide:arrow-right" aria-hidden="true" /></button>
          </div>
        </section>

        <p v-if="message" class="message" role="status">{{ message }}</p>
      </form>

      <footer class="portal-footer">
        <Icon name="lucide:lock-keyhole" aria-hidden="true" />
        <div><strong>Beveiligde persoonlijke link</strong><span>Geldig tot {{ formatDate(data.expiresAt) }}.<template v-if="contact.email || contact.phone"> Hulp nodig? <a v-if="contact.email" :href="`mailto:${contact.email}`">Neem contact op</a><template v-else-if="contact.phone"> <a :href="`tel:${contact.phone}`">Bel ons</a></template></template></span></div>
      </footer>
    </template>
  </main>
</template>

<style scoped>
.payment-notice{margin:.5rem 0 0;font-size:.9rem;color:var(--text-subtle)}
.review-card{display:grid;gap:1rem}.review-card h2{margin:.2rem 0;font-size:1.5rem;letter-spacing:-.025em}.review-card form{display:grid;gap:1rem}.review-intro{margin:0;color:var(--text-subtle)}.star-picker{display:flex;gap:.25rem}.star-picker button{border:0;background:none;padding:.2rem;color:#7d7489;font-size:2.2rem;line-height:0;cursor:pointer;transition:color .12s,transform .12s}.star-picker button:hover{transform:scale(1.1)}.star-picker button.on{color:#a66eff}.star-picker button.on svg{fill:currentColor}.review-done{display:flex;align-items:flex-start;gap:.85rem;color:#bdebd1}.review-done>svg{font-size:1.5rem;margin-top:.1rem}.review-done div{display:grid;gap:.4rem}.review-done p{margin:0;color:var(--text-subtle)}.review-stars-static{display:flex;gap:.15rem;color:#4a4352}.review-stars-static .on{color:#a66eff;fill:currentColor}

.portal-shell{width:min(960px,calc(100% - 2rem));margin:0 auto;padding:1.5rem 0 4rem;color:var(--text)}
.portal-nav{display:flex;align-items:center;justify-content:space-between;min-height:3.5rem;margin-bottom:2rem}.portal-brand{color:var(--text);font-size:1.15rem;font-weight:800;text-decoration:none;letter-spacing:-.02em}
.portal-hero{position:relative;display:grid;gap:1.5rem;margin-bottom:1.25rem;padding:clamp(1.4rem,4vw,2.2rem);overflow:hidden;border:1px solid #2c2138;border-radius:1.5rem;background:radial-gradient(circle at 75% 15%,rgba(131,67,255,.26),transparent 34%),linear-gradient(145deg,#0c0911 10%,#15101e 100%)}
.portal-hero.has-image{min-height:22rem;background:#0c0911}.hero-image{position:absolute;inset:0 0 0 auto;width:62%;height:100%;object-fit:cover;object-position:center}.hero-image-scrim{position:absolute;inset:0;background:linear-gradient(90deg,#0c0911 0%,rgba(12,9,17,.94) 36%,rgba(12,9,17,.4) 72%,rgba(12,9,17,.18) 100%),linear-gradient(0deg,rgba(12,9,17,.62),transparent 58%);pointer-events:none}
.portal-hero::after{position:absolute;inset:auto -5% -45% 45%;height:75%;content:"";background:radial-gradient(ellipse,rgba(141,69,255,.13),transparent 67%);pointer-events:none}.hero-copy,.progress-card{position:relative;z-index:1}.eyebrow{margin:0;color:#b99bff;font-size:.7rem;font-weight:800;letter-spacing:.18em;text-transform:uppercase}.portal-hero h1,.error-card h1{margin:.35rem 0 1rem;font-size:clamp(2.4rem,7vw,4.6rem);line-height:.96;letter-spacing:-.05em}.hero-meta{display:grid;gap:.65rem;color:#ded9e4}.hero-meta span{display:flex;align-items:center;gap:.6rem}.hero-meta svg{color:#a86dff;font-size:1.15rem}
.progress-card{padding:1rem;border:1px solid #3b2855;border-radius:1rem;background:rgba(20,13,31,.78);backdrop-filter:blur(10px)}.progress-copy{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:.65rem}.progress-copy svg{color:#a66eff}.progress-copy strong{font-size:.95rem}.progress-copy span{color:var(--text-subtle);font-size:.8rem}.progress-track{height:.45rem;margin-top:.8rem;overflow:hidden;border-radius:999px;background:#2b2337}.progress-track span{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#7c3cff,#bb71ff);box-shadow:0 0 20px rgba(159,86,255,.45);transition:width .25s ease}
.summary-grid{display:grid;grid-template-columns:minmax(0,30rem);gap:1rem}.surface{border:1px solid #29232f;border-radius:1.15rem;background:linear-gradient(145deg,rgba(20,17,24,.98),rgba(14,12,18,.98));box-shadow:0 16px 50px rgba(0,0,0,.12)}.summary-card{display:grid;grid-template-columns:auto 1fr;gap:1rem;padding:1.15rem}.summary-icon,.wish-type-icon{display:grid;place-items:center;width:2.3rem;height:2.3rem;border-radius:.75rem;background:#211631;color:#a76dff}.summary-card>div:last-child{display:grid;gap:.35rem}.summary-card strong{font-size:1.05rem}.summary-card span{display:flex;align-items:center;gap:.4rem;color:var(--text-subtle);font-size:.84rem}.invoice-amount{font-size:1.5rem!important}.invoice-status i{width:.55rem;height:.55rem;border-radius:50%;background:#f2a425}.invoice-status.status-paid i{background:#58d698}.invoice-status.status-failed i{background:#ff6f7f}.secondary-action,.primary-action{display:inline-flex;align-items:center;justify-content:center;gap:.45rem;border-radius:.75rem;padding:.8rem 1rem;font-weight:750;cursor:pointer}.secondary-action{border:1px solid #544762;background:transparent;color:var(--text)}.invoice-card .secondary-action{padding:.65rem .9rem}.primary-action{border:0;background:linear-gradient(135deg,#7d3eff,#a754ff);color:white;box-shadow:0 10px 30px rgba(126,55,255,.25)}.primary-action:disabled{cursor:not-allowed;background:#1b1622;color:#8a8194;box-shadow:none;outline:1px solid #342b40;outline-offset:-1px}
.submitted-banner{display:flex;align-items:center;gap:.85rem;margin-top:1rem;padding:1rem 1.1rem;border:1px solid #275541;border-radius:1rem;background:#0e2019;color:#bdebd1}.submitted-banner>svg{font-size:1.4rem}.submitted-banner div{display:grid;gap:.15rem}.submitted-banner span{font-size:.85rem;opacity:.78}
.step-section{margin-top:1rem;padding:clamp(1rem,3vw,1.4rem);scroll-margin-top:1rem}.step-header{display:grid;grid-template-columns:auto 1fr;gap:.9rem;align-items:start;margin-bottom:1.35rem}.step-number{display:grid;place-items:center;width:2.5rem;height:2.5rem;border-radius:50%;background:linear-gradient(135deg,#7136ff,#ad59ff);color:white;font-weight:800;box-shadow:0 8px 24px rgba(119,53,255,.25)}.step-number.muted{background:#3d3945;box-shadow:none}.step-section.complete .step-number{background:#55d997;color:#07110d}.step-title{min-width:0}.step-title h2{margin:.05rem 0;font-size:1.35rem;letter-spacing:-.025em}.step-title p{margin:.25rem 0 0;color:var(--text-subtle);font-size:.9rem}.step-title-row{display:flex;align-items:center;justify-content:space-between;gap:.75rem}.status-pill,.wish-count{flex:0 0 auto;border-radius:999px;padding:.3rem .55rem;background:#322216;color:#ffb655;font-size:.68rem;font-weight:750}.status-pill.done{background:#14291f;color:#68dda5}.wish-count{background:#211631;color:#bd91ff}
.field-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.9rem}.wide{grid-column:1/-1}label{display:grid;gap:.4rem;color:#c9c3ce;font-size:.8rem;font-weight:650}label>b{color:#ff8da1}label small{color:var(--text-subtle);font-weight:400}input,select,textarea{width:100%;border:1px solid #3b3442;border-radius:.72rem;padding:.78rem .85rem;background:#0b0910;color:var(--text);font:inherit;font-weight:450;outline:none;transition:border-color .15s,box-shadow .15s}input:focus,select:focus,textarea:focus{border-color:#8152b8;box-shadow:0 0 0 3px rgba(129,82,184,.12)}input:disabled,select:disabled,textarea:disabled{opacity:.65}.check-line,.option-list{display:flex;gap:.65rem;padding:.75rem .8rem;border:1px solid #3b3442;border-radius:.72rem;background:#0b0910}.check-line{align-items:center}.check-line input,.option-list input{width:auto}.check-line span{font-weight:500}.option-list{align-items:start;flex-direction:column}.option-list label{display:flex;align-items:center;gap:.5rem}.signature{margin-top:1rem}.section-action{margin-top:1.15rem;margin-left:auto}
.wish-category-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:.75rem}.wish-category{display:flex;min-height:10.5rem;align-items:center;flex-direction:column;justify-content:center;gap:.55rem;padding:1rem;border:1px solid #332d39;border-radius:1rem;background:#0e0c12;color:var(--text);text-align:center;cursor:pointer;transition:transform .15s,border-color .15s,background .15s}.wish-category:hover{transform:translateY(-2px);border-color:#6f4a9b;background:#14101a}.wish-category>svg{font-size:1.75rem;color:#a96cff}.wish-category strong{font-size:.9rem}.wish-category span{color:var(--text-subtle);font-size:.75rem;line-height:1.4}.empty-wishes{display:flex;align-items:center;gap:.9rem;margin-top:1rem;padding:1rem;border:1px solid #28232f;border-radius:.9rem;background:#0d0b10}.empty-wishes>svg{font-size:1.5rem;color:#9861e9}.empty-wishes div{display:grid;gap:.15rem}.empty-wishes span{color:var(--text-subtle);font-size:.8rem}.wish-card{margin-top:1rem;padding:1rem;border:1px solid #302938;border-radius:1rem;background:#0c0a0f}.wish-head{display:flex;align-items:center;justify-content:space-between;gap:1rem;margin-bottom:.9rem}.wish-head>div{display:flex;align-items:center;gap:.65rem}.wish-head button{display:flex;align-items:center;gap:.35rem;border:0;background:none;color:#a79fac;font-size:.75rem;cursor:pointer}.wish-head button:hover{color:#ff8ea0}.wish-type-icon{width:2rem;height:2rem;border-radius:.6rem}
.review-list{overflow:hidden;border:1px solid #2d2733;border-radius:.9rem}.review-list>div{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:.75rem;padding:.9rem;border-bottom:1px solid #27222c}.review-list>div:last-child{border-bottom:0}.review-list>div>svg:first-child{color:#a56cff;font-size:1.1rem}.review-list span{display:grid;gap:.15rem}.review-list small{color:var(--text-subtle);font-size:.75rem}.review-ok{color:#5edca1!important}.confirm-box{display:flex;align-items:flex-start;gap:.75rem;margin-top:1rem;padding:.9rem;border:1px solid #4d3b68;border-radius:.85rem;background:#171020}.confirm-box>svg{flex:0 0 auto;color:#a66fff;font-size:1.2rem}.confirm-box div{display:grid;gap:.2rem}.confirm-box span{color:var(--text-subtle);font-size:.8rem}.submit-actions{display:flex;justify-content:flex-end;gap:.7rem;margin-top:1rem}.message{margin:1rem 0 0;padding:1rem;border:1px solid #45404a;border-radius:.8rem;background:#121016}
.portal-footer{display:flex;align-items:flex-start;gap:.8rem;margin-top:1.25rem;padding:.5rem;color:#b8b1bf}.portal-footer>svg{flex:0 0 auto;margin-top:.1rem}.portal-footer div{display:grid;gap:.2rem}.portal-footer strong{font-size:.85rem}.portal-footer span{color:var(--text-subtle);font-size:.75rem}.portal-footer a{color:#b987ff}.error-card{padding:1.5rem}.error-card>p{color:var(--text-subtle)}.error-contact{display:flex;gap:1rem;flex-wrap:wrap}.error-contact a{display:flex;align-items:center;gap:.4rem;color:#c895ff}
.summary-grid.is-prominent{grid-template-columns:minmax(0,1fr)}.invoice-card{grid-template-columns:auto 1fr auto;align-items:center}.summary-card>div.invoice-actions{display:flex;align-items:center;gap:.6rem}.invoice-actions button,.invoice-actions a{white-space:nowrap}.ghost-action{display:inline-flex;align-items:center;gap:.4rem;padding:.6rem .8rem;border:1px solid #3b3442;border-radius:.7rem;color:#c9c3ce;font-size:.85rem;font-weight:650;text-decoration:none;transition:border-color .15s,color .15s}.ghost-action:hover{border-color:#6f4a9b;color:var(--text)}.is-prominent .invoice-card{gap:1.1rem;padding:1.15rem 1.4rem;border-color:#6a3fc0;background:radial-gradient(circle at 88% 20%,rgba(131,67,255,.28),transparent 45%),linear-gradient(145deg,#1a1228,#100c18);box-shadow:0 0 0 1px rgba(150,95,255,.18),0 14px 44px rgba(110,50,230,.2)}.is-prominent .summary-icon{width:2.8rem;height:2.8rem;border-radius:.9rem;font-size:1.3rem;background:#2c1c47}.is-prominent .invoice-copy{gap:.3rem}.is-prominent .invoice-amount{font-size:clamp(1.9rem,6vw,2.6rem)!important;line-height:1;letter-spacing:-.04em}.is-prominent .invoice-status{color:#e6dff0}.is-prominent .primary-action{padding:.85rem 1.4rem;font-size:1rem}.is-paid .invoice-card{border-color:#244b38;background:linear-gradient(145deg,#0e1a15,#0c1210);box-shadow:none}.is-paid .summary-icon{background:#14291f;color:#68dda5}.is-paid .eyebrow{color:#7fd5a8}.is-paid .invoice-amount{font-size:1rem!important;color:var(--text-subtle)}.invoice-paid{display:flex;align-items:center;gap:.4rem;color:#68dda5;font-size:1.35rem!important}.invoice-copy{display:grid;gap:.35rem}.invoice-card .invoice-copy span{display:flex}
@media(min-width:760px){.portal-hero{grid-template-columns:minmax(0,1.4fr) minmax(260px,.6fr);align-items:end}.progress-card{align-self:end}}
@media(max-width:760px){.portal-shell{width:min(100% - 1rem,620px);padding-top:.75rem}.portal-nav{margin:0 .5rem 1rem}.portal-hero{margin-inline:0;border-radius:1.2rem}.portal-hero.has-image{min-height:25rem}.portal-hero h1{font-size:clamp(2.2rem,12vw,3.8rem)}.hero-image{width:100%;opacity:.72}.hero-image-scrim{background:linear-gradient(0deg,#0c0911 0%,rgba(12,9,17,.88) 43%,rgba(12,9,17,.28) 100%)}.summary-grid{grid-template-columns:1fr}.summary-card{grid-template-columns:auto 1fr;padding:1rem}.summary-icon{width:2rem;height:2rem}.field-grid{grid-template-columns:1fr}.wide{grid-column:auto}.wish-category-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.step-title-row{align-items:flex-start;flex-direction:column;gap:.45rem}.section-action{width:100%;margin-left:0}.submit-actions{flex-direction:column-reverse}.submit-actions button{width:100%}}
@media(max-width:480px){.summary-grid{grid-template-columns:1fr}.summary-card{grid-template-columns:auto 1fr}.wish-category{min-height:9.25rem;padding:.8rem}.portal-hero{padding:1.1rem}.step-section{padding:1rem}.step-header{grid-template-columns:auto minmax(0,1fr)}.step-number{width:2.2rem;height:2.2rem}.step-title h2{font-size:1.2rem}.review-list>div{padding:.8rem}.invoice-card{grid-template-columns:auto 1fr}.invoice-actions{grid-column:1/-1}.invoice-actions .primary-action,.invoice-actions .secondary-action{flex:1 1 auto}.invoice-actions .ghost-action{flex:0 0 auto}}
</style>
