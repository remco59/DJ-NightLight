<script setup lang="ts">
const route = useRoute()
const token = computed(() => String(route.params.token || ''))
</script>

<template>
  <main class="container client-placeholder">
    <p class="eyebrow">Client portal</p>
    <h1>Booking portal</h1>
    <p>This route is reserved for secure magic-link access.</p>
    <small v-if="token">Portal reference loaded.</small>
  </main>
</template>

<style scoped>
.client-placeholder { padding-block: 5rem; }
small { color: #777381; }
</style>
