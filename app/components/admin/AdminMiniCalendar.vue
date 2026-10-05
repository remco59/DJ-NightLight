<script setup lang="ts">
import { addMonths, dayKey, monthGrid, monthKey } from '~~/shared/dashboard'

type CalendarGig = { id: string, title: string, startsAt: string | Date | null }

const props = defineProps<{ gigs: CalendarGig[] }>()

const todayKey = dayKey(new Date())
const currentMonth = monthKey(new Date())
const month = ref(currentMonth)

// The API sends last month through two months ahead; paging beyond that would show empty grids.
const canGoBack = computed(() => month.value > addMonths(currentMonth, -1))
const canGoForward = computed(() => month.value < addMonths(currentMonth, 2))

const grid = computed(() => monthGrid(month.value))
const gigsByDay = computed(() => {
  const map = new Map<string, CalendarGig[]>()
  for (const gig of props.gigs) {
    if (!gig.startsAt) continue
    const key = dayKey(new Date(gig.startsAt))
    map.set(key, [...(map.get(key) ?? []), gig])
  }
  return map
})
const monthGigCount = computed(() => grid.value.reduce((sum, cell) => sum + (cell.inMonth ? (gigsByDay.value.get(cell.date)?.length ?? 0) : 0), 0))

const monthLabel = computed(() => {
  const [year, mon] = month.value.split('-').map(Number) as [number, number]
  return new Date(Date.UTC(year, mon - 1, 1)).toLocaleDateString('nl-NL', { month: 'long', year: 'numeric', timeZone: 'UTC' })
})

function target(date: string) {
  const list = gigsByDay.value.get(date)
  if (!list?.length) return null
  return list.length === 1 ? `/admin/gigs/${list[0]!.id}` : '/admin/calendar'
}

function cellLabel(date: string, day: number) {
  const list = gigsByDay.value.get(date)
  if (!list?.length) return String(day)
  return `${day}: ${list.map(gig => gig.title).join(', ')}`
}

const weekdays = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo']
</script>

<template>
  <div class="mini-calendar">
    <div class="cal-nav">
      <button type="button" aria-label="Vorige maand" :disabled="!canGoBack" @click="month = addMonths(month, -1)">
        <Icon name="lucide:chevron-left" aria-hidden="true" />
      </button>
      <strong>{{ monthLabel }}</strong>
      <button type="button" aria-label="Volgende maand" :disabled="!canGoForward" @click="month = addMonths(month, 1)">
        <Icon name="lucide:chevron-right" aria-hidden="true" />
      </button>
    </div>

    <div class="cal-grid" role="grid" :aria-label="`Gigs in ${monthLabel}`">
      <span v-for="day in weekdays" :key="day" class="cal-weekday" role="columnheader">{{ day }}</span>
      <template v-for="cell in grid" :key="cell.date">
        <NuxtLink
          v-if="cell.inMonth && target(cell.date)"
          :to="target(cell.date)!"
          class="cal-cell has-gig"
          :class="{ today: cell.date === todayKey }"
          :aria-label="cellLabel(cell.date, cell.day)"
          :title="cellLabel(cell.date, cell.day)"
        >
          {{ cell.day }}
          <span class="cal-dot" aria-hidden="true" />
        </NuxtLink>
        <span
          v-else
          class="cal-cell"
          :class="{ outside: !cell.inMonth, today: cell.date === todayKey }"
          role="gridcell"
        >{{ cell.day }}</span>
      </template>
    </div>

    <p class="cal-foot">
      {{ monthGigCount ? `${monthGigCount} ${monthGigCount === 1 ? 'gig' : 'gigs'} in deze maand` : 'Geen gigs in deze maand' }}
    </p>
  </div>
</template>

<style scoped>
.mini-calendar { padding:.9rem 1rem 1rem; }
.cal-nav { display:flex; align-items:center; justify-content:space-between; margin-bottom:.6rem; }
.cal-nav strong { font-size:.88rem; text-transform:capitalize; }
.cal-nav button { display:grid; place-items:center; width:2rem; height:2rem; border:1px solid #2f2b35; border-radius:.55rem; background:#0d0b10; color:#d0c9d8; cursor:pointer; }
.cal-nav button:disabled { opacity:.35; cursor:default; }
.cal-nav button :deep(svg) { width:1rem; height:1rem; }
.cal-grid { display:grid; grid-template-columns:repeat(7,minmax(0,1fr)); gap:.2rem; }
.cal-weekday { padding:.2rem 0; color:#8f879c; font-size:.68rem; font-weight:800; text-align:center; text-transform:uppercase; }
.cal-cell { position:relative; display:grid; place-items:center; aspect-ratio:1.15; border-radius:.5rem; color:#cfc7da; font-size:.78rem; text-decoration:none; }
.cal-cell.outside { color:#4f4959; }
.cal-cell.today { border:1px solid #6d4aa8; }
.cal-cell.has-gig { background:#211439; color:#f1e6ff; font-weight:800; }
.cal-cell.has-gig:hover { background:#2b1a4d; }
.cal-dot { position:absolute; bottom:.28rem; width:.28rem; height:.28rem; border-radius:50%; background:#b45cff; }
.cal-foot { margin:.7rem 0 0; color:#8f879c; font-size:.74rem; }
</style>
