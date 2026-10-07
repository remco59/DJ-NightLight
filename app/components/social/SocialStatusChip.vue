<script setup lang="ts">
import { socialPostStatusLabels, socialPostStatusTones, type SocialPostStatusKey } from '~~/shared/social'

const props = defineProps<{ status: SocialPostStatusKey }>()
const label = computed(() => socialPostStatusLabels[props.status] ?? props.status)
const tone = computed(() => socialPostStatusTones[props.status] ?? 'neutral')
</script>

<template>
  <span class="chip" :data-tone="tone">{{ label }}</span>
</template>

<style scoped>
.chip {
  display: inline-flex;
  align-items: center;
  padding: .18rem .55rem;
  border: 1px solid #312b38;
  border-radius: 999px;
  background: #17141b;
  color: #cfc8d6;
  font-size: .72rem;
  font-weight: 600;
  white-space: nowrap;
}

.chip[data-tone="info"] {
  border-color: #4b3a7a;
  background: #231b3a;
  color: #cbb9ff;
}

.chip[data-tone="ok"] {
  border-color: #28583d;
  background: #14281d;
  color: #8fd6ad;
}

.chip[data-tone="error"] {
  border-color: #6b2a36;
  background: #2a1218;
  color: #f0a3b0;
}
</style>
