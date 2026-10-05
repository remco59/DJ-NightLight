<script setup lang="ts">
defineProps<{ retry?: boolean }>()
const emit = defineEmits<{ retry: [] }>()
</script>

<template>
  <section class="offline-notice" aria-labelledby="offline-title">
    <Icon name="lucide:wifi-off" aria-hidden="true" />
    <h1 id="offline-title">Je bent offline</h1>
    <p>Deze pagina heeft een internetverbinding nodig. Gigs die je eerder hebt bekeken kun je ook zonder verbinding bekijken.</p>
    <div class="actions">
      <NuxtLink class="primary" to="/admin/gigs">Naar gigs</NuxtLink>
      <button v-if="retry" class="secondary" type="button" @click="emit('retry')">Opnieuw proberen</button>
    </div>
  </section>
</template>

<style scoped>
.offline-notice { max-width: 28rem; margin: 12vh auto 0; text-align: center; }
.offline-notice svg { width: 2.5rem; height: 2.5rem; color: var(--electric-accent); }
h1 { margin: .75rem 0 .5rem; font-size: 1.8rem; }
p { margin: 0 0 1.5rem; color: var(--text-subtle, #aaa3b4); }
.actions { display: flex; flex-wrap: wrap; justify-content: center; gap: .75rem; }
.actions a { display: inline-flex; align-items: center; text-decoration: none; }
</style>
