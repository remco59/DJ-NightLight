<script setup lang="ts">
const { data } = await useSiteContent()
const { data: landingNavigation } = await useFetch<{ pages: Array<{ slug: string, label: string }> }>('/api/public/landing-pages/navigation', {
  key: 'landing-navigation',
})
const route = useRoute()
const menuOpen = ref(false)

const nav = computed(() => [
  { label: 'Home', to: '/' },
  { label: 'Over', to: '/about' },
  { label: 'Media', to: '/media' },
  { label: 'Agenda', to: '/agenda' },
  ...(landingNavigation.value?.pages ?? []).map(page => ({
    label: page.label,
    to: `/diensten/${page.slug}`,
  })),
])

watch(() => route.path, () => {
  menuOpen.value = false
})
</script>

<template>
  <div class="public-shell">
    <header class="site-header">
      <NuxtLink class="brand" to="/">
        <span class="brand-dot" />
        {{ data?.content.brandName || 'DJ NightLight' }}
      </NuxtLink>

      <nav class="desktop-nav" aria-label="Hoofdnavigatie">
        <NuxtLink v-for="item in nav" :key="item.to" :to="item.to">{{ item.label }}</NuxtLink>
      </nav>

      <div class="header-actions">
        <NuxtLink class="book" to="/boeken">Boeken</NuxtLink>
        <button class="menu" type="button" :aria-expanded="menuOpen" aria-label="Menu openen" @click="menuOpen = !menuOpen">
          {{ menuOpen ? 'Sluit' : 'Menu' }}
        </button>
      </div>
    </header>

    <nav v-if="menuOpen" class="mobile-nav" aria-label="Mobiele navigatie">
      <NuxtLink v-for="item in nav" :key="item.to" :to="item.to">{{ item.label }}</NuxtLink>
      <NuxtLink to="/boeken">Boeken</NuxtLink>
    </nav>

    <slot />

    <footer class="footer">
      <div>
        <strong>{{ data?.content.brandName || 'DJ NightLight' }}</strong>
        <span>Groningen · Nederland</span>
      </div>
      <div class="footer-links">
        <a v-if="data?.content.instagramUrl" :href="data.content.instagramUrl" target="_blank" rel="noreferrer">Instagram</a>
        <a v-if="data?.content.spotifyUrl" :href="data.content.spotifyUrl" target="_blank" rel="noreferrer">Spotify</a>
        <a v-if="data?.content.contactEmail" :href="`mailto:${data.content.contactEmail}`">E-mail</a>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.public-shell{min-height:100vh;background:#070709;color:#f5f3f8}.site-header{position:fixed;top:0;left:0;right:0;z-index:50;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:1rem;padding:1rem clamp(1rem,4vw,3.5rem);background:linear-gradient(to bottom,rgba(7,7,9,.92),rgba(7,7,9,.35),transparent);backdrop-filter:blur(8px)}.brand{display:flex;align-items:center;gap:.55rem;text-decoration:none;font-weight:850;letter-spacing:-.02em}.brand-dot{width:.55rem;height:.55rem;border-radius:50%;background:#fff;box-shadow:0 0 1.2rem rgba(255,255,255,.7)}.desktop-nav{display:flex;gap:1.5rem;align-items:center}.desktop-nav a{color:#aba6b1;text-decoration:none;font-size:.88rem}.desktop-nav a.router-link-active{color:#fff}.header-actions{display:flex;justify-content:flex-end;gap:.6rem}.book{padding:.55rem .85rem;border-radius:999px;background:#fff;color:#08080a;text-decoration:none;font-size:.82rem;font-weight:800}.menu{display:none;border:1px solid #343038;border-radius:999px;padding:.5rem .75rem;background:#141217;color:#fff}.mobile-nav{position:fixed;z-index:45;inset:4.2rem 1rem auto;display:grid;padding:.8rem;border:1px solid #2a2730;border-radius:1rem;background:#100e14;box-shadow:0 1.5rem 4rem rgba(0,0,0,.35)}.mobile-nav a{padding:.8rem;border-radius:.6rem;text-decoration:none}.mobile-nav a:hover{background:#19161d}.footer{display:flex;justify-content:space-between;gap:2rem;padding:3rem clamp(1rem,4vw,3.5rem);border-top:1px solid #201d24;color:#7f7985}.footer strong,.footer span{display:block}.footer strong{color:#d9d5de}.footer span{margin-top:.25rem;font-size:.8rem}.footer-links{display:flex;gap:1rem;align-items:flex-start}.footer a{color:#aaa4b0;text-decoration:none;font-size:.85rem}@media(max-width:1000px){.site-header{grid-template-columns:1fr auto}.desktop-nav{display:none}.menu{display:block}.book{display:none}}@media(max-width:760px){.footer{flex-direction:column}.footer-links{flex-wrap:wrap}}
</style>
