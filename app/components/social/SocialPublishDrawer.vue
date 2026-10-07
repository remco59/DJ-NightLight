<script setup lang="ts">
import { apiErrorMessage } from '~/utils/api-error'
import {
  amsterdamLocalToIso,
  canPublishPresetAsFeedImage,
  canPublishPresetAsStory,
  checkCarouselPresets,
  checkScheduleMoment,
  checkVideoForKind,
  formatDuration,
  socialPostKindLabels,
  type SocialPublishImage,
  type SocialPublishVideo,
  type SocialPostKindKey,
  isoToAmsterdamLocal,
  captionLength,
  checkCaption,
  INSTAGRAM_ALT_TEXT_MAX,
  INSTAGRAM_CAPTION_MAX,
  INSTAGRAM_HASHTAG_MAX,
  countHashtags,
  socialProviderLabels,
} from '~~/shared/social'

const props = defineProps<{ images: SocialPublishImage[], video?: SocialPublishVideo | null }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ published: [] }>()

type FacebookInfo = { connected: boolean, canPublish: boolean, name: string | null, message: string | null, tokenExpiresAt?: string | null }
type AccountInfo = { tokenExpiresAt?: string | null, connected: boolean, canPublish: boolean, username: string | null, accountType: string | null, message: string | null, facebook: FacebookInfo }
type PublishedPost = { status: string, permalink: string | null, lastError: string | null, provider: string }

// A video is a reel (also in the feed) or a story; images are a single post, a story (9:16) or a carousel.
const videoKind = ref<'reel' | 'story'>('reel')
const kind = computed<SocialPostKindKey>(() => {
  if (props.video) return videoKind.value
  if (props.images.length > 1) return 'carousel'
  return props.images[0] && canPublishPresetAsStory(props.images[0].preset) ? 'story' : 'image'
})
const isImage = computed(() => kind.value === 'image')
const hasCaption = computed(() => kind.value !== 'story')
const hasMedia = computed(() => Boolean(props.video) || props.images.length > 0)
/** What makes this media unsuitable for the chosen kind, or null. */
const mediaProblem = computed(() => {
  if (props.video) {
    const check = checkVideoForKind(videoKind.value, props.video)
    return check.ok ? null : check.message
  }
  if (props.images.length > 1) {
    const check = checkCarouselPresets(props.images.map(image => image.preset))
    return check.ok ? null : check.message
  }
  const first = props.images[0]
  if (first && !canPublishPresetAsFeedImage(first.preset) && !canPublishPresetAsStory(first.preset)) return 'Dit formaat past niet op Instagram. Exporteer in 1:1, 4:5 of 9:16.'
  return null
})
const showSlides = computed(() => props.images.slice(0, 10))

const account = ref<AccountInfo | null>(null)
const loadingAccount = ref(false)
const caption = ref('')
const altText = ref('')
const publishing = ref(false)
const error = ref('')
const toInstagram = ref(true)
const toFacebook = ref(false)
const results = ref<Array<{ platform: string, status: string, permalink: string | null, error: string | null }>>([])
const done = ref(false)
type Mode = 'now' | 'schedule'
const mode = ref<Mode>('now')
const whenLocal = ref('')
const savedAs = ref<'now' | 'schedule' | 'draft'>('now')
const closeRef = ref<HTMLButtonElement | null>(null)

const whenLabel = computed(() => (scheduledIso.value
  ? new Intl.DateTimeFormat('nl-NL', { timeZone: 'Europe/Amsterdam', dateStyle: 'long', timeStyle: 'short' }).format(new Date(scheduledIso.value))
  : ''))
const length = computed(() => captionLength(caption.value))
const hashtags = computed(() => countHashtags(caption.value))
const captionCheck = computed(() => checkCaption(caption.value))
const publishedOn = (provider: string) => props.images.some(image => image.social?.some(badge => badge.provider === provider && badge.status === 'published'))
const scheduledIso = computed(() => (whenLocal.value ? amsterdamLocalToIso(whenLocal.value) : null))
const scheduleCheck = computed(() => checkScheduleMoment(scheduledIso.value, new Date(), earliestExpiry.value))
// The post can only go out while the Meta access is valid.
const earliestExpiry = computed(() => {
  const dates = [toInstagram.value && account.value?.tokenExpiresAt, toFacebook.value && account.value?.facebook.tokenExpiresAt]
    .filter((value): value is string => typeof value === 'string').map(value => new Date(value))
  return dates.length ? new Date(Math.min(...dates.map(date => date.getTime()))) : null
})
const baseReady = computed(() => Boolean(
  hasMedia.value && (toInstagram.value || toFacebook.value) && !mediaProblem.value
  && (!toInstagram.value || account.value?.canPublish) && (!toFacebook.value || account.value?.facebook.canPublish) && captionCheck.value.ok
  && altText.value.length <= INSTAGRAM_ALT_TEXT_MAX && !publishing.value && !done.value,
))
const canSubmit = computed(() => baseReady.value && (mode.value === 'now' || scheduleCheck.value.ok))
const canDraft = computed(() => baseReady.value)

async function loadAccount() {
  loadingAccount.value = true
  try {
    account.value = await $fetch<AccountInfo>('/api/admin/social/account')
    toInstagram.value = account.value.canPublish
  } catch (cause) {
    account.value = { facebook: { connected: false, canPublish: false, name: null, message: null }, connected: false, canPublish: false, username: null, accountType: null, message: apiErrorMessage(cause, 'De Instagram-koppeling kon niet worden opgehaald.') }
  } finally {
    loadingAccount.value = false
  }
}

async function publish(submitKind: 'submit' | 'draft' = 'submit') {
  if (submitKind === 'draft' ? !canDraft.value : !canSubmit.value) return
  const requested = submitKind === 'draft' ? 'draft' : mode.value
  savedAs.value = requested
  publishing.value = true
  error.value = ''
  try {
    const result = await $fetch<{ posts: PublishedPost[] }>('/api/admin/social/posts', {
      method: 'POST',
      body: {
        kind: kind.value,
        generatedPostIds: props.video ? [] : props.images.map(image => image.id),
        videoRenderJobId: props.video?.id ?? null,
        caption: hasCaption.value ? caption.value : '',
        altText: isImage.value ? (altText.value || null) : null,
        platforms: [toInstagram.value && 'instagram', toFacebook.value && 'facebook'].filter(Boolean),
        mode: requested,
        scheduledAt: requested === 'now' ? null : scheduledIso.value,
      },
    })
    results.value = result.posts.map(item => ({
      platform: item.provider,
      status: item.status,
      permalink: item.permalink,
      error: item.lastError,
    }))
    done.value = true
  } catch (cause) {
    error.value = apiErrorMessage(cause, 'Publiceren is niet gelukt.')
  } finally {
    publishing.value = false
    // Also after a failure: the export now shows its Mislukt status.
    emit('published')
  }
}

/** Tomorrow 18:00 in Amsterdam, a sensible default for a planned post. */
function defaultWhen() {
  const tomorrow = isoToAmsterdamLocal(new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString())
  return `${tomorrow.slice(0, 10)}T18:00`
}

function close() {
  if (publishing.value) return
  open.value = false
}

// Facebook only takes single images in NightLight.
watch(kind, (value) => {
  if (value !== 'image') toFacebook.value = false
})

watch(open, (value) => {
  if (!value) return
  caption.value = ''
  altText.value = ''
  mode.value = 'now'
  whenLocal.value = defaultWhen()
  savedAs.value = 'now'
  error.value = ''
  results.value = []
  toInstagram.value = true
  toFacebook.value = false
  videoKind.value = 'reel'
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
              <h2 id="post-publish-title">{{ kind === 'image' ? 'Publiceren op Instagram en Facebook' : `${socialPostKindLabels[kind]} publiceren op Instagram` }}</h2>
              <p>Plaats de post nu of plan hem in. De export blijft ook bewaard{{ video ? ' bij de renders' : ' bij Recente exports' }}.</p>
            </div>
            <button ref="closeRef" type="button" class="icon-button" aria-label="Sluiten" :disabled="publishing" @click="close">
              <Icon name="lucide:x" aria-hidden="true" />
            </button>
          </header>

          <div v-if="done" class="body done" role="status">
            <Icon name="lucide:circle-check" aria-hidden="true" />
            <strong v-if="savedAs === 'schedule'">Ingepland</strong>
            <strong v-else-if="savedAs === 'draft'">Opgeslagen als concept</strong>
            <strong v-else-if="results.every(item => item.status === 'scheduled')">In de wachtrij</strong>
            <strong v-else>{{ results.every(item => item.status === 'published') ? 'Gepubliceerd' : 'Deels gepubliceerd' }}</strong>
            <ul class="results">
              <li v-for="item in results" :key="item.platform" :class="{ failed: item.status === 'failed' }">
                <span>{{ socialProviderLabels[item.platform] }}:</span>
                <template v-if="item.status === 'scheduled' && savedAs === 'now'">in de wachtrij, wordt binnen enkele minuten geplaatst. Volg de status bij Social.</template>
                <template v-else-if="item.status === 'scheduled'">gepland voor {{ whenLabel }}</template>
                <template v-else-if="item.status === 'draft'">concept bewaard</template>
                <a v-else-if="item.status === 'published' && item.permalink" :href="item.permalink" target="_blank" rel="noopener">Bekijk de post <Icon name="lucide:external-link" aria-hidden="true" /></a>
                <template v-else-if="item.status === 'published'">gepubliceerd</template>
                <template v-else>mislukt{{ item.error ? ` (${item.error})` : '' }}. Gebruik Opnieuw bij Recente exports.</template>
              </li>
            </ul>
            <NuxtLink v-if="savedAs !== 'now' || results.some(item => item.status === 'scheduled')" class="action" to="/admin/social" @click="open = false">Open Social</NuxtLink>
            <button type="button" class="action primary" @click="open = false">Sluiten</button>
          </div>

          <form v-else class="body" @submit.prevent="publish('submit')">
            <p v-if="loadingAccount" class="note">Koppeling controleren…</p>
            <p v-else-if="account && !account.canPublish" class="notice error" role="alert">{{ account.message }}</p>

            <div v-if="video" class="preview-video">
              <video :src="video.videoUrl" controls preload="metadata" muted playsinline aria-label="Voorbeeld van de video" />
              <small>{{ video.title || 'Video' }} · {{ video.width }}×{{ video.height }} · {{ formatDuration(video.durationSeconds) }}</small>
            </div>
            <ol v-else-if="images.length" class="slides" :aria-label="`${images.length} afbeelding${images.length === 1 ? '' : 'en'}`">
              <li v-for="(image, index) in showSlides" :key="image.id">
                <img class="preview" :src="image.imageUrl" :alt="images.length > 1 ? `Afbeelding ${index + 1} van ${images.length}` : 'Voorbeeld van de post'">
                <small v-if="images.length > 1">{{ index + 1 }}</small>
              </li>
            </ol>

            <fieldset v-if="video" class="mode" aria-label="Soort post">
              <label :class="{ active: videoKind === 'reel' }"><input v-model="videoKind" type="radio" value="reel"> Reel</label>
              <label :class="{ active: videoKind === 'story' }"><input v-model="videoKind" type="radio" value="story"> Story</label>
            </fieldset>
            <p v-else class="kind-chip">{{ socialPostKindLabels[kind] }}<template v-if="kind === 'carousel'"> · {{ images.length }} afbeeldingen</template></p>
            <p v-if="kind === 'story'" class="note">Een story verdwijnt na 24 uur en heeft geen bijschrift.</p>
            <p v-if="video && kind === 'reel'" class="note">Een reel staat ook in de feed. Meta verwerkt de video eerst, dus de post staat binnen enkele minuten online.</p>
            <p v-else-if="video" class="note">Meta verwerkt de video eerst, dus de story staat binnen enkele minuten online.</p>

            <p v-if="mediaProblem" class="notice error" role="alert">{{ mediaProblem }}</p>
            <p v-else-if="(toInstagram && publishedOn('instagram')) || (toFacebook && publishedOn('facebook'))" class="notice" role="status">
              Deze export staat al op een van de gekozen platforms. Publiceren plaatst daar een tweede post.
            </p>

            <fieldset v-if="account?.connected" class="targets">
              <legend>Publiceren op</legend>
              <label class="check" :class="{ disabled: !account.canPublish }">
                <input v-model="toInstagram" type="checkbox" :disabled="!account.canPublish">
                <span>Instagram <strong v-if="account.username">@{{ account.username }}</strong></span>
              </label>
              <label v-if="account.facebook.connected" class="check" :class="{ disabled: !account.facebook.canPublish || !isImage }">
                <input v-model="toFacebook" type="checkbox" :disabled="!account.facebook.canPublish || !isImage">
                <span>Facebook-pagina <strong v-if="account.facebook.name">{{ account.facebook.name }}</strong><small v-if="!isImage"> (alleen afbeeldingen)</small></span>
              </label>
            </fieldset>
            <p v-if="account?.facebook.connected && account.facebook.message" class="note">{{ account.facebook.message }}</p>

            <fieldset class="mode" aria-label="Wanneer publiceren">
              <label :class="{ active: mode === 'now' }"><input v-model="mode" type="radio" value="now"> Nu publiceren</label>
              <label :class="{ active: mode === 'schedule' }"><input v-model="mode" type="radio" value="schedule"> Inplannen</label>
            </fieldset>
            <label v-if="mode === 'schedule'" class="field">
              <span class="label-row"><span>Datum en tijd</span><small>Europe/Amsterdam</small></span>
              <input v-model="whenLocal" type="datetime-local" class="when" :aria-invalid="!scheduleCheck.ok">
              <small v-if="!scheduleCheck.ok" class="hint error">{{ scheduleCheck.message }}</small>
              <small v-else class="hint">NightLight plaatst de post op dit moment. Meta kent geen eigen planning, dus de server moet dan draaien.</small>
            </label>

            <label v-if="hasCaption" class="field">
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

            <label v-if="isImage" class="field">
              <span class="label-row">
                <span>Alternatieve tekst</span>
                <small :class="{ over: altText.length > INSTAGRAM_ALT_TEXT_MAX }">{{ altText.length }} / {{ INSTAGRAM_ALT_TEXT_MAX }}</small>
              </span>
              <textarea v-model="altText" rows="2" placeholder="Beschrijf de afbeelding voor mensen die hem niet kunnen zien" />
            </label>

            <p v-if="error" class="notice error" role="alert">{{ error }}</p>

            <footer class="foot">
              <button type="button" class="action" :disabled="publishing" @click="close">Annuleren</button>
              <button type="button" class="action" :disabled="!canDraft" @click="publish('draft')">Opslaan als concept</button>
              <button type="submit" class="action primary" :disabled="!canSubmit">
                {{ publishing ? 'Bezig…' : mode === 'schedule' ? 'Inplannen' : 'Publiceren' }}
              </button>
            </footer>
          </form>
        </aside>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.preview-video {
  display: grid;
  gap: .4rem;
}

.preview-video video {
  width: 8rem;
  max-height: 14rem;
  border-radius: .5rem;
  background: #08070a;
}

.preview-video small,
.slides small {
  color: #8f8798;
  font-size: .72rem;
}

.slides {
  display: flex;
  flex-wrap: wrap;
  gap: .5rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.slides li {
  display: grid;
  justify-items: center;
  gap: .2rem;
}

.kind-chip {
  justify-self: start;
  margin: 0;
  padding: .2rem .6rem;
  border: 1px solid #3a3045;
  border-radius: 999px;
  background: #151119;
  color: #d4ced9;
  font-size: .75rem;
}

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

.mode {
  display: flex;
  gap: .4rem;
  margin: 0;
  padding: .25rem;
  border: 1px solid #2a2530;
  border-radius: .7rem;
  background: #151119;
}

.mode label {
  flex: 1;
  padding: .45rem .6rem;
  border-radius: .5rem;
  font-size: .82rem;
  text-align: center;
  cursor: pointer;
}

.mode label.active {
  background: #7c5cd6;
  color: #fff;
}

.mode input {
  position: absolute;
  opacity: 0;
}

.mode label:has(input:focus-visible) {
  outline: 2px solid #a78bfa;
  outline-offset: 1px;
}

.when {
  padding: .55rem .7rem;
  border: 1px solid #2a2530;
  border-radius: .6rem;
  background: #151119;
  color: inherit;
  font: inherit;
  color-scheme: dark;
}

textarea:focus-visible,
.when:focus-visible {
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

.targets {
  display: grid;
  gap: .5rem;
  margin: 0;
  padding: 0;
  border: 0;
}

.targets legend {
  margin-bottom: .4rem;
  font-size: .82rem;
}

.check {
  display: flex;
  align-items: center;
  gap: .6rem;
  font-size: .82rem;
  cursor: pointer;
}

.check.disabled {
  cursor: not-allowed;
  opacity: .6;
}

.results {
  display: grid;
  gap: .4rem;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: .82rem;
}

.results .failed {
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
