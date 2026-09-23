import type React from 'react'
import { createElement as h } from 'react'
import { AbsoluteFill, interpolate, random, Sequence } from 'remotion'
import type { GraphicItem, ProjectAssetMap } from '../shared/video-project'
import { MOTION_ACCENTS, listProp, parseGigRow, textProp, type MotionTemplateKey } from '../shared/video-templates'
import { stagger } from './animation'
import { MediaFill } from './media'

// NightLight motion templates. Every template lays out on a virtual canvas
// whose short side is 1080px so the same design scales to any aspect ratio.
// Styling is deliberately rough nightlife: heavy italic type, skewed brush
// bars, neon glow; never generic SaaS motion.

export type TemplateRenderProps = {
  item: GraphicItem
  /** Frame relative to the item start. */
  frame: number
  fps: number
  /** Virtual canvas size (short side = 1080). */
  width: number
  height: number
  assets: ProjectAssetMap
}

type Colors = (typeof MOTION_ACCENTS)[keyof typeof MOTION_ACCENTS]

const display: React.CSSProperties = {
  fontFamily: '"Arial Black", "Liberation Sans", Arial, Helvetica, sans-serif',
  fontWeight: 900,
  fontStyle: 'italic',
  textTransform: 'uppercase',
  color: '#fff',
}

const body: React.CSSProperties = {
  fontFamily: 'Arial, "Liberation Sans", Helvetica, sans-serif',
  color: '#fff',
}

/** Keep-clear insets: tall canvases (Reels/Stories) reserve room for Instagram's UI. */
function safeInsets(width: number, height: number) {
  return height / width > 1.5 ? { top: 240, bottom: 430 } : { top: 90, bottom: 90 }
}

function colorsFor(item: GraphicItem): Colors {
  return MOTION_ACCENTS[item.accent] || MOTION_ACCENTS['neon-purple']
}

function glow(colors: Colors, size = 34) {
  return `0 0 ${size}px ${colors.glow}cc, 0 18px 50px rgba(0,0,0,.65)`
}

/** Skewed brush-like bar that wipes in from the left. */
const BrushBar: React.FC<{
  colors: Colors
  progress: number
  width: number
  height?: number
  rotate?: number
  style?: React.CSSProperties
}> = ({ colors, progress, width, height = 16, rotate = -4, style }) =>
  h('div', {
    style: {
      width,
      height,
      transform: `rotate(${rotate}deg) skewX(-24deg) scaleX(${progress})`,
      transformOrigin: 'left center',
      background: `linear-gradient(90deg, ${colors.accent}, ${colors.soft} 70%, transparent)`,
      boxShadow: `0 0 26px ${colors.glow}`,
      borderRadius: '2px 40px 6px 30px',
      ...style,
    },
  })

const Pill: React.FC<{
  colors: Colors
  children?: React.ReactNode
  style?: React.CSSProperties
}> = ({ colors, children, style }) =>
  h(
    'div',
    {
      style: {
        ...display,
        display: 'inline-block',
        padding: '14px 40px',
        background: colors.accent,
        transform: 'skewX(-12deg) rotate(-3deg)',
        fontSize: 36,
        letterSpacing: 2,
        boxShadow: `0 0 30px ${colors.glow}aa`,
        ...style,
      },
    },
    children,
  )

const Kicker: React.FC<{
  children?: React.ReactNode
}> = ({ children }) => h('div', { style: { ...body, fontSize: 26, fontWeight: 800, letterSpacing: 10, opacity: 0.85 } }, children)

function ensureArrow(text: string) {
  return /[→>]$/.test(text) ? text : `${text} →`
}

const GigAnnouncement: React.FC<TemplateRenderProps> = ({ item, frame, width, height }) => {
  const colors = colorsFor(item)
  const props = item.templateProps
  const headline = textProp(props, 'headline')
  const words = headline.split(/\s+/).filter(Boolean)
  const rows = [
    { icon: '▦', text: textProp(props, 'date') },
    { icon: '◷', text: textProp(props, 'time') },
    { icon: '⌖', text: [textProp(props, 'venue'), textProp(props, 'location')].filter(Boolean).join('\n') },
  ].filter(row => row.text)
  const landscape = width > height
  const safe = safeInsets(width, height)
  return h(
    AbsoluteFill,
    {
      style: {
        padding: landscape ? '80px 120px' : `${safe.top - 90}px 80px ${safe.bottom}px`,
        justifyContent: 'space-between',
        alignItems: landscape ? 'flex-start' : 'center',
      },
    },
    h('div', { style: { textAlign: landscape ? 'left' : 'center', opacity: stagger(frame, 0) } }, h(Kicker, null, 'DJ NIGHTLIGHT PRESENTS')),
    h(
      'div',
      { style: { transform: 'rotate(-7deg)', textAlign: landscape ? 'left' : 'center' } },
      words.map((word, index) =>
        h(
          'div',
          {
            key: `${word}-${index}`,
            style: {
              ...display,
              fontSize: landscape ? 150 : Math.min(200, 1500 / Math.max(4, word.length)),
              lineHeight: 0.86,
              letterSpacing: -4,
              color: index % 2 ? colors.accent : '#fff',
              textShadow: glow(colors),
              opacity: stagger(frame, index + 1),
              transform: `translateX(${(1 - stagger(frame, index + 1)) * -120}px)`,
            },
          },
          word,
        ),
      ),
      h(BrushBar, {
        colors,
        progress: stagger(frame, words.length + 1, 4, 18),
        width: landscape ? 560 : 640,
        style: { marginTop: 26, marginInline: landscape ? 0 : 'auto' },
      }),
    ),
    h(
      'div',
      { style: { display: 'flex', flexDirection: 'column', gap: 24, alignItems: landscape ? 'flex-start' : 'center', width: '100%' } },
      rows.length
        ? h(
            'div',
            {
              style: {
                padding: '26px 34px',
                background: 'rgba(6,4,10,.82)',
                border: `2px solid ${colors.accent}88`,
                boxShadow: `0 0 40px ${colors.glow}44`,
                display: 'flex',
                flexDirection: 'column',
                gap: 18,
                minWidth: 520,
                opacity: stagger(frame, 4),
              },
            },
            rows.map((row, index) =>
              h(
                'div',
                {
                  key: row.icon,
                  style: {
                    display: 'flex',
                    gap: 22,
                    alignItems: 'center',
                    opacity: stagger(frame, index + 5),
                    transform: `translateY(${(1 - stagger(frame, index + 5)) * 30}px)`,
                  },
                },
                h('span', { style: { ...body, fontSize: 40, color: colors.soft, width: 44, textAlign: 'center' } }, row.icon),
                h('span', { style: { ...display, fontStyle: 'normal', fontSize: 42, whiteSpace: 'pre-line', lineHeight: 1.1 } }, row.text),
              ),
            ),
          )
        : null,
      textProp(props, 'cta')
        ? h(
            'div',
            { style: { opacity: stagger(frame, 9), transform: `scale(${interpolate(stagger(frame, 9), [0, 1], [1.4, 1])})` } },
            h(Pill, { colors, style: { fontSize: 44, padding: '18px 56px' } }, ensureArrow(textProp(props, 'cta'))),
          )
        : null,
    ),
  )
}

const RecapIntro: React.FC<TemplateRenderProps> = ({ item, frame }) => {
  const colors = colorsFor(item)
  const props = item.templateProps
  const split = interpolate(frame % 24, [0, 3, 6], [10, 0, 0], { extrapolateRight: 'clamp' })
  return h(
    AbsoluteFill,
    { style: { alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 80, gap: 36 } },
    textProp(props, 'kicker') ? h('div', { style: { opacity: stagger(frame, 0) } }, h(Pill, { colors }, textProp(props, 'kicker'))) : null,
    h(
      'div',
      {
        style: {
          ...display,
          fontSize: 170,
          lineHeight: 0.84,
          letterSpacing: -6,
          transform: 'rotate(-5deg)',
          textShadow: `${split}px 0 0 ${colors.accent}, ${-split}px 0 0 #22d3ee, ${glow(colors)}`,
          opacity: stagger(frame, 1),
        },
      },
      textProp(props, 'headline'),
    ),
    h(BrushBar, {
      colors,
      progress: stagger(frame, 3, 4, 16),
      width: 520,
    }),
    textProp(props, 'meta')
      ? h('div', { style: { ...body, fontSize: 38, fontWeight: 800, letterSpacing: 6, opacity: stagger(frame, 5) } }, textProp(props, 'meta'))
      : null,
  )
}

const UpcomingGigs: React.FC<TemplateRenderProps> = ({ item, frame, width, height }) => {
  const colors = colorsFor(item)
  const props = item.templateProps
  const gigs = listProp(props, 'gigs')
    .map(parseGigRow)
    .filter(gig => gig.date || gig.title)
    .slice(0, 6)
  const safe = safeInsets(width, height)
  return h(
    AbsoluteFill,
    { style: { padding: `${safe.top}px 80px ${safe.bottom}px`, alignItems: 'center', gap: 40 } },
    h(
      'div',
      { style: { textAlign: 'center', opacity: stagger(frame, 0) } },
      h(
        'div',
        { style: { ...display, fontSize: 150, lineHeight: 0.9, letterSpacing: -5, transform: 'rotate(-5deg)', textShadow: glow(colors) } },
        textProp(props, 'headline'),
      ),
      textProp(props, 'kicker') ? h('div', { style: { marginTop: 22 } }, h(Pill, { colors }, textProp(props, 'kicker'))) : null,
    ),
    h(
      'div',
      {
        style: {
          width: '100%',
          maxWidth: 900,
          background: 'rgba(6,4,10,.84)',
          border: `2px solid ${colors.accent}88`,
          padding: '10px 36px',
          boxShadow: `0 0 44px ${colors.glow}33`,
        },
      },
      gigs.map((gig, index) =>
        h(
          'div',
          {
            key: `${gig.date}-${index}`,
            style: {
              display: 'grid',
              gridTemplateColumns: '200px 1fr',
              gap: 24,
              alignItems: 'center',
              padding: '24px 0',
              borderBottom: index === gigs.length - 1 ? 'none' : '1px solid rgba(255,255,255,.14)',
              opacity: stagger(frame, index + 2),
              transform: `translateX(${(1 - stagger(frame, index + 2)) * 80}px)`,
            },
          },
          h('div', { style: { ...display, fontSize: 38, color: colors.soft } }, gig.date),
          h(
            'div',
            null,
            h('div', { style: { ...body, fontSize: 40, fontWeight: 900 } }, gig.title),
            gig.place ? h('div', { style: { ...body, fontSize: 28, opacity: 0.65, marginTop: 6 } }, gig.place) : null,
          ),
        ),
      ),
    ),
    textProp(props, 'cta')
      ? h('div', { style: { marginTop: 'auto', opacity: stagger(frame, gigs.length + 3) } }, h(Pill, { colors }, ensureArrow(textProp(props, 'cta'))))
      : null,
  )
}

const WaveMark: React.FC<{
  colors: Colors
  frame: number
  size: number
}> = ({ colors, frame, size }) => {
  const bars = 11
  return h(
    'svg',
    {
      width: size,
      height: size * 0.6,
      viewBox: `0 0 ${bars * 20} 120`,
    },
    Array.from({ length: bars }, (_, index) => {
      const center = 1 - Math.abs(index - (bars - 1) / 2) / ((bars - 1) / 2)
      const height = 18 + (center * 80 + Math.sin(frame / 3 + index) * 14) * stagger(frame, index, 1, 12)
      return h('rect', {
        key: index,
        x: index * 20 + 4,
        y: 60 - height / 2,
        width: 10,
        height,
        rx: 5,
        fill: index % 2 ? colors.soft : colors.accent,
      })
    }),
  )
}

const LogoSting: React.FC<TemplateRenderProps> = ({ item, frame }) => {
  const colors = colorsFor(item)
  const flash = interpolate(frame, [8, 11, 20], [0, 0.55, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  return h(
    AbsoluteFill,
    { style: { alignItems: 'center', justifyContent: 'center', gap: 20 } },
    h(AbsoluteFill, { style: { background: `radial-gradient(circle, ${colors.glow}55, transparent 60%)`, opacity: stagger(frame, 0, 0, 20) } }),
    h(WaveMark, {
      colors,
      frame,
      size: 320,
    }),
    h(
      'div',
      {
        style: {
          ...display,
          fontStyle: 'normal',
          textTransform: 'none',
          fontSize: 110,
          letterSpacing: -2,
          textShadow: glow(colors),
          opacity: stagger(frame, 3),
        },
      },
      textProp(item.templateProps, 'title'),
    ),
    h(
      'div',
      { style: { ...body, fontSize: 30, fontWeight: 700, letterSpacing: 14, color: colors.soft, opacity: stagger(frame, 6) } },
      textProp(item.templateProps, 'tagline'),
    ),
    h(AbsoluteFill, { style: { background: '#fff', opacity: flash } }),
  )
}

const LowerThird: React.FC<TemplateRenderProps> = ({ item, frame, width, height }) => {
  const colors = colorsFor(item)
  const reveal = stagger(frame, 0, 0, 16)
  return h(
    AbsoluteFill,
    null,
    h(
      'div',
      { style: { position: 'absolute', left: 70, bottom: safeInsets(width, height).bottom, display: 'flex', alignItems: 'stretch' } },
      h('div', { style: { width: 16, background: colors.accent, boxShadow: `0 0 24px ${colors.glow}`, transform: `scaleY(${reveal})` } }),
      h(
        'div',
        { style: { overflow: 'hidden' } },
        h(
          'div',
          { style: { padding: '22px 40px 24px', background: 'rgba(6,4,10,.86)', transform: `translateX(${(reveal - 1) * 105}%)` } },
          h('div', { style: { ...display, fontSize: 58, lineHeight: 1 } }, textProp(item.templateProps, 'title')),
          textProp(item.templateProps, 'subtitle')
            ? h(
                'div',
                { style: { ...body, fontSize: 30, marginTop: 10, color: colors.soft, fontWeight: 700, opacity: stagger(frame, 3) } },
                textProp(item.templateProps, 'subtitle'),
              )
            : null,
        ),
      ),
    ),
  )
}

const HypeTitle: React.FC<TemplateRenderProps> = ({ item, frame }) => {
  const colors = colorsFor(item)
  const lines = listProp(item.templateProps, 'lines').filter(Boolean).slice(0, 4)
  const perLine = Math.max(4, Math.floor((item.duration * 0.6) / Math.max(1, lines.length)))
  return h(
    AbsoluteFill,
    { style: { alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 60 } },
    h(
      'div',
      { style: { transform: 'rotate(-6deg)' } },
      lines.map((line, index) => {
        const local = frame - index * perLine
        if (local < 0) return null
        const punch = interpolate(local, [0, 4, 8], [1.6, 0.94, 1], { extrapolateRight: 'clamp' })
        return h(
          'div',
          {
            key: `${line}-${index}`,
            style: {
              ...display,
              fontSize: Math.min(220, 1700 / Math.max(4, line.length)),
              lineHeight: 0.9,
              letterSpacing: -5,
              color: index % 2 ? colors.accent : '#fff',
              textShadow: glow(colors, 40),
              transform: `scale(${punch})`,
            },
          },
          line,
        )
      }),
    ),
  )
}

const PhotoDrop: React.FC<TemplateRenderProps> = ({ item, frame, assets }) => {
  const colors = colorsFor(item)
  const drop = stagger(frame, 0, 0, 16)
  const assetId = textProp(item.templateProps, 'photo')
  return h(
    AbsoluteFill,
    { style: { alignItems: 'center', justifyContent: 'center' } },
    h(
      'div',
      {
        style: {
          width: 760,
          padding: '28px 28px 110px',
          background: '#f4f1ea',
          boxShadow: `0 40px 90px rgba(0,0,0,.6), 0 0 60px ${colors.glow}44`,
          transform: `translateY(${(1 - drop) * -700}px) rotate(${interpolate(drop, [0, 1], [-18, -4])}deg)`,
          position: 'relative',
        },
      },
      h(
        'div',
        { style: { position: 'relative', width: '100%', aspectRatio: '1 / 1', overflow: 'hidden', background: '#111' } },
        h(MediaFill, { asset: assetId ? assets[assetId] : undefined, muted: true }),
      ),
      h(
        'div',
        {
          style: {
            ...display,
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 30,
            textAlign: 'center',
            color: '#15101c',
            fontSize: 40,
            transform: 'rotate(-2deg)',
          },
        },
        textProp(item.templateProps, 'caption'),
      ),
      h('div', {
        style: { position: 'absolute', top: -26, left: '38%', width: 200, height: 52, background: `${colors.accent}cc`, transform: 'rotate(-6deg)' },
      }),
    ),
  )
}

const ClipRecap: React.FC<TemplateRenderProps> = ({ item, frame, width, height, assets }) => {
  const colors = colorsFor(item)
  const media = listProp(item.templateProps, 'media').filter(Boolean).slice(0, 5)
  const count = Math.max(1, media.length)
  const slot = Math.max(1, Math.floor(item.duration / count))
  return h(
    AbsoluteFill,
    null,
    media.length
      ? media.map((id, index) =>
          h(
            Sequence,
            {
              key: `${id}-${index}`,
              from: index * slot,
              durationInFrames: index === media.length - 1 ? item.duration - index * slot : slot,
              layout: 'none',
            },
            h(
              AbsoluteFill,
              { style: { transform: `scale(${1.04 + ((frame - index * slot) / slot) * 0.06})` } },
              h(MediaFill, { asset: assets[id], muted: true }),
            ),
          ),
        )
      : h(MediaFill, { asset: undefined }),
    h(AbsoluteFill, {
      style: {
        background: '#fff',
        opacity: interpolate(frame % slot, [0, 3], [media.length > 1 && frame >= slot ? 0.7 : 0, 0], { extrapolateRight: 'clamp' }),
      },
    }),
    h(AbsoluteFill, { style: { background: 'linear-gradient(180deg, transparent 55%, rgba(5,3,8,.85))' } }),
    h(
      'div',
      { style: { position: 'absolute', left: 70, right: 130, bottom: safeInsets(width, height).bottom } },
      h(
        'div',
        { style: { ...display, fontSize: 120, lineHeight: 0.9, letterSpacing: -4, transform: 'rotate(-5deg)', textShadow: glow(colors) } },
        textProp(item.templateProps, 'title'),
      ),
      h(BrushBar, {
        colors,
        progress: stagger(frame, 2, 4, 16),
        width: 420,
        style: { marginTop: 18 },
      }),
      h(
        'div',
        { style: { ...body, marginTop: 22, fontSize: 30, fontWeight: 800, letterSpacing: 6, color: colors.soft } },
        String(Math.min(count, Math.floor(frame / slot) + 1)).padStart(2, '0'),
        ' / ',
        String(count).padStart(2, '0'),
      ),
    ),
  )
}

// ── Electric set ────────────────────────────────────────────────────────────
// Built straight from the NightLight logo: white-to-violet gradient type,
// slanted neon rules with tapered ends, a neon ring, lightning bolts and
// crackling electric arcs on a deep black night.

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const

/** Logo-style type: white at the top fading into the accent at the bottom. */
function gradientText(colors: Colors, glowSize = 22): React.CSSProperties {
  return {
    ...display,
    color: 'transparent',
    backgroundImage: `linear-gradient(180deg, #ffffff 0%, ${colors.soft} 42%, ${colors.accent} 100%)`,
    WebkitBackgroundClip: 'text',
    backgroundClip: 'text',
    // Italic glyphs overhang their box; pad so the clipped gradient keeps the tail.
    paddingInline: '0.08em',
    filter: `drop-shadow(0 0 ${glowSize}px ${colors.glow}) drop-shadow(0 12px 30px rgba(0,0,0,.7))`,
  }
}

/** Thin neon line with tapered ends, like the rules framing the logo. */
const NeonRule: React.FC<{
  colors: Colors
  progress: number
  width: number | string
  thickness?: number
  rotate?: number
  origin?: 'left' | 'right'
  style?: React.CSSProperties
}> = ({ colors, progress, width, thickness = 7, rotate = 0, origin = 'left', style }) =>
  h('div', {
    style: {
      width,
      height: thickness,
      transform: `rotate(${rotate}deg) scaleX(${progress})`,
      transformOrigin: `${origin} center`,
      background: `linear-gradient(90deg, transparent, ${colors.accent} 14%, ${colors.soft} 50%, ${colors.accent} 86%, transparent)`,
      boxShadow: `0 0 22px ${colors.glow}, 0 0 6px ${colors.accent}`,
      borderRadius: thickness,
      ...style,
    },
  })

/** Lightning bolt with the logo's white-to-violet fill. */
const Bolt: React.FC<{
  colors: Colors
  size: number
  style?: React.CSSProperties
}> = ({ colors, size, style }) => {
  const id = `nl-bolt-${colors.accent.slice(1)}`
  return h(
    'svg',
    {
      width: size * 0.6,
      height: size,
      viewBox: '0 0 60 100',
      style: { overflow: 'visible', filter: `drop-shadow(0 0 ${Math.round(size / 7)}px ${colors.glow}) drop-shadow(0 0 4px ${colors.accent})`, ...style },
    },
    h('defs', null, h('linearGradient', { id, x1: 0, y1: 0, x2: 0, y2: 1 }, h('stop', { offset: '0%', stopColor: '#ffffff' }), h('stop', { offset: '100%', stopColor: colors.accent }))),
    h('path', { d: 'M38 0 L4 58 L28 58 L16 100 L56 36 L32 36 Z', fill: `url(#${id})` }),
  )
}

/** Double neon ring that draws itself clockwise. */
const NeonRing: React.FC<{
  colors: Colors
  progress: number
  size: number
  style?: React.CSSProperties
}> = ({ colors, progress, size, style }) => {
  const center = size / 2
  const rings = [center - 8, center - 8 - size * 0.045]
  return h(
    'svg',
    { width: size, height: size, viewBox: `0 0 ${size} ${size}`, style: { overflow: 'visible', filter: `drop-shadow(0 0 16px ${colors.glow})`, ...style } },
    rings.map((radius, index) => {
      const circumference = 2 * Math.PI * radius
      return h('circle', {
        key: radius,
        cx: center,
        cy: center,
        r: radius,
        fill: 'none',
        stroke: index ? colors.accent : colors.soft,
        strokeWidth: index ? 4 : 7,
        strokeLinecap: 'round',
        strokeDasharray: circumference,
        strokeDashoffset: circumference * (1 - progress),
        transform: `rotate(${-120 + index * 40} ${center} ${center})`,
      })
    }),
  )
}

type Arc = [x1: number, y1: number, x2: number, y2: number]

/** Jagged path between two points; the offset fades out at both ends. */
function arcPath(seed: string, [x1, y1, x2, y2]: Arc, segments = 9, jag = 26) {
  const dx = x2 - x1
  const dy = y2 - y1
  const length = Math.hypot(dx, dy) || 1
  const nx = -dy / length
  const ny = dx / length
  let path = `M${x1} ${y1}`
  for (let index = 1; index < segments; index++) {
    const t = index / segments
    const offset = (random(`${seed}-${index}`) - 0.5) * 2 * jag * Math.sin(Math.PI * t)
    path += ` L${x1 + dx * t + nx * offset} ${y1 + dy * t + ny * offset}`
  }
  return `${path} L${x2} ${y2}`
}

/** Flickering electric arcs, re-rolled every two frames. Coordinates are local to the svg box. */
const ElectricArcs: React.FC<{
  colors: Colors
  frame: number
  width: number
  height: number
  arcs: Arc[]
  seed: string
  intensity?: number
  style?: React.CSSProperties
}> = ({ colors, frame, width, height, arcs, seed, intensity = 0.65, style }) => {
  const tick = Math.floor(frame / 2)
  return h(
    'svg',
    {
      width,
      height,
      viewBox: `0 0 ${width} ${height}`,
      style: { position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none', filter: `drop-shadow(0 0 10px ${colors.glow})`, ...style },
    },
    arcs.map((arc, index) => {
      if (random(`${seed}-on-${index}-${tick}`) > intensity) return null
      const key = `${seed}-${index}-${tick}`
      const main = arcPath(key, arc)
      const [x1, y1, x2, y2] = arc
      const midX = x1 + (x2 - x1) * 0.55
      const midY = y1 + (y2 - y1) * 0.55
      const branch = arcPath(`${key}-b`, [midX, midY, midX + (y2 - y1) * 0.35 + (x2 - x1) * 0.25, midY - (x2 - x1) * 0.35 + (y2 - y1) * 0.25], 5, 12)
      return h(
        'g',
        { key: index, fill: 'none', strokeLinejoin: 'round', strokeLinecap: 'round' },
        h('path', { d: main, stroke: colors.accent, strokeWidth: 7, opacity: 0.55 }),
        h('path', { d: main, stroke: '#fff', strokeWidth: 2.4 }),
        h('path', { d: branch, stroke: colors.soft, strokeWidth: 1.6, opacity: 0.85 }),
      )
    }),
  )
}

/** Neon-tube flicker once a light has "switched on". */
function flicker(frame: number, seed: string, from: number) {
  if (frame < from) return 0
  return random(`${seed}-${Math.floor(frame / 3)}`) > 0.12 ? 1 : 0.35
}

const NeonLogoReveal: React.FC<TemplateRenderProps> = ({ item, frame }) => {
  const colors = colorsFor(item)
  const props = item.templateProps
  const lines = [textProp(props, 'line1'), textProp(props, 'line2')].filter(Boolean)
  const size = 760
  const ring = stagger(frame, 0, 0, 18)
  const strike = stagger(frame, 3, 4, 8)
  const flash = interpolate(frame, [14, 16, 24], [0, 0.45, 0], clamp)
  return h(
    AbsoluteFill,
    null,
    h(AbsoluteFill, { style: { background: `radial-gradient(circle at 50% 50%, ${colors.glow}4d, transparent 58%)`, opacity: ring } }),
    h(
      AbsoluteFill,
      { style: { alignItems: 'center', justifyContent: 'center' } },
      h(
        'div',
        { style: { position: 'relative', width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center' } },
        h(NeonRing, { colors, progress: ring, size, style: { position: 'absolute', inset: 0 } }),
        frame >= 12
          ? h(ElectricArcs, {
              colors,
              frame,
              width: size,
              height: size,
              seed: `logo-${item.id}`,
              arcs: [
                [size * 0.14, size * 0.2, -size * 0.12, -size * 0.08],
                [size * 0.8, size * 0.1, size * 0.98, -size * 0.2],
                [size * 0.98, size * 0.62, size * 1.24, size * 0.82],
                [size * 0.3, size * 0.95, size * 0.06, size * 1.2],
              ],
            })
          : null,
        h(NeonRule, { colors, progress: stagger(frame, 3, 0, 12), width: size * 0.9, rotate: -12, style: { position: 'absolute', top: size * 0.2, left: size * 0.3 } }),
        h(NeonRule, { colors, progress: stagger(frame, 4, 0, 12), width: size * 0.9, rotate: -12, origin: 'right', style: { position: 'absolute', bottom: size * 0.2, right: size * 0.3 } }),
        h(
          'div',
          { style: { position: 'relative', transform: 'rotate(-8deg) skewX(-8deg)' } },
          lines.map((line, index) => {
            const reveal = stagger(frame, 4 + index * 3, 0, 10)
            return h(
              'div',
              {
                key: `${line}-${index}`,
                style: {
                  ...gradientText(colors),
                  fontSize: Math.min(200, 1000 / Math.max(4, line.length)),
                  lineHeight: 0.92,
                  letterSpacing: -4,
                  marginLeft: index ? -40 : 40,
                  opacity: reveal,
                  transform: `scale(${interpolate(reveal, [0, 1], [1.6, 1])})`,
                },
              },
              line,
            )
          }),
        ),
        h(Bolt, {
          colors,
          size: 230,
          style: {
            position: 'absolute',
            right: -size * 0.14,
            top: size * 0.12,
            opacity: strike * flicker(frame, `logo-bolt-${item.id}`, 12),
            transform: `translateY(${(1 - strike) * -160}px) scale(${interpolate(strike, [0, 1], [1.4, 1])})`,
          },
        }),
        textProp(props, 'tagline')
          ? h(
              'div',
              {
                style: {
                  ...body,
                  position: 'absolute',
                  top: size + 40,
                  left: -200,
                  right: -200,
                  textAlign: 'center',
                  fontSize: 32,
                  fontWeight: 800,
                  letterSpacing: 14,
                  color: colors.soft,
                  textShadow: `0 0 18px ${colors.glow}`,
                  opacity: stagger(frame, 8),
                },
              },
              textProp(props, 'tagline'),
            )
          : null,
      ),
    ),
    h(AbsoluteFill, { style: { background: colors.soft, opacity: flash } }),
  )
}

const LightningBanner: React.FC<TemplateRenderProps> = ({ item, frame, width, height }) => {
  const colors = colorsFor(item)
  const title = textProp(item.templateProps, 'title')
  const subtitle = textProp(item.templateProps, 'subtitle')
  // Arial Black italic runs ~0.6em per glyph; keep room for the bolt on the right.
  const size = Math.min(180, (Math.min(width, 1920) - 300) / (0.6 * Math.max(5, title.length)))
  const bannerWidth = Math.min(width - 200, title.length * size * 0.6 + 120)
  const reveal = stagger(frame, 2, 0, 12)
  const strike = stagger(frame, 6, 0, 8)
  const tilt = -5
  const lift = Math.sin((-tilt * Math.PI) / 180) * (bannerWidth / 2)
  const left: [number, number] = [width / 2 - bannerWidth / 2, height / 2 + lift]
  const right: [number, number] = [width / 2 + bannerWidth / 2, height / 2 - lift]
  return h(
    AbsoluteFill,
    { style: { alignItems: 'center', justifyContent: 'center' } },
    frame >= 8
      ? h(ElectricArcs, {
          colors,
          frame,
          width,
          height,
          seed: `banner-${item.id}`,
          arcs: [
            [left[0] + 20, left[1], left[0] - 150, left[1] - 150],
            [left[0] + 40, left[1] + 20, left[0] - 110, left[1] + 130],
            [right[0] - 20, right[1], right[0] + 150, right[1] - 160],
            [right[0] - 40, right[1] + 20, right[0] + 120, right[1] + 120],
          ],
        })
      : null,
    h(
      'div',
      { style: { position: 'relative', width: bannerWidth, padding: `${size * 0.3}px 0`, transform: `rotate(${tilt}deg)` } },
      h(NeonRule, { colors, progress: stagger(frame, 0, 0, 12), width: '100%', style: { position: 'absolute', top: 0, left: 0 } }),
      h(NeonRule, { colors, progress: stagger(frame, 1, 0, 12), width: '100%', origin: 'right', style: { position: 'absolute', bottom: 0, left: 0 } }),
      h(
        'div',
        {
          style: {
            ...gradientText(colors),
            fontSize: size,
            lineHeight: 1,
            letterSpacing: -3,
            textAlign: 'center',
            whiteSpace: 'nowrap',
            transform: 'skewX(-6deg)',
            clipPath: `inset(-30% ${(1 - reveal) * 100}% -30% -10%)`,
          },
        },
        title,
      ),
      h(Bolt, {
        colors,
        size: size * 1.5,
        style: {
          position: 'absolute',
          right: -size * 0.45,
          top: '50%',
          opacity: strike * flicker(frame, `banner-bolt-${item.id}`, 6),
          transform: `translateY(-50%) translateY(${(1 - strike) * -120}px) rotate(12deg)`,
        },
      }),
    ),
    subtitle
      ? h(
          'div',
          {
            style: {
              ...body,
              marginTop: size * 0.45,
              fontSize: 32,
              fontWeight: 800,
              letterSpacing: 10,
              color: colors.soft,
              textShadow: `0 0 16px ${colors.glow}`,
              transform: `rotate(${tilt}deg)`,
              opacity: stagger(frame, 8),
            },
          },
          subtitle,
        )
      : null,
  )
}

const ElectricGigPoster: React.FC<TemplateRenderProps> = ({ item, frame, width, height }) => {
  const colors = colorsFor(item)
  const props = item.templateProps
  const landscape = width > height
  const safe = safeInsets(width, height)
  const ringSize = landscape ? 600 : 500
  const headline = textProp(props, 'headline')
  const info = [textProp(props, 'venue'), textProp(props, 'time')].filter(Boolean)
  const cta = textProp(props, 'cta')
  const ring = h(
    'div',
    { style: { position: 'relative', width: ringSize, height: ringSize, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' } },
    h(AbsoluteFill, { style: { borderRadius: '50%', background: `radial-gradient(circle, ${colors.glow}40, transparent 70%)` } }),
    h(NeonRing, { colors, progress: stagger(frame, 0, 0, 20), size: ringSize, style: { position: 'absolute', inset: 0 } }),
    frame >= 14
      ? h(ElectricArcs, {
          colors,
          frame,
          width: ringSize,
          height: ringSize,
          seed: `poster-${item.id}`,
          intensity: 0.5,
          arcs: [
            [ringSize * 0.1, ringSize * 0.3, -ringSize * 0.15, ringSize * 0.1],
            [ringSize * 0.9, ringSize * 0.72, ringSize * 1.15, ringSize * 0.95],
          ],
        })
      : null,
    h(
      'div',
      {
        style: {
          ...gradientText(colors, 28),
          fontSize: ringSize * 0.42,
          lineHeight: 0.9,
          letterSpacing: -8,
          opacity: stagger(frame, 3),
          transform: `skewX(-6deg) scale(${interpolate(stagger(frame, 3), [0, 1], [1.5, 1])})`,
        },
      },
      textProp(props, 'day'),
    ),
    h('div', { style: { ...display, fontSize: ringSize * 0.11, letterSpacing: 14, color: colors.soft, textShadow: `0 0 18px ${colors.glow}`, opacity: stagger(frame, 5) } }, textProp(props, 'month')),
    h(Bolt, {
      colors,
      size: ringSize * 0.34,
      style: { position: 'absolute', right: -ringSize * 0.04, top: -ringSize * 0.06, transform: 'rotate(14deg)', opacity: stagger(frame, 5) * flicker(frame, `poster-bolt-${item.id}`, 10) },
    }),
  )
  const kicker = h('div', { style: { opacity: stagger(frame, 1) } }, h(Kicker, null, textProp(props, 'kicker')))
  const blocks = [
    headline
      ? h(
          'div',
          { style: { position: 'relative', padding: '22px 10px', transform: 'rotate(-6deg)' } },
          h(NeonRule, { colors, progress: stagger(frame, 5, 0, 12), width: '110%', style: { position: 'absolute', top: 0, left: '-5%' } }),
          h(NeonRule, { colors, progress: stagger(frame, 6, 0, 12), width: '110%', origin: 'right', style: { position: 'absolute', bottom: 0, left: '-5%' } }),
          h(
            'div',
            {
              style: {
                ...gradientText(colors),
                fontSize: Math.min(140, (landscape ? 1150 : 1250) / Math.max(5, headline.length)),
                lineHeight: 1,
                letterSpacing: -3,
                whiteSpace: 'nowrap',
                transform: 'skewX(-6deg)',
                clipPath: `inset(-30% ${(1 - stagger(frame, 6, 0, 12)) * 100}% -30% -10%)`,
              },
            },
            headline,
          ),
        )
      : null,
    info.length
      ? h(
          'div',
          {
            style: {
              padding: '18px 42px',
              background: 'rgba(6,4,10,.84)',
              border: `2px solid ${colors.accent}aa`,
              boxShadow: `0 0 36px ${colors.glow}55, inset 0 0 22px ${colors.glow}33`,
              transform: 'skewX(-12deg)',
              opacity: stagger(frame, 8),
            },
          },
          h(
            'div',
            { style: { transform: 'skewX(12deg)', display: 'flex', flexDirection: 'column', gap: 8 } },
            info.map((line, index) =>
              h('div', { key: `${line}-${index}`, style: { ...display, fontStyle: 'normal', fontSize: index ? 34 : 40, color: index ? colors.soft : '#fff' } }, line),
            ),
          ),
        )
      : null,
    cta
      ? h(
          'div',
          { style: { opacity: stagger(frame, 10), transform: `scale(${interpolate(stagger(frame, 10), [0, 1], [1.4, 1])})` } },
          h(Pill, { colors, style: { background: `linear-gradient(90deg, ${colors.glow}, ${colors.accent})`, fontSize: 40 } }, ensureArrow(cta)),
        )
      : null,
  ]
  return h(
    AbsoluteFill,
    {
      style: {
        padding: landscape ? '70px 120px' : `${safe.top - 60}px 70px ${safe.bottom - 60}px`,
        flexDirection: landscape ? 'row' : 'column',
        alignItems: 'center',
        justifyContent: landscape ? 'center' : 'space-evenly',
        gap: landscape ? 90 : 20,
      },
    },
    ...(landscape
      ? [ring, h('div', { key: 'details', style: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 34 } }, kicker, ...blocks)]
      : [kicker, ring, ...blocks]),
  )
}

const EqBars: React.FC<{
  colors: Colors
  frame: number
}> = ({ colors, frame }) =>
  h(
    'div',
    { style: { display: 'flex', alignItems: 'flex-end', gap: 6, height: 38 } },
    Array.from({ length: 5 }, (_, index) =>
      h('div', {
        key: index,
        style: {
          width: 9,
          height: 8 + Math.abs(Math.sin(frame / (3 + index * 0.7) + index * 1.7)) * 30,
          borderRadius: 3,
          background: `linear-gradient(180deg, #fff, ${colors.accent})`,
          boxShadow: `0 0 10px ${colors.glow}`,
        },
      }),
    ),
  )

const NowPlaying: React.FC<TemplateRenderProps> = ({ item, frame, width, height }) => {
  const colors = colorsFor(item)
  const props = item.templateProps
  const artist = textProp(props, 'artist')
  const cardWidth = 820
  return h(
    AbsoluteFill,
    null,
    h(
      'div',
      { style: { position: 'absolute', left: 80, bottom: safeInsets(width, height).bottom, width: cardWidth, transform: 'rotate(-4deg)', transformOrigin: 'left bottom' } },
      h(NeonRule, { colors, progress: stagger(frame, 0, 0, 12), width: '100%' }),
      h(
        'div',
        { style: { display: 'flex', alignItems: 'center', gap: 18, padding: '22px 0 4px', opacity: stagger(frame, 2) } },
        h(EqBars, { colors, frame }),
        h('div', { style: { ...body, fontSize: 26, fontWeight: 800, letterSpacing: 9, color: colors.soft, textShadow: `0 0 14px ${colors.glow}` } }, textProp(props, 'label')),
      ),
      h(
        'div',
        {
          style: {
            ...gradientText(colors, 18),
            fontSize: Math.min(96, 1025 / Math.max(6, artist.length)),
            lineHeight: 1.02,
            letterSpacing: -2,
            whiteSpace: 'nowrap',
            opacity: stagger(frame, 3),
            transform: `translateX(${(1 - stagger(frame, 3)) * -60}px) skewX(-6deg)`,
          },
        },
        artist,
      ),
      textProp(props, 'track')
        ? h(
            'div',
            { style: { ...body, fontSize: 34, fontWeight: 700, padding: '4px 0 22px', opacity: stagger(frame, 5), transform: `translateX(${(1 - stagger(frame, 5)) * -40}px)` } },
            textProp(props, 'track'),
          )
        : h('div', { style: { height: 22 } }),
      h(NeonRule, { colors, progress: stagger(frame, 1, 0, 12), width: '100%', origin: 'right' }),
      h(Bolt, {
        colors,
        size: 130,
        style: { position: 'absolute', right: 0, top: -64, transform: 'rotate(12deg)', opacity: stagger(frame, 6) * flicker(frame, `np-bolt-${item.id}`, 6) },
      }),
    ),
  )
}

const BoltTransition: React.FC<TemplateRenderProps> = ({ item, frame, width, height }) => {
  const colors = colorsFor(item)
  const word = textProp(item.templateProps, 'word')
  const duration = Math.max(6, item.duration)
  // The white flash peaks at the midpoint, so a cut placed there is hidden.
  const mid = Math.floor(duration / 2)
  const tail = Math.max(3, Math.round(duration * 0.35))
  const wash = interpolate(frame, [0, mid - 2, mid, duration - 1], [0, 0.9, 1, 0], clamp)
  const drop = interpolate(frame, [0, Math.max(1, mid - 1)], [-1, 0], { ...clamp, easing: t => t * t })
  const flash = interpolate(frame, [mid - 2, mid, mid + tail], [0, 1, 0], clamp)
  const boltOpacity = interpolate(frame, [0, 1, mid + tail - 1, mid + tail + 2], [0, 1, 1, 0], clamp)
  const arcsOn = frame >= mid - 3 && frame <= mid + tail
  const wordIn = interpolate(frame, [mid, mid + 3], [0, 1], clamp) * interpolate(frame, [duration - 4, duration - 1], [1, 0], clamp)
  const boltSize = Math.min(height * 0.9, width * 1.2)
  const cx = width / 2
  return h(
    AbsoluteFill,
    null,
    h(AbsoluteFill, { style: { background: `radial-gradient(circle at 50% 45%, ${colors.glow}aa, #05030a 70%)`, opacity: wash } }),
    arcsOn
      ? h(ElectricArcs, {
          colors,
          frame,
          width,
          height,
          intensity: 0.85,
          seed: `transition-${item.id}`,
          arcs: [
            [cx, height * 0.45, -40, height * 0.2],
            [cx, height * 0.5, width + 40, height * 0.3],
            [cx, height * 0.55, -40, height * 0.8],
            [cx, height * 0.55, width + 40, height * 0.85],
            [cx - 60, -20, cx + 40, height * 0.45],
          ],
        })
      : null,
    h(
      AbsoluteFill,
      { style: { alignItems: 'center', justifyContent: 'center' } },
      h(Bolt, { colors, size: boltSize, style: { opacity: boltOpacity, transform: `translateY(${drop * height}px) rotate(8deg)` } }),
    ),
    word
      ? h(
          AbsoluteFill,
          { style: { alignItems: 'center', justifyContent: 'center' } },
          h(
            'div',
            {
              style: {
                ...gradientText(colors, 30),
                fontSize: Math.min(260, (Math.min(width, 1700) * 1.3) / Math.max(4, word.length)),
                letterSpacing: -6,
                opacity: wordIn,
                transform: `rotate(-6deg) skewX(-8deg) scale(${interpolate(wordIn, [0, 1], [1.5, 1])})`,
              },
            },
            word,
          ),
        )
      : null,
    h(AbsoluteFill, { style: { background: `radial-gradient(circle, #ffffff, ${colors.soft})`, opacity: flash } }),
  )
}

const NeonOutro: React.FC<TemplateRenderProps> = ({ item, frame }) => {
  const colors = colorsFor(item)
  const props = item.templateProps
  const headline = textProp(props, 'headline')
  const ringSize = 300
  return h(
    AbsoluteFill,
    { style: { alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 44, padding: 70 } },
    h(AbsoluteFill, { style: { background: `radial-gradient(circle at 50% 40%, ${colors.glow}40, transparent 60%)` } }),
    h(
      'div',
      { style: { position: 'relative', width: ringSize, height: ringSize, display: 'flex', alignItems: 'center', justifyContent: 'center' } },
      h(NeonRing, { colors, progress: stagger(frame, 0, 0, 18), size: ringSize, style: { position: 'absolute', inset: 0 } }),
      frame >= 12
        ? h(ElectricArcs, {
            colors,
            frame,
            width: ringSize,
            height: ringSize,
            seed: `outro-${item.id}`,
            intensity: 0.5,
            arcs: [
              [ringSize * 0.1, ringSize * 0.25, -ringSize * 0.3, -ringSize * 0.05],
              [ringSize * 0.9, ringSize * 0.75, ringSize * 1.3, ringSize * 1.05],
            ],
          })
        : null,
      h(Bolt, { colors, size: ringSize * 0.62, style: { opacity: stagger(frame, 3) * flicker(frame, `outro-bolt-${item.id}`, 8), transform: `rotate(8deg) scale(${interpolate(stagger(frame, 3), [0, 1], [1.5, 1])})` } }),
    ),
    headline
      ? h(
          'div',
          { style: { position: 'relative', padding: '20px 30px', transform: 'rotate(-5deg)' } },
          h(NeonRule, { colors, progress: stagger(frame, 3, 0, 12), width: '100%', style: { position: 'absolute', top: 0, left: 0 } }),
          h(NeonRule, { colors, progress: stagger(frame, 4, 0, 12), width: '100%', origin: 'right', style: { position: 'absolute', bottom: 0, left: 0 } }),
          h(
            'div',
            { style: { ...gradientText(colors), fontSize: Math.min(140, 1150 / Math.max(5, headline.length)), lineHeight: 1, letterSpacing: -3, whiteSpace: 'nowrap', transform: 'skewX(-6deg)', opacity: stagger(frame, 4) } },
            headline,
          ),
        )
      : null,
    textProp(props, 'handle')
      ? h('div', { style: { ...display, fontStyle: 'normal', textTransform: 'none', fontSize: 64, color: '#fff', textShadow: glow(colors, 24), opacity: stagger(frame, 7) } }, textProp(props, 'handle'))
      : null,
    textProp(props, 'website')
      ? h('div', { style: { ...body, fontSize: 30, fontWeight: 800, letterSpacing: 10, color: colors.soft, opacity: stagger(frame, 9) } }, textProp(props, 'website'))
      : null,
  )
}

export const MOTION_TEMPLATE_COMPONENTS: Record<MotionTemplateKey, React.FC<TemplateRenderProps>> = {
  'gig-announcement': GigAnnouncement,
  'recap-intro': RecapIntro,
  'upcoming-gigs': UpcomingGigs,
  'logo-sting': LogoSting,
  'lower-third': LowerThird,
  'hype-title': HypeTitle,
  'photo-drop': PhotoDrop,
  'clip-recap': ClipRecap,
  'neon-logo-reveal': NeonLogoReveal,
  'lightning-banner': LightningBanner,
  'electric-gig-poster': ElectricGigPoster,
  'now-playing': NowPlaying,
  'bolt-transition': BoltTransition,
  'neon-outro': NeonOutro,
}
