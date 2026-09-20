<script setup lang="ts">
import type { QuestionnaireField } from '~~/shared/questionnaire'
import { musicWishCategories } from '~~/shared/questionnaire'
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
}
const { data, error, refresh } = await useFetch<PortalData>(`/api/client/portal/${encodeURIComponent(token)}`)
const answers = reactive<Record<string, Answer>>({ ...(data.value?.questionnaire.answers || {}) })
for (const field of data.value?.questionnaire.fields || []) {
  if (answers[field.id] === undefined) answers[field.id] = field.type === 'multi_select' ? [] : field.type === 'checkbox' || field.type === 'acknowledgement' ? false : ''
}
const acceptedName = ref(data.value?.questionnaire.acceptedName || '')
const wishes = ref<Wish[]>((data.value?.wishes || []).map(wish => ({ ...wish })))
const submitting = ref(false)
const message = ref('')
const categoryLabels: Record<Wish['category'], string> = { must_play: 'Must play', nice_to_have: 'Nice to have', do_not_play: 'Do not play', special_moment: 'Special moment' }

function formatDate(value: string | null) {
  if (!value) return 'Date to be confirmed'
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
  if (!confirm('Submit your details and music wishes? You cannot edit them through this link afterwards.')) return
  submitting.value = true; message.value = ''
  try {
    await $fetch(`/api/client/portal/${encodeURIComponent(token)}/submit`, { method: 'POST', body: {
      answers,
      acceptedName: acceptedName.value,
      wishes: wishes.value.map((wish, ordering) => ({ ...wish, ordering })),
    } })
    await refresh(); message.value = 'Thank you — your details and music wishes have been submitted.'
  } catch (submitError: unknown) { message.value = apiErrorMessage(submitError, 'Could not submit your information.') } finally { submitting.value = false }
}
useSeoMeta({ title: 'Booking portal — DJ NightLight', robots: 'noindex, nofollow' })
</script>

<template>
  <main class="portal-shell">
    <section v-if="error" class="portal-card error-card"><p class="eyebrow">Client portal</p><h1>This link is no longer available</h1><p>Ask DJ NightLight for a new invitation link.</p></section>
    <template v-else-if="data">
      <header class="portal-hero"><p class="eyebrow">Your booking</p><h1>{{ data.gig.title }}</h1><p v-if="data.client.name">Welcome, {{ data.client.name }}.</p></header>
      <section class="portal-grid booking-summary">
        <article class="portal-card"><p class="eyebrow">Date & time</p><strong>{{ formatDate(data.gig.startsAt) }}</strong><span v-if="data.gig.endsAt">Until {{ formatDate(data.gig.endsAt) }}</span></article>
        <article class="portal-card"><p class="eyebrow">Location</p><strong>{{ data.gig.venue?.name || 'To be confirmed' }}</strong><span v-if="data.gig.venue?.city">{{ data.gig.venue.city }}</span></article>
      </section>

      <section v-if="data.questionnaire.status==='submitted'" class="submitted-banner"><strong>Submitted</strong><span>Your information was received on {{ formatDate(data.questionnaire.submittedAt) }}.</span></section>

      <form @submit.prevent="submit">
        <section class="form-section"><div class="section-heading"><p class="eyebrow">Step 1</p><h2>Event details & agreement</h2><span>Questionnaire version {{ data.questionnaire.version }}</span></div>
          <div class="field-grid">
            <label v-for="field in data.questionnaire.fields" :key="field.id" :class="{wide:field.type==='long_text'||field.type==='acknowledgement'}">
              <span>{{ field.label }} <em v-if="field.required">Required</em></span><small v-if="field.helpText">{{ field.helpText }}</small>
              <textarea v-if="field.type==='long_text'" :value="String(answers[field.id]??'')" rows="4" :required="field.required" :disabled="data.questionnaire.status==='submitted'" @input="setAnswer(field,$event)"/>
              <select v-else-if="field.type==='select'" :value="String(answers[field.id]??'')" :required="field.required" :disabled="data.questionnaire.status==='submitted'" @change="setAnswer(field,$event)"><option value="">Choose…</option><option v-for="option in field.options" :key="option" :value="option">{{ option }}</option></select>
              <span v-else-if="field.type==='multi_select'" class="option-list"><label v-for="option in field.options" :key="option"><input v-model="answers[field.id]" type="checkbox" :value="option" :disabled="data.questionnaire.status==='submitted'"> {{ option }}</label></span>
              <span v-else-if="field.type==='checkbox'||field.type==='acknowledgement'" class="check-line"><input v-model="answers[field.id]" type="checkbox" :required="field.required" :disabled="data.questionnaire.status==='submitted'"> Yes</span>
              <input v-else :value="String(answers[field.id]??'')" :type="field.type==='short_text'?'text':field.type" :required="field.required" :disabled="data.questionnaire.status==='submitted'" @input="setAnswer(field,$event)">
            </label>
          </div>
          <label class="signature">Your full name for agreement<input v-model="acceptedName" required :disabled="data.questionnaire.status==='submitted'"></label>
        </section>

        <section class="form-section"><div class="section-heading"><p class="eyebrow">Step 2</p><h2>Music wishes</h2><span>Add tracks, playlists or context for important moments.</span></div>
          <div v-if="!wishes.length" class="empty">No music wishes yet.</div>
          <article v-for="(wish,index) in wishes" :key="index" class="wish-card"><div class="wish-head"><strong>Wish {{ index+1 }}</strong><button v-if="data.questionnaire.status!=='submitted'" type="button" @click="wishes.splice(index,1)">Remove</button></div><div class="field-grid"><label>Category<select v-model="wish.category" :disabled="data.questionnaire.status==='submitted'"><option v-for="category in musicWishCategories" :key="category" :value="category">{{categoryLabels[category]}}</option></select></label><label>Artist<input v-model="wish.artist" :disabled="data.questionnaire.status==='submitted'"></label><label>Title<input v-model="wish.title" :disabled="data.questionnaire.status==='submitted'"></label><label>Spotify track or playlist URL<input v-model="wish.spotifyUrl" type="url" placeholder="https://open.spotify.com/track/…" :disabled="data.questionnaire.status==='submitted'"></label><label class="wide">Note / special moment<textarea v-model="wish.note" rows="2" :disabled="data.questionnaire.status==='submitted'"/></label></div></article>
          <div v-if="data.questionnaire.status!=='submitted'" class="wish-buttons"><button v-for="category in musicWishCategories" :key="category" type="button" @click="addWish(category)">+ {{categoryLabels[category]}}</button></div>
        </section>

        <div v-if="data.questionnaire.status!=='submitted'" class="submit-bar"><div><strong>Ready to send?</strong><span>Your answers and music wishes are submitted together.</span></div><button class="primary" :disabled="submitting">{{submitting?'Submitting…':'Submit everything'}}</button></div>
        <p v-if="message" class="message">{{message}}</p>
      </form>
      <p class="expiry">This secure link is valid until {{ formatDate(data.expiresAt) }}.</p>
    </template>
  </main>
</template>

<style scoped>
.portal-shell{width:min(920px,calc(100% - 2rem));margin:0 auto;padding:clamp(3rem,10vw,7rem) 0}.portal-hero{margin-bottom:2rem}.portal-hero h1,.error-card h1{max-width:760px;margin:.25rem 0 .6rem;font-size:clamp(2.5rem,8vw,5.5rem);line-height:.95;letter-spacing:-.06em}.portal-hero>p:last-child,.error-card>p:last-child{color:#96909f}.portal-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:1rem}.portal-card,.form-section{padding:1.4rem;border:1px solid #2d2832;border-radius:1.1rem;background:#100e14}.portal-card{display:grid;gap:.4rem}.portal-card strong{font-size:1.15rem}.portal-card span,.section-heading span{color:#8e8797}.submitted-banner{display:flex;justify-content:space-between;gap:1rem;margin:1rem 0;padding:1rem;border:1px solid #314a3d;border-radius:.85rem;background:#102019;color:#b9e3c8}.form-section{margin-top:1rem}.section-heading{margin-bottom:1.2rem}.section-heading h2{margin:.2rem 0}.field-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:.85rem}.wide{grid-column:1/-1}label{display:grid;gap:.35rem;color:#b0a9b7;font-size:.8rem}label>span:first-child{font-weight:700}label em{margin-left:.35rem;color:#9d83b2;font-size:.62rem;font-style:normal;text-transform:uppercase}label small{color:#756e7d}input,select,textarea{width:100%;border:1px solid #39323f;border-radius:.65rem;padding:.72rem;background:#0b0a0d;color:#f6f3fa}input:disabled,select:disabled,textarea:disabled{opacity:.7}.check-line,.option-list{display:flex;gap:.55rem;padding:.65rem;border:1px solid #332e39;border-radius:.65rem}.check-line input,.option-list input{width:auto}.option-list{align-items:start;flex-direction:column}.option-list label{display:flex;align-items:center;gap:.5rem}.signature{margin-top:1rem}.wish-card{margin-top:.7rem;padding:1rem;border:1px solid #29242f;border-radius:.85rem;background:#0d0b10}.wish-head{display:flex;justify-content:space-between;margin-bottom:.8rem}.wish-head button,.wish-buttons button{border:1px solid #332d3a;border-radius:.55rem;padding:.45rem .65rem;background:#19151f;color:#cfc8d5;cursor:pointer}.wish-head button{border:0;background:transparent;color:#dc9da7}.wish-buttons{display:flex;flex-wrap:wrap;gap:.45rem;margin-top:.8rem}.empty{color:#777080}.submit-bar{position:sticky;bottom:1rem;z-index:5;display:flex;align-items:center;justify-content:space-between;gap:1rem;margin-top:1rem;padding:1rem 1.15rem;border:1px solid #403748;border-radius:1rem;background:rgba(20,17,25,.96);backdrop-filter:blur(14px)}.submit-bar strong,.submit-bar span{display:block}.submit-bar span{color:#817a89;font-size:.78rem}.primary{border:0;border-radius:.7rem;padding:.75rem 1rem;background:#fff;color:#09080b;font-weight:800;cursor:pointer}.message{color:#b6afbf}.expiry{margin-top:1rem;color:#6f6977;font-size:.78rem}.error-card{max-width:720px}@media(max-width:640px){.portal-grid,.field-grid{grid-template-columns:1fr}.wide{grid-column:auto}.submitted-banner,.submit-bar{align-items:stretch;flex-direction:column}.primary{width:100%}}
</style>
