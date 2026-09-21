<script setup lang="ts">
definePageMeta({ layout: 'admin' })

type CancellationBehavior = 'delete' | 'mark_cancelled' | 'keep'
type SyncItem = {
  gigId: string
  title: string
  gigStatus: string
  startsAt: string | null
  syncStatus: string
  providerEventId: string | null
  retryCount: number
  nextRetryAt: string | null
  lastAttemptAt: string | null
  lastSyncedAt: string | null
  lastError: string | null
}
type CalendarData = {
  credentialsConfigured: boolean
  settings: {
    enabled: boolean
    calendarId: string
    cancellationBehavior: CancellationBehavior
  }
  items: SyncItem[]
}

const { data, refresh, pending } = await useFetch<CalendarData>('/api/admin/calendar')
const syncing = ref<string | null>(null)
const message = ref('')

async function sync(gigId?: string) {
  syncing.value = gigId || 'all'
  message.value = ''
  try {
    const response = await $fetch<{ result: { processed?: number, failed?: number, status?: string } }>('/api/admin/calendar/sync', {
      method: 'POST',
      body: gigId ? { gigId } : {},
    })
    message.value = gigId
      ? `Sync finished: ${response.result.status || 'done'}.`
      : `Sync finished: ${response.result.processed || 0} processed, ${response.result.failed || 0} failed.`
  } catch (error) {
    message.value = error instanceof Error ? error.message : 'Synchronization failed.'
  } finally {
    syncing.value = null
    await refresh()
  }
}

function formatDate(value: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('nl-NL', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}
</script>

<template>
  <div class="page">
    <header class="page-header">
      <div>
        <p class="eyebrow">Operations</p>
        <h1>Calendar</h1>
        <p class="intro">One-way synchronization from booked NightLight gigs to Google Calendar.</p>
      </div>
      <button class="primary" type="button" :disabled="syncing !== null || !data?.settings.enabled" @click="sync()">
        {{ syncing === 'all' ? 'Syncing…' : 'Sync all' }}
      </button>
    </header>

    <section class="panel">
      <div class="panel-heading">
        <div>
          <h2>Connection & behavior</h2>
          <p>Google Calendar is configured centrally in Settings, so credentials and sync behavior have one source of truth.</p>
        </div>
        <span class="status" :class="{ ok: data?.credentialsConfigured }">
          {{ data?.credentialsConfigured ? 'Credentials configured' : 'Credentials missing' }}
        </span>
      </div>

      <div class="facts">
        <div><span>Synchronization</span><strong>{{ data?.settings.enabled ? 'Enabled' : 'Disabled' }}</strong></div>
        <div><span>Calendar ID</span><strong>{{ data?.settings.calendarId || 'primary' }}</strong></div>
        <div>
          <span>Cancelled / declined gigs</span>
          <strong>{{ data?.settings.cancellationBehavior === 'delete' ? 'Delete mapped event' : data?.settings.cancellationBehavior === 'mark_cancelled' ? 'Keep and mark cancelled' : 'Leave event unchanged' }}</strong>
        </div>
      </div>
      <NuxtLink class="settings-link" to="/admin/settings#integrations">Manage Google Calendar in Settings → Integrations</NuxtLink>
      <p v-if="message" class="message">{{ message }}</p>
    </section>

    <section class="panel">
      <div class="panel-heading">
        <div>
          <h2>Synchronization status</h2>
          <p>Failed jobs are retried in the background with exponential backoff and can be retried manually.</p>
        </div>
        <button class="quiet" type="button" :disabled="pending" @click="refresh()">Refresh</button>
      </div>

      <div v-if="!data?.items.length" class="empty">No gigs have been queued for Calendar sync yet.</div>
      <div v-else class="list">
        <article v-for="item in data.items" :key="item.gigId" class="row">
          <div>
            <strong>{{ item.title }}</strong>
            <p>{{ formatDate(item.startsAt) }} · {{ item.gigStatus }}</p>
          </div>
          <div class="sync-state">
            <span class="pill" :data-state="item.syncStatus">{{ item.syncStatus }}</span>
            <small v-if="item.lastSyncedAt">Last synced {{ formatDate(item.lastSyncedAt) }}</small>
            <small v-else-if="item.lastAttemptAt">Last attempt {{ formatDate(item.lastAttemptAt) }}</small>
            <small v-if="item.lastError" class="error">{{ item.lastError }}</small>
          </div>
          <button class="quiet" type="button" :disabled="syncing !== null || !data?.settings.enabled" @click="sync(item.gigId)">
            {{ syncing === item.gigId ? 'Retrying…' : 'Sync now' }}
          </button>
        </article>
      </div>
    </section>
  </div>
</template>

<style scoped>
.page { max-width: 1180px; margin: 0 auto; }
.page-header, .panel-heading, .row { display: flex; gap: 1rem; justify-content: space-between; align-items: flex-start; }
.page-header { margin-bottom: 1.5rem; }
h1 { margin: .2rem 0; font-size: clamp(2.5rem, 6vw, 4.6rem); letter-spacing: -.05em; }
h2 { margin: 0 0 .35rem; }
.intro, .panel p, .row p, small { color: #938c9c; }
.panel a { color: #c9b2df; }
.panel { margin-top: 1rem; padding: 1.35rem; border: 1px solid #29242f; border-radius: 1rem; background: #121016; }
.facts { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: .8rem; margin: 1.25rem 0; }
.facts div { display: grid; gap: .3rem; padding: .8rem; border: 1px solid #2d2833; border-radius: .7rem; background: #0d0b10; }
.facts span { color: #81798a; font-size: .75rem; }
.facts strong { font-size: .85rem; }
.settings-link { display: inline-flex; color: #c9b2df; font-size: .85rem; }
button { border-radius: .7rem; padding: .7rem 1rem; cursor: pointer; }
button:disabled { cursor: not-allowed; opacity: .5; }
.primary { border: 0; background: #fff; color: #0d0b10; font-weight: 700; }
.secondary, .quiet { border: 1px solid #35303b; background: #19161e; color: #fff; }
.quiet { padding: .5rem .75rem; }
.status, .pill { border: 1px solid #453c4f; border-radius: 999px; padding: .32rem .58rem; color: #a69eae; font-size: .72rem; text-transform: uppercase; letter-spacing: .08em; }
.status.ok, .pill[data-state="synced"] { border-color: #315845; color: #8fc9a7; }
.pill[data-state="failed"] { border-color: #704048; color: #ef9aa7; }
.list { display: grid; margin-top: 1rem; }
.row { padding: 1rem 0; border-top: 1px solid #28232d; }
.row:first-child { border-top: 0; }
.sync-state { display: grid; gap: .35rem; min-width: 260px; }
.sync-state .pill { justify-self: start; }
.error { max-width: 480px; color: #ef9aa7; }
.message { margin: .8rem 0 0; }
.empty { margin-top: 1rem; padding: 1.2rem; border: 1px dashed #35303b; border-radius: .8rem; color: #8f8798; }
@media (max-width: 800px) {
  .page-header, .panel-heading, .row { display: grid; }
  .facts { grid-template-columns: 1fr; }
  .sync-state { min-width: 0; }
}
</style>
