<script setup lang="ts">
import { apiErrorMessage } from '~/utils/api-error'
import { calendarSyncStatusLabels, gigStatusLabels, labelFor } from '~~/shared/labels'

definePageMeta({ layout: 'admin' })

type ViewMode = 'day' | 'week' | 'month' | 'year'
type CancellationBehavior = 'delete' | 'mark_cancelled' | 'keep'
type CalendarEvent = {
  id: string
  title: string
  eventType: string | null
  status: string
  startsAt: string | null
  endsAt: string | null
  venueName: string | null
  venueCity: string | null
  assignedUserId: string | null
  assignedUserName: string | null
}
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
  icsUrl: string
  settings: {
    enabled: boolean
    calendarId: string
    cancellationBehavior: CancellationBehavior
  }
  items: SyncItem[]
}

const view = ref<ViewMode>('month')
const cursor = ref(new Date())
const drawerOpen = ref(false)
const syncing = ref<string | null>(null)
const settingsSaving = ref(false)
const rotatingToken = ref(false)
const message = ref('')
const settingsForm = reactive({
  enabled: false,
  calendarId: 'primary',
  cancellationBehavior: 'delete' as CancellationBehavior,
})

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate())
}
function addDays(value: Date, days: number) {
  const result = new Date(value)
  result.setDate(result.getDate() + days)
  return result
}
function startOfWeek(value: Date) {
  const result = startOfDay(value)
  const day = result.getDay() || 7
  return addDays(result, 1 - day)
}
function endOfWeek(value: Date) {
  return addDays(startOfWeek(value), 7)
}
function startOfMonth(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), 1)
}
function endOfMonth(value: Date) {
  return new Date(value.getFullYear(), value.getMonth() + 1, 1)
}
function startOfYear(value: Date) {
  return new Date(value.getFullYear(), 0, 1)
}
function endOfYear(value: Date) {
  return new Date(value.getFullYear() + 1, 0, 1)
}
function dateKey(value: Date) {
  return [value.getFullYear(), String(value.getMonth() + 1).padStart(2, '0'), String(value.getDate()).padStart(2, '0')].join('-')
}
function visibleRange(mode: ViewMode, value: Date) {
  if (mode === 'day') return { start: startOfDay(value), end: addDays(startOfDay(value), 1) }
  if (mode === 'week') return { start: startOfWeek(value), end: endOfWeek(value) }
  if (mode === 'year') return { start: startOfYear(value), end: endOfYear(value) }
  const monthStart = startOfMonth(value)
  const gridStart = startOfWeek(monthStart)
  return { start: gridStart, end: addDays(gridStart, 42) }
}

const range = computed(() => visibleRange(view.value, cursor.value))
const eventsQuery = computed(() => ({
  start: range.value.start.toISOString(),
  end: range.value.end.toISOString(),
}))
const { data: eventsData, pending: eventsPending } = await useFetch<{ events: CalendarEvent[] }>('/api/admin/calendar/events', {
  query: eventsQuery,
})
const events = computed(() => eventsData.value?.events || [])

const {
  data: integrationData,
  refresh: refreshIntegration,
  pending: integrationPending,
  error: integrationError,
} = await useFetch<CalendarData>('/api/admin/calendar')

const canManageIntegrations = computed(() => Boolean(integrationData.value) && !integrationError.value)

watch(() => integrationData.value?.settings, (settings) => {
  if (!settings) return
  settingsForm.enabled = settings.enabled
  settingsForm.calendarId = settings.calendarId
  settingsForm.cancellationBehavior = settings.cancellationBehavior
}, { immediate: true })

const weekdayFormatter = new Intl.DateTimeFormat('nl-NL', { weekday: 'short' })
const monthFormatter = new Intl.DateTimeFormat('nl-NL', { month: 'long', year: 'numeric' })
const fullDateFormatter = new Intl.DateTimeFormat('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
const shortDateFormatter = new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short' })

const periodLabel = computed(() => {
  if (view.value === 'day') return capitalize(fullDateFormatter.format(cursor.value))
  if (view.value === 'week') {
    const start = startOfWeek(cursor.value)
    const end = addDays(start, 6)
    if (start.getMonth() === end.getMonth()) {
      return `${start.getDate()}–${end.getDate()} ${new Intl.DateTimeFormat('nl-NL', { month: 'long', year: 'numeric' }).format(end)}`
    }
    return `${shortDateFormatter.format(start)} – ${shortDateFormatter.format(end)} ${end.getFullYear()}`
  }
  if (view.value === 'year') return String(cursor.value.getFullYear())
  return capitalize(monthFormatter.format(cursor.value))
})

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
function setView(mode: ViewMode) {
  view.value = mode
}
function navigate(direction: number) {
  const next = new Date(cursor.value)
  if (view.value === 'day') next.setDate(next.getDate() + direction)
  if (view.value === 'week') next.setDate(next.getDate() + (7 * direction))
  if (view.value === 'month') next.setMonth(next.getMonth() + direction)
  if (view.value === 'year') next.setFullYear(next.getFullYear() + direction)
  cursor.value = next
}
function goToday() {
  cursor.value = new Date()
}
function openDay(date: Date) {
  cursor.value = new Date(date)
  view.value = 'day'
}
function isToday(date: Date) {
  return dateKey(date) === dateKey(new Date())
}
function sameMonth(date: Date) {
  return date.getMonth() === cursor.value.getMonth() && date.getFullYear() === cursor.value.getFullYear()
}
function eventsForDay(date: Date) {
  const key = dateKey(date)
  return events.value
    .filter(item => item.startsAt && dateKey(new Date(item.startsAt)) === key)
    .sort((a, b) => new Date(a.startsAt || 0).getTime() - new Date(b.startsAt || 0).getTime())
}
function formatTime(value: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('nl-NL', { hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}
function formatLocation(item: CalendarEvent) {
  return [item.venueName, item.venueCity].filter(Boolean).join(' · ') || 'Locatie nog niet ingevuld'
}
function formatSyncDate(value: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('nl-NL', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

const monthDays = computed(() => Array.from({ length: 42 }, (_, index) => addDays(range.value.start, index)))
const weekDays = computed(() => Array.from({ length: 7 }, (_, index) => addDays(startOfWeek(cursor.value), index)))
const yearMonths = computed(() => Array.from({ length: 12 }, (_, month) => new Date(cursor.value.getFullYear(), month, 1)))
const timelineHours = Array.from({ length: 18 }, (_, index) => index + 8)
const timelineHeight = timelineHours.length * 52

function eventStyle(item: CalendarEvent) {
  if (!item.startsAt) return {}
  const start = new Date(item.startsAt)
  const end = item.endsAt ? new Date(item.endsAt) : new Date(start.getTime() + 60 * 60 * 1000)
  let minutes = start.getHours() * 60 + start.getMinutes() - 8 * 60
  if (minutes < 0) minutes = 0
  const duration = Math.max(35, (end.getTime() - start.getTime()) / 60000)
  return {
    top: `${Math.max(0, minutes / 60 * 52)}px`,
    height: `${Math.max(42, duration / 60 * 52)}px`,
  }
}
function miniMonthDays(month: Date) {
  const start = startOfWeek(startOfMonth(month))
  return Array.from({ length: 42 }, (_, index) => addDays(start, index))
}
function eventsForMiniDay(date: Date) {
  return eventsForDay(date).slice(0, 3)
}
function switchToDay(date: Date) {
  openDay(date)
}

async function sync(gigId?: string) {
  syncing.value = gigId || 'all'
  message.value = ''
  try {
    const response = await $fetch<{ result: { processed?: number, failed?: number, status?: string } }>('/api/admin/calendar/sync', {
      method: 'POST',
      body: gigId ? { gigId } : {},
    })
    message.value = gigId
      ? `Synchronisatie klaar: ${response.result.status ? labelFor(calendarSyncStatusLabels, response.result.status).toLowerCase() : 'gereed'}.`
      : `Synchronisatie klaar: ${response.result.processed || 0} verwerkt, ${response.result.failed || 0} mislukt.`
  } catch (error) {
    message.value = apiErrorMessage(error, 'Synchronisatie mislukt.')
  } finally {
    syncing.value = null
    await refreshIntegration()
  }
}

async function saveSettings() {
  settingsSaving.value = true
  message.value = ''
  try {
    await $fetch('/api/admin/calendar/settings', {
      method: 'PUT',
      body: settingsForm,
    })
    message.value = 'Agenda-instellingen opgeslagen.'
    await refreshIntegration()
  } catch (error) {
    message.value = apiErrorMessage(error, 'Agenda-instellingen opslaan is niet gelukt.')
  } finally {
    settingsSaving.value = false
  }
}

async function copyIcs() {
  if (!integrationData.value?.icsUrl) return
  await navigator.clipboard.writeText(integrationData.value.icsUrl)
  message.value = 'ICS-koppeling gekopieerd.'
}

async function rotateIcs() {
  if (!confirm('Nieuwe ICS-koppeling maken? De huidige link werkt daarna niet meer.')) return
  rotatingToken.value = true
  try {
    await $fetch('/api/admin/calendar/ics-token', { method: 'POST' })
    await refreshIntegration()
    message.value = 'Nieuwe ICS-koppeling aangemaakt.'
  } catch (error) {
    message.value = apiErrorMessage(error, 'ICS-koppeling vernieuwen is niet gelukt.')
  } finally {
    rotatingToken.value = false
  }
}
</script>

<template>
  <div class="calendar-page">
    <header class="page-header">
      <div>
        <p class="eyebrow">Planning</p>
        <h1>Agenda</h1>
        <p class="intro">Bekijk al je boekingen, beheer je planning en houd overzicht over alle gigs.</p>
      </div>
      <button v-if="canManageIntegrations" class="integration-button" type="button" @click="drawerOpen = true">
        <Icon name="lucide:plug-zap" aria-hidden="true" />
        <span>Integraties</span>
        <span class="connection-dot" :class="{ ok: integrationData?.credentialsConfigured }" />
        <span class="connection-copy">{{ integrationData?.credentialsConfigured ? 'Google verbonden' : 'ICS beschikbaar' }}</span>
        <Icon name="lucide:chevron-right" aria-hidden="true" />
      </button>
    </header>

    <section class="calendar-shell">
      <div class="toolbar">
        <div class="navigation">
          <button class="icon-button" type="button" aria-label="Vorige periode" @click="navigate(-1)">
            <Icon name="lucide:chevron-left" />
          </button>
          <button class="quiet-button" type="button" @click="goToday">Vandaag</button>
          <button class="icon-button" type="button" aria-label="Volgende periode" @click="navigate(1)">
            <Icon name="lucide:chevron-right" />
          </button>
          <strong class="period">{{ periodLabel }}</strong>
        </div>
        <div class="view-switcher" aria-label="Agendaweergave">
          <button v-for="option in ([['day','Dag'],['week','Week'],['month','Maand'],['year','Jaar']] as const)" :key="option[0]" type="button" :class="{ active: view === option[0] }" @click="setView(option[0])">
            {{ option[1] }}
          </button>
        </div>
      </div>

      <div v-if="eventsPending" class="loading">Agenda laden…</div>

      <div v-else-if="view === 'month'" class="month-view">
        <div v-for="day in ['ma','di','wo','do','vr','za','zo']" :key="day" class="weekday">{{ day }}</div>
        <div v-for="day in monthDays" :key="dateKey(day)" class="month-cell" :class="{ muted: !sameMonth(day), today: isToday(day) }">
          <button class="day-number" type="button" @click="openDay(day)">{{ day.getDate() }}</button>
          <div class="month-events">
            <NuxtLink v-for="item in eventsForDay(day).slice(0, 3)" :key="item.id" class="month-event" :data-status="item.status" :to="`/admin/gigs/${item.id}`">
              <span class="event-time">{{ formatTime(item.startsAt) }}</span>
              <span class="event-title">{{ item.title }}</span>
              <span class="event-location"><Icon name="lucide:map-pin" />{{ formatLocation(item) }}</span>
            </NuxtLink>
            <button v-if="eventsForDay(day).length > 3" class="more-events" type="button" @click="openDay(day)">
              +{{ eventsForDay(day).length - 3 }} meer
            </button>
          </div>
        </div>
      </div>

      <div v-else-if="view === 'week'" class="time-grid-scroll">
        <div class="week-grid" :style="{ '--timeline-height': timelineHeight + 'px' }">
          <div class="time-header" />
          <button v-for="day in weekDays" :key="'head-'+dateKey(day)" class="week-day-head" :class="{ today: isToday(day) }" type="button" @click="openDay(day)">
            <span>{{ weekdayFormatter.format(day) }}</span>
            <strong>{{ day.getDate() }}</strong>
          </button>
          <div class="time-labels">
            <span v-for="hour in timelineHours" :key="hour" :style="{ top: ((hour - 8) * 52) + 'px' }">{{ String(hour % 24).padStart(2, '0') }}:00</span>
          </div>
          <div v-for="day in weekDays" :key="dateKey(day)" class="time-column" :class="{ today: isToday(day) }">
            <NuxtLink v-for="item in eventsForDay(day)" :key="item.id" class="time-event" :data-status="item.status" :style="eventStyle(item)" :to="`/admin/gigs/${item.id}`">
              <span class="event-time">{{ formatTime(item.startsAt) }}</span>
              <strong>{{ item.title }}</strong>
              <span class="event-location"><Icon name="lucide:map-pin" />{{ formatLocation(item) }}</span>
            </NuxtLink>
          </div>
        </div>
      </div>

      <div v-else-if="view === 'day'" class="time-grid-scroll">
        <div class="day-grid" :style="{ '--timeline-height': timelineHeight + 'px' }">
          <div class="time-labels">
            <span v-for="hour in timelineHours" :key="hour" :style="{ top: ((hour - 8) * 52) + 'px' }">{{ String(hour % 24).padStart(2, '0') }}:00</span>
          </div>
          <div class="time-column day-column">
            <NuxtLink v-for="item in eventsForDay(cursor)" :key="item.id" class="time-event day-event" :data-status="item.status" :style="eventStyle(item)" :to="`/admin/gigs/${item.id}`">
              <div class="day-event-main">
                <span class="event-time">{{ formatTime(item.startsAt) }}<template v-if="item.endsAt"> – {{ formatTime(item.endsAt) }}</template></span>
                <strong>{{ item.title }}</strong>
              </div>
              <span class="event-location"><Icon name="lucide:map-pin" />{{ formatLocation(item) }}</span>
              <span v-if="item.eventType" class="event-type">{{ item.eventType }}</span>
            </NuxtLink>
          </div>
        </div>
      </div>

      <div v-else class="year-view">
        <section v-for="month in yearMonths" :key="month.getMonth()" class="mini-month" :class="{ current: month.getMonth() === new Date().getMonth() && month.getFullYear() === new Date().getFullYear() }">
          <h3>{{ capitalize(new Intl.DateTimeFormat('nl-NL', { month: 'long' }).format(month)) }}</h3>
          <div class="mini-weekdays"><span v-for="day in ['m','d','w','d','v','z','z']" :key="day">{{ day }}</span></div>
          <div class="mini-grid">
            <button v-for="day in miniMonthDays(month)" :key="dateKey(day)" type="button" class="mini-day" :class="{ muted: day.getMonth() !== month.getMonth(), today: isToday(day), hasEvents: eventsForMiniDay(day).length }" :title="eventsForDay(day).map(item => item.title + ' — ' + formatLocation(item)).join('\n')" @click="switchToDay(day)">
              <span>{{ day.getDate() }}</span>
              <span v-if="eventsForMiniDay(day).length" class="mini-dots">
                <i v-for="item in eventsForMiniDay(day)" :key="item.id" :data-status="item.status" />
              </span>
            </button>
          </div>
        </section>
      </div>
    </section>

    <p v-if="message" class="page-message">{{ message }}</p>

    <Teleport to="body">
      <div v-if="drawerOpen" class="drawer-backdrop" @click.self="drawerOpen = false">
        <aside class="drawer" aria-label="Agenda en integraties">
          <header class="drawer-header">
            <div>
              <h2>Agenda & integraties</h2>
              <p>Beheer hoe je NightLight-gigs synchroniseert met andere agenda’s.</p>
            </div>
            <button class="icon-button" type="button" aria-label="Sluiten" @click="drawerOpen = false"><Icon name="lucide:x" /></button>
          </header>

          <section class="drawer-card">
            <div class="drawer-row">
              <div class="integration-icon google">G</div>
              <div>
                <strong>Google Calendar</strong>
                <p><span class="connection-dot" :class="{ ok: integrationData?.credentialsConfigured }" /> {{ integrationData?.credentialsConfigured ? 'Verbonden' : 'Niet geconfigureerd' }}</p>
              </div>
              <NuxtLink class="small-button" to="/admin/settings#integrations">Beheren</NuxtLink>
            </div>
          </section>

          <section class="drawer-card">
            <div class="section-title">
              <div>
                <strong>ICS-abonnement</strong>
                <p>Gebruik deze geheime link in Google Calendar, Apple Calendar of Outlook.</p>
              </div>
              <Icon name="lucide:calendar-sync" />
            </div>
            <div class="copy-field">
              <input :value="integrationData?.icsUrl || ''" readonly aria-label="ICS-abonnementslink">
              <button type="button" aria-label="Kopiëren" @click="copyIcs"><Icon name="lucide:copy" /></button>
            </div>
            <div class="split-actions">
              <button class="primary-action" type="button" @click="copyIcs">Koppeling kopiëren</button>
              <button class="quiet-button" type="button" :disabled="rotatingToken" @click="rotateIcs">{{ rotatingToken ? 'Vernieuwen…' : 'Token vernieuwen' }}</button>
            </div>
          </section>

          <section class="drawer-card settings-card">
            <label class="toggle-row">
              <span><strong>Google-synchronisatie</strong><small>Nieuwe en gewijzigde geboekte gigs automatisch synchroniseren.</small></span>
              <input v-model="settingsForm.enabled" type="checkbox">
            </label>
            <label>
              <span>Agenda-ID</span>
              <input v-model="settingsForm.calendarId" type="text">
            </label>
            <label>
              <span>Gedrag bij geannuleerde / afgewezen gigs</span>
              <select v-model="settingsForm.cancellationBehavior">
                <option value="delete">Gekoppelde afspraak verwijderen</option>
                <option value="mark_cancelled">Als geannuleerd markeren</option>
                <option value="keep">Afspraak ongewijzigd laten</option>
              </select>
            </label>
            <button class="primary-action" type="button" :disabled="settingsSaving" @click="saveSettings">{{ settingsSaving ? 'Opslaan…' : 'Instellingen opslaan' }}</button>
            <button class="sync-all" type="button" :disabled="syncing !== null || !settingsForm.enabled" @click="sync()">
              <Icon name="lucide:refresh-cw" /> {{ syncing === 'all' ? 'Synchroniseren…' : 'Nu alles synchroniseren' }}
            </button>
          </section>

          <section class="sync-section">
            <div class="sync-heading">
              <div>
                <h3>Synchronisatiestatus</h3>
                <p>Recente Google Calendar-activiteiten.</p>
              </div>
              <button class="small-button" type="button" :disabled="integrationPending" @click="refreshIntegration"><Icon name="lucide:refresh-cw" /> Vernieuwen</button>
            </div>
            <div v-if="!integrationData?.items.length" class="empty">Nog geen synchronisatietaken.</div>
            <article v-for="item in integrationData?.items || []" :key="item.gigId" class="sync-item">
              <div>
                <strong>{{ item.title }}</strong>
                <small>{{ formatSyncDate(item.startsAt) }} · {{ labelFor(gigStatusLabels, item.gigStatus) }}</small>
                <small v-if="item.lastError" class="error">{{ item.lastError }}</small>
              </div>
              <div class="sync-actions">
                <span class="pill" :data-state="item.syncStatus">{{ labelFor(calendarSyncStatusLabels, item.syncStatus) }}</span>
                <button class="icon-button compact" type="button" :disabled="syncing !== null || !settingsForm.enabled" aria-label="Deze gig synchroniseren" @click="sync(item.gigId)">
                  <Icon name="lucide:rotate-cw" />
                </button>
              </div>
            </article>
          </section>
        </aside>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.calendar-page { max-width: 1500px; margin: 0 auto; }
.page-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 1.5rem; margin-bottom: 1.5rem; }
.eyebrow { margin: 0 0 .6rem; color: #c9b2df; font-size: .72rem; font-weight: 800; letter-spacing: .22em; text-transform: uppercase; }
h1 { margin: 0; font-size: clamp(3rem, 6vw, 5.2rem); line-height: .95; letter-spacing: -.06em; }
.intro { margin: 1rem 0 0; color: #9890a1; }
button, input, select { font: inherit; }
button { color: inherit; }
.integration-button, .icon-button, .quiet-button, .small-button { border: 1px solid #312b38; background: #151219; }
.integration-button { display: flex; align-items: center; gap: .65rem; padding: .75rem .9rem; border-radius: .8rem; cursor: pointer; }
.connection-copy { color: #aaa2b2; font-size: .78rem; }
.connection-dot { display: inline-block; width: .5rem; height: .5rem; border-radius: 50%; background: #766f7c; }
.connection-dot.ok { background: #44dc78; box-shadow: 0 0 12px rgba(68,220,120,.35); }
.calendar-shell { overflow: hidden; border: 1px solid #29242f; border-radius: 1rem; background: #0f0d12; }
.toolbar { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: .9rem 1rem; border-bottom: 1px solid #29242f; }
.navigation { display: flex; align-items: center; gap: .65rem; min-width: 0; }
.icon-button, .quiet-button, .small-button { display: inline-flex; align-items: center; justify-content: center; gap: .4rem; border-radius: .65rem; cursor: pointer; }
.icon-button { width: 2.45rem; height: 2.45rem; padding: 0; }
.icon-button.compact { width: 2rem; height: 2rem; }
.quiet-button, .small-button { padding: .55rem .8rem; }
.period { margin-left: .5rem; font-size: 1.15rem; white-space: nowrap; }
.view-switcher { display: grid; grid-auto-flow: column; border: 1px solid #312b38; border-radius: .7rem; overflow: hidden; }
.view-switcher button { min-width: 74px; padding: .62rem .8rem; border: 0; border-left: 1px solid #312b38; background: transparent; color: #b1a9b8; cursor: pointer; }
.view-switcher button:first-child { border-left: 0; }
.view-switcher button.active { background: linear-gradient(180deg, rgba(126,53,188,.34), rgba(74,31,105,.32)); color: #fff; box-shadow: inset 0 0 0 1px rgba(153,72,219,.28); }
.loading { padding: 4rem; text-align: center; color: #8f8798; }

.month-view { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); }
.weekday { padding: .75rem; border-right: 1px solid #29242f; border-bottom: 1px solid #29242f; color: #8c8494; font-size: .78rem; text-align: center; }
.weekday:nth-child(7) { border-right: 0; }
.month-cell { min-height: 145px; padding: .55rem; border-right: 1px solid #29242f; border-bottom: 1px solid #29242f; }
.month-cell:nth-child(7n) { border-right: 0; }
.month-cell.muted { background: #0b090d; color: #5e5864; }
.month-cell.today { background: linear-gradient(180deg, rgba(113,45,166,.12), transparent 55%); box-shadow: inset 0 0 0 1px rgba(143,61,211,.38); }
.day-number { width: 1.9rem; height: 1.9rem; padding: 0; border: 0; border-radius: 50%; background: transparent; color: inherit; cursor: pointer; }
.today .day-number { background: #8e3de0; color: #fff; font-weight: 800; }
.month-events { display: grid; gap: .35rem; margin-top: .3rem; }
.month-event { display: grid; grid-template-columns: auto 1fr; column-gap: .4rem; row-gap: .12rem; min-width: 0; padding: .42rem .48rem; border: 1px solid #312b38; border-left: 3px solid #8e3de0; border-radius: .55rem; background: #17141b; color: #fff; text-decoration: none; }
.month-event[data-status="booked"], .time-event[data-status="booked"] { border-left-color: #8e3de0; }
.month-event[data-status="lead"], .time-event[data-status="lead"] { border-left-color: #5bb9ff; }
.month-event[data-status="declined"], .time-event[data-status="declined"], .month-event[data-status="cancelled"], .time-event[data-status="cancelled"] { border-left-color: #746c79; opacity: .58; }
.event-time { color: #aaa2b2; font-size: .68rem; white-space: nowrap; }
.event-title { overflow: hidden; font-size: .75rem; font-weight: 750; text-overflow: ellipsis; white-space: nowrap; }
.event-location { grid-column: 1 / -1; display: flex; align-items: center; gap: .25rem; overflow: hidden; color: #89818f; font-size: .66rem; text-overflow: ellipsis; white-space: nowrap; }
.event-location :deep(svg) { flex: 0 0 auto; width: .75rem; height: .75rem; }
.more-events { border: 0; background: transparent; color: #bca4d1; font-size: .72rem; text-align: left; cursor: pointer; }

.time-grid-scroll { overflow-x: auto; }
.week-grid { display: grid; grid-template-columns: 66px repeat(7, minmax(145px, 1fr)); min-width: 1080px; }
.time-header, .week-day-head { height: 58px; border: 0; border-right: 1px solid #29242f; border-bottom: 1px solid #29242f; background: #111015; }
.week-day-head { display: grid; place-content: center; gap: .1rem; color: #8f8798; cursor: pointer; }
.week-day-head strong { color: #fff; font-size: 1rem; }
.week-day-head.today strong { display: grid; width: 1.8rem; height: 1.8rem; place-content: center; margin: auto; border-radius: 50%; background: #8e3de0; }
.time-labels { position: relative; height: var(--timeline-height); border-right: 1px solid #29242f; background: #0c0a0e; }
.time-labels span { position: absolute; right: .65rem; transform: translateY(-.4rem); color: #77707e; font-size: .7rem; }
.time-column { position: relative; height: var(--timeline-height); border-right: 1px solid #29242f; background-image: repeating-linear-gradient(to bottom, transparent 0, transparent 51px, #29242f 52px); }
.time-column.today { background-color: rgba(128,49,188,.045); }
.time-event { position: absolute; right: .3rem; left: .3rem; z-index: 2; display: flex; flex-direction: column; gap: .12rem; min-height: 42px; overflow: hidden; padding: .4rem .5rem; border: 1px solid #362e3e; border-left: 3px solid #8e3de0; border-radius: .55rem; background: rgba(25,21,30,.97); color: #fff; text-decoration: none; }
.time-event strong { overflow: hidden; font-size: .75rem; text-overflow: ellipsis; white-space: nowrap; }
.day-grid { display: grid; grid-template-columns: 66px 1fr; min-width: 740px; }
.day-column { min-width: 0; }
.day-event { right: .75rem; left: .75rem; padding: .55rem .75rem; }
.day-event-main { display: flex; align-items: center; gap: 1rem; }
.day-event-main strong { font-size: .9rem; }
.day-event .event-location { font-size: .72rem; }
.event-type { color: #8f8798; font-size: .7rem; }

.year-view { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: .75rem; padding: .85rem; }
.mini-month { padding: .85rem; border: 1px solid #29242f; border-radius: .8rem; background: #111015; }
.mini-month.current { border-color: #6e2e9f; box-shadow: inset 0 0 0 1px rgba(151,62,218,.22); }
.mini-month h3 { margin: 0 0 .65rem; font-size: .95rem; }
.mini-weekdays, .mini-grid { display: grid; grid-template-columns: repeat(7, 1fr); }
.mini-weekdays span { padding-bottom: .3rem; color: #6f6875; font-size: .62rem; text-align: center; }
.mini-day { position: relative; min-height: 31px; padding: 0; border: 0; border-radius: .4rem; background: transparent; color: #c7c0cc; font-size: .68rem; cursor: pointer; }
.mini-day.muted { color: #4f4954; }
.mini-day.today { background: #7b33bb; color: #fff; }
.mini-dots { position: absolute; right: 2px; bottom: 2px; left: 2px; display: flex; justify-content: center; gap: 2px; }
.mini-dots i { width: 4px; height: 4px; border-radius: 50%; background: #8e3de0; }
.mini-dots i[data-status="lead"] { background: #5bb9ff; }
.mini-dots i[data-status="declined"], .mini-dots i[data-status="cancelled"] { background: #746c79; }

.page-message { margin: .8rem 0 0; color: #bca4d1; font-size: .82rem; }
.drawer-backdrop { position: fixed; z-index: 100; inset: 0; display: flex; justify-content: flex-end; background: rgba(5,4,7,.58); backdrop-filter: blur(2px); }
.drawer { width: min(460px, 100vw); height: 100%; overflow-y: auto; padding: 1.1rem; border-left: 1px solid #322b39; background: #0f0d12; box-shadow: -24px 0 60px rgba(0,0,0,.45); }
.drawer-header { display: flex; justify-content: space-between; gap: 1rem; margin-bottom: 1rem; }
.drawer-header h2 { margin: 0; font-size: 1.5rem; }
.drawer-header p, .drawer-card p, .sync-heading p { margin: .3rem 0 0; color: #8f8798; font-size: .78rem; }
.drawer-card { margin-top: .75rem; padding: .9rem; border: 1px solid #2d2833; border-radius: .8rem; background: #151219; }
.drawer-row, .section-title, .sync-heading, .sync-item, .sync-actions { display: flex; align-items: center; gap: .7rem; }
.drawer-row > div:nth-child(2), .section-title > div, .sync-item > div:first-child { flex: 1; min-width: 0; }
.integration-icon { display: grid; width: 2.1rem; height: 2.1rem; place-content: center; border-radius: .6rem; background: #201b25; font-weight: 900; }
.integration-icon.google { color: #fff; }
.copy-field { display: grid; grid-template-columns: 1fr auto; margin-top: .8rem; }
.copy-field input, .settings-card input[type="text"], .settings-card select { min-width: 0; padding: .65rem .7rem; border: 1px solid #352f3b; background: #0d0b10; color: #fff; }
.copy-field input { border-radius: .6rem 0 0 .6rem; }
.copy-field button { width: 2.6rem; border: 1px solid #352f3b; border-left: 0; border-radius: 0 .6rem .6rem 0; background: #19161e; cursor: pointer; }
.split-actions { display: grid; grid-template-columns: 1fr 1fr; gap: .55rem; margin-top: .6rem; }
.primary-action, .sync-all { border: 0; border-radius: .6rem; padding: .7rem; background: linear-gradient(135deg, #8f39dc, #6923ad); color: white; font-weight: 750; cursor: pointer; }
.sync-all { display: flex; align-items: center; justify-content: center; gap: .45rem; margin-top: .65rem; width: 100%; }
.settings-card { display: grid; gap: .75rem; }
.settings-card label:not(.toggle-row) { display: grid; gap: .35rem; color: #bdb5c5; font-size: .78rem; }
.settings-card select { border-radius: .6rem; }
.toggle-row { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
.toggle-row span { display: grid; gap: .2rem; }
.toggle-row small { color: #81798a; font-weight: 400; }
.toggle-row input { width: 2.6rem; accent-color: #8f39dc; }
.sync-section { margin-top: 1.2rem; }
.sync-heading { justify-content: space-between; align-items: flex-start; }
.sync-heading h3 { margin: 0; }
.sync-item { justify-content: space-between; align-items: flex-start; padding: .8rem 0; border-bottom: 1px solid #28232d; }
.sync-item small { display: block; margin-top: .2rem; color: #81798a; font-size: .7rem; }
.sync-actions { align-items: center; }
.pill { border: 1px solid #453c4f; border-radius: 999px; padding: .28rem .5rem; color: #a69eae; font-size: .62rem; text-transform: uppercase; letter-spacing: .06em; white-space: nowrap; }
.pill[data-state="synced"] { border-color: #315845; color: #8fc9a7; }
.pill[data-state="failed"] { border-color: #704048; color: #ef9aa7; }
.error { color: #ef9aa7 !important; }
.empty { padding: 1rem; border: 1px dashed #35303b; border-radius: .7rem; color: #81798a; }

@media (max-width: 1050px) {
  .year-view { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .month-cell { min-height: 125px; }
  .event-location { font-size: .61rem; }
}
@media (max-width: 800px) {
  .calendar-page { margin: 0 -.35rem; }
  .page-header { display: grid; padding: 0 .35rem; }
  .integration-button { width: 100%; }
  .toolbar { align-items: stretch; flex-direction: column; }
  .navigation { display: grid; grid-template-columns: auto 1fr auto; }
  .period { grid-column: 1 / -1; grid-row: 2; margin: .2rem 0 0; white-space: normal; }
  .view-switcher { width: 100%; }
  .view-switcher button { min-width: 0; }
  .month-view { min-width: 760px; }
  .calendar-shell { overflow-x: auto; }
  .year-view { grid-template-columns: repeat(2, minmax(260px, 1fr)); min-width: 560px; }
}
@media (max-width: 560px) {
  h1 { font-size: 3rem; }
  .connection-copy { display: none; }
  .drawer { width: 100vw; }
  .split-actions { grid-template-columns: 1fr; }
}
</style>
