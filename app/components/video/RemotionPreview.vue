<script setup lang="ts">
import type { PlayerRef } from '@remotion/player'
import type React from 'react'
import type { Root } from 'react-dom/client'
import type { ProjectAssetMap, VideoProject } from '~~/shared/video-project'
import { projectDurationFrames } from '~~/shared/video-project'

// Mounts the real Remotion composition (React) inside the Vue editor through
// @remotion/player, so what you preview is exactly what the worker renders.

const props = defineProps<{
  project: VideoProject
  assets: ProjectAssetMap
  width: number
  height: number
}>()

const emit = defineEmits<{
  frame: [frame: number]
  playing: [playing: boolean]
}>()

const container = ref<HTMLElement | null>(null)
const failed = ref('')
let root: Root | null = null
let player: PlayerRef | null = null
let renderPlayer: (() => void) | null = null

function onFrame(event: { detail: { frame: number } }) {
  emit('frame', event.detail.frame)
}
function onPlay() {
  emit('playing', true)
}
function onPause() {
  emit('playing', false)
}

function attach(ref: PlayerRef | null) {
  if (ref === player) return
  if (player) {
    player.removeEventListener('frameupdate', onFrame)
    player.removeEventListener('seeked', onFrame)
    player.removeEventListener('play', onPlay)
    player.removeEventListener('pause', onPause)
  }
  player = ref
  if (player) {
    player.addEventListener('frameupdate', onFrame)
    player.addEventListener('seeked', onFrame)
    player.addEventListener('play', onPlay)
    player.addEventListener('pause', onPause)
  }
}

onMounted(async () => {
  try {
    const [{ createElement }, { createRoot }, { Player }, { ProjectComposition }] = await Promise.all([
      import('react'),
      import('react-dom/client'),
      import('@remotion/player'),
      import('~~/remotion/ProjectComposition'),
    ])
    if (!container.value) return
    root = createRoot(container.value)
    renderPlayer = () => {
      // Vue proxies are not safe to hand to React; pass a plain snapshot.
      const project = JSON.parse(JSON.stringify(props.project)) as VideoProject
      root?.render(createElement(Player, {
        ref: attach,
        // Player's generic props do not survive createElement; the props shape is checked above.
        component: ProjectComposition as unknown as React.FC<Record<string, unknown>>,
        inputProps: { project, assets: { ...props.assets } },
        durationInFrames: projectDurationFrames(project),
        compositionWidth: project.width,
        compositionHeight: project.height,
        fps: project.fps,
        style: { width: `${props.width}px`, height: `${props.height}px` },
        clickToPlay: false,
        doubleClickToFullscreen: false,
        spaceKeyToPlayOrPause: false,
        // Music, clip audio and template sound effects share these; see graphicSounds().
        numberOfSharedAudioTags: 16,
        acknowledgeRemotionLicense: true,
      }))
    }
    renderPlayer()
  } catch (error) {
    console.error('Remotion preview failed to load', error)
    failed.value = 'Het voorbeeld kan in deze browser niet worden geladen.'
  }
})

watch(() => [props.project, props.assets, props.width, props.height], () => renderPlayer?.(), { deep: true })

onBeforeUnmount(() => {
  attach(null)
  root?.unmount()
  root = null
})

defineExpose({
  play: () => player?.play(),
  pause: () => player?.pause(),
  toggle: () => player?.toggle(),
  seek: (frame: number) => player?.seekTo(frame),
  isPlaying: () => player?.isPlaying() ?? false,
  setVolume: (volume: number) => player?.setVolume(volume),
  requestFullscreen: () => player?.requestFullscreen(),
})
</script>

<template>
  <div class="remotion-preview" :style="{ width: `${width}px`, height: `${height}px` }">
    <div ref="container" />
    <p v-if="failed" class="preview-error">{{ failed }}</p>
  </div>
</template>

<style scoped>
.remotion-preview {
  position: relative;
  background: #000;
  box-shadow: 0 30px 80px rgba(0, 0, 0, .55);
}

.preview-error {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  margin: 0;
  padding: 1rem;
  color: #fca5a5;
  text-align: center;
}
</style>
