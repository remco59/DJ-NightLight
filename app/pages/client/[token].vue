<script setup lang="ts">
import type { QuestionnaireField } from '~~/shared/questionnaire'
import { musicWishCategories } from '~~/shared/questionnaire'
import { musicWishCategoryLabels } from '~~/shared/labels'
import { apiErrorMessage } from '~/utils/api-error'

const route = useRoute()
const token = String(route.params.token || '')
type Wish = { category: typeof musicWishCategories[number], artist: string | null, title: string | null, spotifyUrl: string | null, note: string | null, ordering: number }
type Answer = string | number | boolean | string[]
type PortalData = {
  gig: { id: string, title: string, eventType: string | null, status: string, startsAt: string | null, endsAt: string | null, venue: { name: string, city: string | null } | null }
  client: { name: string | null }
  expiresAt: string
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
const categoryLabels = musicWishCategoryLabels as Record<Wish['category'], string>
// Submitting locks the answers, so the button first asks for a second, explicit click.
const confirming = ref(false)

function formatDate(value: string | null) {
  if (!value) return 'Datum volgt nog'
  return new Intl.DateTimeFormat('nl-NL', { dateStyle: 'full', timeStyle: 'short' }).format(new Date(value))
}
function addWish(category: Wish['category'] = 'nice_to_have') {
  wishes.value.push({ category, artist: '', title: '', spotifyUrl: '', note: '', ordering: wishes.value.length })
}
function setAnswer(field: QuestionnaireField, event: Event) {
  const value = (event.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value
  answers[field.id] = field.type === 'number' && value !== '' ? Number(value) : value
}
async function submit() {
  if (!confirming.value) { confirming.value = true; return }
  confirming.value = false
  submitting.value = true; message.value = ''
  try {
    await $fetch(`/api/client/portal/${encodeURIComponent(token)}/submit`, { method: 'POST', body: {
      answers,
      acceptedName: acceptedName.value,
      wishes: wishes.value.map((wish, ordering) => ({ ...wish, ordering })),
    } })
    await refresh(); message.value = 'Bedankt! Je gegevens en muziekwensen zijn verstuurd.'
  } catch (submitError: unknown) { message.value = apiErrorMessage(submitError, 'Versturen is niet gelukt. Probeer het opnieuw of neem contact op.') } finally { submitting.value = false }
}
async function payInvoice() {
  paymentBusy.value = true; message.value = ''
  try {
    const result = await $fetch<{url:string}>(`/api/client/portal/${encodeURIComponent(token)}/checkout`, { method: 'POST' })
    window.location.assign(result.url)
  } catch (paymentError: unknown) { message.value = apiErrorMessage(paymentError, 'De betaling kon niet worden gestart. Probeer het later opnieuw.') } finally { paymentBusy.value = false }
}
useSeoMeta({ title: 'Jouw boeking — DJ NightLight', robots: 'noindex, nofollow' })
</script>

<template>
  <main id="main" class="portal-shell">
    <NuxtLink to="/" class="portal-brand">DJ NightLight</NuxtLink>
    <section v-if="error" class="portal-card error-card"><p class="eyebrow">Klantportaal</p><h1>Deze link werkt niet meer</h1><p>De link is verlopen of al gebruikt. Vraag om een nieuwe uitnodiging, dan stuur ik je die zo snel mogelijk.</p><p v-if="contact.email||contact.phone" class="error-contact"><a v-if="contact.email" :href="`mailto:${contact.email}`"><Icon name="lucide:mail" aria-hidden="true" />{{ contact.email }}</a><a v-if="contact.phone" :href="`tel:${contact.phone}`"><Icon name="lucide:phone" aria-hidden="true" />{{ contact.phone }}</a></p></section>
    <template v-else-if="data">
      <header class="portal-hero"><p class="eyebrow">Jouw boeking</p><h1>{{ data.gig.title }}</h1><p v-if="data.client.name">Welkom, {{ data.client.name }}.</p></header>
      <section class="portal-grid booking-summary">
        <article class="portal-card"><p class="eyebrow">Datum & tijd</p><strong>{{ formatDate(data.gig.startsAt) }}</strong><span v-if="data.gig.endsAt">Tot {{ formatDate(data.gig.endsAt) }}</span></article>
        <article class="portal-card"><p class="eyebrow">Locatie</p><strong>{{ data.gig.venue?.name || 'Volgt nog' }}</strong><span v-if="data.gig.venue?.city">{{ data.gig.venue.city }}</span></article>
      </section>

      <section v-if="data.invoice?.status==='finalized'" class="payment-card"><div><p class="eyebrow">Factuur {{data.invoice.invoiceNumber}}</p><h2>{{new Intl.NumberFormat('nl-NL',{style:'currency',currency:data.invoice.currency}).format(data.invoice.totalCents/100)}}</h2><span v-if="data.invoice.paymentStatus==='paid'">Betaald{{data.invoice.paidAt?` op ${formatDate(data.invoice.paidAt)}`:''}}</span><span v-else-if="data.invoice.paymentStatus==='pending'">Betaling wordt verwerkt. Een bankoverschrijving kan een paar werkdagen duren.</span><span v-else>Te betalen vóór {{formatDate(data.invoice.dueDate)}} · met iDEAL, kaart of overschrijving.</span></div><strong v-if="data.invoice.paymentStatus==='paid'" class="paid">Betaling ontvangen</strong><button v-else type="button" class="primary" :disabled="paymentBusy" @click="payInvoice">{{paymentBusy?'Betaalpagina openen…':'Veilig betalen'}}</button></section>

      <section v-if="data.questionnaire.status==='submitted'" class="submitted-banner"><strong>Verstuurd</strong><span>Je gegevens zijn ontvangen op {{ formatDate(data.questionnaire.submittedAt) }}.</span></section>

      <form @submit.prevent="submit">
        <section class="form-section"><div class="section-heading"><p class="eyebrow">Stap 1</p><h2>Gegevens van het feest & akkoord</h2><span>Hoe meer ik weet, hoe beter de avond aansluit.</span></div>
          <div class="field-grid">
            <label v-for="field in data.questionnaire.fields" :key="field.id" :class="{wide:field.type==='long_text'||field.type==='acknowledgement'}">
              <span>{{ field.label }} <em v-if="field.required">Verplicht</em></span><small v-if="field.helpText">{{ field.helpText }}</small>
              <textarea v-if="field.type==='long_text'" :value="String(answers[field.id]??'')" rows="4" :required="field.required" :disabled="data.questionnaire.status==='submitted'" @input="setAnswer(field,$event)"/>
              <select v-else-if="field.type==='select'" :value="String(answers[field.id]??'')" :required="field.required" :disabled="data.questionnaire.status==='submitted'" @change="setAnswer(field,$event)"><option value="">Kies…</option><option v-for="option in field.options" :key="option" :value="option">{{ option }}</option></select>
              <span v-else-if="field.type==='multi_select'" class="option-list"><label v-for="option in field.options" :key="option"><input v-model="answers[field.id]" type="checkbox" :value="option" :disabled="data.questionnaire.status==='submitted'"> {{ option }}</label></span>
              <span v-else-if="field.type==='checkbox'||field.type==='acknowledgement'" class="check-line"><input v-model="answers[field.id]" type="checkbox" :required="field.required" :disabled="data.questionnaire.status==='submitted'"> Ja</span>
              <input v-else :value="String(answers[field.id]??'')" :type="field.type==='short_text'?'text':field.type" :required="field.required" :disabled="data.questionnaire.status==='submitted'" @input="setAnswer(field,$event)">
            </label>
          </div>
          <label class="signature">Je volledige naam als akkoord<input v-model="acceptedName" required :disabled="data.questionnaire.status==='submitted'"></label>
        </section>

        <section class="form-section"><div class="section-heading"><p class="eyebrow">Stap 2</p><h2>Muziekwensen</h2><span>Voeg nummers, playlists of uitleg bij belangrijke momenten toe.</span></div>
          <div v-if="!wishes.length" class="empty">Nog geen muziekwensen. Kies hieronder een soort wens om te beginnen.</div>
          <article v-for="(wish,index) in wishes" :key="index" class="wish-card"><div class="wish-head"><strong>Wens {{ index+1 }}</strong><button v-if="data.questionnaire.status!=='submitted'" type="button" @click="wishes.splice(index,1)">Verwijderen</button></div><div class="field-grid"><label>Soort wens<select v-model="wish.category" :disabled="data.questionnaire.status==='submitted'"><option v-for="category in musicWishCategories" :key="category" :value="category">{{categoryLabels[category]}}</option></select></label><label>Artiest<input v-model="wish.artist" :disabled="data.questionnaire.status==='submitted'"></label><label>Titel<input v-model="wish.title" :disabled="data.questionnaire.status==='submitted'"></label><label>Spotify-link naar nummer of playlist<input v-model="wish.spotifyUrl" type="url" placeholder="https://open.spotify.com/track/…" :disabled="data.questionnaire.status==='submitted'"></label><label class="wide">Toelichting of speciaal moment<textarea v-model="wish.note" rows="2" :disabled="data.questionnaire.status==='submitted'"/></label></div></article>
          <div v-if="data.questionnaire.status!=='submitted'" class="wish-buttons"><button v-for="category in musicWishCategories" :key="category" type="button" @click="addWish(category)"><Icon name="lucide:plus" aria-hidden="true" /> {{categoryLabels[category]}}</button></div>
        </section>

        <div v-if="data.questionnaire.status!=='submitted'" class="submit-bar" :class="{ confirming }"><div v-if="confirming" role="alert"><strong>Alles klopt?</strong><span>Na versturen kun je je antwoorden en wensen niet meer via deze link aanpassen.</span></div><div v-else><strong>Klaar om te versturen?</strong><span>Je antwoorden en muziekwensen worden samen verstuurd.</span></div><div class="submit-actions"><button v-if="confirming" type="button" class="ghost" @click="confirming=false">Nog even aanpassen</button><button class="primary" :disabled="submitting">{{submitting?'Versturen…':confirming?'Ja, verstuur alles':'Alles versturen'}}</button></div></div>
        <p v-if="message" class="message" role="status">{{message}}</p>
      </form>
      <p class="expiry">Deze beveiligde link is geldig tot {{ formatDate(data.expiresAt) }}.<template v-if="contact.email||contact.phone"> Vragen? <a v-if="contact.email" :href="`mailto:${contact.email}`">{{ contact.email }}</a><template v-if="contact.email&&contact.phone"> · </template><a v-if="contact.phone" :href="`tel:${contact.phone}`">{{ contact.phone }}</a></template></p>
    </template>
  </main>
</template>

<style scoped>
.payment-card{display:flex;align-items:center;justify-content:space-between;gap:1rem;margin-top:1rem;padding:1.2rem;border:1px solid #44334f;border-radius:1rem;background:linear-gradient(135deg,#181020,#100e14)}.payment-card h2{margin:.2rem 0}.payment-card span{color:#908899}.paid{color:#a9e1bb}@media(max-width:640px){.payment-card{align-items:stretch;flex-direction:column}}
.portal-shell{width:min(920px,calc(100% - 2rem));margin:0 auto;padding:clamp(3rem,10vw,7rem) 0}.portal-hero{margin-bottom:2rem}.portal-hero h1,.error-card h1{max-width:760px;margin:.25rem 0 .6rem;font-size:clamp(2.5rem,8vw,5.5rem);line-height:.95;letter-spacing:-.06em}.portal-hero>p:last-child,.error-card>p:last-child{color:#96909f}.portal-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:1rem}.portal-card,.form-section{padding:1.4rem;border:1px solid #2d2832;border-radius:1.1rem;background:#100e14}.portal-card{display:grid;gap:.4rem}.portal-card strong{font-size:1.15rem}.portal-card span,.section-heading span{color:#8e8797}.submitted-banner{display:flex;justify-content:space-between;gap:1rem;margin:1rem 0;padding:1rem;border:1px solid #314a3d;border-radius:.85rem;background:#102019;color:#b9e3c8}.form-section{margin-top:1rem}.section-heading{margin-bottom:1.2rem}.section-heading h2{margin:.2rem 0}.field-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:.85rem}.wide{grid-column:1/-1}label{display:grid;gap:.35rem;color:#b0a9b7;font-size:.8rem}label>span:first-child{font-weight:700}label em{margin-left:.35rem;color:#9d83b2;font-size:.62rem;font-style:normal;text-transform:uppercase}label small{color:#756e7d}input,select,textarea{width:100%;border:1px solid #39323f;border-radius:.65rem;padding:.72rem;background:#0b0a0d;color:#f6f3fa}input:disabled,select:disabled,textarea:disabled{opacity:.7}.check-line,.option-list{display:flex;gap:.55rem;padding:.65rem;border:1px solid #332e39;border-radius:.65rem}.check-line input,.option-list input{width:auto}.option-list{align-items:start;flex-direction:column}.option-list label{display:flex;align-items:center;gap:.5rem}.signature{margin-top:1rem}.wish-card{margin-top:.7rem;padding:1rem;border:1px solid #29242f;border-radius:.85rem;background:#0d0b10}.wish-head{display:flex;justify-content:space-between;margin-bottom:.8rem}.wish-head button,.wish-buttons button{border:1px solid #332d3a;border-radius:.55rem;padding:.45rem .65rem;background:#19151f;color:#cfc8d5;cursor:pointer}.wish-head button{border:0;background:transparent;color:#dc9da7}.wish-buttons{display:flex;flex-wrap:wrap;gap:.45rem;margin-top:.8rem}.empty{color:#777080}.submit-bar{position:sticky;bottom:1rem;z-index:5;display:flex;align-items:center;justify-content:space-between;gap:1rem;margin-top:1rem;padding:1rem 1.15rem;border:1px solid #403748;border-radius:1rem;background:rgba(20,17,25,.96);backdrop-filter:blur(14px)}.submit-bar strong,.submit-bar span{display:block}.submit-bar span{color:#817a89;font-size:.78rem}.primary{border:0;border-radius:.7rem;padding:.75rem 1rem;background:#fff;color:#09080b;font-weight:800;cursor:pointer}.message{color:#b6afbf}.expiry{margin-top:1rem;color:#8f8996;font-size:.8rem}.expiry a,.error-contact a{color:#d9c6ff}.error-contact{display:flex;flex-wrap:wrap;gap:.5rem 1.25rem;margin-top:1.25rem}.error-contact a{display:inline-flex;align-items:center;gap:.45rem;min-height:2.75rem}.portal-brand{display:inline-block;margin-bottom:2.5rem;color:#f6f3fa;font-weight:800;letter-spacing:-.02em;text-decoration:none}.submit-bar.confirming{border-color:#7a5aa8}.submit-actions{display:flex;gap:.5rem}.ghost{border:1px solid #403748;border-radius:.7rem;padding:.75rem 1rem;background:transparent;color:#e6dfee;cursor:pointer}@media(max-width:640px){.submit-actions{flex-direction:column-reverse}}.error-card{max-width:720px}@media(max-width:640px){.portal-grid,.field-grid{grid-template-columns:1fr}.wide{grid-column:auto}.submitted-banner,.submit-bar{align-items:stretch;flex-direction:column}.primary{width:100%}}
</style>
