<script setup lang="ts">
import type { PostTemplateInfo } from '~~/shared/post-generator'

defineProps<{
  template: PostTemplateInfo
  thumbnail?: string | null
  selected: boolean
  /** Show the description under the title (template browser). */
  detailed?: boolean
}>()

defineEmits<{ select: [] }>()
</script>

<template>
  <button
    type="button"
    class="template-card"
    :class="{ selected, detailed }"
    :aria-pressed="selected"
    @click="$emit('select')"
  >
    <span class="shot">
      <img v-if="thumbnail" :src="thumbnail" alt="" draggable="false">
      <span v-else class="placeholder" :data-template="template.key">
        <span class="placeholder-logo">NIGHTLIGHT</span>
        <span class="placeholder-title">{{ template.label }}</span>
      </span>
      <span v-if="selected" class="check" aria-hidden="true"><Icon name="lucide:check" /></span>
    </span>
    <span class="copy">
      <strong>{{ template.label }}</strong>
      <small>{{ template.category }}</small>
    </span>
    <span v-if="detailed" class="description">{{ template.description }}</span>
  </button>
</template>

<style scoped>
.template-card {
  display: grid;
  align-content: start;
  gap: .45rem;
  min-width: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.shot {
  position: relative;
  display: grid;
  place-items: center;
  overflow: hidden;
  aspect-ratio: 4 / 5;
  border: 1px solid #2a2530;
  border-radius: .65rem;
  background: #0b0a0e;
  transition: border-color .15s ease, box-shadow .15s ease;
}

.shot img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.template-card:hover .shot {
  border-color: #4a4153;
}

.template-card.selected .shot {
  border-color: #9d5cff;
  box-shadow: 0 0 0 1px #9d5cff, 0 10px 26px rgba(124, 58, 237, .22);
}

.check {
  position: absolute;
  top: .4rem;
  right: .4rem;
  display: grid;
  width: 1.35rem;
  height: 1.35rem;
  place-items: center;
  border-radius: 50%;
  background: #8b5cf6;
  color: #fff;
  font-size: .75rem;
}

.placeholder {
  display: grid;
  align-content: space-between;
  width: 100%;
  height: 100%;
  padding: .7rem;
  background:
    radial-gradient(circle at 70% 20%, rgba(157, 92, 255, .35), transparent 60%),
    linear-gradient(180deg, #1a1422, #09080c);
}

.placeholder-logo {
  color: #fff;
  font-size: .5rem;
  font-weight: 900;
  letter-spacing: .08em;
}

.placeholder-title {
  color: #fff;
  font-size: .95rem;
  font-weight: 900;
  line-height: 1;
  text-transform: uppercase;
}

.copy {
  display: grid;
  gap: .1rem;
  min-width: 0;
}

.copy strong {
  overflow: hidden;
  color: #e8e3ee;
  font-size: .78rem;
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.copy small {
  color: #7f7888;
  font-size: .66rem;
}

.template-card.selected .copy strong {
  color: #fff;
}

.description {
  color: #8f8798;
  font-size: .72rem;
  line-height: 1.4;
}
</style>
