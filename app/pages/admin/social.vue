<script setup lang="ts">
import { apiErrorMessage } from '~/utils/api-error'
import {
  amsterdamLocalToIso,
  isoToAmsterdamLocal,
  socialPostActions,
  socialProviderLabels,
  socialTabLabels,
  socialTabs,
  type SocialPostItem,
  type SocialTab,
} from '~~/shared/social'

definePageMeta({ layout: 'admin' })
useSeoMeta({ title: 'Social — DJ NightLight', robots: 'noindex, nofollow' })

type Overview = {
  posts: SocialPostItem[]
  counts: Record<SocialTab, number>
  stats: { scheduled: number, publishedThisWeek: number, failed: number }
  account: { username: string, accountType: string | null } | null
}

const route = useRoute()
const router = useRouter()
const tab = computed<SocialTab>(() => (socialTabs.includes(route.query.tab as SocialTab) ? route.query.tab as SocialTab : 'queue'))

const { data, refresh, pending, error: loadError } = await useFetch<Overview>('/api/admin/social/posts', {
  query: computed(() => ({ tab: tab.value })),
  watch: [tab],
})

const posts = computed(() => data.value?.posts ?? [])
const counts = computed(() => data.value?.counts ?? { queue: 0, history: 0, failed: 0 })
const stats = computed(() => data.value?.stats ?? { scheduled: 0, publishedThisWeek: 0, failed: 0 })

const busy = ref<string | null>(null)
const message = ref('')
const messageIsError = ref(false)
const confirmAction = useConfirm()

function setTab(next: SocialTab) {
  void router.replace({ query: next === 'queue' ? {} : { tab: next } })
}

const momentFormatter = new Intl.DateTimeFormat('nl-NL', { timeZone: 'Europe/Amsterdam', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
function moment(post: SocialPostItem) {
  const value = post.status === 'published' ? post.publishedAt : post.scheduledAt
  return value ? momentFormatter.format(new Date(value)) : 'Nog niet gepland'
}

function notify(text: string, isError = false) {
  message.value = text
  messageIsError.value = isError
}

async function run(post: SocialPostItem, action: () => Promise<unknown>, done: string, failed: string) {
  busy.value = post.id
  notify('')
  try {
    await action()
    notify(done)
  } catch (cause) {
    notify(apiErrorMessage(cause, failed), true)
  } finally {
    busy.value = null
    await refresh()
  }
}

const retry = (post: SocialPostItem) => run(post,
  () => $fetch(`/api/admin/social/posts/${post.id}/retry`, { method: 'POST' }),
  'De post staat opnieuw in de wachtrij en wordt binnen een minuut gepubliceerd.', 'Opnieuw proberen is niet gelukt.')

async function cancel(post: SocialPostItem) {
  const ok = await confirmAction({
    title: post.status === 'failed' ? 'Mislukte post annuleren?' : 'Post annuleren?',
    body: 'De post wordt niet gepubliceerd. De export blijft bewaard in de Foto editor.',
    confirmLabel: 'Post annuleren',
    tone: 'danger',
  })
  if (!ok) return
  await run(post, () => $fetch(`/api/admin/social/posts/${post.id}/cancel`, { method: 'POST' }), 'Post geannuleerd.', 'Annuleren is niet gelukt.')
}

// Editing a concept or planned post.
const editing = ref<SocialPostItem | null>(null)
const form = reactive({ caption: '', altText: '', when: '' })
const saving = ref(false)
const formError = ref('')

function startEdit(post: SocialPostItem) {
  editing.value = post
  form.caption = post.caption
  form.altText = post.altText ?? ''
  form.when = post.scheduledAt ? isoToAmsterdamLocal(post.scheduledAt) : ''
  formError.value = ''
}

async function save(action: 'schedule' | 'draft') {
  const post = editing.value
  if (!post) return
  saving.value = true
  formError.value = ''
  try {
    await $fetch(`/api/admin/social/posts/${post.id}`, {
      method: 'PATCH',
      body: {
        caption: form.caption,
        altText: form.altText || null,
        scheduledAt: form.when ? amsterdamLocalToIso(form.when) : null,
        action,
      },
    })
    editing.value = null
    notify(action === 'schedule' ? 'Post ingepland.' : 'Concept opgeslagen.')
    await refresh()
  } catch (cause) {
    formError.value = apiErrorMessage(cause, 'Opslaan is niet gelukt.')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="social-page">
    <header class="page-header">
      <div>
        <p class="eyebrow">Content</p>
        <h1>Social</h1>
        <p class="intro">Wat er de deur uit gaat: geplande posts, wat al live staat en wat opnieuw moet.</p>
      </div>
      <div class="header-actions">
        <button class="quiet-button" type="button" :disabled="pending" @click="refresh()">
          <Icon name="lucide:refresh-cw" aria-hidden="true" /> Vernieuwen
        </button>
        <NuxtLink class="primary-button" to="/admin/post-generator">
          <Icon name="lucide:plus" aria-hidden="true" /> Nieuwe post
        </NuxtLink>
      </div>
    </header>

    <section class="stats" aria-label="Overzicht">
      <article><p>Gepland</p><strong>{{ stats.scheduled }}</strong></article>
      <article><p>Deze week gepubliceerd</p><strong>{{ stats.publishedThisWeek }}</strong></article>
      <article :class="{ alert: stats.failed }"><p>Mislukt</p><strong>{{ stats.failed }}</strong></article>
      <article>
        <p>Instagram</p>
        <strong v-if="data?.account" class="account">@{{ data.account.username }}</strong>
        <NuxtLink v-else class="account-link" to="/admin/settings#integrations">Niet gekoppeld</NuxtLink>
      </article>
    </section>

    <div class="tabs" role="tablist" aria-label="Social posts">
      <button
        v-for="item in socialTabs"
        :key="item"
        type="button"
        role="tab"
        :aria-selected="tab === item"
        :class="{ active: tab === item }"
        @click="setTab(item)"
      >
        {{ socialTabLabels[item] }}
        <span v-if="item === 'failed' && counts.failed" class="badge" :aria-label="`${counts.failed} mislukt`">{{ counts.failed }}</span>
      </button>
    </div>

    <p v-if="message" class="message" :class="{ error: messageIsError }" role="status">{{ message }}</p>
    <p v-if="loadError" class="message error" role="alert">{{ apiErrorMessage(loadError, 'De posts konden niet worden geladen.') }}</p>

    <div class="table-wrap">
      <table v-if="posts.length">
        <thead>
          <tr>
            <th scope="col">Post</th>
            <th scope="col">Account</th>
            <th scope="col">Moment</th>
            <th scope="col">Status</th>
            <th scope="col"><span class="sr-only">Acties</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="post in posts" :key="post.id">
            <td>
              <div class="post-cell">
                <img v-if="post.thumbnailUrl" :src="post.thumbnailUrl" alt="" loading="lazy">
                <div>
                  <strong>{{ post.title }}</strong>
                  <small>Afbeelding<template v-if="post.templateKey"> · {{ post.templateKey }}</template></small>
                </div>
              </div>
            </td>
            <td>
              <Icon :name="post.provider === 'facebook' ? 'lucide:facebook' : 'lucide:instagram'" aria-hidden="true" />
              {{ socialProviderLabels[post.provider] ?? post.provider }}
              <small class="muted">{{ post.accountName }}</small>
            </td>
            <td>{{ moment(post) }}</td>
            <td>
              <SocialStatusChip :status="post.status" />
              <p v-if="post.status === 'failed' && post.lastError" class="error-text">{{ post.lastError }}</p>
              <p v-else-if="post.status === 'scheduled' && post.retryCount" class="note-text">
                Poging {{ post.retryCount + 1 }}: {{ post.lastError }}
              </p>
              <p v-else-if="post.status === 'scheduled' && post.lastError" class="note-text">{{ post.lastError }}</p>
            </td>
            <td class="actions">
              <a v-if="post.permalink" :href="post.permalink" target="_blank" rel="noopener" class="link-button">Bekijk <Icon name="lucide:external-link" aria-hidden="true" /></a>
              <button v-if="socialPostActions(post.status).retry" type="button" class="small-button" :disabled="busy === post.id" @click="retry(post)">Opnieuw</button>
              <button v-if="socialPostActions(post.status).edit" type="button" class="small-button" :disabled="busy === post.id" @click="startEdit(post)">{{ post.status === 'draft' ? 'Inplannen' : 'Aanpassen' }}</button>
              <button v-if="socialPostActions(post.status).cancel" type="button" class="small-button danger" :disabled="busy === post.id" @click="cancel(post)">Annuleren</button>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-else-if="!pending" class="empty">
        <template v-if="tab === 'queue'">Niets gepland. Maak een post in de Foto editor en kies Inplannen.</template>
        <template v-else-if="tab === 'history'">Nog geen gepubliceerde posts.</template>
        <template v-else>Geen mislukte posts.</template>
      </p>
    </div>

    <Teleport to="body">
      <div v-if="editing" class="backdrop" @click.self="editing = null" @keydown.esc="editing = null">
        <aside class="panel" role="dialog" aria-modal="true" aria-labelledby="social-edit-title">
          <header>
            <h2 id="social-edit-title">{{ editing.title }}</h2>
            <button type="button" class="icon-button" aria-label="Sluiten" @click="editing = null"><Icon name="lucide:x" aria-hidden="true" /></button>
          </header>
          <label class="field">
            <span>Bijschrift</span>
            <textarea v-model="form.caption" rows="7" />
          </label>
          <label class="field">
            <span>Alternatieve tekst</span>
            <textarea v-model="form.altText" rows="2" />
          </label>
          <label class="field">
            <span>Datum en tijd <small>(Europe/Amsterdam)</small></span>
            <input v-model="form.when" type="datetime-local">
          </label>
          <p v-if="formError" class="message error" role="alert">{{ formError }}</p>
          <footer>
            <button type="button" class="quiet-button" :disabled="saving" @click="editing = null">Sluiten</button>
            <button type="button" class="quiet-button" :disabled="saving" @click="save('draft')">Opslaan als concept</button>
            <button type="button" class="primary-button" :disabled="saving || !form.when" @click="save('schedule')">Inplannen</button>
          </footer>
        </aside>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.social-page { max-width: 1300px; margin: 0 auto; }
.page-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 1.5rem; margin-bottom: 1.5rem; }
.eyebrow { margin: 0 0 .6rem; color: #c9b2df; font-size: .72rem; font-weight: 800; letter-spacing: .22em; text-transform: uppercase; }
h1 { margin: 0; font-size: clamp(3rem, 6vw, 5.2rem); line-height: .95; letter-spacing: -.04em; }
.intro { margin: 1rem 0 0; color: #9890a1; }
.header-actions { display: flex; gap: .6rem; }
button, input, textarea { font: inherit; color: inherit; }
.quiet-button, .small-button, .icon-button, .primary-button { display: inline-flex; align-items: center; justify-content: center; gap: .4rem; border: 1px solid #312b38; border-radius: .65rem; background: #151219; cursor: pointer; text-decoration: none; }
.quiet-button, .primary-button { padding: .6rem .9rem; font-size: .85rem; }
.primary-button { border-color: #7c5cd6; background: #7c5cd6; color: #fff; }
.small-button { padding: .35rem .65rem; font-size: .76rem; }
.small-button.danger { color: #f0a3b0; }
.icon-button { width: 2.2rem; height: 2.2rem; padding: 0; }
button:disabled { cursor: not-allowed; opacity: .5; }
.stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: .9rem; margin-bottom: 1.5rem; }
.stats article { display: grid; gap: .5rem; padding: 1.1rem 1.2rem; border: 1px solid #292530; border-radius: 1rem; background: var(--surface-card); }
.stats p { margin: 0; color: #9d97a6; font-size: .8rem; }
.stats strong { font-size: 2rem; letter-spacing: -.03em; }
.stats strong.account { font-size: 1.15rem; letter-spacing: 0; }
.stats .alert strong { color: #f0a3b0; }
.account-link { color: #c4b5fd; font-size: .9rem; }
.tabs { display: flex; gap: .3rem; margin-bottom: 1rem; border-bottom: 1px solid #292530; }
.tabs button { display: inline-flex; align-items: center; gap: .45rem; padding: .7rem 1rem; border: 0; border-bottom: 2px solid transparent; background: none; color: #9d97a6; cursor: pointer; }
.tabs button.active { border-bottom-color: #a78bfa; color: #fff; }
.badge { min-width: 1.3rem; padding: .05rem .4rem; border-radius: 999px; background: #6b2a36; color: #fff; font-size: .7rem; text-align: center; }
.message { margin: 0 0 1rem; padding: .7rem .9rem; border: 1px solid #312b38; border-radius: .7rem; background: #151219; font-size: .85rem; }
.message.error { border-color: #6b2a36; color: #f0b7c1; }
.table-wrap { overflow-x: auto; border: 1px solid #292530; border-radius: 1rem; background: #0f0d12; }
table { width: 100%; border-collapse: collapse; font-size: .85rem; }
th { padding: .8rem 1rem; color: #8f8798; font-size: .72rem; font-weight: 600; letter-spacing: .08em; text-align: left; text-transform: uppercase; }
td { padding: .8rem 1rem; border-top: 1px solid #1f1b24; vertical-align: top; }
.post-cell { display: flex; align-items: center; gap: .8rem; min-width: 14rem; }
.post-cell img { width: 3rem; height: 3rem; border-radius: .5rem; object-fit: cover; background: #08070a; }
.post-cell small, .muted { display: block; color: #8f8798; font-size: .74rem; }
.error-text { max-width: 24rem; margin: .4rem 0 0; color: #f0a3b0; font-size: .76rem; line-height: 1.4; }
.note-text { max-width: 24rem; margin: .4rem 0 0; color: #9d97a6; font-size: .76rem; line-height: 1.4; }
.actions { display: flex; flex-wrap: wrap; gap: .4rem; justify-content: flex-end; }
.link-button { align-self: center; color: #c4b5fd; font-size: .78rem; }
.empty { margin: 0; padding: 2.5rem 1rem; color: #8f8798; text-align: center; }
.backdrop { position: fixed; inset: 0; z-index: 2100; display: flex; justify-content: flex-end; background: rgba(4, 3, 6, .55); }
.panel { display: flex; flex-direction: column; gap: 1rem; width: min(460px, 100%); height: 100%; padding: 1.2rem; overflow: auto; border-left: 1px solid #2a2530; background: #0f0d13; }
.panel header { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
.panel h2 { margin: 0; font-size: 1.1rem; }
.panel footer { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: .5rem; margin-top: auto; }
.field { display: grid; gap: .4rem; font-size: .82rem; }
.field small { color: #8f8798; }
textarea, input[type="datetime-local"] { width: 100%; padding: .6rem .75rem; border: 1px solid #2a2530; border-radius: .6rem; background: #151119; color-scheme: dark; resize: vertical; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
@media (max-width: 720px) {
  .page-header { flex-direction: column; }
}
</style>
