<script setup lang="ts">
definePageMeta({ layout: 'admin' })

type OpsEvent = {
  id: string
  kind: string
  status: string
  message: string | null
  occurredAt: string
}
type OperationsData = {
  counts: {
    failedEmails: number
    failedCalendar: number
    failedPayments: number
    pendingOutbox: number
  }
  latestBackup: OpsEvent | null
  latestRestoreTest: OpsEvent | null
  recentOps: OpsEvent[]
  failures: {
    email: Array<{ id: string, templateKey: string, recipient: string, attemptCount: number, lastError: string | null, updatedAt: string }>
    calendar: Array<{ gigId: string, retryCount: number, lastError: string | null, lastAttemptAt: string | null }>
    payments: Array<{ id: string, invoiceId: string, failureCode: string | null, updatedAt: string }>
  }
  stripe: {
    recentEvents: Array<{ eventId: string, eventType: string, livemode: boolean, processedAt: string }>
  }
}

const { data, refresh } = await useFetch<OperationsData>('/api/admin/operations')

function formatDate(value: string | null | undefined) {
  if (!value) return 'Never'
  return new Intl.DateTimeFormat('nl-NL', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}
function stateClass(status: string | undefined) {
  return status === 'success' ? 'ok' : status === 'failed' ? 'bad' : ''
}
</script>

<template>
  <div class="page">
    <header class="header">
      <div>
        <p class="eyebrow">System</p>
        <h1>Operations</h1>
        <p>Backups, restore verification and integration failure states in one owner-only view.</p>
      </div>
      <button type="button" @click="refresh()">Refresh</button>
    </header>

    <section class="top-grid">
      <article class="status-card">
        <span>Latest backup</span>
        <strong :class="stateClass(data?.latestBackup?.status)">{{ data?.latestBackup?.status || 'unknown' }}</strong>
        <small>{{ formatDate(data?.latestBackup?.occurredAt) }}</small>
        <p>{{ data?.latestBackup?.message || 'No backup event recorded yet.' }}</p>
      </article>
      <article class="status-card">
        <span>Latest restore test</span>
        <strong :class="stateClass(data?.latestRestoreTest?.status)">{{ data?.latestRestoreTest?.status || 'unknown' }}</strong>
        <small>{{ formatDate(data?.latestRestoreTest?.occurredAt) }}</small>
        <p>{{ data?.latestRestoreTest?.message || 'No restore test recorded yet.' }}</p>
      </article>
    </section>

    <section class="metrics">
      <article>
        <span>Failed emails</span>
        <strong>{{ data?.counts.failedEmails || 0 }}</strong>
      </article>
      <article>
        <span>Calendar failures</span>
        <strong>{{ data?.counts.failedCalendar || 0 }}</strong>
      </article>
      <article>
        <span>Payment failures</span>
        <strong>{{ data?.counts.failedPayments || 0 }}</strong>
      </article>
      <article>
        <span>Pending outbox</span>
        <strong>{{ data?.counts.pendingOutbox || 0 }}</strong>
      </article>
    </section>

    <section class="panel">
      <h2>Recent operational events</h2>
      <div class="rows">
        <div v-for="item in data?.recentOps" :key="item.id" class="row">
          <span class="pill" :class="stateClass(item.status)">{{ item.status }}</span>
          <strong>{{ item.kind }}</strong>
          <span>{{ item.message || '—' }}</span>
          <small>{{ formatDate(item.occurredAt) }}</small>
        </div>
        <p v-if="!data?.recentOps.length">No operational events recorded yet.</p>
      </div>
    </section>

    <div class="split">
      <section class="panel">
        <h2>Email failures</h2>
        <div class="rows compact">
          <div v-for="item in data?.failures.email" :key="item.id" class="failure">
            <strong>{{ item.templateKey }}</strong>
            <span>{{ item.recipient }}</span>
            <small>{{ item.attemptCount }} attempts · {{ formatDate(item.updatedAt) }}</small>
            <p>{{ item.lastError || 'Unknown error' }}</p>
          </div>
          <p v-if="!data?.failures.email.length">No failed email jobs.</p>
        </div>
      </section>

      <section class="panel">
        <h2>Calendar failures</h2>
        <div class="rows compact">
          <div v-for="item in data?.failures.calendar" :key="item.gigId" class="failure">
            <strong>Gig {{ item.gigId.slice(0, 8) }}</strong>
            <small>{{ item.retryCount }} retries · {{ formatDate(item.lastAttemptAt) }}</small>
            <p>{{ item.lastError || 'Unknown error' }}</p>
          </div>
          <p v-if="!data?.failures.calendar.length">No Calendar failures.</p>
        </div>
      </section>
    </div>

    <div class="split">
      <section class="panel">
        <h2>Payment failures</h2>
        <div class="rows compact">
          <div v-for="item in data?.failures.payments" :key="item.id" class="failure">
            <strong>Invoice {{ item.invoiceId.slice(0, 8) }}</strong>
            <span>{{ item.failureCode || 'Unspecified failure' }}</span>
            <small>{{ formatDate(item.updatedAt) }}</small>
          </div>
          <p v-if="!data?.failures.payments.length">No failed payments.</p>
        </div>
      </section>

      <section class="panel">
        <h2>Recent Stripe webhooks</h2>
        <div class="rows compact">
          <div v-for="item in data?.stripe.recentEvents" :key="item.eventId" class="failure">
            <strong>{{ item.eventType }}</strong>
            <span>{{ item.livemode ? 'Live mode' : 'Test mode' }}</span>
            <small>{{ formatDate(item.processedAt) }}</small>
          </div>
          <p v-if="!data?.stripe.recentEvents.length">No Stripe webhooks received yet.</p>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.page { max-width: 1240px; margin: 0 auto; }
.header { display: flex; align-items: flex-end; justify-content: space-between; gap: 1rem; }
h1 { margin: .2rem 0; font-size: clamp(2.6rem, 6vw, 4.7rem); letter-spacing: -.055em; }
h2 { margin: 0 0 .8rem; }
p, small, span { color: #918999; }
button { border: 1px solid #37313d; border-radius: .65rem; padding: .65rem .8rem; background: #18151d; color: #fff; cursor: pointer; }
.top-grid, .split, .metrics { display: grid; gap: .8rem; margin-top: 1rem; }
.top-grid, .split { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.metrics { grid-template-columns: repeat(4, minmax(0, 1fr)); }
.status-card, .panel, .metrics article { border: 1px solid #2d2733; border-radius: 1rem; background: #121016; }
.status-card, .metrics article { padding: 1rem; }
.status-card { display: grid; gap: .35rem; }
.status-card > strong { font-size: 1.55rem; text-transform: uppercase; }
.status-card .ok, .pill.ok { color: #8ed0a7; }
.status-card .bad, .pill.bad { color: #ee919d; }
.metrics article { display: grid; gap: .4rem; }
.metrics strong { font-size: 2rem; }
.panel { margin-top: 1rem; padding: 1rem; }
.split .panel { margin-top: 0; }
.rows { display: grid; }
.row { display: grid; grid-template-columns: 85px 130px 1fr 160px; gap: .7rem; align-items: center; padding: .7rem 0; border-top: 1px solid #2a2530; }
.row:first-child { border-top: 0; }
.pill { justify-self: start; border: 1px solid #413847; border-radius: 999px; padding: .25rem .45rem; font-size: .67rem; text-transform: uppercase; }
.failure { display: grid; gap: .25rem; padding: .75rem 0; border-top: 1px solid #2a2530; }
.failure:first-child { border-top: 0; }
.failure p { margin: .15rem 0 0; color: #d9b0b6; overflow-wrap: anywhere; }
@media (max-width: 820px) {
  .metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .row { grid-template-columns: 80px 1fr; }
  .row span:nth-child(3), .row small { grid-column: 2; }
}
@media (max-width: 620px) {
  .header, .top-grid, .split { display: grid; grid-template-columns: 1fr; }
  .metrics { grid-template-columns: 1fr 1fr; }
}
</style>
