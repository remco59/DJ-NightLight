<script setup lang="ts">
import { apiErrorMessage } from '~/utils/api-error'
import { mediaApi } from '~/composables/useMediaLibrary'
import type { MediaCollectionSummary } from '~~/shared/media-library'

const props = defineProps<{ collections: MediaCollectionSummary[] }>()
const emit = defineEmits<{
  close: []
  changed: []
  open: [id: string]
  notify: [message: string, tone?: 'error']
}>()

const newName = ref('')
const renaming = ref('')
const renameValue = ref('')
const busy = ref(false)

async function run(task: () => Promise<unknown>, success: string, failure: string) {
  busy.value = true
  try {
    await task()
    emit('changed')
    emit('notify', success)
    return true
  } catch (error) {
    emit('notify', apiErrorMessage(error, failure), 'error')
    return false
  } finally {
    busy.value = false
  }
}

async function create() {
  const name = newName.value.trim()
  if (!name) return
  if (await run(() => mediaApi.createCollection(name), `Collectie “${name}” aangemaakt.`, 'Collectie aanmaken is niet gelukt.')) newName.value = ''
}

function startRename(collection: MediaCollectionSummary) {
  renaming.value = collection.id
  renameValue.value = collection.name
}

async function rename(collection: MediaCollectionSummary) {
  const name = renameValue.value.trim()
  if (!name || name === collection.name) {
    renaming.value = ''
    return
  }
  if (await run(() => mediaApi.updateCollection(collection.id, { name }), 'Collectie hernoemd.', 'Collectie hernoemen is niet gelukt.')) renaming.value = ''
}

async function move(collection: MediaCollectionSummary, offset: number) {
  const ordered = [...props.collections]
  const index = ordered.findIndex(entry => entry.id === collection.id)
  const target = index + offset
  if (target < 0 || target >= ordered.length) return
  ordered.splice(target, 0, ...ordered.splice(index, 1))
  await run(
    () => Promise.all(ordered.map((entry, sortOrder) => mediaApi.updateCollection(entry.id, { sortOrder }))),
    'Volgorde opgeslagen.',
    'Volgorde wijzigen is niet gelukt.',
  )
}

async function remove(collection: MediaCollectionSummary) {
  if (!confirm(`Collectie “${collection.name}” verwijderen? De ${collection.itemCount} item(s) erin blijven in de bibliotheek.`)) return
  await run(() => mediaApi.deleteCollection(collection.id), 'Collectie verwijderd.', 'Collectie verwijderen is niet gelukt.')
}

function onKey(event: KeyboardEvent) {
  if (event.key === 'Escape' && !renaming.value) emit('close')
}
onMounted(() => document.addEventListener('keydown', onKey))
onBeforeUnmount(() => document.removeEventListener('keydown', onKey))
</script>

<template>
  <Teleport to="body">
    <div class="layer">
      <button type="button" class="mh-backdrop" aria-label="Collecties sluiten" @click="emit('close')" />
      <section class="dialog" role="dialog" aria-modal="true" aria-labelledby="collections-dialog-title">
        <header>
          <div>
            <h2 id="collections-dialog-title">Collecties</h2>
            <p>Groepeer media per doel. Een collectie verwijst naar bestanden en maakt nooit kopieën, dus één foto kan in meerdere collecties staan.</p>
          </div>
          <button type="button" class="mh-icon-btn close" aria-label="Sluiten" @click="emit('close')"><Icon name="lucide:x" aria-hidden="true" /></button>
        </header>

        <form class="create" @submit.prevent="create">
          <input v-model="newName" class="mh-input" maxlength="80" placeholder="Nieuwe collectie, bijv. Beste publieksfoto’s">
          <button type="submit" class="mh-btn primary" :disabled="busy || !newName.trim()"><Icon name="lucide:plus" aria-hidden="true" />Aanmaken</button>
        </form>

        <ul v-if="collections.length" class="list">
          <li v-for="(collection, index) in collections" :key="collection.id">
            <img v-if="collection.coverUrls[0]" :src="collection.coverUrls[0]" alt="" class="thumb">
            <span v-else class="thumb empty"><Icon name="lucide:folder" aria-hidden="true" /></span>
            <form v-if="renaming === collection.id" class="rename" @submit.prevent="rename(collection)">
              <input v-model="renameValue" class="mh-input" maxlength="80" autofocus @keydown.escape.prevent="renaming = ''">
              <button type="submit" class="mh-btn" :disabled="busy">Opslaan</button>
            </form>
            <button v-else type="button" class="name" @click="emit('open', collection.id)">
              <strong>{{ collection.name }}</strong>
              <small>{{ collection.itemCount }} item{{ collection.itemCount === 1 ? '' : 's' }}</small>
            </button>
            <div class="tools">
              <button type="button" class="mh-icon-btn" aria-label="Omhoog" :disabled="busy || index === 0" @click="move(collection, -1)"><Icon name="lucide:arrow-up" aria-hidden="true" /></button>
              <button type="button" class="mh-icon-btn" aria-label="Omlaag" :disabled="busy || index === collections.length - 1" @click="move(collection, 1)"><Icon name="lucide:arrow-down" aria-hidden="true" /></button>
              <button type="button" class="mh-icon-btn" :aria-label="`${collection.name} hernoemen`" @click="startRename(collection)"><Icon name="lucide:pencil" aria-hidden="true" /></button>
              <button type="button" class="mh-icon-btn danger" :aria-label="`${collection.name} verwijderen`" :disabled="busy" @click="remove(collection)"><Icon name="lucide:trash-2" aria-hidden="true" /></button>
            </div>
          </li>
        </ul>
        <p v-else class="mh-empty">Nog geen collecties.</p>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.layer { position: fixed; inset: 0; z-index: 1060; display: grid; place-items: center; padding: 1rem; }
.layer .mh-backdrop { border: 0; cursor: default; }
.dialog { position: relative; display: grid; gap: 1.1rem; width: min(40rem, 100%); max-height: calc(100dvh - 2rem); overflow: auto; border: 1px solid #2c2733; border-radius: 1.1rem; padding: 1.4rem; background: #0f0d13; box-shadow: 0 2rem 5rem rgba(0, 0, 0, .6); }
header { display: flex; justify-content: space-between; gap: 1rem; }
h2 { margin: 0 0 .3rem; font-size: 1.35rem; }
header p { margin: 0; color: #8f879a; font-size: .82rem; line-height: 1.5; }
.close { border-color: transparent; background: transparent; }
.create, .rename { display: flex; gap: .5rem; }
.rename { flex: 1; min-width: 0; }
.list { display: grid; gap: .5rem; margin: 0; padding: 0; list-style: none; }
.list li { display: flex; align-items: center; gap: .8rem; border: 1px solid #25212c; border-radius: .75rem; padding: .55rem; background: #121016; }
.thumb { flex: none; width: 3.4rem; height: 2.5rem; border-radius: .45rem; object-fit: cover; }
.thumb.empty { display: grid; place-items: center; background: #1a1720; color: #7d7686; }
.name { display: grid; flex: 1; gap: .1rem; min-width: 0; border: 0; padding: 0; background: none; color: #fff; font: inherit; text-align: left; cursor: pointer; }
.name:hover strong { color: #c4b1f5; }
.name strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.name small { color: #8f879a; font-size: .76rem; }
.tools { display: flex; gap: .3rem; }
.tools .mh-icon-btn { width: 2rem; height: 2rem; }
.tools .mh-icon-btn:disabled { opacity: .35; cursor: not-allowed; }
.tools .danger { color: #f39aa6; }
@media (max-width: 520px) {
  .layer { padding: 0; }
  .dialog { height: 100dvh; max-height: none; border: 0; border-radius: 0; align-content: start; }
  .list li { flex-wrap: wrap; }
  .tools { width: 100%; justify-content: flex-end; }
}
</style>
