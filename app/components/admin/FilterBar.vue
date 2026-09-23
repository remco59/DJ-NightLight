<script setup lang="ts">
const props = withDefaults(defineProps<{
  hasAdvanced?: boolean
  advancedOpen?: boolean
  activeAdvancedCount?: number
  hasActiveFilters?: boolean
  resultsLabel?: string
  compact?: boolean
}>(), {
  hasAdvanced: false,
  advancedOpen: false,
  activeAdvancedCount: 0,
  hasActiveFilters: false,
  resultsLabel: '',
  compact: false,
})

const emit = defineEmits<{
  toggleAdvanced: []
  clearAll: []
}>()

const slots = useSlots()
const hasToolbar = computed(() => Boolean(slots.toolbar))
</script>

<template>
  <div class="filter-system" :class="{ compact: props.compact }">
    <section class="filter-card">
      <div class="primary-row">
        <div class="primary-controls">
          <slot name="primary" />
        </div>
        <button
          v-if="props.hasAdvanced"
          class="more-filters"
          type="button"
          :aria-expanded="props.advancedOpen"
          @click="emit('toggleAdvanced')"
        >
          <Icon name="lucide:list-filter" aria-hidden="true" />
          <span>More filters</span>
          <span v-if="props.activeAdvancedCount" class="count-badge">{{ props.activeAdvancedCount }}</span>
          <Icon class="caret" :name="props.advancedOpen ? 'lucide:chevron-up' : 'lucide:chevron-down'" aria-hidden="true" />
        </button>
      </div>

      <div v-if="props.hasAdvanced && props.advancedOpen" class="advanced-row">
        <slot name="advanced" />
      </div>

      <div v-if="props.hasActiveFilters" class="active-row">
        <div class="chips">
          <slot name="chips" />
        </div>
        <button class="clear-all" type="button" @click="emit('clearAll')">Clear all</button>
      </div>
    </section>

    <div v-if="props.resultsLabel || hasToolbar" class="results-toolbar">
      <strong v-if="props.resultsLabel">{{ props.resultsLabel }}</strong>
      <div v-if="hasToolbar" class="toolbar-actions">
        <slot name="toolbar" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.filter-system{display:grid;gap:.9rem;margin-bottom:1rem}
.filter-card{overflow:hidden;border:1px solid #302a38;border-radius:1rem;background:#0e0c11}
.primary-row{display:flex;gap:.65rem;align-items:stretch;padding:.75rem}
.primary-controls{display:grid;grid-template-columns:minmax(16rem,2fr) repeat(2,minmax(10rem,1fr));gap:.6rem;min-width:0;flex:1}
.primary-controls :deep(:only-child){grid-column:1/-1}
.primary-controls :deep(input),.primary-controls :deep(select),.advanced-row :deep(input),.advanced-row :deep(select){width:100%;min-height:3rem;border:1px solid #393340;border-radius:.72rem;padding:.72rem .82rem;background:#0b0a0d;color:#f6f3fa;font:inherit}
.primary-controls :deep(input:focus),.primary-controls :deep(select:focus),.advanced-row :deep(input:focus),.advanced-row :deep(select:focus),.more-filters:focus-visible,.clear-all:focus-visible{outline:2px solid #9c82d9;outline-offset:2px}
.more-filters{display:flex;align-self:flex-start;align-items:center;justify-content:center;gap:.5rem;min-width:10.8rem;border:1px solid #4a4056;border-radius:.72rem;padding:.72rem .9rem;background:#15121a;color:#f5f1f8;font:inherit;font-weight:700;cursor:pointer}
.more-filters:hover{background:#1c1722;border-color:#655577}
.more-filters svg{width:1.1rem;height:1.1rem}
.count-badge{display:grid;min-width:1.45rem;height:1.45rem;place-items:center;border-radius:999px;background:#8770d4;color:#fff;font-size:.72rem;font-weight:900}
.caret{color:#9f96a8}
.advanced-row{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:.6rem;padding:.8rem;border-top:1px solid #27222e;background:#100e14}
.advanced-row :deep(label){display:grid;gap:.35rem;color:#9b94a3;font-size:.76rem}
.active-row{display:flex;align-items:center;justify-content:space-between;gap:.75rem;padding:.7rem .8rem;border-top:1px solid #27222e}
.chips{display:flex;flex-wrap:wrap;gap:.45rem;min-width:0}
.clear-all{border:0;background:transparent;color:#c9bfd2;font:inherit;font-size:.8rem;cursor:pointer;white-space:nowrap}
.clear-all:hover{color:#fff}
.results-toolbar{display:flex;align-items:center;justify-content:space-between;gap:1rem;padding-inline:.2rem}
.results-toolbar>strong{font-size:1rem}
.toolbar-actions{display:flex;align-items:center;gap:.55rem}
.toolbar-actions :deep(select){border:1px solid #393340;border-radius:.7rem;padding:.65rem .8rem;background:#0d0b10;color:#f6f3fa}
.compact{gap:.55rem;margin-bottom:.65rem}
.compact .filter-card{border-radius:.8rem}
.compact .primary-row{padding:.55rem}
.compact .primary-controls{grid-template-columns:1fr}
.compact .primary-controls :deep(input),.compact .primary-controls :deep(select){min-height:2.65rem}
.compact .active-row{padding:.55rem}
@media(max-width:900px){
  .primary-row{flex-wrap:wrap}
  .primary-controls{grid-template-columns:minmax(0,2fr) minmax(9rem,1fr)}
  .primary-controls :deep(:first-child){grid-column:1/-1}
  .more-filters{flex:1}
  .advanced-row{grid-template-columns:repeat(2,minmax(0,1fr))}
}
@media(max-width:620px){
  .primary-controls,.advanced-row{grid-template-columns:1fr}
  .primary-controls :deep(:first-child){grid-column:auto}
  .more-filters{width:100%}
  .active-row,.results-toolbar{align-items:stretch;flex-direction:column}
  .clear-all{align-self:flex-start;padding:.25rem 0}
  .toolbar-actions{width:100%}
  .toolbar-actions :deep(select){width:100%}
}
</style>
