import type React from 'react'
import { createElement as h } from 'react'
import { AbsoluteFill, Img, interpolate, random, Sequence, staticFile } from 'remotion'
import type { GraphicItem, ProjectAssetMap } from '../shared/video-project'
import { MOTION_ACCENTS, listProp, parseGigRow, textProp, type MotionTemplateKey } from '../shared/video-templates'
import { stagger } from './animation'
import { BRAND_LOGOS, type BrandLogo } from './brand-logo'
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
    h('div', { style: { textAlign: landscape ? 'left' : 'center', opacity: stagger(frame, 0) } }, h(Kicker, null, 'DJ NIGHTLIGHT PRESENTEERT')),
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
// Animates the real NightLight logo artwork. scripts/brand/extract-logo-layers.py
// cuts both logo files into layers (every letter, the bolt, the ring frame, the
// neon rules and the electric arcs) that stack back into the exact logo; these
// templates build, strike and crackle with those layers. Custom text gets the
// logo's white-to-violet gradient and sits between the logo's own neon rules.

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const

const EMBLEM_LETTERS = ['n1', 'i1', 'g1', 'h1', 't1', 'l2', 'i2', 'g2', 'h2', 't2'] as const
const WORDMARK_LETTERS = ['n', 'i', 'g', 'h', 't', 'l', 'i2', 'g2', 'h2', 't2'] as const
/** Ring centre and inner radius on the emblem canvas. */
const EMBLEM_RING = { x: 581, y: 552, radius: 380 }
/** Letter band of the wordmark: centre, size and tilt of the space between its rules. */
const WORDMARK_BAND = { x: 930, y: 348, width: 1260, height: 216, rotate: -6.2 }
/** Vertical span of the wordmark rules, used to crop the rule frame. */
const WORDMARK_RULES = { top: 95, bottom: 605 }
/** Dominant hue of the logo artwork. */
const LOGO_HUE = 268

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

function hueOf(hex: string) {
  const [r, g, b] = [1, 3, 5].map(offset => parseInt(hex.slice(offset, offset + 2), 16) / 255) as [number, number, number]
  const max = Math.max(r, g, b)
  const delta = max - Math.min(r, g, b)
  if (!delta) return LOGO_HUE
  const hue = max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4
  return (hue * 60 + 360) % 360
}

/** Shifts the violet artwork towards the chosen accent; the logo's own violet stays untouched. */
function artTint(colors: Colors) {
  if (colors === MOTION_ACCENTS.mono) return 'grayscale(1) brightness(1.15)'
  const shift = ((hueOf(colors.accent) - LOGO_HUE + 540) % 360) - 180
  return Math.abs(shift) < 12 ? undefined : `hue-rotate(${Math.round(shift)}deg)`
}

/** 0→1 over `length` frames starting at `start`. */
function reveal(frame: number, start: number, length = 10) {
  return stagger(frame - start, 0, 0, length)
}

/** Neon-tube flicker once a light has switched on. */
function flicker(frame: number, seed: string, from: number) {
  if (frame < from) return 0
  const roll = random(`${seed}-${Math.floor(frame / 2)}`)
  return roll > 0.3 ? 1 : roll > 0.12 ? 0.45 : 0
}

/** A letter or bolt hitting its place: overshoot, then a bright flash that settles. */
function slam(t: number, from = 1.5): React.CSSProperties {
  return {
    opacity: Math.min(1, t * 1.6),
    transform: `scale(${interpolate(t, [0, 1], [from, 1])})`,
    filter: t < 1 ? `brightness(${1 + (1 - t) * 1.8})` : undefined,
  }
}

type LayerStyle = (layer: string) => React.CSSProperties | null

/** The logo rebuilt from its layers. `layer` styles each layer; returning null hides it. */
const LogoArt: React.FC<{
  logo: BrandLogo
  width: number
  colors: Colors
  layer?: LayerStyle
  style?: React.CSSProperties
}> = ({ logo, width, colors, layer, style }) => {
  const spec = BRAND_LOGOS[logo]
  const scale = width / spec.width
  return h(
    'div',
    { style: { position: 'relative', width, height: spec.height * scale, filter: artTint(colors), ...style } },
    Object.entries(spec.layers).map(([name, [x, y, w, hh]]) => {
      const extra = layer ? layer(name) : {}
      if (extra === null) return null
      return h(Img, {
        key: name,
        src: staticFile(`brand/logo/${logo}-${name}.webp`),
        style: { position: 'absolute', left: x * scale, top: y * scale, width: w * scale, height: hh * scale, maxWidth: 'none', ...extra },
      })
    }),
  )
}

/**
 * The wordmark's own neon rules (plus its bolt and arcs when asked) with custom
 * content in the letter band between them. Cropped to the rules for layout;
 * the bolt and arcs spill over.
 */
const RuleFrame: React.FC<{
  colors: Colors
  width: number
  frame: number
  start?: number
  seed: string
  bolt?: boolean
  arcs?: boolean
  content: (band: { width: number, height: number }) => React.ReactNode
}> = ({ colors, width, frame, start = 0, seed, bolt = true, arcs = true, content }) => {
  const scale = width / BRAND_LOGOS.wordmark.width
  const top = reveal(frame, start, 12)
  const bottom = reveal(frame, start + 2, 12)
  const strike = reveal(frame, start + 12, 6)
  const band = { width: WORDMARK_BAND.width * scale, height: WORDMARK_BAND.height * scale }
  return h(
    'div',
    { style: { position: 'relative', width, height: (WORDMARK_RULES.bottom - WORDMARK_RULES.top) * scale } },
    h(LogoArt, {
      logo: 'wordmark',
      width,
      colors,
      style: { position: 'absolute', left: 0, top: -WORDMARK_RULES.top * scale },
      layer: (name) => {
        if (name === 'rule-top') return { clipPath: `inset(-20% ${(1 - top) * 100}% -20% 0)` }
        if (name === 'rule-bottom') return { clipPath: `inset(-20% 0 -20% ${(1 - bottom) * 100}%)` }
        if (name === 'bolt' && bolt) return { ...slam(strike, 1.8), opacity: strike * (frame >= start + 18 ? Math.max(0.55, flicker(frame, `${seed}-bolt`, 0)) : 1) }
        if (name === 'arcs' && arcs) return { opacity: flicker(frame, `${seed}-arcs`, start + 14) }
        return null
      },
    }),
    h(
      'div',
      {
        style: {
          position: 'absolute',
          left: (WORDMARK_BAND.x - WORDMARK_BAND.width / 2) * scale,
          top: (WORDMARK_BAND.y - WORDMARK_RULES.top - WORDMARK_BAND.height / 2) * scale,
          width: band.width,
          height: band.height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transform: `rotate(${WORDMARK_BAND.rotate}deg)`,
        },
      },
      content(band),
    ),
  )
}

/** Custom text sized to fill a rule-frame band. */
function bandText(colors: Colors, band: { width: number, height: number }, text: string, reveal01: number): React.ReactNode {
  return h(
    'div',
    {
      style: {
        ...gradientText(colors, Math.max(10, band.height * 0.14)),
        fontSize: Math.min(band.height * 0.86, band.width / (0.66 * Math.max(4, text.length))),
        lineHeight: 1,
        letterSpacing: -2,
        whiteSpace: 'nowrap',
        transform: 'skewX(-8deg)',
        clipPath: `inset(-40% ${(1 - reveal01) * 100}% -40% -10%)`,
      },
    },
    text,
  )
}

const NeonLogoReveal: React.FC<TemplateRenderProps> = ({ item, frame, width, height }) => {
  const colors = colorsFor(item)
  const size = Math.min(width, height) * 0.86
  const ring = reveal(frame, 0, 20)
  const strike = reveal(frame, 26, 6)
  const flash = interpolate(frame, [27, 29, 38], [0, 0.4, 0], clamp)
  const breathe = frame > 40 ? 1 + Math.sin((frame - 40) / 14) * 0.008 : 1
  const artHeight = (size * BRAND_LOGOS.emblem.height) / BRAND_LOGOS.emblem.width
  const tagline = textProp(item.templateProps, 'tagline')
  return h(
    AbsoluteFill,
    null,
    h(AbsoluteFill, { style: { background: `radial-gradient(circle at 50% 50%, ${colors.glow}55, transparent 58%)`, opacity: ring } }),
    h(
      AbsoluteFill,
      { style: { alignItems: 'center', justifyContent: 'center' } },
      h(
        'div',
        { style: { position: 'relative', transform: `scale(${breathe})` } },
        h(LogoArt, {
          logo: 'emblem',
          width: size,
          colors,
          layer: (name) => {
            if (name === 'frame') {
              const mask = `conic-gradient(from -150deg, #000 ${ring * 360}deg, transparent ${ring * 360}deg)`
              return ring < 1 ? { WebkitMaskImage: mask, maskImage: mask } : {}
            }
            if (name === 'bolt') return slam(strike, 2)
            if (name === 'arcs') return { opacity: flicker(frame, `reveal-arcs-${item.id}`, 28) }
            const index = EMBLEM_LETTERS.indexOf(name as typeof EMBLEM_LETTERS[number])
            return slam(reveal(frame, 6 + index * 2 + (index >= 5 ? 2 : 0), 8))
          },
        }),
        tagline
          ? h(
              'div',
              {
                style: {
                  ...body,
                  position: 'absolute',
                  top: artHeight + 30,
                  left: -200,
                  right: -200,
                  textAlign: 'center',
                  fontSize: 34,
                  fontWeight: 800,
                  letterSpacing: 14,
                  color: colors.soft,
                  textShadow: `0 0 18px ${colors.glow}`,
                  opacity: reveal(frame, 34, 12),
                },
              },
              tagline,
            )
          : null,
      ),
    ),
    h(AbsoluteFill, { style: { background: colors.soft, opacity: flash } }),
  )
}

const LightningBanner: React.FC<TemplateRenderProps> = ({ item, frame, width }) => {
  const colors = colorsFor(item)
  const title = textProp(item.templateProps, 'title')
  const subtitle = textProp(item.templateProps, 'subtitle')
  const frameWidth = Math.min(width - 60, 1560)
  return h(
    AbsoluteFill,
    { style: { alignItems: 'center', justifyContent: 'center', gap: 34 } },
    h(RuleFrame, { colors, width: frameWidth, frame, seed: `banner-${item.id}`, content: band => bandText(colors, band, title, reveal(frame, 6, 12)) }),
    subtitle
      ? h(
          'div',
          {
            style: {
              ...body,
              fontSize: 32,
              fontWeight: 800,
              letterSpacing: 10,
              color: colors.soft,
              textShadow: `0 0 16px ${colors.glow}`,
              transform: `rotate(${WORDMARK_BAND.rotate}deg)`,
              opacity: reveal(frame, 16, 12),
            },
          },
          subtitle,
        )
      : null,
  )
}

/** The emblem's ring (with its bolt and arcs) as a badge around custom content. */
const RingBadge: React.FC<{
  colors: Colors
  width: number
  frame: number
  start: number
  seed: string
  children?: React.ReactNode
}> = ({ colors, width, frame, start, seed, children }) => {
  const scale = width / BRAND_LOGOS.emblem.width
  const ring = reveal(frame, start, 18)
  const mask = `conic-gradient(from -150deg, #000 ${ring * 360}deg, transparent ${ring * 360}deg)`
  return h(
    'div',
    { style: { position: 'relative', width, height: BRAND_LOGOS.emblem.height * scale } },
    h(LogoArt, {
      logo: 'emblem',
      width,
      colors,
      layer: (name) => {
        if (name === 'frame') return ring < 1 ? { WebkitMaskImage: mask, maskImage: mask } : {}
        if (name === 'bolt') return slam(reveal(frame, start + 14, 6), 1.8)
        if (name === 'arcs') return { opacity: flicker(frame, `${seed}-arcs`, start + 18) }
        return null
      },
    }),
    h(
      'div',
      {
        style: {
          position: 'absolute',
          left: (EMBLEM_RING.x - EMBLEM_RING.radius) * scale,
          top: (EMBLEM_RING.y - EMBLEM_RING.radius) * scale,
          width: EMBLEM_RING.radius * 2 * scale,
          height: EMBLEM_RING.radius * 2 * scale,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        },
      },
      children,
    ),
  )
}

/** The full wordmark, letters slamming in one after another. */
const WordmarkBuild: React.FC<{
  colors: Colors
  width: number
  frame: number
  start: number
  seed: string
}> = ({ colors, width, frame, start, seed }) =>
  h(LogoArt, {
    logo: 'wordmark',
    width,
    colors,
    layer: (name) => {
      if (name === 'rule-top') return { clipPath: `inset(-20% ${(1 - reveal(frame, start, 12)) * 100}% -20% 0)` }
      if (name === 'rule-bottom') return { clipPath: `inset(-20% 0 -20% ${(1 - reveal(frame, start + 2, 12)) * 100}%)` }
      if (name === 'bolt') return slam(reveal(frame, start + 24, 6), 1.8)
      if (name === 'arcs') return { opacity: flicker(frame, `${seed}-arcs`, start + 26) }
      const index = WORDMARK_LETTERS.indexOf(name as typeof WORDMARK_LETTERS[number])
      return slam(reveal(frame, start + 4 + index * 2, 8))
    },
  })

const ElectricGigPoster: React.FC<TemplateRenderProps> = ({ item, frame, width, height }) => {
  const colors = colorsFor(item)
  const props = item.templateProps
  const landscape = width > height
  const safe = safeInsets(width, height)
  const padding = landscape ? { top: 70, bottom: 70 } : { top: safe.top - 60, bottom: safe.bottom - 60 }
  // Shrink the stack on short canvases (square) so nothing collides.
  const k = landscape ? 1 : Math.min(1, (height - padding.top - padding.bottom) / 1260)
  const headline = textProp(props, 'headline')
  const info = [textProp(props, 'venue'), textProp(props, 'time')].filter(Boolean)
  const cta = textProp(props, 'cta')
  const badgeWidth = (landscape ? 640 : 520) * k
  const ringSize = (2 * EMBLEM_RING.radius * badgeWidth) / BRAND_LOGOS.emblem.width
  const day = reveal(frame, 16, 8)

  const header = h(WordmarkBuild, { colors, width: (landscape ? 700 : 660) * k, frame, start: 0, seed: `poster-mark-${item.id}` })
  const badge = h(
    RingBadge,
    { colors, width: badgeWidth, frame, start: 6, seed: `poster-ring-${item.id}` },
    h('div', { style: { ...gradientText(colors, 26), fontSize: ringSize * 0.5, lineHeight: 0.9, letterSpacing: -8, transform: 'skewX(-8deg)', ...slam(day) } }, textProp(props, 'day')),
    h('div', { style: { ...display, fontSize: ringSize * 0.13, letterSpacing: 14, color: colors.soft, textShadow: `0 0 18px ${colors.glow}`, opacity: reveal(frame, 20, 10) } }, textProp(props, 'month')),
  )
  const blocks = [
    headline
      ? h(RuleFrame, { key: 'headline', colors, width: (landscape ? 820 : 900) * k, frame, start: 18, seed: `poster-rules-${item.id}`, arcs: false, bolt: false, content: band => bandText(colors, band, headline, reveal(frame, 22, 12)) })
      : null,
    info.length
      ? h(
          'div',
          {
            key: 'info',
            style: {
              padding: '18px 42px',
              background: 'rgba(6,4,10,.84)',
              border: `2px solid ${colors.accent}aa`,
              boxShadow: `0 0 36px ${colors.glow}55, inset 0 0 22px ${colors.glow}33`,
              transform: `skewX(-12deg) scale(${k})`,
              opacity: reveal(frame, 28, 12),
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
          { key: 'cta', style: { opacity: reveal(frame, 32, 10), transform: `scale(${interpolate(reveal(frame, 32, 10), [0, 1], [1.4, 1]) * k})` } },
          h(Pill, { colors, style: { background: `linear-gradient(90deg, ${colors.glow}, ${colors.accent})`, fontSize: 40 } }, ensureArrow(cta)),
        )
      : null,
  ]
  return h(
    AbsoluteFill,
    {
      style: {
        padding: landscape ? '70px 110px' : `${padding.top}px 60px ${padding.bottom}px`,
        flexDirection: landscape ? 'row' : 'column',
        alignItems: 'center',
        justifyContent: landscape ? 'center' : 'space-evenly',
        gap: landscape ? 70 : 10,
      },
    },
    ...(landscape
      ? [badge, h('div', { key: 'details', style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 30 } }, header, ...blocks)]
      : [header, badge, ...blocks]),
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
  const frameWidth = Math.min(width - 100, 960)
  const tilt = `rotate(${WORDMARK_BAND.rotate}deg)`
  return h(
    AbsoluteFill,
    null,
    h(
      'div',
      { style: { position: 'absolute', left: 30, bottom: safeInsets(width, height).bottom, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' } },
      h(
        'div',
        { style: { display: 'flex', alignItems: 'center', gap: 18, marginLeft: frameWidth * 0.2, marginBottom: -6, transform: tilt, opacity: reveal(frame, 4, 10) } },
        h(EqBars, { colors, frame }),
        h('div', { style: { ...body, fontSize: 26, fontWeight: 800, letterSpacing: 9, color: colors.soft, textShadow: `0 0 14px ${colors.glow}` } }, textProp(props, 'label')),
      ),
      h(RuleFrame, { colors, width: frameWidth, frame, seed: `np-${item.id}`, content: band => bandText(colors, band, textProp(props, 'artist'), reveal(frame, 6, 12)) }),
      textProp(props, 'track')
        ? h(
            'div',
            {
              style: {
                ...body,
                fontSize: 34,
                fontWeight: 700,
                marginTop: -8,
                marginLeft: frameWidth * 0.14,
                transform: tilt,
                opacity: reveal(frame, 12, 10),
                textShadow: '0 4px 18px rgba(0,0,0,.8)',
              },
            },
            textProp(props, 'track'),
          )
        : null,
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
  const arcsOn = frame >= mid - 4 && frame <= mid + tail + 2
  const wordIn = interpolate(frame, [mid, mid + 3], [0, 1], clamp) * interpolate(frame, [duration - 4, duration - 1], [1, 0], clamp)
  const [, , boltW, boltH] = BRAND_LOGOS.wordmark.layers.bolt
  const boltHeight = height * 0.8
  const arcSize = Math.max(width, height) * 1.15
  const only = (keep: string) => (name: string) => (name === keep ? {} : null)
  return h(
    AbsoluteFill,
    null,
    h(AbsoluteFill, { style: { background: `radial-gradient(circle at 50% 45%, ${colors.glow}aa, #05030a 70%)`, opacity: wash } }),
    arcsOn
      ? h(
          AbsoluteFill,
          { style: { alignItems: 'center', justifyContent: 'center', opacity: flicker(frame, `transition-arcs-${item.id}`, 0) } },
          h(LogoArt, { logo: 'emblem', width: arcSize, colors, layer: only('arcs'), style: { position: 'absolute' } }),
          h(LogoArt, { logo: 'wordmark', width: arcSize, colors, layer: only('arcs'), style: { position: 'absolute', transform: 'rotate(90deg) scaleX(-1)' } }),
        )
      : null,
    h(
      AbsoluteFill,
      { style: { alignItems: 'center', justifyContent: 'center' } },
      h(Img, {
        src: staticFile('brand/logo/wordmark-bolt.webp'),
        style: {
          height: boltHeight,
          width: (boltHeight * boltW) / boltH,
          maxWidth: 'none',
          opacity: boltOpacity,
          filter: artTint(colors),
          transform: `translateY(${drop * height}px)`,
        },
      }),
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
                transform: `rotate(${WORDMARK_BAND.rotate}deg) skewX(-8deg) scale(${interpolate(wordIn, [0, 1], [1.5, 1])})`,
              },
            },
            word,
          ),
        )
      : null,
    h(AbsoluteFill, { style: { background: `radial-gradient(circle, #ffffff, ${colors.soft})`, opacity: flash } }),
  )
}

const NeonOutro: React.FC<TemplateRenderProps> = ({ item, frame, width }) => {
  const colors = colorsFor(item)
  const props = item.templateProps
  const headline = textProp(props, 'headline')
  const ring = reveal(frame, 0, 16)
  const mask = `conic-gradient(from -150deg, #000 ${ring * 360}deg, transparent ${ring * 360}deg)`
  return h(
    AbsoluteFill,
    { style: { alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 36, padding: 60 } },
    h(AbsoluteFill, { style: { background: `radial-gradient(circle at 50% 40%, ${colors.glow}40, transparent 60%)` } }),
    h(LogoArt, {
      logo: 'emblem',
      width: 560,
      colors,
      layer: (name) => {
        if (name === 'frame') return ring < 1 ? { WebkitMaskImage: mask, maskImage: mask } : {}
        if (name === 'bolt') return slam(reveal(frame, 18, 6), 1.8)
        if (name === 'arcs') return { opacity: flicker(frame, `outro-arcs-${item.id}`, 20) }
        const index = EMBLEM_LETTERS.indexOf(name as typeof EMBLEM_LETTERS[number])
        return slam(reveal(frame, 4 + index, 8))
      },
    }),
    headline
      ? h(RuleFrame, { colors, width: Math.min(width - 80, 900), frame, start: 14, seed: `outro-rules-${item.id}`, bolt: false, arcs: false, content: band => bandText(colors, band, headline, reveal(frame, 18, 12)) })
      : null,
    textProp(props, 'handle')
      ? h('div', { style: { ...display, fontStyle: 'normal', textTransform: 'none', fontSize: 64, color: '#fff', textShadow: glow(colors, 24), opacity: reveal(frame, 26, 10) } }, textProp(props, 'handle'))
      : null,
    textProp(props, 'website')
      ? h('div', { style: { ...body, fontSize: 30, fontWeight: 800, letterSpacing: 10, color: colors.soft, opacity: reveal(frame, 30, 10) } }, textProp(props, 'website'))
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
