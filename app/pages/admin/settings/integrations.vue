<script setup lang="ts">
import type { IntegrationsData } from '~/types/integrations'

definePageMeta({ layout: 'admin' })
useSeoMeta({ title: 'Koppelingen — DJ NightLight', robots: 'noindex, nofollow' })

const [{ data: integrations }, { data: stripe }] = await Promise.all([
  useFetch<IntegrationsData>('/api/admin/integrations'),
  useFetch<{ status: { keyConfigured: boolean, webhookConfigured: boolean, livemode: boolean | null } }>('/api/admin/stripe'),
])

const stripeReady = computed(() => Boolean(stripe.value?.status.keyConfigured && stripe.value?.status.webhookConfigured))
const instagramLabel = computed(() => {
  const instagram = integrations.value?.instagram
  if (!instagram?.account) return instagram?.configured ? 'Niet verbonden' : 'Niet ingesteld'
  return instagram.account.status === 'active' ? 'Verbonden' : 'Opnieuw verbinden'
})
</script>

<template>
  <div class="overview">
    <div class="heading">
      <span class="icon"><Icon name="lucide:link-2" aria-hidden="true" /></span>
      <div><h2>Koppelingen</h2><p>Koppel NightLight met andere diensten om je workflow te automatiseren.</p></div>
    </div>
    <div class="cards">
      <NuxtLink class="card" to="/admin/settings/stripe">
        <div><span class="brand stripe">S</span><span class="pill" :class="{ on: stripeReady }">{{ stripeReady ? (stripe?.status.livemode ? 'Live' : 'Testmodus') : 'Niet ingesteld' }}</span></div>
        <h3>Stripe</h3><p>Online betalingen en betaalstatussen.</p>
      </NuxtLink>
      <NuxtLink class="card" to="/admin/settings/resend">
        <div><span class="brand resend"><Icon name="lucide:send" aria-hidden="true" /></span><span class="pill" :class="{ on: integrations?.email.configured }">{{ integrations?.email.configured ? 'Actief' : 'Niet ingesteld' }}</span></div>
        <h3>Resend</h3><p>Verstuur e-mails, facturen en uitnodigingen.</p>
      </NuxtLink>
      <NuxtLink class="card" to="/admin/settings/google-calendar">
        <div><span class="brand google">G</span><span class="pill" :class="{ on: integrations?.calendar.configured }">{{ integrations?.calendar.configured ? 'Verbonden' : 'Niet gekoppeld' }}</span></div>
        <h3>Google Agenda</h3><p>Synchroniseer geboekte gigs met je agenda.</p>
      </NuxtLink>
      <NuxtLink class="card" to="/admin/settings/instagram">
        <div><span class="brand instagram"><Icon name="lucide:instagram" aria-hidden="true" /></span><span class="pill" :class="{ on: integrations?.instagram.account?.status === 'active' }">{{ instagramLabel }}</span></div>
        <h3>Instagram</h3><p>Publiceer en plan posts vanuit NightLight.</p>
      </NuxtLink>
    </div>
  </div>
</template>

<style scoped>
.heading{display:flex;align-items:flex-start;gap:.8rem;margin-bottom:1rem}
.heading h2{margin:0;font-size:1.25rem}
.heading p{margin:.25rem 0 0;color:var(--text-subtle);font-size:.8rem}
.icon{display:grid;place-items:center;flex:0 0 2.55rem;width:2.55rem;height:2.55rem;border-radius:.75rem;background:#28164a;color:#bd91ff}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(15rem,1fr));gap:.8rem}
.card{display:block;padding:1rem;border:1px solid var(--border);border-radius:.95rem;background:linear-gradient(180deg,#111016,#0f0d13);color:inherit;text-decoration:none}
.card:hover{border-color:#583c78}
.card>div{display:flex;align-items:center;justify-content:space-between}
.card h3{margin:.8rem 0 .2rem;font-size:.95rem}
.card p{margin:0;color:var(--text-subtle);font-size:.74rem;line-height:1.4}
.brand{display:grid;place-items:center;width:2.45rem;height:2.45rem;border-radius:.7rem;color:#fff;font-weight:900}
.brand.google{background:linear-gradient(135deg,#2d6cdf,#34a853 45%,#fbbc05 70%,#ea4335)}
.brand.resend{background:#171717}
.brand.instagram{background:linear-gradient(135deg,#833ab4,#c13584 50%,#fd1d1d 80%,#fcb045)}
.brand.stripe{background:linear-gradient(135deg,#7855ff,#4f2de0)}
.pill{display:inline-flex;align-items:center;padding:.27rem .6rem;border-radius:99px;background:#26222a;color:#9c929f;font-size:.65rem;font-weight:800}
.pill.on{background:#153426;color:#72e6a2}
</style>
