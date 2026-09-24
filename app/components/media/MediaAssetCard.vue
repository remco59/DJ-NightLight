<script setup lang="ts">
import MediaPopover from '~/components/media/MediaPopover.vue'
import { mediaKindFromMime } from '~~/shared/media'
import {
  formatMediaBytes,
  formatMediaDate,
  formatMediaDuration,
  mediaDisplayTitle,
  mediaSubline,
  mediaTypeLabel,
  type MediaCollectionSummary,
  type MediaLibraryItem,
} from '~~/shared/media-library'

export type MediaCardAction = 'open' | 'edit' | 'copy' | 'download' | 'variant' | 'delete'

const props = withDefaults(defineProps<{
  item: MediaLibraryItem
  selected?: boolean
  /** While a selection exists, clicking a card toggles it instead of opening it. */
  selecting?: boolean
  layout?: 'grid' | 'row'
  /** Picker cards have no checkbox or menu. */
  interactive?: boolean
  active?: boolean
  collections?: MediaCollectionSummary[]
}>(), {
  selected: false,
  selecting: false,
  layout: 'grid',
  interactive: true,
  active: false,
  collections: () => [],
})

const emit = defineEmits<{
  open: []
  toggle: [event: MouseEvent | KeyboardEvent]
  action: [action: MediaCardAction]
  collection: [collectionId: string, member: boolean]
}>()

const menuOpen = ref(false)
const kind = computed(() => mediaKindFromMime(props.item.mimeType))
const title = computed(() => mediaDisplayTitle(props.item))
const duration = computed(() => formatMediaDuration(props.item.durationMs))
const typeIcon = computed(() => {
  if (props.item.source === 'generated') return 'lucide:sparkles'
  if (kind.value === 'video') return 'lucide:clapperboard'
  if (kind.value === 'audio') return 'lucide:audio-lines'
  return 'lucide:image'
})
const visibleTags = computed(() => props.item.tags.slice(0, 3))
const hiddenTagCount = computed(() => Math.max(0, props.item.tags.length - visibleTags.value.length))

function activate(event: MouseEvent | KeyboardEvent) {
  if (props.interactive && (props.selecting || event.shiftKey || event.metaKey || event.ctrlKey)) emit('toggle', event)
  else emit('open')
}

function run(action: MediaCardAction) {
  menuOpen.value = false
  emit('action', action)
}
</script>

<template>
  <article
    class="card"
    :class="[layout, { selected, active, 'has-selection': selecting }]"
    :data-kind="kind"
  >
    <button
      type="button"
      class="thumb"
      :aria-label="`${title} ${selecting ? 'selecteren' : 'openen'}`"
      @click="activate"
    >
      <img v-if="item.thumbnailUrl" :src="item.thumbnailUrl" :alt="item.altText || title" loading="lazy" decoding="async">
      <span v-else class="placeholder"><Icon :name="typeIcon" aria-hidden="true" /></span>
      <span v-if="layout === 'grid'" class="type-badge" :title="mediaTypeLabel(item)"><Icon :name="typeIcon" aria-hidden="true" /></span>
      <span v-if="duration && layout === 'grid'" class="duration"><Icon name="lucide:video" aria-hidden="true" />{{ duration }}</span>
      <span v-if="item.variantCount && layout === 'grid'" class="variants" :title="`${item.variantCount} variant${item.variantCount === 1 ? '' : 'en'}`">
        <Icon name="lucide:layers" aria-hidden="true" />{{ item.variantCount }}
      </span>
    </button>

    <button
      v-if="interactive"
      type="button"
      class="select"
      role="checkbox"
      :aria-checked="selected"
      :aria-label="`${title} selecteren`"
      @click.stop="emit('toggle', $event)"
    >
      <span class="mh-check" :class="{ checked: selected }"><Icon v-if="selected" name="lucide:check" aria-hidden="true" /></span>
    </button>

    <MediaPopover v-if="interactive" v-model:open="menuOpen" class="menu" align="end">
      <template #trigger="{ toggle }">
        <button type="button" class="more" :aria-expanded="menuOpen" :aria-label="`Acties voor ${title}`" @click.stop="toggle">
          <Icon name="lucide:ellipsis" aria-hidden="true" />
        </button>
      </template>
      <button type="button" class="mh-menu-item" @click="run('open')"><Icon name="lucide:maximize-2" aria-hidden="true" />Voorbeeld openen</button>
      <button type="button" class="mh-menu-item" @click="run('edit')"><Icon name="lucide:pencil" aria-hidden="true" />Gegevens bewerken</button>
      <button type="button" class="mh-menu-item" @click="run('copy')"><Icon name="lucide:link" aria-hidden="true" />Link kopiëren</button>
      <button type="button" class="mh-menu-item" @click="run('download')"><Icon name="lucide:download" aria-hidden="true" />Downloaden</button>
      <button type="button" class="mh-menu-item" @click="run('variant')"><Icon name="lucide:layers" aria-hidden="true" />Variant uploaden</button>
      <template v-if="collections.length">
        <div class="mh-menu-sep" />
        <p class="menu-label">Collecties</p>
        <button
          v-for="collection in collections"
          :key="collection.id"
          type="button"
          class="mh-menu-item"
          role="menuitemcheckbox"
          :aria-checked="item.collectionIds.includes(collection.id)"
          @click="emit('collection', collection.id, !item.collectionIds.includes(collection.id))"
        >
          <Icon :name="item.collectionIds.includes(collection.id) ? 'lucide:square-check' : 'lucide:square'" aria-hidden="true" />{{ collection.name }}
        </button>
      </template>
      <div class="mh-menu-sep" />
      <button type="button" class="mh-menu-item danger" @click="run('delete')"><Icon name="lucide:trash-2" aria-hidden="true" />Verwijderen</button>
    </MediaPopover>

    <div class="body" @click="activate">
      <strong :title="title">{{ title }}</strong>
      <small>
        <template v-if="item.variantLabel"><span class="variant-label">{{ item.variantLabel }}</span> · </template>{{ mediaSubline(item) }}
      </small>
      <span v-if="item.tags.length && layout === 'grid'" class="tags">
        <span v-for="tag in visibleTags" :key="tag" class="mh-tag">{{ tag }}</span>
        <span v-if="hiddenTagCount" class="mh-tag more-tags">+{{ hiddenTagCount }}</span>
      </span>
    </div>

    <template v-if="layout === 'row'">
      <span class="cell tags-cell">
        <span v-for="tag in visibleTags" :key="tag" class="mh-tag">{{ tag }}</span>
      </span>
      <span class="cell type-cell"><Icon :name="typeIcon" aria-hidden="true" />{{ duration || mediaTypeLabel(item) }}</span>
      <span class="cell size-cell">{{ formatMediaBytes(item.byteSize) }}</span>
      <span class="cell date-cell">{{ formatMediaDate(item.createdAt) }}</span>
    </template>
  </article>
</template>

<style scoped>
.card {
  position: relative;
  display: flex;
  flex-direction: column;
  min-width: 0;
  border: 1px solid #25212c;
  border-radius: .9rem;
  background: #111016;
  transition: border-color .15s ease, box-shadow .15s ease, transform .15s ease;
}
.card:hover { border-color: #3b3446; }
.card.selected { border-color: #8b5cf6; box-shadow: 0 0 0 1px #8b5cf6, 0 0 1.4rem rgba(124, 58, 237, .22); }
.card.active { border-color: #a78bfa; box-shadow: 0 0 0 2px #a78bfa; }
.thumb {
  position: relative;
  display: block;
  overflow: hidden;
  width: 100%;
  aspect-ratio: 16 / 10;
  border: 0;
  border-radius: .85rem .85rem 0 0;
  padding: 0;
  background: #09080c;
  cursor: pointer;
}
.thumb img { display: block; width: 100%; height: 100%; object-fit: cover; transition: transform .35s ease; }
.card:hover .thumb img { transform: scale(1.025); }
.placeholder { display: grid; width: 100%; height: 100%; place-items: center; color: #6f6878; font-size: 2rem; background: radial-gradient(circle at 50% 40%, #1d1726, #09080c 70%); }
.type-badge, .duration, .variants {
  position: absolute;
  bottom: .6rem;
  display: inline-flex;
  align-items: center;
  gap: .3rem;
  border-radius: .45rem;
  padding: .28rem .42rem;
  background: rgba(8, 7, 11, .72);
  color: #fff;
  font-size: .72rem;
  font-weight: 700;
  backdrop-filter: blur(6px);
}
.type-badge { left: .6rem; }
.duration { right: .6rem; }
.variants { right: .6rem; }
.duration + .variants { right: 4.6rem; }
.type-badge .iconify, .duration .iconify, .variants .iconify { width: .9rem; height: .9rem; }
.select, .more {
  position: absolute;
  top: .6rem;
  z-index: 2;
  display: grid;
  place-items: center;
  border: 0;
  padding: .15rem;
  background: transparent;
  cursor: pointer;
}
.select { left: .6rem; opacity: .85; }
.card:hover .select, .card.selected .select, .card.has-selection .select { opacity: 1; }
.menu { position: absolute; top: .6rem; right: .6rem; z-index: 3; }
.more {
  position: static;
  width: 1.9rem;
  height: 1.9rem;
  border-radius: .5rem;
  background: rgba(8, 7, 11, .66);
  color: #fff;
  backdrop-filter: blur(6px);
}
.more:hover { background: rgba(32, 27, 40, .9); }
.menu :deep(.popover-panel) { max-height: 22rem; overflow: auto; }
.menu-label { margin: .35rem .65rem .2rem; color: #6f6878; font-size: .66rem; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; }
.body { display: grid; gap: .25rem; min-width: 0; padding: .75rem .85rem .85rem; cursor: pointer; }
.body strong { overflow: hidden; color: #f5f2f8; font-size: .9rem; text-overflow: ellipsis; white-space: nowrap; }
.body small { overflow: hidden; color: #8f879a; font-size: .76rem; text-overflow: ellipsis; white-space: nowrap; }
.variant-label { color: #c4b1f5; }
.tags { display: flex; gap: .35rem; margin-top: .4rem; overflow: hidden; }
.more-tags { color: #8f879a; }

/* List layout: one dense row per asset. */
.card.row {
  display: grid;
  grid-template-columns: 2rem 4.5rem minmax(0, 2.2fr) minmax(0, 1.4fr) minmax(6rem, .8fr) 5rem 6.5rem 2.2rem;
  align-items: center;
  gap: .8rem;
  border-radius: .7rem;
  padding: .45rem .6rem;
}
.card.row .select { position: static; order: -2; opacity: 1; }
.card.row .thumb { order: -1; width: 4.5rem; height: 3rem; aspect-ratio: auto; border-radius: .45rem; }
.card.row .body { padding: 0; }
.card.row .menu { position: static; order: 10; }
.card.row .cell { overflow: hidden; color: #9d95a8; font-size: .78rem; text-overflow: ellipsis; white-space: nowrap; }
.card.row .tags-cell { display: flex; gap: .3rem; }
.card.row .type-cell { display: inline-flex; align-items: center; gap: .35rem; }
.card.row:hover .thumb img { transform: none; }
@media (max-width: 900px) {
  .card.row { grid-template-columns: 2rem 4rem minmax(0, 1fr) 5rem 2.2rem; }
  .card.row .tags-cell, .card.row .type-cell, .card.row .date-cell { display: none; }
}
@media (max-width: 520px) {
  .card.row { grid-template-columns: 2rem 3.6rem minmax(0, 1fr) 2.2rem; gap: .6rem; }
  .card.row .thumb { width: 3.6rem; height: 2.6rem; }
  .card.row .size-cell { display: none; }
}
@media (prefers-reduced-motion: reduce) {
  .thumb img { transition: none; }
}
</style>
