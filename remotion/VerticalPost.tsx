import React from 'react'
import {
  AbsoluteFill,
  Audio,
  Img,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion'
import type { VerticalPostProps } from './Root'

const palette = {
  night: { accent: '#b07cff', wash: 'rgba(71, 34, 105, .55)', panel: 'rgba(10, 8, 15, .72)' },
  mono: { accent: '#ffffff', wash: 'rgba(0, 0, 0, .45)', panel: 'rgba(0, 0, 0, .74)' },
  warm: { accent: '#ff9a58', wash: 'rgba(112, 45, 16, .48)', panel: 'rgba(18, 8, 4, .72)' },
} as const

export const VerticalPost: React.FC<VerticalPostProps> = ({ imageSrc, audioSrc, design }) => {
  const frame = useCurrentFrame()
  const { fps, durationInFrames } = useVideoConfig()
  const colors = palette[design.brandPreset]
  const enter = spring({ frame, fps, config: { damping: 18, stiffness: 90 } })
  const progress = frame / Math.max(1, durationInFrames - 1)
  const motionStrength = design.motionPreset === 'minimal' ? 0.25 : design.motionPreset === 'energy' ? 1 : 0.55
  const zoom = 1.04 + progress * 0.12 * motionStrength
  const drift = interpolate(progress, [0, 1], [-22, 22]) * motionStrength
  const pulse = design.templateKey === 'pulse'
    ? 1 + Math.sin(frame / 7) * 0.008 * motionStrength
    : 1
  const slide = design.templateKey === 'slide' ? interpolate(enter, [0, 1], [70, 0]) : 0

  return (
    <AbsoluteFill style={{ backgroundColor: '#09080b', fontFamily: 'Arial, Helvetica, sans-serif', overflow: 'hidden' }}>
      {imageSrc ? (
        <Img
          src={imageSrc}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: `translate3d(${drift}px, 0, 0) scale(${zoom * pulse})`,
            filter: design.brandPreset === 'mono' ? 'grayscale(1) contrast(1.08)' : 'saturate(1.08) contrast(1.04)',
          }}
        />
      ) : null}

      <AbsoluteFill style={{ background: `linear-gradient(180deg, ${colors.wash} 0%, rgba(5,4,7,.08) 38%, rgba(5,4,7,${design.overlayOpacity}) 100%)` }} />

      <div style={{
        position: 'absolute',
        inset: '150px 82px 170px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: design.templateKey === 'spotlight' ? 'flex-end' : 'space-between',
        transform: `translateY(${slide}px)`,
        opacity: enter,
      }}>
        <div style={{ color: colors.accent, fontSize: 34, fontWeight: 900, letterSpacing: 8 }}>
          {design.logoText}
        </div>

        <div style={{
          padding: design.templateKey === 'pulse' ? '44px 42px' : '0',
          borderRadius: 36,
          background: design.templateKey === 'pulse' ? colors.panel : 'transparent',
          border: design.templateKey === 'pulse' ? `2px solid ${colors.accent}55` : 'none',
        }}>
          <div style={{ color: '#fff', fontSize: 94, lineHeight: .95, fontWeight: 950, letterSpacing: -5, textTransform: 'uppercase' }}>
            {design.headline}
          </div>
          {design.subline ? <div style={{ marginTop: 30, color: 'rgba(255,255,255,.78)', fontSize: 36, fontWeight: 600 }}>{design.subline}</div> : null}
          {(design.dateText || design.locationText) ? (
            <div style={{ marginTop: 42, display: 'flex', gap: 18, flexWrap: 'wrap' }}>
              {[design.dateText, design.locationText].filter(Boolean).map((item) => (
                <span key={item} style={{ padding: '16px 22px', borderRadius: 999, background: colors.panel, color: '#fff', fontSize: 28, fontWeight: 800 }}>{item}</span>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {audioSrc ? <Audio src={audioSrc} volume={0.9} /> : null}
    </AbsoluteFill>
  )
}
