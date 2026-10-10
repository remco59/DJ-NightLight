<script setup lang="ts">
import AdminNav from '~/components/admin/AdminNav.vue'
import AdminBottomNav from '~/components/admin/AdminBottomNav.vue'
import { worksOffline } from '~~/shared/offline-routes'

const route = useRoute()

// Installable admin app: the manifest is scoped to /admin, so only the admin layout links it.
useHead({
  link: [
    { rel: 'manifest', href: '/admin.webmanifest' },
    { rel: 'apple-touch-icon', href: '/pwa/apple-touch-icon.png' },
  ],
  meta: [
    // Lets the bottom navigation respect the safe-area inset on devices with gesture navigation.
    { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
    { name: 'theme-color', content: '#0a090d' },
    { name: 'apple-mobile-web-app-capable', content: 'yes' },
    { name: 'apple-mobile-web-app-title', content: 'NightLight' },
  ],
})

// Offline: only gig pages keep working (from the service worker cache); anything else is replaced by an offline notice.
const online = useOnline()
const blocked = computed(() => !online.value && !worksOffline(route.path))
const postEditorRoute = computed(() => route.path === '/admin/post-generator')
const mobileOpen = ref(false)
const sidebar = ref<HTMLElement | null>(null)

// On a phone the sidebar is an off-canvas drawer: while closed it must not be
// reachable with Tab, and while open Escape closes it again.
const isCompact = ref(false)
let media: MediaQueryList | null = null
function syncCompact() { isCompact.value = Boolean(media?.matches) }
onMounted(() => {
  media = window.matchMedia('(max-width: 820px)')
  syncCompact()
  media.addEventListener('change', syncCompact)
})
onBeforeUnmount(() => media?.removeEventListener('change', syncCompact))
const sidebarHidden = computed(() => isCompact.value && !mobileOpen.value)

watch(mobileOpen, async (open) => {
  if (!isCompact.value) return
  await nextTick()
  if (open) sidebar.value?.querySelector<HTMLElement>('a, button')?.focus()
  else document.querySelector<HTMLElement>('.bottom-nav button')?.focus()
})
function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && mobileOpen.value) mobileOpen.value = false
}

watch(()=>route.path,()=>{mobileOpen.value=false})
</script>

<template>
  <div class="admin-shell" :class="{ 'post-editor-route': postEditorRoute }" @keydown="onKeydown">
    <a class="skip-link" href="#main">Naar de inhoud</a>
    <header class="mobile-header">
      <NuxtLink to="/admin" class="brand" aria-label="NightLight">
        <img class="brand-logo" src="/brand/logo/wordmark-thumb.webp" alt="DJ NightLight">
      </NuxtLink>
    </header>

    <aside ref="sidebar" class="sidebar" :class="{ open: mobileOpen }" :inert="sidebarHidden || undefined" :aria-hidden="sidebarHidden || undefined" :aria-label="isCompact ? 'Menu' : undefined">
      <div class="sheet-bar">
        <span class="sheet-handle" aria-hidden="true" />
        <button class="sheet-close" type="button" aria-label="Menu sluiten" @click="mobileOpen = false">
          <Icon name="lucide:x" aria-hidden="true" />
        </button>
      </div>
      <AdminNav />
    </aside>

    <div v-if="!online" class="offline-banner" role="status">
      <Icon name="lucide:wifi-off" aria-hidden="true" />
      Offline — je ziet de laatst opgehaalde gigs. Aanmaken en wijzigen kan alleen met verbinding.
    </div>

    <main id="main" class="admin-main" tabindex="-1" :inert="(isCompact && mobileOpen) || undefined">
      <AdminOfflineNotice v-if="blocked" />
      <slot v-else />
    </main>

    <AdminBottomNav v-if="!postEditorRoute" :more-open="mobileOpen" @more="mobileOpen = !mobileOpen" />

    <button
      v-if="mobileOpen"
      class="backdrop"
      type="button"
      aria-label="Menu sluiten"
      @click="mobileOpen = false"
    />
  </div>
</template>

<style scoped>
.admin-shell {
  min-height: 100vh;
  background: #0a090d;
  color: var(--text);
}
.sidebar {
  position: fixed;
  inset: 0 auto 0 0;
  z-index: var(--z-drawer);
  width: 17rem;
  display: flex;
  flex-direction: column;
  border-right: 1px solid #26222c;
  background: #0e0c12;
}
.brand {
  display: flex;
  align-items: center;
  text-decoration: none;
}
.brand-logo {
  width: 8.75rem;
  max-width: 42vw;
  height: auto;
  object-fit: contain;
  filter: drop-shadow(0 0 .75rem rgba(137, 79, 255, .18));
}
.admin-main {
  min-height: 100vh;
  margin-left: 17rem;
  padding: 2rem clamp(1.25rem, 4vw, 3.5rem) 4rem;
}
.mobile-header, .backdrop, .sheet-bar { display: none; }
.offline-banner {
  position: sticky;
  top: 0;
  z-index: var(--z-sticky);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: .5rem;
  margin-left: 17rem;
  padding: .55rem 1rem;
  background: #3a2a05;
  border-bottom: 1px solid #6b4e0a;
  color: #ffe7a8;
  font-size: .85rem;
}
.admin-main:focus { outline: none; }

/* The post editor is a viewport-height workspace: the page itself does not
   scroll, the editor's panels do. */
.post-editor-route {
  display: flex;
  flex-direction: column;
  height: 100dvh;
  min-height: 0;
  overflow: hidden;
}
.post-editor-route .admin-main {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  padding: 1.25rem clamp(1rem, 2vw, 1.75rem) 1rem;
}

@media (max-width: 820px) {
  .mobile-header {
    position: sticky;
    top: 0;
    z-index: var(--z-sticky);
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: .75rem;
    padding: .55rem 1rem;
    border-bottom: 1px solid #26222c;
    background: rgba(14, 12, 18, .94);
    backdrop-filter: blur(14px);
  }
  .mobile-header .brand { min-height: 2.75rem; }
  /* The navigation is a bottom sheet, opened from "Meer" in the bottom navigation. */
  .sidebar {
    inset: auto 0 0 0;
    width: auto;
    max-height: 88dvh;
    overflow-y: auto;
    overscroll-behavior: contain;
    border-right: 0;
    border-top: 1px solid #302b38;
    border-radius: 1.25rem 1.25rem 0 0;
    padding-bottom: env(safe-area-inset-bottom);
    box-shadow: 0 -1rem 3rem rgba(0, 0, 0, .55);
    transform: translateY(105%);
    transition: transform .22s ease;
  }
  .sidebar.open { transform: translateY(0); }
  .sidebar :deep(.sidebar-top) { display: none; }
  .sheet-bar {
    position: sticky;
    top: 0;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 2.75rem;
    background: #0e0c12;
  }
  .sheet-handle { width: 2.5rem; height: .3rem; border-radius: 999px; background: #3a3444; }
  .sheet-close {
    position: absolute;
    right: .5rem;
    top: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2.75rem;
    height: 2.75rem;
    padding: 0;
    border: 0;
    background: none;
    color: inherit;
  }
  /* Room for the fixed bottom navigation (3.25rem tabs + padding) plus the safe-area inset. */
  .admin-main { margin-left: 0; padding-top: 1rem; padding-bottom: calc(5.5rem + env(safe-area-inset-bottom)); }
  .offline-banner { margin-left: 0; }
  /* Touch-sized controls on a phone (the post editor sizes its own). */
  .admin-shell:not(.post-editor-route) .admin-main :deep(:is(button, select, input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="color"]))) { min-height: 2.75rem; }
  .post-editor-route .admin-main { padding-top: 1rem; }
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: calc(var(--z-drawer) - 5);
    display: block;
    border: 0;
    background: rgba(0, 0, 0, .58);
  }
}

/* Phone post editor: full-screen, with its own header instead of the admin one. */
@media (max-width: 720px) {
  .post-editor-route .mobile-header { display: none; }
  .post-editor-route .admin-main {
    width: 100%;
    max-width: 100vw;
    height: 100dvh;
    padding: .5rem .6rem 0;
  }
}
</style>
