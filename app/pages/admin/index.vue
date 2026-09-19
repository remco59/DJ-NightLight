<script setup lang="ts">
const { user, clear } = useUserSession()

async function logout() {
  await $fetch('/api/auth/logout', { method: 'POST' })
  await clear()
  await navigateTo('/admin/login')
}

useSeoMeta({
  title: 'Dashboard — DJ NightLight',
  robots: 'noindex, nofollow',
})
</script>

<template>
  <main class="container admin-placeholder">
    <p class="eyebrow">Back office</p>
    <h1>Hoi {{ user?.name || 'NightLight' }}</h1>
    <p>De beveiligde adminomgeving is actief. Het operationele dashboard volgt in fase 1.</p>
    <button type="button" @click="logout">Uitloggen</button>
  </main>
</template>

<style scoped>
.admin-placeholder { padding-block: 5rem; }
button { margin-top: 1rem; padding: .75rem 1rem; }
</style>
