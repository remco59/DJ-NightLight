<script setup lang="ts">
// Changes made offline: how many are waiting, and the ones the server refused.
const online = useOnline()
const outbox = useOfflineOutbox()
const { waiting, refused, syncing } = outbox
const count = computed(() => waiting.value.length)
</script>

<template>
  <section v-if="count || refused.length" class="outbox" aria-label="Offline wijzigingen">
    <p v-if="count" class="line" role="status">
      <Icon :name="syncing ? 'lucide:refresh-cw' : 'lucide:cloud-upload'" aria-hidden="true" />
      <span>
        {{ count }} {{ count === 1 ? 'wijziging wacht' : 'wijzigingen wachten' }} op synchronisatie<template v-if="!online"> — gaat vanzelf zodra je weer online bent</template>
      </span>
      <button v-if="online" type="button" :disabled="syncing" @click="outbox.flush()">{{ syncing ? 'Bezig…' : 'Nu synchroniseren' }}</button>
    </p>
    <ul v-if="refused.length" class="refused">
      <li v-for="entry in refused" :key="entry.id">
        <Icon name="lucide:triangle-alert" aria-hidden="true" />
        <span>
          <strong>{{ entry.gigTitle }}</strong>:
          {{ entry.kind === 'note' ? 'notitie' : 'statuswijziging' }} niet verwerkt. {{ entry.error }}
        </span>
        <NuxtLink :to="`/admin/gigs/${entry.gigId}`">Bekijk gig</NuxtLink>
        <button type="button" @click="outbox.discard(entry.id)">Verwijderen</button>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.outbox { margin-left: 17rem; padding: .55rem 1rem; background: #14202b; border-bottom: 1px solid #2b4560; color: #cfe6ff; font-size: .85rem; }
.line, .refused li { display: flex; align-items: center; flex-wrap: wrap; gap: .5rem; margin: 0; }
.refused { margin: .4rem 0 0; padding: 0; list-style: none; color: #ffd7a8; }
.refused li + li { margin-top: .3rem; }
button, a { min-height: 2rem; padding: .2rem .7rem; border: 1px solid currentColor; border-radius: .5rem; background: none; color: inherit; font-size: .8rem; text-decoration: none; cursor: pointer; }
button:disabled { opacity: .6; cursor: default; }
@media (max-width: 820px) { .outbox { margin-left: 0; } }
</style>
