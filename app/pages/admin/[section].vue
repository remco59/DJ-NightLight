<script setup lang="ts">
definePageMeta({ layout: 'admin' })

const route = useRoute()
const section = computed(() => String(route.params.section))

const sections: Record<string, { title: string, description: string }> = {
  gigs: { title: 'Gigs', description: 'Beheer leads, geboekte gigs en planning.' },
  clients: { title: 'Klanten', description: 'Klantprofielen en boekingsgeschiedenis.' },
  venues: { title: 'Locaties', description: 'Locaties, contactpersonen en notities voor de opbouw.' },
  invoices: { title: 'Facturen', description: 'Facturen en betaalstatus.' },
  media: { title: 'Media', description: 'Foto’s en media die door heel NightLight worden gebruikt.' },
  content: { title: 'Website', description: 'Bewerk de publieke website.' },
  'landing-pages': { title: 'Landing pages', description: 'Gerichte dienst- en campagnepagina’s.' },
  'post-generator': { title: 'Post generator', description: 'Maak social posts in je eigen huisstijl.' },
  calendar: { title: 'Agenda', description: 'NightLight-agendasynchronisatie.' },
  email: { title: 'Email', description: 'Templates en automatische communicatie.' },
  users: { title: 'Gebruikers', description: 'Accounts en rechten.' },
  settings: { title: 'Instellingen', description: 'Bedrijfs- en applicatie-instellingen.' },
}

const current = computed(() => sections[section.value])

if (!current.value) {
  throw createError({ statusCode: 404, statusMessage: 'Onderdeel niet gevonden' })
}

useSeoMeta({
  title: () => `${current.value?.title || 'Admin'} — DJ NightLight`,
  robots: 'noindex, nofollow',
})
</script>

<template>
  <div v-if="current" class="placeholder">
    <p class="eyebrow">Back office</p>
    <h1>{{ current.title }}</h1>
    <p>{{ current.description }}</p>
    <div class="coming">
      <strong>Dit onderdeel staat klaar in de navigatie.</strong>
      <span>De volledige workflow volgt in de bijbehorende projectfase.</span>
    </div>
  </div>
</template>

<style scoped>
.placeholder { max-width: 800px; margin-inline: auto; padding-top: 1rem; }
h1 { margin: .3rem 0; font-size: clamp(2.4rem, 6vw, 4.5rem); letter-spacing: -.05em; }
p { color: #918b9a; }
.coming {
  display: grid;
  gap: .4rem;
  margin-top: 2rem;
  padding: 1.4rem;
  border: 1px dashed #302a38;
  border-radius: 1rem;
}
.coming span { color: #777180; }
</style>
