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
import type { VideoFieldVisibility } from '../shared/video-generator'
import { BODY_FONT_FAMILY } from './fonts'
import type { VerticalPostProps } from './Root'

const palette = {
  night: {
    accent: '#b77bff',
    accentSoft: '#d8b9ff',
    wash: 'rgba(71, 34, 105, .58)',
    panel: 'rgba(10, 8, 15, .82)',
  },
  mono: {
    accent: '#ffffff',
    accentSoft: '#d7d3dc',
    wash: 'rgba(0, 0, 0, .48)',
    panel: 'rgba(0, 0, 0, .82)',
  },
  warm: {
    accent: '#ff8d58',
    accentSoft: '#ffc2a4',
    wash: 'rgba(112, 45, 16, .52)',
    panel: 'rgba(18, 8, 4, .82)',
  },
} as const

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

export const VerticalPost: React.FC<VerticalPostProps> = ({ imageSrc, audioSrc, design }) => {
  const frame = useCurrentFrame()
  const { fps, durationInFrames } = useVideoConfig()
  const colors = palette[design.brandPreset] || palette.night
  const visibility = design.visibility
  const visible = (key: keyof VideoFieldVisibility) => visibility?.[key] !== false
  const enter = spring({ frame, fps, config: { damping: 18, stiffness: 90 } })
  const progress = frame / Math.max(1, durationInFrames - 1)
  const motionStrength = design.motionPreset === 'minimal' ? 0.25 : design.motionPreset === 'energy' ? 1 : 0.55
  const baseZoom = clamp(design.zoom ?? 1, 1, 3)
  const zoom = baseZoom * (1.02 + progress * 0.1 * motionStrength)
  const drift = interpolate(progress, [0, 1], [-22, 22]) * motionStrength
  const pulse = design.templateKey === 'pulse'
    ? 1 + Math.sin(frame / 7) * 0.008 * motionStrength
    : 1
  const slide = design.templateKey === 'slide' ? interpolate(enter, [0, 1], [70, 0]) : 0
  const textAlign = design.textAlign || 'left'
  const textPosition = design.textPosition || 'bottom'
  const imageX = clamp(design.imageX ?? 0, -1, 1)
  const imageY = clamp(design.imageY ?? 0, -1, 1)
  const objectPosition = `${50 + imageX * 50}% ${50 + imageY * 50}%`
  const campaign = ['gig-announcement', 'recap', 'upcoming-gigs'].includes(design.templateKey)

  const logo = visible('logo') && design.logoText ? (
    <div style={{
      position: 'absolute',
      top: 118,
      left: 82,
      right: 82,
      color: colors.accent,
      fontSize: 31,
      fontWeight: 950,
      letterSpacing: 8,
      textAlign,
      textShadow: `0 0 26px ${colors.accent}77`,
      opacity: enter,
    }}>
      {design.logoText}
    </div>
  ) : null

  const metaChips = [
    visible('date') ? design.dateText : '',
    visible('time') ? design.timeText : '',
    visible('location') ? design.locationText : '',
  ].filter(Boolean)

  const regularContent = (
    <div style={{
      position: 'absolute',
      inset: '170px 82px 170px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: textPosition === 'top' ? 'flex-start' : textPosition === 'middle' ? 'center' : 'flex-end',
      transform: `translateY(${slide}px)`,
      opacity: enter,
      textAlign,
    }}>
      <div style={{
        alignSelf: textAlign === 'left' ? 'flex-start' : textAlign === 'right' ? 'flex-end' : 'stretch',
        maxWidth: 920,
        padding: design.templateKey === 'pulse' ? '44px 42px' : '0',
        borderRadius: 36,
        background: design.templateKey === 'pulse' ? colors.panel : 'transparent',
        border: design.templateKey === 'pulse' ? `2px solid ${colors.accent}66` : 'none',
        boxShadow: design.templateKey === 'pulse' ? '0 30px 80px rgba(0,0,0,.35)' : 'none',
      }}>
        {visible('headline') && design.headline ? (
          <div style={{
            color: '#fff',
            fontSize: 94,
            lineHeight: .95,
            fontWeight: 950,
            letterSpacing: -5,
            textTransform: 'uppercase',
            textShadow: '0 16px 46px rgba(0,0,0,.5)',
          }}>
            {design.headline}
          </div>
        ) : null}

        {visible('subline') && design.subline ? (
          <div style={{
            marginTop: 30,
            color: 'rgba(255,255,255,.82)',
            fontSize: 36,
            lineHeight: 1.15,
            fontWeight: 650,
          }}>
            {design.subline}
          </div>
        ) : null}

        {metaChips.length ? (
          <div style={{
            marginTop: 42,
            display: 'flex',
            justifyContent: textAlign === 'left' ? 'flex-start' : textAlign === 'right' ? 'flex-end' : 'center',
            gap: 18,
            flexWrap: 'wrap',
          }}>
            {metaChips.map((item) => (
              <span key={item} style={{
                padding: '16px 22px',
                borderRadius: 999,
                background: colors.panel,
                border: `1px solid ${colors.accent}55`,
                color: '#fff',
                fontSize: 28,
                fontWeight: 800,
              }}>
                {item}
              </span>
            ))}
          </div>
        ) : null}

        {visible('cta') && design.ctaText ? (
          <div style={{
            marginTop: 34,
            color: colors.accentSoft,
            fontSize: 28,
            fontWeight: 900,
            letterSpacing: 2,
            textTransform: 'uppercase',
          }}>
            {design.ctaText}
          </div>
        ) : null}
      </div>
    </div>
  )

  const campaignTexture = campaign ? (
    <>
      <div style={{
        position: 'absolute',
        inset: 0,
        background: `linear-gradient(180deg, rgba(4,2,7,.26), rgba(5,2,9,.9)), linear-gradient(145deg, ${colors.accent}22, transparent 48%)`,
      }} />
      <div style={{
        position: 'absolute',
        left: -70,
        top: 300,
        width: 410,
        height: 24,
        transform: 'rotate(-10deg)',
        background: colors.accent,
        opacity: .36,
        boxShadow: `0 0 34px ${colors.accent}66`,
      }} />
      <div style={{
        position: 'absolute',
        right: -90,
        bottom: 290,
        width: 430,
        height: 22,
        transform: 'rotate(-10deg)',
        background: colors.accent,
        opacity: .28,
        boxShadow: `0 0 34px ${colors.accent}55`,
      }} />
    </>
  ) : null

  const gigAnnouncement = design.templateKey === 'gig-announcement' ? (
    <div style={{
      position: 'absolute',
      inset: '230px 72px 150px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      opacity: enter,
      transform: `translateY(${interpolate(enter, [0, 1], [50, 0])}px)`,
    }}>
      {visible('headline') && design.headline ? (
        <div style={{
          maxWidth: 930,
          color: '#fff',
          fontSize: 116,
          lineHeight: .83,
          fontWeight: 950,
          fontStyle: 'italic',
          letterSpacing: -7,
          textTransform: 'uppercase',
          textShadow: `0 0 34px ${colors.accent}88, 0 20px 60px rgba(0,0,0,.6)`,
        }}>
          {design.headline}
        </div>
      ) : null}
      <div style={{ width: 470, height: 14, marginTop: 28, transform: 'rotate(-2deg)', background: colors.accent }} />
      {visible('subline') && design.subline ? (
        <div style={{
          marginTop: 48,
          padding: '20px 52px',
          borderRadius: 999,
          border: '3px solid rgba(255,255,255,.92)',
          background: colors.accent,
          color: '#fff',
          fontSize: 42,
          fontWeight: 950,
          letterSpacing: 2,
          textTransform: 'uppercase',
        }}>
          {design.subline}
        </div>
      ) : null}
      <div style={{
        width: '100%',
        display: 'grid',
        gridTemplateColumns: metaChips.length === 1 ? '1fr' : metaChips.length === 2 ? '1fr 1fr' : 'repeat(3, 1fr)',
        gap: 16,
        marginTop: 72,
      }}>
        {metaChips.map((item) => (
          <div key={item} style={{
            minHeight: 112,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 18,
            background: 'rgba(6,4,9,.9)',
            border: `2px solid ${colors.accent}99`,
            color: '#fff',
            fontSize: 31,
            fontWeight: 900,
            textTransform: 'uppercase',
            boxShadow: `0 0 26px ${colors.accent}33`,
          }}>
            {item}
          </div>
        ))}
      </div>
      {visible('cta') && design.ctaText ? (
        <div style={{ marginTop: 54, color: colors.accentSoft, fontSize: 33, fontWeight: 950, letterSpacing: 3 }}>
          {design.ctaText}
        </div>
      ) : null}
    </div>
  ) : null

  const recap = design.templateKey === 'recap' ? (
    <div style={{
      position: 'absolute',
      inset: '240px 70px 150px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      opacity: enter,
    }}>
      {visible('subline') && design.subline ? (
        <div style={{
          marginBottom: 34,
          padding: '13px 34px',
          borderRadius: 999,
          background: colors.accent,
          color: '#fff',
          fontSize: 28,
          fontWeight: 950,
          letterSpacing: 4,
          textTransform: 'uppercase',
        }}>
          {design.subline}
        </div>
      ) : null}
      {visible('headline') && design.headline ? (
        <div style={{
          maxWidth: 930,
          color: '#fff',
          fontSize: 126,
          lineHeight: .84,
          fontWeight: 950,
          fontStyle: 'italic',
          letterSpacing: -8,
          textTransform: 'uppercase',
          textShadow: `0 0 42px ${colors.accent}77, 0 24px 70px rgba(0,0,0,.65)`,
        }}>
          {design.headline}
        </div>
      ) : null}
      {metaChips.length ? (
        <div style={{ marginTop: 56, display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
          {metaChips.map((item) => (
            <span key={item} style={{
              padding: '16px 24px',
              border: `2px solid ${colors.accent}88`,
              background: 'rgba(7,4,10,.82)',
              color: '#fff',
              fontSize: 29,
              fontWeight: 850,
            }}>
              {item}
            </span>
          ))}
        </div>
      ) : null}
      {visible('cta') && design.ctaText ? (
        <div style={{ marginTop: 60, color: colors.accentSoft, fontSize: 31, fontWeight: 950, letterSpacing: 2 }}>
          {design.ctaText}
        </div>
      ) : null}
    </div>
  ) : null

  const upcoming = design.templateKey === 'upcoming-gigs' ? (
    <div style={{
      position: 'absolute',
      inset: '220px 72px 145px',
      display: 'flex',
      flexDirection: 'column',
      opacity: enter,
    }}>
      <div style={{ textAlign: 'center' }}>
        {visible('headline') && design.headline ? (
          <div style={{
            color: '#fff',
            fontSize: 102,
            lineHeight: .88,
            fontWeight: 950,
            fontStyle: 'italic',
            letterSpacing: -6,
            textTransform: 'uppercase',
            textShadow: `0 0 32px ${colors.accent}66`,
          }}>
            {design.headline}
          </div>
        ) : null}
        {visible('subline') && design.subline ? (
          <div style={{
            display: 'inline-block',
            marginTop: 24,
            padding: '13px 32px',
            borderRadius: 999,
            background: colors.accent,
            color: '#fff',
            fontSize: 29,
            fontWeight: 950,
            letterSpacing: 3,
            textTransform: 'uppercase',
          }}>
            {design.subline}
          </div>
        ) : null}
      </div>

      {visible('gigList') ? (
        <div style={{
          marginTop: 58,
          padding: '12px 30px',
          background: 'rgba(5,3,8,.88)',
          border: `2px solid ${colors.accent}88`,
          boxShadow: `0 0 44px ${colors.accent}22`,
        }}>
          {(design.gigItems || []).filter(item => item.enabled).slice(0, 6).map((item, index) => (
            <div key={`${item.dateText}-${item.title}-${index}`} style={{
              display: 'grid',
              gridTemplateColumns: '170px 1fr',
              gap: 22,
              alignItems: 'center',
              minHeight: 122,
              padding: '18px 4px',
              borderBottom: index === (design.gigItems || []).filter(row => row.enabled).slice(0, 6).length - 1 ? 'none' : '1px solid rgba(255,255,255,.12)',
            }}>
              <div style={{ color: colors.accentSoft, fontSize: 29, fontWeight: 950 }}>{item.dateText}</div>
              <div>
                <div style={{ color: '#fff', fontSize: 34, fontWeight: 900 }}>{item.title}</div>
                {item.locationText ? <div style={{ marginTop: 7, color: 'rgba(255,255,255,.62)', fontSize: 25 }}>{item.locationText}</div> : null}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {visible('cta') && design.ctaText ? (
        <div style={{ marginTop: 'auto', textAlign: 'center', color: colors.accentSoft, fontSize: 29, fontWeight: 950, letterSpacing: 2 }}>
          {design.ctaText}
        </div>
      ) : null}
    </div>
  ) : null

  return (
    <AbsoluteFill style={{ backgroundColor: '#09080b', fontFamily: BODY_FONT_FAMILY, overflow: 'hidden' }}>
      {imageSrc ? (
        <Img
          src={imageSrc}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition,
            transform: `translate3d(${drift}px, 0, 0) scale(${zoom * pulse})`,
            filter: design.brandPreset === 'mono' ? 'grayscale(1) contrast(1.08)' : 'saturate(1.08) contrast(1.04)',
          }}
        />
      ) : null}

      <AbsoluteFill style={{
        background: `linear-gradient(180deg, ${colors.wash} 0%, rgba(5,4,7,.08) 38%, rgba(5,4,7,${design.overlayOpacity ?? .72}) 100%)`,
      }} />

      {campaignTexture}
      {logo}
      {!campaign ? regularContent : null}
      {gigAnnouncement}
      {recap}
      {upcoming}

      {audioSrc ? <Audio src={audioSrc} volume={0.9} /> : null}
    </AbsoluteFill>
  )
}
