<script setup lang="ts">
import { canPublishReview, publicReviewAuthor } from '~~/shared/reviews'
import { apiErrorMessage } from '~/utils/api-error'

definePageMeta({ layout: 'admin' })

type Review = { id: string, gigId: string, gigTitle: string, startsAt: string | null, rating: number, comment: string | null, authorName: string | null, publicConsent: boolean, published: boolean, createdAt: string }

const { data, refresh } = await useFetch<{ reviews: Review[], average: number | null }>('/api/admin/reviews')
const dateFormat = new Intl.DateTimeFormat('nl-NL', { dateStyle: 'medium' })
const average = computed(() => data.value?.average === null || data.value?.average === undefined ? '–' : data.value.average.toFixed(1).replace('.', ','))

const busyId = ref('')
const message = ref('')
async function setPublished(review: Review, published: boolean) {
  busyId.value = review.id
  message.value = ''
  try {
    await $fetch(`/api/admin/reviews/${review.id}`, { method: 'PATCH', body: { published } })
    await refresh()
  }
  catch (error: unknown) {
    message.value = apiErrorMessage(error, 'Wijzigen is niet gelukt.')
  }
  finally {
    busyId.value = ''
  }
}
function consentNote(review: Review) {
  if (!review.publicConsent) return 'Geen toestemming om te tonen'
  if (!canPublishReview(review)) return 'Geen tekst om te tonen'
  return `Mag op de website, als “${publicReviewAuthor(review.authorName)}”`
}

useSeoMeta({ title: 'Reviews — DJ NightLight', robots: 'noindex, nofollow' })
</script>

<template>
  <div class="reviews-admin">
    <header>
      <p class="eyebrow">Klanten</p>
      <h1>Reviews</h1>
      <p class="summary"><strong>{{ average }}</strong> gemiddeld · {{ data?.reviews.length || 0 }} {{ data?.reviews.length === 1 ? 'review' : 'reviews' }}</p>
    </header>

    <p v-if="message" class="error" role="alert">{{ message }}</p>
    <p v-if="!data?.reviews.length" class="empty">Er zijn nog geen reviews binnengekomen.</p>

    <article v-for="review in data?.reviews || []" :key="review.id" class="review">
      <div class="review-head">
        <span class="stars" role="img" :aria-label="`${review.rating} van 5 sterren`"><Icon v-for="n in 5" :key="n" name="lucide:star" :class="{ on: n <= review.rating }" aria-hidden="true" /></span>
        <NuxtLink :to="`/admin/gigs/${review.gigId}`">{{ review.gigTitle }}</NuxtLink>
      </div>
      <p v-if="review.comment" class="comment">“{{ review.comment }}”</p>
      <small>{{ review.authorName || 'Anoniem' }} · {{ dateFormat.format(new Date(review.createdAt)) }}</small>
      <div class="publish">
        <span class="publish-note" :data-ok="canPublishReview(review) || undefined">{{ consentNote(review) }}</span>
        <button v-if="review.published" type="button" class="secondary" :disabled="busyId === review.id" @click="setPublished(review, false)"><Icon name="lucide:eye-off" aria-hidden="true" />Verberg van website</button>
        <button v-else type="button" class="secondary" :disabled="busyId === review.id || !canPublishReview(review)" @click="setPublished(review, true)"><Icon name="lucide:eye" aria-hidden="true" />Toon op website</button>
        <span v-if="review.published" class="live-badge">Op de website</span>
      </div>
    </article>
  </div>
</template>

<style scoped>
.publish{display:flex;flex-wrap:wrap;align-items:center;gap:.5rem .75rem;margin-top:.2rem;padding-top:.7rem;border-top:1px solid var(--border)}.publish-note{flex:1 1 12rem;color:var(--text-muted);font-size:.82rem}.publish-note[data-ok]{color:#a9e1bb}.publish button{display:inline-flex;align-items:center;gap:.4rem;min-height:2.75rem;padding:.5rem .95rem;border:1px solid var(--border-strong);border-radius:.7rem;background:var(--button-secondary-bg);color:var(--button-secondary-fg);font-weight:700;cursor:pointer}.publish button:hover:not(:disabled){border-color:#4a4254}.publish button:disabled{opacity:.45;cursor:not-allowed}.live-badge{padding:.2rem .6rem;border:1px solid #2f5a42;border-radius:999px;color:#a9e1bb;font-size:.75rem;font-weight:700}.error{color:#ffb3bf}
.reviews-admin{display:grid;gap:1rem;max-width:760px;margin:0 auto;padding:1rem 0 3rem}.eyebrow{margin:0;color:#b99bff;font-size:.7rem;font-weight:800;letter-spacing:.16em;text-transform:uppercase}h1{margin:.2rem 0;font-size:clamp(2rem,5vw,3rem);letter-spacing:-.04em}.summary,.empty{margin:0;color:var(--text-subtle)}.summary strong{color:var(--text);font-size:1.3rem}
.review{display:grid;gap:.6rem;padding:1.1rem;border:1px solid #2c2732;border-radius:1rem;background:var(--surface-card)}.review-head{display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap}.review-head a{color:#c99bff;font-weight:700;text-decoration:none}.stars{display:flex;gap:.1rem;color:#4a4352}.stars .on{color:#ffbf47;fill:currentColor}.comment{margin:0}.review small{color:var(--text-subtle)}
</style>
