<script setup lang="ts">
import { usePostEditor } from '~/composables/usePostEditor'
import { apiErrorMessage } from '~/utils/api-error'
import {
  canPublishPresetAsFeedImage,
  captionLength,
  checkCaption,
  INSTAGRAM_ALT_TEXT_MAX,
  INSTAGRAM_CAPTION_MAX,
  INSTAGRAM_HASHTAG_MAX,
  countHashtags,
} from '~~/shared/social'

const props = defineProps<{ postId: string | null }>()
const open = defineModel<boolean>('open', { required: true })

type AccountInfo = { connected: boolean, canPublish: boolean, username: string | null, accountType: string | null, message: string | null }

const editor = usePostEditor()
const post = computed(() => editor.posts.value.find(item => item.id === props.postId) || null)

const account = ref<AccountInfo | null>(null)
const loadingAccount = ref(false)
const caption = ref('')
const altText = ref('')
const publishing = ref(false)
const error = ref('')
const permalink = ref<string | null>(null)
const done = ref(false)
const closeRef = ref<HTMLButtonElement | null>(null)

const length = computed(() => captionLength(caption.value))
const hashtags = computed(() => countHashtags(caption.value))
const captionCheck = computed(() => checkCaption(caption.value))
const presetBlocked = computed(() => Boolean(post.value) && !canPublishPresetAsFeedImage(post.value!.preset))
const alreadyPublished = computed(() => post.value?.social?.status === 'published')
const canSubmit = computed(() => Boolean(
  post.value && account.value?.canPublish && captionCheck.value.ok && !presetBlocked.value
  && altText.value.length <= INSTAGRAM_ALT_TEXT_MAX && !publishing.value && !done.value,
))

async function loadAccount() {
  loadingAccount.value = true
  try {
    account.value = await $fetch<AccountInfo>('/api/admin/social/account')
  } catch (cause) {
    account.value = { connected: false, canPublish: false, username: null, accountType: null, message: apiErrorMessage(cause, 'De Instagram-koppeling kon niet worden opgehaald.') }
  } finally {
    loadingAccount.value = false
  }
}

async function publish() {
  if (!canSubmit.value || !post.value) return
  publishing.value = true
  error.value = ''
  try {
    const result = await $fetch<{ post: { permalink: string | null } }>('/api/admin/social/posts', {
      method: 'POST',
      body: { generatedPostId: post.value.id, caption: caption.value, altText: altText.value || null },
    })
    permalink.value = result.post.permalink
    done.value = true
  } catch (cause) {
    error.value = apiErrorMessage(cause, 'Publiceren is niet gelukt.')
  } finally {
    publishing.value = false
    // Also after a failure: the export now shows its Mislukt status.
    await editor.refresh()
  }
}

function close() {
  if (publishing.value) return
  open.value = false
}

watch(open, (value) => {
  if (!value) return
  caption.value = ''
  altText.value = ''
  error.value = ''
  permalink.value = null
  done.value = false
  void loadAccount()
  void nextTick(() => closeRef.value?.focus())
})
</script>

<template>
  <Teleport to="body">
    <Transition name="drawer">
      <div v-if="open" class="backdrop" @click.self="close" @keydown.esc="close">
        <aside class="drawer" role="dialog" aria-modal="true" aria-labelledby="post-publish-title">
          <header class="drawer-head">
            <div>
              <h2 id="post-publish-title">Publiceren op Instagram</h2>
              <p>De post wordt direct geplaatst en blijft ook bewaard bij Recente exports.</p>
            </div>
            <button ref="closeRef" type="button" class="icon-button" aria-label="Sluiten" :disabled="publishing" @click="close">
              <Icon name="lucide:x" aria-hidden="true" />
            </button>
          </header>

          <div v-if="done" class="body done" role="status">
            <Icon name="lucide:circle-check" aria-hidden="true" />
            <strong>Gepubliceerd op Instagram</strong>
            <a v-if="permalink" :href="permalink" target="_blank" rel="noopener">Bekijk de post <Icon name="lucide:external-link" aria-hidden="true" /></a>
            <button type="button" class="action primary" @click="open = false">Sluiten</button>
          </div>

          <form v-else class="body" @submit.prevent="publish">
            <p v-if="loadingAccount" class="note">Koppeling controleren…</p>
            <p v-else-if="account && !account.canPublish" class="notice error" role="alert">{{ account.message }}</p>
            <p v-else-if="account?.connected" class="chip">
              <Icon name="lucide:instagram" aria-hidden="true" />
              <span>@{{ account.username }}</span>
              <small>Verbonden</small>
            </p>

            <img v-if="post" class="preview" :src="post.imageUrl" alt="Voorbeeld van de post">

            <p v-if="presetBlocked" class="notice error" role="alert">
              Dit formaat past niet in de Instagram-feed. Exporteer in 1:1 of 4:5; stories volgen in een latere fase.
            </p>
            <p v-else-if="alreadyPublished" class="notice" role="status">
              Deze export is al gepubliceerd. Publiceren plaatst een tweede post.
            </p>

            <label class="field">
              <span class="label-row">
                <span>Bijschrift</span>
                <small :class="{ over: length > INSTAGRAM_CAPTION_MAX }">{{ length.toLocaleString('nl-NL') }} / {{ INSTAGRAM_CAPTION_MAX.toLocaleString('nl-NL') }}</small>
              </span>
              <textarea v-model="caption" rows="7" placeholder="Schrijf een bijschrift" :aria-invalid="!captionCheck.ok" />
              <small class="hint">
                Hashtags worden als gewone tekst in het bijschrift geplaatst
                <template v-if="hashtags">({{ hashtags }} / {{ INSTAGRAM_HASHTAG_MAX }})</template>.
              </small>
              <small v-if="!captionCheck.ok" class="hint error">{{ captionCheck.message }}</small>
            </label>

            <label class="field">
              <span class="label-row">
                <span>Alternatieve tekst</span>
                <small :class="{ over: altText.length > INSTAGRAM_ALT_TEXT_MAX }">{{ altText.length }} / {{ INSTAGRAM_ALT_TEXT_MAX }}</small>
              </span>
              <textarea v-model="altText" rows="2" placeholder="Beschrijf de afbeelding voor mensen die hem niet kunnen zien" />
            </label>

            <p v-if="error" class="notice error" role="alert">{{ error }}</p>

            <footer class="foot">
              <button type="button" class="action" :disabled="publishing" @click="close">Annuleren</button>
              <button type="submit" class="action primary" :disabled="!canSubmit">
                {{ publishing ? 'Publiceren…' : 'Publiceren' }}
              </button>
            </footer>
          </form>
        </aside>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 2100;
  display: flex;
  justify-content: flex-end;
  background: rgba(4, 3, 6, .55);
}

.drawer {
  display: flex;
  flex-direction: column;
  width: min(460px, 100%);
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

.body {
  display: grid;
  align-content: start;
  gap: 1rem;
  padding: 1.2rem;
  overflow: auto;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: .5rem;
  width: fit-content;
  margin: 0;
  padding: .4rem .75rem;
  border: 1px solid #2a2530;
  border-radius: 999px;
  background: #151119;
  font-size: .82rem;
}

.chip small {
  padding: .1rem .45rem;
  border-radius: 999px;
  background: rgba(76, 175, 120, .16);
  color: #8fd6ad;
  font-size: .68rem;
}

.preview {
  width: 6.5rem;
  max-height: 8.5rem;
  border-radius: .5rem;
  object-fit: contain;
  background: #08070a;
}

.field {
  display: grid;
  gap: .4rem;
  font-size: .82rem;
}

.label-row {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
}

.label-row small,
.hint {
  color: #8f8798;
  font-size: .72rem;
}

.label-row small.over,
.hint.error {
  color: #f0a3b0;
}

textarea {
  width: 100%;
  padding: .65rem .75rem;
  border: 1px solid #2a2530;
  border-radius: .6rem;
  background: #151119;
  color: inherit;
  font: inherit;
  resize: vertical;
}

textarea:focus-visible {
  outline: 2px solid #a78bfa;
  outline-offset: 1px;
}

.note {
  margin: 0;
  color: #8f8798;
  font-size: .8rem;
}

.notice {
  margin: 0;
  padding: .65rem .8rem;
  border: 1px solid #2a2530;
  border-radius: .6rem;
  background: #151119;
  font-size: .78rem;
  line-height: 1.45;
}

.notice.error {
  border-color: #6b2a36;
  color: #f0b7c1;
}

.foot {
  display: flex;
  justify-content: flex-end;
  gap: .5rem;
  padding-top: .5rem;
}

.action {
  display: inline-flex;
  align-items: center;
  gap: .35rem;
  padding: .55rem 1rem;
  border: 1px solid #2a2530;
  border-radius: .6rem;
  background: #151119;
  color: #d9d2e1;
  font-size: .82rem;
  cursor: pointer;
}

.action.primary {
  border-color: #7c5cd6;
  background: #7c5cd6;
  color: #fff;
}

.action:disabled {
  cursor: not-allowed;
  opacity: .5;
}

.done {
  justify-items: center;
  padding-top: 3rem;
  text-align: center;
}

.done svg:first-child {
  color: #8fd6ad;
  font-size: 2rem;
}

.done a {
  color: #c4b5fd;
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
