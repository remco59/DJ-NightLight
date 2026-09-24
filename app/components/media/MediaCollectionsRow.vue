<script setup lang="ts">
import type { MediaCollectionSummary } from '~~/shared/media-library'

defineProps<{
  collections: MediaCollectionSummary[]
  activeId: string
}>()

const emit = defineEmits<{
  select: [id: string]
  manage: []
}>()
</script>

<template>
  <section class="collections" aria-labelledby="collections-heading">
    <header>
      <h2 id="collections-heading">Collections</h2>
      <button type="button" class="view-all" @click="emit('manage')">
        {{ collections.length ? 'View all collections' : 'Create a collection' }}<Icon name="lucide:arrow-right" aria-hidden="true" />
      </button>
    </header>
    <div v-if="collections.length" class="row">
      <button
        v-for="collection in collections"
        :key="collection.id"
        type="button"
        class="collection"
        :class="{ active: activeId === collection.id }"
        :aria-pressed="activeId === collection.id"
        @click="emit('select', collection.id)"
      >
        <span class="cover" aria-hidden="true">
          <img v-for="(url, index) in collection.coverUrls.slice(0, 1)" :key="index" :src="url" alt="" loading="lazy">
        </span>
        <span class="icon"><Icon :name="activeId === collection.id ? 'lucide:folder-open' : 'lucide:folder'" aria-hidden="true" /></span>
        <span class="copy">
          <strong>{{ collection.name }}</strong>
          <small>{{ collection.itemCount }} item{{ collection.itemCount === 1 ? '' : 's' }}</small>
        </span>
        <span class="go"><Icon :name="activeId === collection.id ? 'lucide:x' : 'lucide:arrow-right'" aria-hidden="true" /></span>
      </button>
    </div>
  </section>
</template>

<style scoped>
.collections { margin-bottom: 1.6rem; }
header { display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-bottom: .75rem; }
h2 { margin: 0; font-size: 1.05rem; letter-spacing: -.01em; }
.view-all { display: inline-flex; align-items: center; gap: .45rem; border: 0; padding: 0; background: none; color: #c9c2d1; font: inherit; font-size: .82rem; cursor: pointer; }
.view-all:hover { color: #fff; }
.row { display: grid; grid-auto-columns: minmax(15rem, 1fr); grid-auto-flow: column; gap: .9rem; overflow-x: auto; padding-bottom: .2rem; scrollbar-width: thin; }
.collection {
  position: relative;
  display: flex;
  align-items: center;
  gap: .85rem;
  overflow: hidden;
  min-height: 4.1rem;
  border: 1px solid #27222e;
  border-radius: .85rem;
  padding: .75rem .9rem;
  background: #111016;
  color: #fff;
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: border-color .15s ease, box-shadow .15s ease;
}
.collection:hover { border-color: #43394f; }
.collection.active { border-color: #8b5cf6; box-shadow: 0 0 0 1px #8b5cf6, 0 0 1.2rem rgba(124, 58, 237, .25); }
.cover { position: absolute; inset: 0 0 0 38%; }
.cover img { width: 100%; height: 100%; object-fit: cover; opacity: .9; }
.cover::after { content: ""; position: absolute; inset: 0; background: linear-gradient(90deg, #111016 0%, rgba(17, 16, 22, .82) 30%, rgba(17, 16, 22, .15) 100%); }
.icon, .copy, .go { position: relative; z-index: 1; }
.icon { display: grid; flex: none; width: 2.3rem; height: 2.3rem; place-items: center; border: 1px solid #2f2a37; border-radius: .6rem; background: rgba(19, 17, 24, .85); color: #d9d3df; }
.copy { display: grid; flex: 1; gap: .12rem; min-width: 0; }
.copy strong { overflow: hidden; font-size: .9rem; text-overflow: ellipsis; white-space: nowrap; }
.copy small { color: #a79fb2; font-size: .76rem; }
.go { display: grid; flex: none; width: 2rem; height: 2rem; place-items: center; border-radius: 50%; background: rgba(8, 7, 11, .6); color: #fff; backdrop-filter: blur(4px); }
@media (max-width: 720px) {
  .row { grid-auto-columns: minmax(13rem, 78%); }
}
</style>
