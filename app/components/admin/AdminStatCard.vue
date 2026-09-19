<script setup lang="ts">
defineProps<{
  label: string
  value: string | number
  detail?: string
  muted?: boolean
}>()
</script>

<template>
  <article class="stat" :class="{ muted }">
    <p>{{ label }}</p>
    <strong>{{ value }}</strong>
    <small v-if="detail">{{ detail }}</small>
  </article>
</template>

<style scoped>
.stat {
  min-height: 9rem;
  display: grid;
  align-content: space-between;
  gap: .75rem;
  padding: 1.2rem;
  border: 1px solid #292530;
  border-radius: 1.1rem;
  background: #100e14;
}
.stat p { margin: 0; color: #9d97a6; font-size: .82rem; }
.stat strong { font-size: clamp(2rem, 4vw, 3.2rem); letter-spacing: -.04em; }
.stat small { color: #777180; }
.stat.muted strong { color: #6e6876; }
</style>
