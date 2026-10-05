<script setup lang="ts">
definePageMeta({ layout: 'admin' })
const route = useRoute()
const online = useOnline()

// Back to where the user was heading as soon as the connection returns.
async function leave() {
  const from = typeof route.query.from === 'string' && route.query.from.startsWith('/admin') ? route.query.from : '/admin/gigs'
  await navigateTo(from)
}
watch(online, (value) => { if (value) void leave() })
function retry() { if (navigator.onLine) void leave() }
</script>

<template>
  <AdminOfflineNotice retry @retry="retry" />
</template>
