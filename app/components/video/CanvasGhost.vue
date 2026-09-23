<script setup lang="ts">
import { cropClipPath } from '~~/shared/video-canvas'
import { useCanvasItems } from '~/composables/useCanvasItems'
import { useVideoEditor } from '~/composables/useVideoEditor'

// Faint copy of the selected clip placed under the preview player: the player
// covers the canvas, so only the part outside the frame (what the canvas edge
// cuts off) shows, which makes framing a 16:9 clip on a 9:16 canvas visible.

const props = defineProps<{ scale: number }>()

const editor = useVideoEditor()
const { selected, boxStyle } = useCanvasItems()

const ghost = computed(() => {
  const entry = selected.value
  if (!entry || entry.item.type === 'graphic') return null
  const asset = editor.mediaById.value.get(entry.item.assetId)
  const src = asset && (entry.item.type === 'image' ? asset.url : asset.thumbnailUrl)
  if (!src) return null
  return { src, style: { ...boxStyle(entry, props.scale), clipPath: cropClipPath(entry.item.crop) } }
})
</script>

<template>
  <img v-if="ghost" class="canvas-ghost" :src="ghost.src" :style="ghost.style" alt="" aria-hidden="true">
</template>

<style scoped>
.canvas-ghost {
  position: absolute;
  max-width: none;
  object-fit: fill;
  opacity: .28;
  pointer-events: none;
}
</style>
