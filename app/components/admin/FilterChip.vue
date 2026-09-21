<script setup lang="ts">
defineProps<{ label: string }>()
const emit = defineEmits<{ remove: [] }>()
</script>

<template>
  <button class="filter-chip" type="button" :aria-label="`Remove ${label} filter`" @click="emit('remove')">
    <span>{{ label }}</span>
    <span aria-hidden="true">×</span>
  </button>
</template>

<style scoped>
.filter-chip{display:inline-flex;align-items:center;gap:.45rem;max-width:20rem;border:1px solid #3b3444;border-radius:999px;padding:.42rem .68rem;background:#17131c;color:#d7cedf;font:inherit;font-size:.76rem;cursor:pointer}
.filter-chip:hover{border-color:#625371;background:#1d1823;color:#fff}
.filter-chip span:first-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.filter-chip:focus-visible{outline:2px solid #9c82d9;outline-offset:2px}
</style>
