<script setup lang="ts">
import type { StaffRole } from '~~/shared/auth'

// Phone-only primary navigation, so the hamburger drawer is for the long tail.
// "Meer" opens that drawer.
defineProps<{ moreOpen: boolean }>()
const emit = defineEmits<{ more: [] }>()

const route = useRoute()
const { user } = useUserSession()

type Item = { label: string, to: string, icon: string, roles: readonly StaffRole[], active: () => boolean }
const gigRoles: readonly StaffRole[] = ['owner', 'manager', 'dj']
const items: Item[] = [
  { label: 'Dashboard', to: '/admin', icon: 'lucide:layout-dashboard', roles: ['owner', 'manager', 'dj', 'content_editor'], active: () => route.path === '/admin' },
  { label: 'Gigs', to: '/admin/gigs', icon: 'lucide:disc-3', roles: gigRoles, active: () => route.path.startsWith('/admin/gigs') },
  { label: 'Agenda', to: '/admin/calendar', icon: 'lucide:calendar-range', roles: ['owner', 'manager'], active: () => route.path.startsWith('/admin/calendar') },
  { label: 'Media', to: '/admin/media', icon: 'lucide:images', roles: ['content_editor'], active: () => route.path.startsWith('/admin/media') },
  { label: 'Social', to: '/admin/social', icon: 'lucide:share-2', roles: ['content_editor'], active: () => route.path.startsWith('/admin/social') },
]
const visible = computed(() => {
  const role = user.value?.role as StaffRole | undefined
  return role ? items.filter(item => item.roles.includes(role)) : []
})
</script>

<template>
  <nav class="bottom-nav" aria-label="Hoofdnavigatie">
    <NuxtLink
      v-for="item in visible"
      :key="item.to"
      :to="item.to"
      class="tab"
      :class="{ active: item.active() && !moreOpen }"
      :aria-current="item.active() && !moreOpen ? 'page' : undefined"
    >
      <Icon :name="item.icon" aria-hidden="true" />
      <span>{{ item.label }}</span>
    </NuxtLink>
    <button type="button" class="tab" :class="{ active: moreOpen }" :aria-expanded="moreOpen" @click="emit('more')">
      <Icon name="lucide:ellipsis" aria-hidden="true" />
      <span>Meer</span>
    </button>
  </nav>
</template>

<style scoped>
.bottom-nav {
  position: fixed;
  inset: auto 0 0;
  z-index: var(--z-sticky);
  display: none;
  grid-auto-flow: column;
  grid-auto-columns: 1fr;
  gap: .25rem;
  padding: .35rem .5rem calc(.35rem + env(safe-area-inset-bottom));
  border-top: 1px solid #26222c;
  background: rgba(14, 12, 18, .96);
  backdrop-filter: blur(14px);
}
.tab {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: .15rem;
  min-height: 3.25rem;
  min-width: 2.75rem;
  padding: .35rem .25rem;
  border: 1px solid transparent;
  border-radius: .8rem;
  background: none;
  color: #9a93a6;
  font: inherit;
  font-size: .78rem;
  font-weight: 700;
  text-decoration: none;
  cursor: pointer;
}
.tab :deep(svg) { width: 1.5rem; height: 1.5rem; }
.tab.active {
  border-color: #3a2d55;
  background: linear-gradient(180deg, #1e1433, #150f24);
  color: #c9a4ff;
  box-shadow: 0 0 1rem rgba(137, 79, 255, .18);
}
@media (max-width: 820px) {
  .bottom-nav { display: grid; }
}
</style>
