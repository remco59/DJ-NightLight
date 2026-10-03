<script setup lang="ts">
import { isAnimated, keyframeAt, toggleKeyframe, type KeyframeProp } from '~~/shared/video-keyframes'
import type { TimelineItem } from '~~/shared/video-project'
import { useVideoEditor } from '~/composables/useVideoEditor'

// Diamond next to an animatable value: adds a keyframe at the playhead (holding
// the current value) or removes the one that is there. Outline = the value is
// animated, filled = there is a keyframe on this very frame.

const props = defineProps<{ item: TimelineItem, props: KeyframeProp[], label: string }>()

const editor = useVideoEditor()
const frame = computed(() => editor.state.frame - props.item.start)
const inside = computed(() => frame.value >= 0 && frame.value < props.item.duration)
const animated = computed(() => props.props.some(prop => isAnimated(props.item, prop)))
const onKeyframe = computed(() => props.props.every(prop => keyframeAt(props.item, prop, frame.value)))

function toggle() {
  if (!inside.value) return
  const at = frame.value
  const remove = onKeyframe.value
  editor.patchItem(props.item.id, (target) => {
    for (const prop of props.props) {
      const has = Boolean(keyframeAt(target, prop, at))
      if (remove === has) toggleKeyframe(target, prop, at)
    }
  }, `${props.item.id}:keyframe:${Date.now()}`)
}
</script>

<template>
  <button
    type="button"
    class="keyframe-button"
    :class="{ animated, on: onKeyframe }"
    :disabled="!inside"
    :aria-pressed="onKeyframe"
    :title="onKeyframe ? `Keyframe ${label} verwijderen` : `Keyframe ${label} toevoegen op de playhead`"
    :aria-label="onKeyframe ? `Keyframe ${label} verwijderen` : `Keyframe ${label} toevoegen`"
    @click.prevent="toggle"
  >
    <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M6 1 11 6 6 11 1 6Z" /></svg>
  </button>
</template>

<style scoped>
.keyframe-button {
  display: inline-grid;
  flex: none;
  width: 22px;
  height: 22px;
  padding: 0;
  place-items: center;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: rgba(255, 255, 255, .35);
  cursor: pointer;
}

.keyframe-button svg path { fill: none; stroke: currentColor; stroke-width: 1.4; stroke-linejoin: round; }
.keyframe-button:hover:not(:disabled) { color: #ddd6fe; }
.keyframe-button.animated { color: #a78bfa; }
.keyframe-button.on { color: #facc15; }
.keyframe-button.on svg path { fill: currentColor; }
.keyframe-button:disabled { opacity: .35; cursor: default; }
.keyframe-button:focus-visible { outline: 2px solid rgba(167, 139, 250, .8); }

@media (pointer: coarse) {
  .keyframe-button { width: 32px; height: 32px; }
}
</style>
