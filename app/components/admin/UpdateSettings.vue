<script setup lang="ts">
import { apiErrorMessage } from '~/utils/api-error'
import {
  UPDATE_BUSY_PHASES,
  type SystemUpdateStatus,
  type UpdateCheck,
  type UpdateCommit,
} from '~~/shared/system-update'

const { data, refresh } = await useFetch<SystemUpdateStatus>('/api/admin/system/update')

const checking = ref(false)
const starting = ref(false)
const check = ref<UpdateCheck | null>(null)
const message = ref('')
const messageType = ref<'success' | 'error' | ''>('')

watchEffect(() => {
  if (data.value?.lastCheck && !check.value) check.value = data.value.lastCheck
})

const state = computed(() => data.value?.state ?? null)
const busy = computed(() => Boolean(state.value && UPDATE_BUSY_PHASES.includes(state.value.phase)))
const current = computed(() => check.value?.current ?? data.value?.current ?? null)
const latest = computed(() => check.value?.latest ?? null)
const visibleCommits = computed(() => check.value?.commits.slice(0, 3) ?? [])
const hiddenCommitCount = computed(() => Math.max(0, (check.value?.commits.length ?? 0) - visibleCommits.value.length))
const lastRun = computed(() => {
  const run = state.value
  if (!run?.finishedAt || (run.phase !== 'succeeded' && run.phase !== 'failed')) return null
  return run
})

function formatDate(value: string | null | undefined) {
  if (!value) return ''
  return new Date(value).toLocaleString('nl-NL', { dateStyle: 'medium', timeStyle: 'short' })
}

function formatShortDate(value: string | null | undefined) {
  if (!value) return ''
  return new Date(value).toLocaleString('nl-NL', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// While an update is preparing, poll: once the updater switches the site to
// maintenance this request answers 503 and the maintenance plugin reloads the
// page onto the maintenance screen.
let pollTimer: ReturnType<typeof setTimeout> | undefined
function schedulePoll() {
  clearTimeout(pollTimer)
  if (!busy.value) return
  pollTimer = setTimeout(async () => {
    await refresh()
    schedulePoll()
  }, 2000)
}
watch(busy, schedulePoll, { immediate: true })
onBeforeUnmount(() => clearTimeout(pollTimer))

async function checkForUpdates() {
  checking.value = true
  message.value = ''
  messageType.value = ''
  try {
    check.value = await $fetch<UpdateCheck>('/api/admin/system/update/check', { method: 'POST' })
    message.value = check.value.updateAvailable
      ? `${check.value.behind} nieuwe ${check.value.behind === 1 ? 'wijziging' : 'wijzigingen'} beschikbaar.`
      : 'NightLight is up-to-date.'
    messageType.value = 'success'
  } catch (error: unknown) {
    message.value = apiErrorMessage(error, 'Controleren op updates is niet gelukt.')
    messageType.value = 'error'
  } finally {
    checking.value = false
  }
}

async function startUpdate() {
  if (!window.confirm('Tijdens het bijwerken toont de hele website een onderhoudspagina. Dit duurt meestal een paar minuten. Nu bijwerken?')) return
  starting.value = true
  message.value = ''
  messageType.value = ''
  try {
    await $fetch('/api/admin/system/update', { method: 'POST' })
    await refresh()
  } catch (error: unknown) {
    message.value = apiErrorMessage(error, 'Bijwerken starten is niet gelukt.')
    messageType.value = 'error'
  } finally {
    starting.value = false
  }
}
</script>

<template>
  <section id="updates" class="card updates">
    <div class="head">
      <div>
        <p class="eyebrow">Onderhoud</p>
        <h2>Software-updates</h2>
        <p>Controleer GitHub op een nieuwe versie van NightLight en werk de server in één keer bij. Tijdens het opnieuw bouwen toont de website een onderhoudspagina.</p>
      </div>
    </div>

    <p v-if="!data?.available" class="notice">
      Updates vanuit de instellingen zijn alleen beschikbaar op de server-installatie (Unraid) met de updater-container en een ingestelde <code>UPDATER_TOKEN</code>.
    </p>
    <p v-else-if="!data.configured" class="notice error">
      {{ data.configError || 'De updater is niet volledig ingesteld.' }}
    </p>

    <template v-else>
      <div v-if="check?.updateAvailable" class="update-hero">
        <span class="hero-icon" aria-hidden="true">↓</span>
        <div>
          <h3>Software-update beschikbaar</h3>
          <p>Er staat een nieuwere versie van NightLight klaar.</p>
          <div class="version-route" aria-label="Versie-update">
            <code>{{ current?.shortSha || 'Onbekend' }}</code>
            <span aria-hidden="true">→</span>
            <code class="latest">{{ latest?.shortSha || 'Onbekend' }}</code>
          </div>
          <small v-if="latest">Nieuwste versie van {{ formatShortDate(latest.date) }}</small>
        </div>
      </div>

      <div v-else-if="check" class="update-hero up-to-date">
        <span class="hero-icon" aria-hidden="true">✓</span>
        <div>
          <h3>NightLight is up-to-date</h3>
          <p>Je draait de nieuwste beschikbare versie.</p>
          <small v-if="current">Gecontroleerd op {{ formatShortDate(new Date().toISOString()) }}</small>
        </div>
      </div>

      <div v-else class="update-hero neutral">
        <span class="hero-icon" aria-hidden="true">↻</span>
        <div>
          <h3>Nog niet gecontroleerd</h3>
          <p>Controleer of er een nieuwere versie van NightLight beschikbaar is.</p>
        </div>
      </div>

      <dl class="versions">
        <div>
          <span class="version-icon" aria-hidden="true">◇</span>
          <div>
            <dt>Geïnstalleerd</dt>
            <dd>{{ current?.shortSha || 'Onbekend' }}</dd>
            <small v-if="current">{{ formatDate(current.date) }}</small>
          </div>
        </div>
        <div v-if="check?.updateAvailable">
          <span class="version-icon accent" aria-hidden="true">◇</span>
          <div>
            <dt>Beschikbaar</dt>
            <dd class="accent-text">{{ latest?.shortSha || 'Onbekend' }}</dd>
            <small v-if="latest">{{ formatDate(latest.date) }}</small>
          </div>
        </div>
      </dl>

      <div v-if="check?.updateAvailable && check.commits.length" class="changelog">
        <div class="changelog-head">
          <h3>Wat verandert er?</h3>
          <span v-if="check.behind > 1">{{ check.behind }} wijzigingen</span>
        </div>

        <ul>
          <li v-for="commit in visibleCommits" :key="commit.sha">
            <div class="commit-copy">
              <strong>{{ commit.subject }}</strong>
              <small><code>{{ commit.shortSha }}</code> · {{ commit.author }} · {{ formatDate(commit.date) }}</small>
            </div>
          </li>
        </ul>

        <details v-if="hiddenCommitCount || check.behind > check.commits.length" class="more-changes">
          <summary>Alle wijzigingen bekijken</summary>
          <ul v-if="hiddenCommitCount">
            <li v-for="commit in check.commits.slice(3)" :key="commit.sha">
              <div class="commit-copy">
                <strong>{{ commit.subject }}</strong>
                <small><code>{{ commit.shortSha }}</code> · {{ commit.author }} · {{ formatDate(commit.date) }}</small>
              </div>
            </li>
          </ul>
          <small v-if="check.behind > check.commits.length" class="older-count">
            en nog {{ check.behind - check.commits.length }} oudere wijzigingen
          </small>
        </details>
      </div>

      <p v-if="busy" class="notice busy-notice">{{ state?.step || 'Update wordt voorbereid…' }}</p>

      <div class="actions">
        <button
          v-if="check?.updateAvailable"
          class="primary-update"
          type="button"
          :disabled="starting || busy || checking"
          @click="startUpdate"
        >
          <span aria-hidden="true">↓</span>
          {{ starting || busy ? 'Bijwerken…' : `Bijwerken naar ${latest?.shortSha || 'nieuwste versie'}` }}
        </button>

        <button class="ghost recheck" type="button" :disabled="checking || busy" @click="checkForUpdates">
          <span aria-hidden="true">↻</span>
          {{ checking ? 'Controleren…' : check ? 'Opnieuw controleren' : 'Controleren op updates' }}
        </button>

        <span v-if="message" class="action-message" :class="messageType">{{ message }}</span>
      </div>

      <details v-if="lastRun" class="last-run" :class="lastRun.phase">
        <summary>
          <span class="run-icon" aria-hidden="true">{{ lastRun.phase === 'succeeded' ? '✓' : '!' }}</span>
          <span class="run-copy">
            <strong>{{ lastRun.phase === 'succeeded' ? 'Laatste update geslaagd' : 'Laatste update mislukt' }}</strong>
            <small>{{ formatDate(lastRun.finishedAt) }}<template v-if="lastRun.message"> · {{ lastRun.message }}</template></small>
          </span>
          <span class="history-label">Updategeschiedenis bekijken</span>
        </summary>
        <pre>{{ lastRun.log.join('\n') || 'Geen log beschikbaar.' }}</pre>
      </details>
    </template>
  </section>
</template>

<style scoped>
.updates{margin-top:1.5rem;padding:1.35rem;border:1px solid var(--border);border-radius:1rem;background:var(--surface-card);scroll-margin-top:1rem}
.head h2{margin:.15rem 0 .3rem}
.head p:last-child{max-width:48rem;margin:0;color:var(--text-subtle);font-size:.85rem;line-height:1.55}
.notice{margin:1rem 0 0;padding:.85rem;border:1px solid var(--border);border-radius:.8rem;background:var(--surface-input);color:var(--text-muted);font-size:.85rem;line-height:1.5}
.notice.error{border-color:#5a2a2a;color:#ff9d9d}
.notice code{color:var(--text)}
.update-hero{display:flex;gap:1rem;align-items:flex-start;margin-top:1.35rem;padding:1.25rem;border:1px solid #66490d;border-radius:1rem;background:linear-gradient(135deg,rgba(83,58,9,.72),rgba(37,28,12,.68));box-shadow:inset 0 1px 0 rgba(255,255,255,.025)}
.update-hero.up-to-date{border-color:#24573a;background:linear-gradient(135deg,rgba(19,66,42,.6),rgba(17,35,27,.62))}
.update-hero.neutral{border-color:var(--border);background:var(--surface-input)}
.hero-icon{display:grid;place-items:center;flex:0 0 3rem;width:3rem;height:3rem;border-radius:50%;background:rgba(185,127,14,.22);color:#f4bd43;font-size:1.65rem;font-weight:800}
.update-hero.up-to-date .hero-icon{background:rgba(31,143,81,.2);color:#5fe294}
.update-hero.neutral .hero-icon{background:rgba(255,255,255,.055);color:var(--text-muted)}
.update-hero h3{margin:.05rem 0 .2rem;font-size:1.02rem}
.update-hero p{margin:0;color:var(--text-muted);font-size:.88rem}
.update-hero small{display:block;margin-top:.55rem;color:var(--text-subtle);font-size:.75rem}
.version-route{display:flex;gap:.65rem;align-items:center;margin-top:.75rem;color:var(--text-muted)}
.version-route code{padding:.3rem .6rem;border-radius:.55rem;background:rgba(255,255,255,.06);color:var(--text-muted);font-size:.9rem;font-weight:800}
.version-route code.latest{background:rgba(139,82,255,.15);color:#a873ff}
.versions{display:grid;grid-template-columns:repeat(2,1fr);gap:0;margin:1rem 0 0;border:1px solid var(--border);border-radius:1rem;background:var(--surface-input);overflow:hidden}
.versions>div{display:flex;gap:.85rem;align-items:center;padding:1rem 1.1rem;min-width:0}
.versions>div+div{border-left:1px solid var(--border)}
.version-icon{display:grid;place-items:center;flex:0 0 2.4rem;width:2.4rem;height:2.4rem;border-radius:50%;background:rgba(255,255,255,.055);color:var(--text-muted);font-size:1.2rem}
.version-icon.accent{background:rgba(139,82,255,.12);color:#a873ff}
.versions dt{color:var(--text-muted);font-size:.78rem}
.versions dd{margin:.15rem 0 0;font-size:1rem;font-weight:800;overflow-wrap:anywhere}
.versions small{display:block;margin-top:.12rem;color:var(--text-subtle);font-size:.72rem;font-weight:400}
.accent-text{color:#a873ff}
.changelog{margin-top:1rem;padding:1rem;border:1px solid var(--border);border-radius:1rem;background:var(--surface-input)}
.changelog-head{display:flex;justify-content:space-between;gap:1rem;align-items:center;margin-bottom:.7rem}
.changelog h3{margin:0;font-size:1rem}
.changelog-head>span{color:#a873ff;font-size:.76rem;font-weight:700}
.changelog ul{display:grid;gap:.55rem;margin:0;padding:0;list-style:none}
.changelog li{padding:.72rem .8rem;border:1px solid var(--border);border-radius:.75rem;background:rgba(0,0,0,.12)}
.commit-copy{display:grid;gap:.35rem}
.commit-copy strong{font-size:.88rem;line-height:1.35;overflow-wrap:anywhere}
.commit-copy small{color:var(--text-subtle);font-size:.72rem}
.commit-copy code{color:#a873ff}
.more-changes{margin-top:.65rem}
.more-changes summary{color:#a873ff;font-size:.78rem;font-weight:700;cursor:pointer;list-style:none}
.more-changes summary::-webkit-details-marker{display:none}
.more-changes[open] summary{margin-bottom:.65rem}
.older-count{display:block;margin-top:.5rem;color:var(--text-subtle);font-size:.72rem}
.busy-notice{border-color:#66490d;color:#f4bd43}
.actions{display:flex;flex-direction:column;align-items:center;gap:.7rem;margin-top:1rem}
button{border:0;border-radius:.8rem;padding:.78rem 1rem;background:#fff;color:#09080b;font-weight:800;cursor:pointer}
button:disabled{cursor:not-allowed;opacity:.55}
button.ghost{border:1px solid var(--border-strong);background:transparent;color:var(--text)}
.primary-update{display:flex;justify-content:center;gap:.55rem;width:100%;background:linear-gradient(90deg,#7238ef,#9b56ff);color:#fff;font-size:.92rem;box-shadow:0 7px 24px rgba(121,64,240,.16)}
.primary-update span,.recheck span{font-size:1.15rem;line-height:1}
.recheck{display:flex;justify-content:center;gap:.55rem;min-width:15rem}
.action-message{color:var(--text-muted);font-size:.8rem;text-align:center}
.action-message.success{color:#8ed6a3}
.action-message.error{color:#ff9d9d}
.last-run{margin-top:1.15rem;border-top:1px solid var(--border)}
.last-run summary{display:grid;grid-template-columns:auto 1fr auto;gap:.8rem;align-items:center;padding:1rem 0 0;color:#75e39b;font-size:.85rem;cursor:pointer;list-style:none}
.last-run summary::-webkit-details-marker{display:none}
.last-run.failed summary{color:#ff9d9d}
.run-icon{display:grid;place-items:center;width:2.25rem;height:2.25rem;border-radius:50%;background:rgba(31,143,81,.18);font-size:1rem;font-weight:900}
.last-run.failed .run-icon{background:rgba(255,80,80,.12)}
.run-copy{display:grid;gap:.15rem}
.run-copy small{color:var(--text-subtle);font-size:.72rem;font-weight:400}
.history-label{color:var(--text-muted);font-size:.76rem;font-weight:500}
.last-run pre{max-height:20rem;margin:.85rem 0 0;padding:.85rem;overflow:auto;border:1px solid var(--border);border-radius:.7rem;background:var(--surface-input);color:var(--text-muted);font-size:.72rem;line-height:1.5;white-space:pre-wrap;word-break:break-all}
@media(max-width:650px){
  .updates{padding:1.05rem}
  .update-hero{padding:1rem}
  .hero-icon{flex-basis:2.65rem;width:2.65rem;height:2.65rem}
  .versions{grid-template-columns:1fr}
  .versions>div+div{border-top:1px solid var(--border);border-left:0}
  .changelog{padding:.85rem}
  .changelog-head{align-items:flex-start;flex-direction:column;gap:.25rem}
  .recheck{width:100%;min-width:0}
  .last-run summary{grid-template-columns:auto 1fr}
  .history-label{grid-column:2}
}
</style>
