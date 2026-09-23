import type React from 'react'
import { createElement as h } from 'react'
import { AbsoluteFill, interpolate, Sequence } from 'remotion'
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

export const MOTION_TEMPLATE_COMPONENTS: Record<MotionTemplateKey, React.FC<TemplateRenderProps>> = {
  'gig-announcement': GigAnnouncement,
  'recap-intro': RecapIntro,
  'upcoming-gigs': UpcomingGigs,
  'logo-sting': LogoSting,
  'lower-third': LowerThird,
  'hype-title': HypeTitle,
  'photo-drop': PhotoDrop,
  'clip-recap': ClipRecap,
}
