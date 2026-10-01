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
const lastRun = computed(() => {
  const run = state.value
  if (!run?.finishedAt || (run.phase !== 'succeeded' && run.phase !== 'failed')) return null
  return run
})

const pill = computed(() => {
  if (!data.value?.available) return { label: 'Niet beschikbaar', tone: '' }
  if (!data.value.configured) return { label: 'Niet ingesteld', tone: 'warn' }
  if (busy.value) return { label: 'Bezig met bijwerken', tone: 'warn' }
  if (check.value?.updateAvailable) return { label: 'Update beschikbaar', tone: 'warn' }
  if (check.value) return { label: 'Up-to-date', tone: 'on' }
  return { label: 'Niet gecontroleerd', tone: '' }
})

function formatDate(value: string | null | undefined) {
  if (!value) return ''
  return new Date(value).toLocaleString('nl-NL', { dateStyle: 'medium', timeStyle: 'short' })
}

function commitLabel(commit: UpdateCommit | null) {
  return commit ? `${commit.shortSha} · ${commit.subject}` : 'Onbekend'
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
      <span class="pill" :class="pill.tone">{{ pill.label }}</span>
    </div>

    <p v-if="!data?.available" class="notice">
      Updates vanuit de instellingen zijn alleen beschikbaar op de server-installatie (Unraid) met de updater-container en een ingestelde <code>UPDATER_TOKEN</code>.
    </p>
    <p v-else-if="!data.configured" class="notice error">
      {{ data.configError || 'De updater is niet volledig ingesteld.' }}
    </p>

    <template v-else>
      <dl class="versions">
        <div>
          <dt>Huidige versie</dt>
          <dd>{{ commitLabel(current) }}<small v-if="current">{{ formatDate(current.date) }}</small></dd>
        </div>
        <div v-if="check?.updateAvailable">
          <dt>Nieuwste versie ({{ data.branch }})</dt>
          <dd>{{ commitLabel(check.latest) }}<small v-if="check.latest">{{ formatDate(check.latest.date) }}</small></dd>
        </div>
      </dl>

      <div v-if="check?.updateAvailable && check.commits.length" class="commits">
        <p>Nieuw in deze update</p>
        <ul>
          <li v-for="commit in check.commits" :key="commit.sha">
            <code>{{ commit.shortSha }}</code>
            <span>{{ commit.subject }}</span>
            <small>{{ commit.author }} · {{ formatDate(commit.date) }}</small>
          </li>
        </ul>
        <small v-if="check.behind > check.commits.length" class="more">en nog {{ check.behind - check.commits.length }} oudere wijzigingen</small>
      </div>

      <p v-if="busy" class="notice">{{ state?.step || 'Update wordt voorbereid…' }}</p>

      <details v-if="lastRun" class="last-run" :class="lastRun.phase">
        <summary>
          {{ lastRun.phase === 'succeeded' ? 'Laatste update geslaagd' : 'Laatste update mislukt' }}
          · {{ formatDate(lastRun.finishedAt) }}
          <span v-if="lastRun.message">— {{ lastRun.message }}</span>
        </summary>
        <pre>{{ lastRun.log.join('\n') || 'Geen log beschikbaar.' }}</pre>
      </details>

      <div class="actions">
        <span :class="messageType">{{ message }}</span>
        <div>
          <button class="ghost" type="button" :disabled="checking || busy" @click="checkForUpdates">
            {{ checking ? 'Controleren…' : 'Controleren op updates' }}
          </button>
          <button type="button" :disabled="!check?.updateAvailable || starting || busy || checking" @click="startUpdate">
            {{ starting || busy ? 'Bijwerken…' : 'Nu bijwerken' }}
          </button>
        </div>
      </div>
    </template>
  </section>
</template>

<style scoped>
.updates{margin-top:1.5rem;padding:1.2rem;border:1px solid var(--border);border-radius:1rem;background:var(--surface-card);scroll-margin-top:1rem}
.head,.actions{display:flex;justify-content:space-between;gap:1rem;align-items:flex-start}
.head h2{margin:.15rem 0 .3rem}
.head p:last-child{margin:0;color:var(--text-subtle);font-size:.85rem;line-height:1.5}
.pill{flex:none;padding:.25rem .7rem;border-radius:99px;background:var(--border);color:var(--text-muted);font-size:.75rem;font-weight:700}
.pill.on{background:#16382a;color:#7be0a8}
.pill.warn{background:#3a2c12;color:#f3c77a}
.notice{margin:1rem 0 0;padding:.85rem;border:1px solid var(--border);border-radius:.8rem;background:var(--surface-input);color:var(--text-muted);font-size:.85rem;line-height:1.5}
.notice.error{border-color:#5a2a2a;color:#ff9d9d}
.notice code{color:var(--text)}
.versions{display:grid;grid-template-columns:repeat(2,1fr);gap:.8rem;margin:1rem 0 0}
.versions div{padding:.85rem;border:1px solid var(--border);border-radius:.8rem;background:var(--surface-input);min-width:0}
.versions dt{color:var(--text-subtle);font-size:.75rem}
.versions dd{display:grid;gap:.2rem;margin:.3rem 0 0;font-weight:700;overflow-wrap:anywhere}
.versions small{color:var(--text-subtle);font-size:.75rem;font-weight:400}
.commits{margin-top:1rem}
.commits>p{margin:0 0 .5rem;color:var(--text-muted);font-size:.8rem}
.commits ul{display:grid;gap:.4rem;max-height:18rem;margin:0;padding:0;overflow:auto;list-style:none}
.commits li{display:grid;grid-template-columns:auto 1fr;gap:.15rem .6rem;padding:.6rem .75rem;border:1px solid var(--border);border-radius:.7rem;background:var(--surface-input);font-size:.85rem}
.commits code{color:#b58cff}
.commits span{overflow-wrap:anywhere}
.commits li small{grid-column:2;color:var(--text-subtle);font-size:.72rem}
.more{display:block;margin-top:.4rem;color:var(--text-subtle);font-size:.75rem}
.last-run{margin-top:1rem;border:1px solid var(--border);border-radius:.8rem;background:var(--surface-input)}
.last-run summary{padding:.75rem .85rem;color:#8ed6a3;font-size:.85rem;cursor:pointer}
.last-run.failed summary{color:#ff9d9d}
.last-run summary span{color:var(--text-muted)}
.last-run pre{max-height:20rem;margin:0;padding:.85rem;overflow:auto;border-top:1px solid var(--border);color:var(--text-muted);font-size:.72rem;line-height:1.5;white-space:pre-wrap;word-break:break-all}
.actions{align-items:center;margin-top:1rem}
.actions>div{display:flex;gap:.6rem}
.actions span{color:var(--text-muted);font-size:.85rem}
.actions .success{color:#8ed6a3}
.actions .error{color:#ff9d9d}
button{border:0;border-radius:.7rem;padding:.7rem 1rem;background:#fff;color:#09080b;font-weight:800;cursor:pointer}
button:disabled{cursor:not-allowed;opacity:.55}
button.ghost{border:1px solid var(--border-strong);background:transparent;color:var(--text)}
@media(max-width:650px){
  .head,.actions{align-items:stretch;flex-direction:column}
  .versions{grid-template-columns:1fr}
  .actions>div{flex-direction:column}
  .actions button{width:100%}
}
</style>
