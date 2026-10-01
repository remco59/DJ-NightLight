<script setup lang="ts">
import { gigStatusLabels, invoiceStatusLabels, labelFor, paymentStatusLabels } from '~~/shared/labels'

// One chip for every status in the back office, so "Geboekt", "Betaald" and
// "Concept" look the same wherever they appear.
const props = defineProps<{
  kind: 'gig' | 'invoice' | 'payment'
  status: string
}>()

type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger'

const tones: Record<typeof props.kind, Record<string, Tone>> = {
  gig: { lead: 'info', booked: 'success', declined: 'danger', cancelled: 'danger' },
  invoice: { draft: 'neutral', finalized: 'info', void: 'danger' },
  payment: { unpaid: 'warning', pending: 'info', paid: 'success', failed: 'danger' },
}
const labels = { gig: gigStatusLabels, invoice: invoiceStatusLabels, payment: paymentStatusLabels }

const tone = computed<Tone>(() => tones[props.kind][props.status] ?? 'neutral')
const label = computed(() => labelFor(labels[props.kind], props.status))
</script>

<template>
  <span class="status-chip" :data-tone="tone">{{ label }}</span>
</template>

<style scoped>
.status-chip{display:inline-flex;align-items:center;gap:.35rem;width:max-content;padding:.2rem .6rem;border:1px solid var(--border-strong);border-radius:999px;color:var(--text-muted);font-size:.78rem;font-weight:700;line-height:1.3;white-space:nowrap}
.status-chip::before{content:"";width:.42rem;height:.42rem;border-radius:50%;background:currentColor}
.status-chip[data-tone=info]{border-color:#34506e;color:#a8cdf5}
.status-chip[data-tone=success]{border-color:#2f5a42;color:#a9e1bb}
.status-chip[data-tone=warning]{border-color:#5b4a24;color:#f2cf8a}
.status-chip[data-tone=danger]{border-color:#5a2a33;color:#f3a7b2}
</style>
