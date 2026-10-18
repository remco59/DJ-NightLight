<script setup lang="ts">
import {
  TRANSITIONS,
  TRANSITION_GROUPS,
  TRANSITION_GROUP_KEYS,
  type TransitionKey,
} from '~~/shared/video-transitions'

// Choose one of the registered transitions, grouped like the registry. Adding
// a transition to shared/video-transitions.ts makes it show up here.
defineProps<{ modelValue: TransitionKey | null }>()
const emit = defineEmits<{ 'update:modelValue': [key: TransitionKey | null] }>()

const groups = TRANSITION_GROUP_KEYS.map(group => ({
  key: group,
  label: TRANSITION_GROUPS[group],
  items: (Object.keys(TRANSITIONS) as TransitionKey[]).filter(key => TRANSITIONS[key].group === group),
})).filter(group => group.items.length)
</script>

<template>
  <div class="picker">
    <button type="button" class="none" :class="{ active: modelValue === null }" :aria-pressed="modelValue === null" @click="emit('update:modelValue', null)">
      <Icon name="lucide:ban" aria-hidden="true" />Geen
    </button>
    <fieldset v-for="group in groups" :key="group.key">
      <legend>{{ group.label }}</legend>
      <div class="grid">
        <button
          v-for="key in group.items"
          :key="key"
          type="button"
          class="option"
          :class="{ active: modelValue === key }"
          :aria-pressed="modelValue === key"
          :title="TRANSITIONS[key].description"
          @click="emit('update:modelValue', key)"
        >
          <Icon :name="TRANSITIONS[key].icon" aria-hidden="true" />
          <span>{{ TRANSITIONS[key].label }}</span>
        </button>
      </div>
    </fieldset>
  </div>
</template>

<style scoped>
.picker {
  display: flex;
  flex-direction: column;
  gap: .6rem;
}

fieldset {
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}

legend {
  padding: 0;
  margin-bottom: .3rem;
  color: var(--ve-muted);
  font-size: .72rem;
  text-transform: uppercase;
  letter-spacing: .06em;
}

.grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: .35rem;
}

button {
  display: flex;
  align-items: center;
  gap: .45rem;
  min-width: 0;
  min-height: 34px;
  padding: .4rem .55rem;
  border: 1px solid var(--ve-border);
  border-radius: 7px;
  background: var(--ve-bg);
  color: var(--ve-text);
  font-size: .78rem;
  text-align: left;
  cursor: pointer;
}

button span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

button:hover { border-color: var(--ve-accent); }

button.active {
  border-color: var(--ve-accent);
  background: color-mix(in srgb, var(--ve-accent) 22%, var(--ve-bg));
}

button:focus-visible {
  outline: 2px solid var(--ve-accent);
  outline-offset: 1px;
}

.none { align-self: flex-start; }

@media (pointer: coarse) {
  button { min-height: 44px; }
}
</style>
