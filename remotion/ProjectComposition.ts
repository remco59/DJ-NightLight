import type React from 'react'
import { createElement as h } from 'react'
import { AbsoluteFill, Html5Audio, interpolate, Sequence, useCurrentFrame, useVideoConfig } from 'remotion'
import type {
  AudioClipItem,
  GraphicItem,
  ImageClipItem,
  ItemTransform,
  ProjectAssetMap,
  TrackKind,
  VideoClipItem,
  VideoProject,
} from '../shared/video-project'
import { animationState, animationStyle } from './animation'
import { MediaFill, cropClipPath } from './media'
import { MOTION_TEMPLATE_COMPONENTS } from './motion-templates'

// Single source of truth for what a project looks like. The editor mounts
// this component in @remotion/player and the render worker renders it with
// @remotion/renderer, so the preview is the export.

export type ProjectCompositionProps = {
  project: VideoProject
  assets: ProjectAssetMap
}

export const PROJECT_COMPOSITION_ID = 'NightLightProject'

function transformStyle(transform: ItemTransform, extraScale = 1): React.CSSProperties {
  return {
    transform: `translate(${transform.x}px, ${transform.y}px) rotate(${transform.rotation}deg) scale(${transform.scale * extraScale})`,
  }
}

const MediaItemView: React.FC<{
  item: VideoClipItem | ImageClipItem
  assets: ProjectAssetMap
  trackKind: TrackKind
  trackMuted: boolean
}> = ({ item, assets, trackKind, trackMuted }) => {
  const frame = useCurrentFrame()
  const kenBurns = item.type === 'image' ? 1 + item.kenBurns * 0.12 * (frame / Math.max(1, item.duration)) : 1
  const overlay = trackKind === 'graphics'
  return h(
    AbsoluteFill,
    { style: { opacity: item.opacity, clipPath: cropClipPath(item.crop), ...transformStyle(item.transform, kenBurns) } },
    h(MediaFill, {
      asset: assets[item.assetId],
      style: overlay ? { objectFit: 'contain' } : undefined,
      trimBefore: item.type === 'video' ? item.trimStart : undefined,
      playbackRate: item.type === 'video' ? item.speed : undefined,
      volume: item.type === 'video' ? item.volume : undefined,
      muted: item.type === 'video' ? item.muted || trackMuted : true,
    }),
  )
}

const GraphicItemView: React.FC<{
  item: GraphicItem
  assets: ProjectAssetMap
}> = ({ item, assets }) => {
  const frame = useCurrentFrame()
  const { width, height, fps } = useVideoConfig()
  const Template = MOTION_TEMPLATE_COMPONENTS[item.templateKey]
  if (!Template) return null
  // Templates are designed on a canvas whose short side is 1080px.
  const unit = Math.min(width, height) / 1080
  const virtualWidth = width / unit
  const virtualHeight = height / unit
  const animation = animationStyle(
    animationState({
      frame,
      duration: item.duration,
      entrance: item.entrance,
      exit: item.exit,
      entranceFrames: item.entranceFrames,
      exitFrames: item.exitFrames,
    }),
  )
  return h(
    AbsoluteFill,
    { style: { opacity: item.opacity, ...transformStyle(item.transform) } },
    h(
      'div',
      {
        style: {
          position: 'absolute',
          left: 0,
          top: 0,
          width: virtualWidth,
          height: virtualHeight,
          transform: `scale(${unit})`,
          transformOrigin: 'top left',
        },
      },
      h(
        AbsoluteFill,
        { style: animation },
        h(Template, {
          item,
          frame,
          fps,
          width: virtualWidth,
          height: virtualHeight,
          assets,
        }),
      ),
    ),
  )
}

const AudioItemView: React.FC<{
  item: AudioClipItem
  assets: ProjectAssetMap
}> = ({ item, assets }) => {
  const asset = assets[item.assetId]
  if (!asset) return null
  const volume = (frame: number) => {
    const fadeIn = item.fadeIn > 0 ? interpolate(frame, [0, item.fadeIn], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) : 1
    const fadeOut =
      item.fadeOut > 0
        ? interpolate(frame, [item.duration - item.fadeOut, item.duration], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
        : 1
    return Math.max(0, Math.min(1, item.volume * fadeIn * fadeOut))
  }
  return h(Html5Audio, {
    src: asset.src,
    trimBefore: item.trimStart || undefined,
    volume,
    pauseWhenBuffering: true,
  })
}

export const ProjectComposition: React.FC<ProjectCompositionProps> = ({ project, assets }) => {
  const { fps } = useVideoConfig()
  return h(
    AbsoluteFill,
    { style: { backgroundColor: project.background, overflow: 'hidden' } },
    project.tracks.map(track => {
      if (track.hidden) return null
      return h(
        AbsoluteFill,
        { key: track.id },
        track.items.map(item =>
          h(
            Sequence,
            {
              key: item.id,
              from: item.start,
              durationInFrames: item.duration,
              premountFor: fps,
              name: item.type,
            },
            item.type === 'graphic'
              ? h(GraphicItemView, { item, assets })
              : item.type === 'audio'
                ? track.muted
                  ? null
                  : h(AudioItemView, { item, assets })
                : h(MediaItemView, {
                    item,
                    assets,
                    trackKind: track.kind,
                    trackMuted: track.muted,
                  }),
          ),
        ),
      )
    }),
  )
}
