<script setup lang="ts">
import AdminNav from '~/components/admin/AdminNav.vue'

const route = useRoute()
const mobileOpen = ref(false)

watch(()=>route.path,()=>{mobileOpen.value=false})
</script>

<template>
  <div class="admin-shell" :class="{ 'post-editor-route': route.path === '/admin/post-generator' }">
    <header class="mobile-header">
      <NuxtLink to="/admin" class="brand">NightLight</NuxtLink>
      <button class="menu-button" type="button" :aria-expanded="mobileOpen" aria-label="Menu openen" @click="mobileOpen = !mobileOpen">
        <Icon :name="mobileOpen ? 'lucide:x' : 'lucide:menu'" aria-hidden="true" />
        {{ mobileOpen ? 'Sluiten' : 'Menu' }}
      </button>
    </header>

    <aside class="sidebar" :class="{ open: mobileOpen }">
      <AdminNav />
    </aside>

    <main class="admin-main">
      <slot />
    </main>

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
  color: #f6f3fa;
}
.sidebar {
  position: fixed;
  inset: 0 auto 0 0;
  z-index: 30;
  width: 17rem;
  display: flex;
  flex-direction: column;
  border-right: 1px solid #26222c;
  background: #0e0c12;
}
.brand {
  display: flex;
  align-items: center;
  gap: .8rem;
  text-decoration: none;
}
.admin-main {
  min-height: 100vh;
  margin-left: 17rem;
  padding: 2rem clamp(1.25rem, 4vw, 3.5rem) 4rem;
}
.mobile-header, .backdrop { display: none; }

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
    z-index: 20;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: .9rem 1rem;
    border-bottom: 1px solid #26222c;
    background: rgba(14, 12, 18, .94);
    backdrop-filter: blur(14px);
  }
  .mobile-header .brand { font-weight: 800; }
  .menu-button {
    display: inline-flex;
    align-items: center;
    gap: .4rem;
    border: 1px solid #302b38;
    border-radius: .6rem;
    padding: .5rem .7rem;
    background: #17141c;
    color: inherit;
  }
  .sidebar {
    width: min(19rem, 84vw);
    transform: translateX(-105%);
    transition: transform .2s ease;
  }
  .sidebar.open { transform: translateX(0); }
  .admin-main { margin-left: 0; padding-top: 1.5rem; }
  .post-editor-route .admin-main { padding-top: 1rem; }
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 25;
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
