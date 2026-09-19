<script setup lang="ts">
definePageMeta({ layout: 'admin' })

const route = useRoute()
const section = computed(() => String(route.params.section))

const sections: Record<string, { title: string, description: string }> = {
  gigs: { title: 'Gigs', description: 'Manage leads, booked gigs and planning.' },
  clients: { title: 'Clients', description: 'Client profiles and booking history.' },
  venues: { title: 'Venues', description: 'Locations, contacts and load-in notes.' },
  invoices: { title: 'Invoices', description: 'Invoices and payment status.' },
  media: { title: 'Media', description: 'Photos and media used across NightLight.' },
  content: { title: 'Website', description: 'Edit the public website.' },
  'landing-pages': { title: 'Landing pages', description: 'Targeted service and campaign pages.' },
  'post-generator': { title: 'Post generator', description: 'Create branded social posts.' },
  calendar: { title: 'Calendar', description: 'NightLight calendar synchronization.' },
  email: { title: 'Email', description: 'Templates and automated communication.' },
  users: { title: 'Users', description: 'Accounts and permissions.' },
  settings: { title: 'Settings', description: 'Business and application settings.' },
}

const current = computed(() => sections[section.value])

if (!current.value) {
  throw createError({ statusCode: 404, statusMessage: 'Admin section not found' })
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
      <strong>This module is ready in the navigation.</strong>
      <span>Its full workflow is implemented in the matching project phase.</span>
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
