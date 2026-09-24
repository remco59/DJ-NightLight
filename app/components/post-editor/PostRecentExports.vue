<script setup lang="ts">
import { usePostEditor, type GeneratedPost } from '~/composables/usePostEditor'
import { POST_TEMPLATE_KEYS, postTemplateInfo, type PostTemplateKey } from '~~/shared/post-generator'

const open = defineModel<boolean>('open', { required: true })

const editor = usePostEditor()
const { busy } = editor
const closeRef = ref<HTMLButtonElement | null>(null)
const refreshing = ref(false)

function templateLabel(key: string) {
  return (POST_TEMPLATE_KEYS as readonly string[]).includes(key) ? postTemplateInfo(key as PostTemplateKey).label : key
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('nl-NL', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function reuse(post: GeneratedPost) {
  editor.reuseExport(post)
  open.value = false
}

async function refresh() {
  refreshing.value = true
  try {
    await editor.refresh()
  } finally {
    refreshing.value = false
  }
}

watch(open, (value) => {
  if (value) void nextTick(() => closeRef.value?.focus())
})
</script>

<template>
  <Teleport to="body">
    <Transition name="drawer">
      <div v-if="open" class="backdrop" @click.self="open = false" @keydown.esc="open = false">
        <aside class="drawer" role="dialog" aria-modal="true" aria-labelledby="post-exports-title">
          <header class="drawer-head">
            <div>
              <h2 id="post-exports-title">Recent exports</h2>
              <p>Download an exported PNG or load its design back into the editor.</p>
            </div>
            <div class="head-actions">
              <button type="button" class="icon-button" aria-label="Refresh" title="Refresh" :disabled="refreshing" @click="refresh">
                <Icon name="lucide:refresh-cw" aria-hidden="true" />
              </button>
              <button ref="closeRef" type="button" class="icon-button" aria-label="Close" @click="open = false">
                <Icon name="lucide:x" aria-hidden="true" />
              </button>
            </div>
          </header>

          <ul v-if="editor.posts.value.length" class="export-list">
            <li v-for="post in editor.posts.value" :key="post.id" class="export-item">
              <a class="export-image" :href="post.imageUrl" target="_blank" rel="noopener" :aria-label="`Open ${templateLabel(post.templateKey)} export in a new tab`">
                <img :src="post.imageUrl" alt="" loading="lazy">
              </a>
              <div class="export-copy">
                <strong>{{ templateLabel(post.templateKey) }}</strong>
                <small>{{ post.width }}<IconTimes />{{ post.height }} · {{ formatDate(post.createdAt) }}</small>
                <div class="export-actions">
                  <a class="action" :href="post.imageUrl" :download="'nightlight-' + post.id + '.png'">
                    <Icon name="lucide:download" aria-hidden="true" />Download
                  </a>
                  <button type="button" class="action" @click="reuse(post)">
                    <Icon name="lucide:pencil" aria-hidden="true" />Edit again
                  </button>
                  <button
                    type="button"
                    class="action danger"
                    :aria-label="'Delete ' + templateLabel(post.templateKey) + ' export'"
                    title="Delete"
                    :disabled="busy === post.id"
                    @click="editor.deletePost(post)"
                  >
                    <Icon name="lucide:trash-2" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </li>
          </ul>

          <div v-else class="empty">
            <Icon name="lucide:images" aria-hidden="true" />
            <strong>No exports yet</strong>
            <small>Exported posts appear here, ready to download or reuse.</small>
          </div>
        </aside>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: flex;
  justify-content: flex-end;
  background: rgba(4, 3, 6, .55);
}

.drawer {
  display: flex;
  flex-direction: column;
  width: min(440px, 100%);
  height: 100%;
  border-left: 1px solid #2a2530;
  background: #0f0d13;
  box-shadow: -30px 0 80px rgba(0, 0, 0, .5);
}

.drawer-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.2rem 1.2rem 1rem;
  border-bottom: 1px solid #1f1b24;
}

.drawer-head h2 {
  margin: 0;
  font-size: 1.15rem;
}

.drawer-head p {
  margin: .3rem 0 0;
  color: #8f8798;
  font-size: .76rem;
  line-height: 1.45;
}

.head-actions {
  display: flex;
  gap: .35rem;
}

.icon-button {
  display: grid;
  width: 2.1rem;
  height: 2.1rem;
  place-items: center;
  border: 1px solid #2a2530;
  border-radius: .6rem;
  background: #151119;
  color: #d4ced9;
  cursor: pointer;
}

.icon-button:disabled {
  opacity: .5;
}

.export-list {
  display: grid;
  gap: .25rem;
  margin: 0;
  padding: .6rem;
  overflow: auto;
  list-style: none;
}

.export-item {
  display: grid;
  grid-template-columns: 5.5rem minmax(0, 1fr);
  gap: .9rem;
  padding: .6rem;
  border-radius: .75rem;
}

.export-item:hover {
  background: #15121a;
}

.export-image {
  display: grid;
  place-items: center;
  overflow: hidden;
  aspect-ratio: 4 / 5;
  border-radius: .5rem;
  background: #08070a;
}

.export-image img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.export-copy {
  display: grid;
  align-content: start;
  gap: .25rem;
  min-width: 0;
}

.export-copy strong {
  font-size: .84rem;
}

.export-copy small {
  color: #7f7888;
  font-size: .72rem;
}

.export-actions {
  display: flex;
  flex-wrap: wrap;
  gap: .35rem;
  margin-top: .45rem;
}

.action {
  display: inline-flex;
  align-items: center;
  gap: .35rem;
  padding: .35rem .6rem;
  border: 1px solid #2a2530;
  border-radius: .5rem;
  background: #151119;
  color: #d9d2e1;
  font-size: .72rem;
  text-decoration: none;
  cursor: pointer;
}

.action:hover {
  border-color: #4a4153;
  color: #fff;
}

.action.danger:hover:not(:disabled) {
  border-color: #6b2a36;
  color: #f0b7c1;
}

.action:disabled {
  cursor: not-allowed;
  opacity: .45;
}

.empty {
  display: grid;
  justify-items: center;
  gap: .4rem;
  padding: 3rem 1.5rem;
  color: #8f8798;
  text-align: center;
}

.empty svg {
  font-size: 1.6rem;
}

.empty strong {
  color: #e8e3ee;
}

.empty small {
  font-size: .76rem;
}

.drawer-enter-active,
.drawer-leave-active {
  transition: opacity .2s ease;
}

.drawer-enter-active .drawer,
.drawer-leave-active .drawer {
  transition: transform .22s cubic-bezier(.22, .8, .24, 1);
}

.drawer-enter-from,
.drawer-leave-to {
  opacity: 0;
}

.drawer-enter-from .drawer,
.drawer-leave-to .drawer {
  transform: translateX(100%);
}

@media (prefers-reduced-motion: reduce) {
  .drawer-enter-active,
  .drawer-leave-active,
  .drawer-enter-active .drawer,
  .drawer-leave-active .drawer {
    transition: none;
  }
}
</style>
