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
import { graphicBackdrop, mediaFit } from '../shared/video-project'
import { mediaBoxSize } from '../shared/video-canvas'
import { animationState, animationStyle } from './animation'
import { MediaFill, cropClipPath } from './media'
import { MOTION_ACCENTS } from '../shared/video-templates'
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
  const { width, height } = useVideoConfig()
  const kenBurns = item.type === 'image' ? 1 + item.kenBurns * 0.12 * (frame / Math.max(1, item.duration)) : 1
  const asset = assets[item.assetId]
  const fit = mediaFit(item, trackKind)
  // The box has the source's aspect ratio and is centred on the canvas, so the
  // canvas edge (not object-fit) crops it and moving/zooming reveals the rest.
  // Crop insets are therefore relative to the source.
  const box = mediaBoxSize(asset, { width, height }, fit)
  return h(
    'div',
    {
      style: {
        position: 'absolute',
        left: (width - box.width) / 2,
        top: (height - box.height) / 2,
        width: box.width,
        height: box.height,
        opacity: item.opacity,
        clipPath: cropClipPath(item.crop),
        ...transformStyle(item.transform, kenBurns),
      },
    },
    h(MediaFill, {
      asset,
      // Only matters when the source size is unknown and the box is the canvas.
      style: { objectFit: fit },
      trimBefore: item.type === 'video' ? item.trimStart : undefined,
      playbackRate: item.type === 'video' ? item.speed : undefined,
      volume: item.type === 'video' ? item.volume : undefined,
      muted: item.type === 'video' ? item.muted || trackMuted : true,
    }),
  )
}

function backdropStyle(item: GraphicItem, strength: number, fade: number): React.CSSProperties {
  const colors = MOTION_ACCENTS[item.accent] || MOTION_ACCENTS['neon-purple']
  switch (item.backdropStyle) {
    case 'blur':
      return {
        backdropFilter: `blur(${Math.round(4 + strength * 28)}px) brightness(${1 - strength * 0.7})`,
        opacity: fade,
      }
    case 'gradient':
      // Dark at the bottom and top edge with the accent glowing through the middle.
      return {
        background: `linear-gradient(180deg, rgba(5,3,10,.55) 0%, ${colors.glow}66 45%, rgba(5,3,10,.9) 78%, #05030a 100%)`,
        opacity: Math.min(1, strength * 1.6) * fade,
      }
    default:
      return { background: '#05030a', opacity: strength * fade }
  }
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
  const state = animationState({
    frame,
    duration: item.duration,
    entrance: item.entrance,
    exit: item.exit,
    entranceFrames: item.entranceFrames,
    exitFrames: item.exitFrames,
  })
  const animation = animationStyle(state)
  // Full-frame treatment of the footage underneath; it ignores the item's
  // transform and fades with the entrance/exit so the cut-in stays smooth.
  const strength = graphicBackdrop(item)
  const fade = item.opacity * state.opacity
  return h(
    AbsoluteFill,
    null,
    strength > 0 && fade > 0 ? h(AbsoluteFill, { style: backdropStyle(item, strength, fade) }) : null,
    h(
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
