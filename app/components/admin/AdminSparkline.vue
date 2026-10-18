<script setup lang="ts">
import { sparklinePoints } from '~~/shared/system-status'

const props = withDefaults(defineProps<{
  values: readonly number[]
  tone?: 'ok' | 'warn' | 'bad'
  width?: number
  height?: number
}>(), { tone: 'ok', width: 160, height: 40 })

const line = computed(() => sparklinePoints(props.values, props.width, props.height))
const area = computed(() => (line.value ? `0,${props.height} ${line.value} ${props.width},${props.height}` : ''))
</script>

<template>
  <svg
    class="sparkline"
    :class="tone"
    :viewBox="`0 0 ${width} ${height}`"
    preserveAspectRatio="none"
    role="img"
    aria-label="Verloop van de laatste metingen"
  >
    <template v-if="values.length > 1">
      <polygon class="area" :points="area" />
      <polyline class="line" :points="line" fill="none" vector-effect="non-scaling-stroke" />
    </template>
    <line v-else class="idle" x1="0" :y1="height / 2" :x2="width" :y2="height / 2" vector-effect="non-scaling-stroke" />
  </svg>
</template>

<style scoped>
.sparkline { display: block; width: 100%; height: 2.75rem; overflow: visible; --tone: var(--status-ok); }
.sparkline.warn { --tone: var(--status-warn); }
.sparkline.bad { --tone: var(--status-danger); }
.line { stroke: var(--tone); stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }
.area { fill: var(--tone); opacity: .12; }
.idle { stroke: var(--border-strong); stroke-width: 2; stroke-dasharray: 3 5; }
</style>
