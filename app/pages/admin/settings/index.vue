<script setup lang="ts">
import type { StaffRole } from '~~/shared/auth'

// The settings-access middleware normally redirects before this renders; this is the fallback.
const { user } = useUserSession()
await navigateTo(firstSettingsPath(user.value?.role as StaffRole | undefined), { replace: true })
</script>

<template><div /></template>
