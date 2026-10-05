<script setup lang="ts">
import type { RevenueMonth } from '~~/shared/dashboard'

const props = defineProps<{ months: RevenueMonth[] }>()

const max = computed(() => Math.max(...props.months.map(month => month.cents), 0))
const total = computed(() => props.months.reduce((sum, month) => sum + month.cents, 0))

function monthLabel(key: string) {
  const [year, month] = key.split('-').map(Number) as [number, number]
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('nl-NL', { month: 'short', timeZone: 'UTC' }).replace('.', '')
}

function monthTitle(key: string) {
  const [year, month] = key.split('-').map(Number) as [number, number]
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('nl-NL', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

function euro(cents: number) {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(cents / 100)
}

function compactEuro(cents: number) {
  if (cents >= 100_000) return `€${(cents / 100_000).toFixed(1).replace('.', ',').replace(',0', '')}k`
  return euro(cents)
}

function barHeight(cents: number) {
  if (!max.value || cents <= 0) return '0%'
  // Keep a sliver visible so a small month still reads as a bar.
  return `${Math.max(4, Math.round((cents / max.value) * 100))}%`
}
</script>

<template>
  <div class="revenue-chart">
    <p v-if="!total" class="chart-empty">Nog geen geboekte omzet in deze periode.</p>
    <ul v-else class="bars" aria-label="Geboekte omzet per maand">
      <li
        v-for="month in months"
        :key="month.key"
        class="bar-col"
        :class="{ current: month.current, future: month.future, zero: !month.cents }"
        :title="`${monthTitle(month.key)}: ${euro(month.cents)}${month.future ? ' (al geboekt)' : ''}`"
      >
        <span class="bar-value">{{ month.cents ? compactEuro(month.cents) : '' }}</span>
        <span class="bar-track"><span class="bar" :style="{ height: barHeight(month.cents) }" /></span>
        <span class="bar-label">{{ monthLabel(month.key) }}</span>
        <span class="sr-only">{{ monthTitle(month.key) }}: {{ euro(month.cents) }}</span>
      </li>
    </ul>
    <p v-if="total" class="legend">
      <span class="swatch past" /> Afgelopen
      <span class="swatch now" /> Deze maand
      <span class="swatch future" /> Al geboekt voor later
    </p>
  </div>
</template>

<style scoped>
.revenue-chart { padding:1rem 1rem .9rem; }
.bars { display:grid; grid-template-columns:repeat(12,minmax(0,1fr)); gap:.5rem; height:200px; margin:0; padding:0; list-style:none; }
.bar-col { display:grid; grid-template-rows:1.1rem minmax(0,1fr) 1.2rem; gap:.3rem; min-width:0; text-align:center; }
.bar-value { color:#b9b0c6; font-size:.66rem; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.bar-track { display:flex; align-items:flex-end; border-bottom:1px solid var(--border); }
.bar { display:block; width:100%; border-radius:.35rem .35rem 0 0; background:#4a3578; }
.bar-col.current .bar { background:linear-gradient(180deg,#b45cff,#7c3aed); }
.bar-col.future .bar { background:repeating-linear-gradient(135deg,#2e2349 0 5px,#3a2d5c 5px 10px); border:1px dashed #5b4a8a; border-bottom:0; }
.bar-label { color:#8f879c; font-size:.7rem; font-weight:700; text-transform:capitalize; }
.bar-col.current .bar-label { color:#d9c2ff; }
.legend { display:flex; flex-wrap:wrap; align-items:center; gap:.4rem 1rem; margin:.85rem 0 0; color:#8f879c; font-size:.72rem; }
.swatch { display:inline-block; width:.7rem; height:.7rem; margin-right:-.5rem; border-radius:.2rem; }
.swatch.past { background:#4a3578; }
.swatch.now { background:#9b4dff; }
.swatch.future { background:#3a2d5c; border:1px dashed #5b4a8a; }
.chart-empty { margin:0; padding:2rem .5rem; color:var(--text-subtle); font-size:.85rem; }
.sr-only { position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0); white-space:nowrap; }
@media (max-width: 520px) {
  .bars { gap:.25rem; height:170px; }
  .bar-value { display:none; }
}
</style>
