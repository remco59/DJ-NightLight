<script setup lang="ts">
definePageMeta({ layout: 'admin' })

type Review = { id: string, gigId: string, gigTitle: string, startsAt: string | null, rating: number, comment: string | null, authorName: string | null, createdAt: string }

const { data } = await useFetch<{ reviews: Review[], average: number | null }>('/api/admin/reviews')
const dateFormat = new Intl.DateTimeFormat('nl-NL', { dateStyle: 'medium' })
const average = computed(() => data.value?.average === null || data.value?.average === undefined ? '–' : data.value.average.toFixed(1).replace('.', ','))

useSeoMeta({ title: 'Reviews — DJ NightLight', robots: 'noindex, nofollow' })
</script>

<template>
  <div class="reviews-admin">
    <header>
      <p class="eyebrow">Klanten</p>
      <h1>Reviews</h1>
      <p class="summary"><strong>{{ average }}</strong> gemiddeld · {{ data?.reviews.length || 0 }} {{ data?.reviews.length === 1 ? 'review' : 'reviews' }}</p>
    </header>

    <p v-if="!data?.reviews.length" class="empty">Er zijn nog geen reviews binnengekomen.</p>

    <article v-for="review in data?.reviews || []" :key="review.id" class="review">
      <div class="review-head">
        <span class="stars" :aria-label="`${review.rating} van 5 sterren`"><Icon v-for="n in 5" :key="n" name="lucide:star" :class="{ on: n <= review.rating }" aria-hidden="true" /></span>
        <NuxtLink :to="`/admin/gigs/${review.gigId}`">{{ review.gigTitle }}</NuxtLink>
      </div>
      <p v-if="review.comment" class="comment">“{{ review.comment }}”</p>
      <small>{{ review.authorName || 'Anoniem' }} · {{ dateFormat.format(new Date(review.createdAt)) }}</small>
    </article>
  </div>
</template>

<style scoped>
.reviews-admin{display:grid;gap:1rem;max-width:760px;margin:0 auto;padding:1rem 0 3rem}.eyebrow{margin:0;color:#b99bff;font-size:.7rem;font-weight:800;letter-spacing:.16em;text-transform:uppercase}h1{margin:.2rem 0;font-size:clamp(2rem,5vw,3rem);letter-spacing:-.04em}.summary,.empty{margin:0;color:var(--text-subtle)}.summary strong{color:var(--text);font-size:1.3rem}
.review{display:grid;gap:.6rem;padding:1.1rem;border:1px solid #2c2732;border-radius:1rem;background:var(--surface-card)}.review-head{display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap}.review-head a{color:#c99bff;font-weight:700;text-decoration:none}.stars{display:flex;gap:.1rem;color:#4a4352}.stars .on{color:#ffbf47;fill:currentColor}.comment{margin:0}.review small{color:var(--text-subtle)}
</style>
