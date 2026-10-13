<script setup lang="ts">
import { usePostEditor } from '~/composables/usePostEditor'

// Shows the post exactly as exported (no guides). Shared by the desktop and
// phone layouts: set `open`, the dialog renders the image and reports `busy`
// while it does.
const open = defineModel<boolean>('open', { required: true })
const busy = defineModel<boolean>('busy', { default: false })
const emit = defineEmits<{ export: [] }>()

const editor = usePostEditor()
const { design, message } = editor

const url = ref('')
const closeRef = ref<HTMLButtonElement | null>(null)
let run = 0

const formatLabel = computed(() => design.preset === 'story' ? '9:16' : design.preset === 'portrait' ? '4:5' : '1:1')

function revoke() {
  if (url.value) URL.revokeObjectURL(url.value)
  url.value = ''
}

async function render() {
  const current = ++run
  if (!editor.selectedAsset.value) {
    message.value = 'Kies eerst een foto.'
    open.value = false
    return
  }
  busy.value = true
  try {
    const blob = await editor.renderExportBlob()
    if (current !== run) return
    revoke()
    url.value = URL.createObjectURL(blob)
    await nextTick()
    closeRef.value?.focus()
  } catch (error) {
    if (current !== run) return
    message.value = error instanceof Error ? error.message : 'Voorbeeld maken is niet gelukt.'
    open.value = false
  } finally {
    if (current === run) busy.value = false
  }
}

function close() {
  open.value = false
}

function exportPost() {
  close()
  emit('export')
}

watch(open, (value) => {
  if (value) void render()
  else {
    run += 1
    busy.value = false
    revoke()
  }
})

function onKey(event: KeyboardEvent) {
  if (event.key === 'Escape' && url.value) close()
}

onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  run += 1
  revoke()
})
</script>

<template>
  <Teleport to="body">
    <div v-if="open && url" class="preview-backdrop" @click.self="close">
      <section class="preview-dialog" role="dialog" aria-modal="true" aria-label="Voorbeeld van de post">
        <img :src="url" alt="Voorbeeld van de geëxporteerde post">
        <footer class="preview-footer">
          <span>Precies zoals geëxporteerd · zonder hulplijnen · {{ formatLabel }}</span>
          <div>
            <button ref="closeRef" type="button" class="action" @click="close">Sluiten</button>
            <button type="button" class="action primary" :disabled="editor.busy.value === 'render' || !editor.readyToExport.value" @click="exportPost">
              Post exporteren <Icon name="lucide:arrow-right" aria-hidden="true" />
            </button>
          </div>
        </footer>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.preview-backdrop {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: grid;
  place-items: center;
  padding: 1.5rem;
  background: rgba(4, 3, 6, .88);
  backdrop-filter: blur(10px);
}

.preview-dialog {
  display: grid;
  justify-items: center;
  gap: .9rem;
  max-width: 100%;
  max-height: 100%;
}

.preview-dialog img {
  max-width: min(100%, 1080px);
  max-height: calc(100dvh - 7rem);
  object-fit: contain;
  box-shadow: 0 30px 100px rgba(0, 0, 0, .6);
}

.preview-footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: .6rem 1rem;
  width: 100%;
  color: #8f8798;
  font-size: .76rem;
}

.preview-footer div {
  display: flex;
  gap: .5rem;
}

.action {
  display: inline-flex;
  align-items: center;
  gap: .45rem;
  min-height: 2.65rem;
  padding: 0 .95rem;
  border: 1px solid #2a2530;
  border-radius: .7rem;
  background: #111015;
  color: #ece7f1;
  font: inherit;
  font-size: .82rem;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
  transition: border-color .15s ease, background .15s ease;
}

.action:hover:not(:disabled) {
  border-color: #3f3748;
  background: #17141c;
}

.action:disabled {
  cursor: not-allowed;
  opacity: .5;
}

.action.primary {
  border-color: var(--button-primary-bg);
  background: var(--button-primary-bg);
  color: var(--button-primary-fg);
}

.action.primary:hover:not(:disabled) {
  border-color: #e6e0ee;
  background: #e6e0ee;
}

@media (max-width: 520px) {
  .preview-backdrop {
    padding: .75rem;
  }

  .preview-footer div {
    width: 100%;
  }

  .preview-footer .action {
    flex: 1 1 0;
    justify-content: center;
  }
}
</style>
