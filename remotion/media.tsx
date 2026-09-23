/** @jsxImportSource react */
import React from 'react'
import { AbsoluteFill, Img, OffthreadVideo } from 'remotion'
import type { ItemCrop, ProjectAsset } from '../shared/video-project'

export function cropClipPath(crop?: ItemCrop) {
  if (!crop || (!crop.top && !crop.right && !crop.bottom && !crop.left)) return undefined
  return `inset(${crop.top * 100}% ${crop.right * 100}% ${crop.bottom * 100}% ${crop.left * 100}%)`
}

/** Full-frame image or video source, object-fit cover. */
export const MediaFill: React.FC<{
  asset: ProjectAsset | undefined
  style?: React.CSSProperties
  trimBefore?: number
  playbackRate?: number
  volume?: number
  muted?: boolean
}> = ({ asset, style, trimBefore, playbackRate, volume, muted }) => {
  if (!asset) {
    return (
      <AbsoluteFill style={{
        alignItems: 'center',
        justifyContent: 'center',
        background: 'repeating-linear-gradient(45deg, #1a1224 0 24px, #120c19 24px 48px)',
        color: 'rgba(255,255,255,.5)',
        fontSize: 32,
        fontFamily: 'Arial, Helvetica, sans-serif',
        ...style,
      }}>
        Missing media
      </AbsoluteFill>
    )
  }

  const fill: React.CSSProperties = { width: '100%', height: '100%', objectFit: 'cover', ...style }
  if (asset.mimeType.startsWith('video/')) {
    return (
      <OffthreadVideo
        src={asset.src}
        style={fill}
        trimBefore={trimBefore || undefined}
        playbackRate={playbackRate || 1}
        volume={volume ?? 1}
        muted={muted}
        pauseWhenBuffering
      />
    )
  }
  return <Img src={asset.src} style={fill} pauseWhenLoading />
}
