<script setup lang="ts">
import type { GigConflict } from '~/composables/useGigConflicts'

defineProps<{ conflicts: GigConflict[] }>()

const dayTime = new Intl.DateTimeFormat('nl-NL', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
function when(value: string | null) {
  return value ? dayTime.format(new Date(value)) : 'zonder datum'
}
</script>

<template>
  <div v-if="conflicts.length" class="conflict-warning" role="status">
    <Icon name="lucide:triangle-alert" aria-hidden="true" />
    <div>
      <strong>{{ conflicts.length === 1 ? 'Overlapt met een andere gig' : `Overlapt met ${conflicts.length} andere gigs` }}</strong>
      <ul>
        <li v-for="conflict in conflicts" :key="conflict.id">
          <NuxtLink :to="`/admin/gigs/${conflict.id}`">{{ conflict.title }}</NuxtLink>
          <span>{{ conflict.status === 'booked' ? 'Geboekt' : 'Lead' }} · {{ when(conflict.startsAt) }}</span>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.conflict-warning { display: flex; gap: .7rem; align-items: flex-start; margin: .2rem 0 .8rem; padding: .75rem .9rem; border: 1px solid color-mix(in srgb, var(--status-warn) 55%, transparent); border-radius: .75rem; background: color-mix(in srgb, var(--status-warn) 12%, var(--surface-card)); color: var(--text); font-size: .9rem; }
.conflict-warning svg { flex: none; width: 1.2rem; height: 1.2rem; margin-top: .1rem; color: var(--status-warn); }
ul { display: grid; gap: .15rem; margin: .3rem 0 0; padding: 0; list-style: none; }
li { display: flex; flex-wrap: wrap; gap: .1rem .6rem; }
li span { color: var(--text-muted); }
a { color: var(--electric-soft); }
</style>
