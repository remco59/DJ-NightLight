<script setup lang="ts">
const route = useRoute()
const token = String(route.params.token || '')
type PortalData = {
  gig: { id: string, title: string, eventType: string | null, status: string, startsAt: string | null, endsAt: string | null, venue: { name: string, city: string | null } | null }
  client: { name: string | null }
  expiresAt: string
}
const { data, error } = await useFetch<PortalData>(`/api/client/portal/${encodeURIComponent(token)}`)

function formatDate(value: string | null) {
  if (!value) return 'Date to be confirmed'
  return new Intl.DateTimeFormat('nl-NL', { dateStyle: 'full', timeStyle: 'short' }).format(new Date(value))
}

useSeoMeta({ title: 'Booking portal — DJ NightLight', robots: 'noindex, nofollow' })
</script>

<template>
  <main class="portal-shell">
    <section v-if="error" class="portal-card error-card">
      <p class="eyebrow">Client portal</p>
      <h1>This link is no longer available</h1>
      <p>Ask DJ NightLight for a new invitation link.</p>
    </section>
    <template v-else-if="data">
      <header class="portal-hero">
        <p class="eyebrow">Your booking</p>
        <h1>{{ data.gig.title }}</h1>
        <p v-if="data.client.name">Welcome, {{ data.client.name }}.</p>
      </header>
      <section class="portal-grid">
        <article class="portal-card">
          <p class="eyebrow">Date & time</p>
          <strong>{{ formatDate(data.gig.startsAt) }}</strong>
          <span v-if="data.gig.endsAt">Until {{ formatDate(data.gig.endsAt) }}</span>
        </article>
        <article class="portal-card">
          <p class="eyebrow">Location</p>
          <strong>{{ data.gig.venue?.name || 'To be confirmed' }}</strong>
          <span v-if="data.gig.venue?.city">{{ data.gig.venue.city }}</span>
        </article>
        <article class="portal-card wide">
          <p class="eyebrow">Status</p>
          <strong class="status">{{ data.gig.status }}</strong>
          <span>Questionnaire and music wishes are available in the next step of this portal.</span>
        </article>
      </section>
      <p class="expiry">This secure link is valid until {{ formatDate(data.expiresAt) }}.</p>
    </template>
  </main>
</template>

<style scoped>
.portal-shell{width:min(900px,calc(100% - 2rem));margin:0 auto;padding:clamp(3rem,10vw,7rem) 0}.portal-hero{margin-bottom:2rem}.portal-hero h1,.error-card h1{max-width:760px;margin:.25rem 0 .6rem;font-size:clamp(2.5rem,8vw,5.5rem);line-height:.95;letter-spacing:-.06em}.portal-hero>p:last-child,.error-card>p:last-child{color:#96909f}.portal-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:1rem}.portal-card{display:grid;gap:.4rem;padding:1.4rem;border:1px solid #2d2832;border-radius:1.1rem;background:#100e14}.portal-card strong{font-size:1.15rem}.portal-card span{color:#8e8797}.portal-card.wide{grid-column:1/-1}.status{width:max-content;padding:.3rem .55rem;border-radius:999px;background:#241c2b;text-transform:capitalize}.expiry{margin-top:1rem;color:#6f6977;font-size:.78rem}.error-card{max-width:720px}@media(max-width:640px){.portal-grid{grid-template-columns:1fr}.portal-card.wide{grid-column:auto}}
</style>
