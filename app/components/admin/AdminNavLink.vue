<script setup lang="ts">
import { worksOffline } from '~~/shared/offline-routes'

// A navigation link that is greyed out and not focusable while offline when the
// page behind it needs a connection (see shared/offline-routes.ts).
const props = defineProps<{ to: string }>()
const online = useOnline()
const unavailable = computed(() => !online.value && !worksOffline(props.to))
</script>

<template>
  <span v-if="unavailable" class="unavailable" aria-disabled="true" title="Niet beschikbaar offline"><slot /></span>
  <NuxtLink v-else :to="to"><slot /></NuxtLink>
</template>
