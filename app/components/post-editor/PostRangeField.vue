<script setup lang="ts">
// Slider with a precise numeric input. The model is in design units; the
// number field shows it multiplied by `factor` (e.g. 1.5 → 150 %).
const props = withDefaults(defineProps<{
  label: string
  min: number
  max: number
  step: number
  factor?: number
  unit?: string
}>(), {
  factor: 100,
  unit: '%',
})

const model = defineModel<number>({ required: true })
const id = useId()

const displayValue = computed(() => Math.round(model.value * props.factor))

function clamp(value: number) {
  return Math.max(props.min, Math.min(props.max, value))
}

function commitNumber(event: Event) {
  const input = event.target as HTMLInputElement
  const parsed = Number.parseFloat(input.value)
  if (Number.isFinite(parsed)) model.value = clamp(parsed / props.factor)
  input.value = String(displayValue.value)
}
</script>

<template>
  <div class="range-field">
    <label :for="id">{{ label }}</label>
    <input
      :id="id"
      v-model.number="model"
      class="range"
      type="range"
      :min="min"
      :max="max"
      :step="step"
      :style="{ '--fill': ((model - min) / (max - min)) * 100 + '%' }"
    >
    <span class="number">
      <input
        type="number"
        inputmode="numeric"
        :aria-label="`${label} (${unit})`"
        :value="displayValue"
        :min="Math.round(min * factor)"
        :max="Math.round(max * factor)"
        @change="commitNumber"
        @keydown.enter="commitNumber"
      >
      <span aria-hidden="true">{{ unit }}</span>
    </span>
  </div>
</template>

<style scoped>
.range-field {
  display: grid;
  grid-template-columns: 5.2rem minmax(0, 1fr) 4.4rem;
  align-items: center;
  gap: .75rem;
}

label {
  color: #bdb6c6;
  font-size: .8rem;
}

.range {
  width: 100%;
  height: 1.25rem;
  margin: 0;
  background: transparent;
  accent-color: #9d5cff;
  cursor: pointer;
  appearance: none;
}

.range::-webkit-slider-runnable-track {
  height: 4px;
  border-radius: 999px;
  background: linear-gradient(90deg, #8b5cf6 var(--fill), #2d2835 var(--fill));
}

.range::-moz-range-track {
  height: 4px;
  border-radius: 999px;
  background: #2d2835;
}

.range::-moz-range-progress {
  height: 4px;
  border-radius: 999px;
  background: #8b5cf6;
}

.range::-webkit-slider-thumb {
  width: 14px;
  height: 14px;
  margin-top: -5px;
  border: 2px solid #f4efff;
  border-radius: 50%;
  background: #8b5cf6;
  appearance: none;
}

.range::-moz-range-thumb {
  width: 12px;
  height: 12px;
  border: 2px solid #f4efff;
  border-radius: 50%;
  background: #8b5cf6;
}

.number {
  display: flex;
  align-items: center;
  gap: .15rem;
  min-width: 0;
  padding: 0 .5rem;
  border: 1px solid #2c2733;
  border-radius: .5rem;
  background: #131018;
  color: #8f8798;
  font-size: .75rem;
}

.number:focus-within {
  border-color: #8b5cf6;
}

.number input {
  width: 100%;
  min-width: 0;
  padding: .42rem 0;
  border: 0;
  background: transparent;
  color: #f3eff8;
  font-size: .8rem;
  font-variant-numeric: tabular-nums;
  text-align: right;
  appearance: textfield;
}

.number input:focus {
  outline: none;
}

.number input::-webkit-inner-spin-button,
.number input::-webkit-outer-spin-button {
  margin: 0;
  appearance: none;
}
</style>
