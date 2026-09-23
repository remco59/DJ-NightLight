<script setup lang="ts">
const { data } = await useSiteContent()
const { data: landingNavigation } = await useFetch<{ pages: Array<{ slug: string, label: string }> }>('/api/public/landing-pages/navigation', {
  key: 'landing-navigation',
})
const route = useRoute()
const menuOpen = ref(false)

const nav = computed(() => [
  { label: data.value?.content.publicCopy.navigation.home || 'Home', to: '/' },
  { label: data.value?.content.publicCopy.navigation.about || 'Over', to: '/about' },
  { label: data.value?.content.publicCopy.navigation.media || 'Media', to: '/media' },
  { label: data.value?.content.publicCopy.navigation.agenda || 'Agenda', to: '/agenda' },
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
        <span class="brand-dot" aria-hidden="true" />
        {{ data?.content.brandName || 'DJ NightLight' }}
      </NuxtLink>

      <nav class="desktop-nav" aria-label="Hoofdnavigatie">
        <NuxtLink v-for="item in nav" :key="item.to" :to="item.to">{{ item.label }}</NuxtLink>
      </nav>

      <div class="header-actions">
        <NuxtLink class="book" to="/boeken">{{ data?.content.publicCopy.navigation.booking || 'Boeken' }} <Icon name="lucide:arrow-up-right" aria-hidden="true" /></NuxtLink>
        <button
          class="menu"
          type="button"
          :aria-expanded="menuOpen"
          :aria-label="menuOpen ? data?.content.publicCopy.navigation.close : data?.content.publicCopy.navigation.menu"
          @click="menuOpen = !menuOpen"
        >
          <span>{{ menuOpen ? data?.content.publicCopy.navigation.close : data?.content.publicCopy.navigation.menu }}</span>
          <Icon :name="menuOpen ? 'lucide:x' : 'lucide:menu'" aria-hidden="true" />
        </button>
      </div>
    </header>

    <Transition name="menu-panel">
      <nav v-if="menuOpen" class="mobile-nav" aria-label="Mobiele navigatie">
        <div class="mobile-nav-links">
          <NuxtLink v-for="(item,index) in nav" :key="item.to" :to="item.to">
            <span>0{{ index + 1 }}</span>
            <strong>{{ item.label }}</strong>
          </NuxtLink>
        </div>
        <NuxtLink class="mobile-book" to="/boeken">
          <span>{{ data?.content.publicCopy.navigation.mobileEyebrow }}</span>
          <strong>{{ data?.content.publicCopy.navigation.mobileBooking }} <Icon name="lucide:arrow-right" aria-hidden="true" /></strong>
        </NuxtLink>
      </nav>
    </Transition>

    <slot />

    <footer class="footer">
      <div class="footer-primary">
        <div>
          <p class="eyebrow">{{ data?.content.publicCopy.footer.eyebrow }}</p>
          <strong>{{ data?.content.publicCopy.footer.title }}</strong>
        </div>
        <NuxtLink class="footer-cta" to="/boeken">{{ data?.content.publicCopy.footer.cta }} <Icon name="lucide:arrow-right" aria-hidden="true" /></NuxtLink>
      </div>

      <div class="footer-bottom">
        <div class="footer-brand">
          <strong>{{ data?.content.brandName || 'DJ NightLight' }}</strong>
          <span>{{ data?.content.publicCopy.footer.location }}</span>
        </div>

        <nav class="footer-nav" aria-label="Voettekst navigatie">
          <NuxtLink v-for="item in nav" :key="item.to" :to="item.to">{{ item.label }}</NuxtLink>
        </nav>

        <div class="footer-links">
          <a v-if="data?.content.instagramUrl" :href="data.content.instagramUrl" target="_blank" rel="noreferrer"><Icon name="lucide:instagram" aria-hidden="true" />{{ data.content.publicCopy.footer.instagram }}</a>
          <a v-if="data?.content.spotifyUrl" :href="data.content.spotifyUrl" target="_blank" rel="noreferrer"><Icon name="lucide:audio-lines" aria-hidden="true" />{{ data.content.publicCopy.footer.spotify }}</a>
          <a v-if="data?.content.contactEmail" :href="`mailto:${data.content.contactEmail}`"><Icon name="lucide:mail" aria-hidden="true" />{{ data.content.publicCopy.footer.email }}</a>
        </div>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.public-shell{min-height:100vh;background:#070709;color:#f5f3f8;overflow:hidden}.site-header{position:fixed;top:0;left:0;right:0;z-index:50;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:1rem;padding:1.15rem clamp(1rem,3vw,3rem);border-bottom:1px solid rgba(255,255,255,.055);background:linear-gradient(to bottom,rgba(7,7,9,.91),rgba(7,7,9,.69));backdrop-filter:blur(16px) saturate(1.2)}.brand{display:flex;width:max-content;align-items:center;gap:.62rem;text-decoration:none;font-size:.98rem;font-weight:850;letter-spacing:-.03em}.brand-dot{width:.58rem;height:.58rem;border-radius:50%;background:#fff;box-shadow:0 0 1.25rem rgba(255,255,255,.72)}.desktop-nav{display:flex;gap:1.7rem;align-items:center}.desktop-nav a{position:relative;padding:.3rem 0;color:#9e98a4;text-decoration:none;font-size:.9rem;font-weight:520;transition:color .2s ease}.desktop-nav a::after{content:"";position:absolute;left:0;right:0;bottom:-.15rem;height:1px;background:#fff;transform:scaleX(0);transform-origin:left;transition:transform .2s ease}.desktop-nav a:hover,.desktop-nav a.router-link-active{color:#fff}.desktop-nav a.router-link-active::after{transform:scaleX(1)}.header-actions{display:flex;justify-content:flex-end;gap:.6rem}.book{display:inline-flex;align-items:center;gap:.35rem;padding:.62rem .95rem;border-radius:999px;background:#fff;color:#08080a;text-decoration:none;font-size:.84rem;font-weight:800;transition:transform .2s ease}.book:hover{transform:translateY(-2px)}.book svg{font-size:.95rem}.menu{display:none;align-items:center;gap:.55rem;border:1px solid #3b3640;border-radius:999px;padding:.58rem .8rem;background:rgba(18,16,21,.8);color:#fff}.menu svg{font-size:1rem}.mobile-nav{position:fixed;z-index:45;inset:4.5rem 0 0;display:grid;grid-template-rows:1fr auto;padding:clamp(2rem,8vw,5rem) clamp(1rem,5vw,4rem) 2rem;background:rgba(8,7,10,.98);backdrop-filter:blur(20px);overflow:auto}.mobile-nav-links{display:grid;align-content:start}.mobile-nav-links a{display:grid;grid-template-columns:3.2rem 1fr;align-items:baseline;padding:1rem 0;border-bottom:1px solid #252129;text-decoration:none}.mobile-nav-links a:first-child{border-top:1px solid #252129}.mobile-nav-links span{color:#6f6975;font-size:.68rem}.mobile-nav-links strong{font-size:clamp(2rem,10vw,4.5rem);line-height:1;letter-spacing:-.055em}.mobile-nav-links a.router-link-active strong{color:#cfc1ff}.mobile-book{display:flex;justify-content:space-between;align-items:end;gap:1rem;margin-top:2rem;padding:1.25rem 0;text-decoration:none}.mobile-book span{color:#807a86;font-size:.8rem}.mobile-book strong{font-size:1.1rem}.menu-panel-enter-active,.menu-panel-leave-active{transition:opacity .22s ease,transform .22s ease}.menu-panel-enter-from,.menu-panel-leave-to{opacity:0;transform:translateY(-.7rem)}

.footer{padding:clamp(4.5rem,8vw,8rem) clamp(1rem,3vw,3rem) 2.5rem;border-top:1px solid #201d24;background:radial-gradient(circle at 20% 20%,rgba(94,53,190,.12),transparent 26rem),#08080a}.footer-primary{display:flex;justify-content:space-between;gap:3rem;align-items:end;max-width:1320px;margin:0 auto;padding-bottom:clamp(4rem,8vw,7rem)}.footer-primary>div>strong{display:block;white-space:pre-line;margin-top:.75rem;font-size:clamp(2.8rem,6vw,6.5rem);line-height:.9;letter-spacing:-.065em}.footer-cta{display:inline-flex;align-items:center;gap:.7rem;padding-bottom:.3rem;border-bottom:1px solid #625a68;color:#d8d2dc;text-decoration:none;font-size:1rem}.footer-cta svg{transition:transform .2s ease}.footer-cta:hover svg{transform:translateX(.25rem)}.footer-bottom{display:grid;grid-template-columns:1fr auto 1fr;align-items:start;gap:2rem;max-width:1320px;margin:0 auto;padding-top:1.5rem;border-top:1px solid #201d24;color:#817b87}.footer-brand strong,.footer-brand span{display:block}.footer-brand strong{color:#d9d5de;font-size:.92rem}.footer-brand span{margin-top:.3rem;font-size:.8rem}.footer-nav{display:flex;gap:1.2rem;flex-wrap:wrap;justify-content:center}.footer-links{display:flex;gap:1.2rem;align-items:flex-start;justify-content:flex-end;flex-wrap:wrap}.footer a{color:#aaa4b0;text-decoration:none;font-size:.85rem}.footer a:hover{color:#fff}.footer-links a{display:inline-flex;align-items:center;gap:.4rem}

@media(max-width:1000px){.site-header{grid-template-columns:1fr auto}.desktop-nav{display:none}.menu{display:flex}.book{display:none}.footer-bottom{grid-template-columns:1fr 1fr}.footer-nav{display:none}}
@media(max-width:760px){.site-header{padding:.95rem 1rem}.brand{font-size:.9rem}.mobile-nav{inset:4rem 0 0}.footer{padding-left:1rem;padding-right:1rem}.footer-primary{display:block}.footer-primary>div>strong{font-size:clamp(3rem,14vw,5rem)}.footer-cta{margin-top:2rem}.footer-bottom{grid-template-columns:1fr;gap:1.5rem}.footer-links{justify-content:flex-start}}
@media(prefers-reduced-motion:reduce){.menu-panel-enter-active,.menu-panel-leave-active,.book,.desktop-nav a,.desktop-nav a::after,.footer-cta svg{transition:none}.book:hover,.footer-cta:hover svg{transform:none}}
</style>
