import type React from 'react'
import { createElement as h, Fragment } from 'react'
import { AbsoluteFill, Img, interpolate, random, Sequence, staticFile } from 'remotion'
import type { GraphicItem, ProjectAssetMap } from '../shared/video-project'
import type { LucideIconName } from '../shared/lucide-icons'
import { MOTION_ACCENTS, iconProp, listProp, parseGigRow, textProp, type MotionTemplateKey } from '../shared/video-templates'
import { stagger } from './animation'
import { BRAND_LOGOS, type BrandLogo } from './brand-logo'
import { BODY_FONT_FAMILY, DISPLAY_FONT_FAMILY } from './fonts'
import { LucideIcon } from './lucide-icon'
import { MediaFill } from './media'

// NightLight motion templates. Every template lays out on a virtual canvas
// whose short side is 1080px so the same design scales to any aspect ratio.
//
// All templates share one Electric look built from the real NightLight logo
// artwork. scripts/brand/extract-logo-layers.py cuts both logo files into
// layers (every letter, the bolt, the ring frame, the neon rules and the
// electric arcs) that stack back into the exact logo; templates build, strike
// and crackle with those layers. Custom text gets the logo's white-to-violet
// gradient and sits between the logo's own neon rules.

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
  fontFamily: DISPLAY_FONT_FAMILY,
  fontWeight: 900,
  fontStyle: 'italic',
  textTransform: 'uppercase',
  color: '#fff',
}

const body: React.CSSProperties = {
  fontFamily: BODY_FONT_FAMILY,
  color: '#fff',
}

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const

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

function iconOf(item: GraphicItem, key: string) {
  return iconProp(item.templateKey, item.templateProps, key)
}

/** CTA text followed by its icon; a typed trailing arrow makes way for the icon. */
function ctaLabel(text: string, icon: LucideIconName | null) {
  if (!icon) return text
  return h(
    Fragment,
    null,
    text.replace(/\s*(?:->|[→>])$/, ''),
    h(LucideIcon, { name: icon, style: { marginLeft: '0.3em', verticalAlign: '-0.12em' } }),
  )
}

// ── Logo building blocks ────────────────────────────────────────────────────

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
/** Text and panels lean with the logo. */
const TILT = `rotate(${WORDMARK_BAND.rotate}deg)`

/**
 * Logo-style type: white at the top fading into the accent at the bottom.
 * `deep` starts in the accent instead, for alternating lines.
 */
function gradientText(colors: Colors, glowSize = 22, deep = false): React.CSSProperties {
  return {
    ...display,
    color: 'transparent',
    backgroundImage: deep
      ? `linear-gradient(180deg, ${colors.soft} 0%, ${colors.accent} 55%, ${colors.glow} 100%)`
      : `linear-gradient(180deg, #ffffff 0%, ${colors.soft} 42%, ${colors.accent} 100%)`,
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

/**
 * Something hitting its place: overshoot, then a bright flash that settles.
 * `base` transforms and filters are kept underneath the hit.
 */
function slam(t: number, from = 1.5, base: React.CSSProperties = {}): React.CSSProperties {
  return {
    ...base,
    opacity: Math.min(1, t * 1.6),
    transform: [base.transform, `scale(${interpolate(t, [0, 1], [from, 1])})`].filter(Boolean).join(' '),
    filter: [t < 1 ? `brightness(${1 + (1 - t) * 1.8})` : '', base.filter].filter(Boolean).join(' ') || undefined,
  }
}

/** Clip that wipes content in from the left. */
function wipe(t: number): React.CSSProperties {
  return { clipPath: `inset(-40% ${(1 - t) * 100}% -40% -10%)` }
}

function ringMask(t: number): React.CSSProperties {
  if (t >= 1) return {}
  const mask = `conic-gradient(from -150deg, #000 ${t * 360}deg, transparent ${t * 360}deg)`
  return { WebkitMaskImage: mask, maskImage: mask }
}

type LayerStyle = (layer: string) => React.CSSProperties | null

/** Layer filter that shows a single layer of a logo. */
const only = (keep: string): LayerStyle => name => (name === keep ? {} : null)

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

/** The logo's electric arcs on their own, centred on the parent and crackling. */
const ArcBurst: React.FC<{
  colors: Colors
  width: number
  opacity: number
  logo?: BrandLogo
}> = ({ colors, width, opacity, logo = 'wordmark' }) =>
  h(
    AbsoluteFill,
    { style: { alignItems: 'center', justifyContent: 'center', opacity, pointerEvents: 'none' } },
    h(LogoArt, { logo, width, colors, layer: only('arcs'), style: { position: 'absolute' } }),
  )

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
          transform: TILT,
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
        ...wipe(reveal01),
      },
    },
    text,
  )
}

/** The wordmark's bottom neon rule on its own, wiping in from the left. */
const NeonRule: React.FC<{
  colors: Colors
  width: number
  progress: number
  style?: React.CSSProperties
}> = ({ colors, width, progress, style }) => {
  const [, , w, hh] = BRAND_LOGOS.wordmark.layers['rule-bottom']
  return h(Img, {
    src: staticFile('brand/logo/wordmark-rule-bottom.webp'),
    style: {
      display: 'block',
      width,
      height: (width * hh) / w,
      maxWidth: 'none',
      filter: artTint(colors),
      clipPath: `inset(-20% ${(1 - progress) * 100}% -20% 0)`,
      ...style,
    },
  })
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
  return h(
    'div',
    { style: { position: 'relative', width, height: BRAND_LOGOS.emblem.height * scale } },
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
    h(LogoArt, {
      logo: 'emblem',
      width,
      colors,
      style: { position: 'absolute', left: 0, top: 0 },
      layer: (name) => {
        if (name === 'frame') return ringMask(ring)
        if (name === 'bolt') return slam(reveal(frame, start + 14, 6), 1.8)
        if (name === 'arcs') return { opacity: flicker(frame, `${seed}-arcs`, start + 18) }
        return null
      },
    }),
  )
}

/** The full wordmark, letters slamming in `step` frames apart, then the bolt. */
const WordmarkBuild: React.FC<{
  colors: Colors
  width: number
  frame: number
  start: number
  seed: string
  step?: number
}> = ({ colors, width, frame, start, seed, step = 2 }) => {
  const boltAt = start + 4 + WORDMARK_LETTERS.length * step
  return h(LogoArt, {
    logo: 'wordmark',
    width,
    colors,
    layer: (name) => {
      if (name === 'rule-top') return { clipPath: `inset(-20% ${(1 - reveal(frame, start, 12)) * 100}% -20% 0)` }
      if (name === 'rule-bottom') return { clipPath: `inset(-20% 0 -20% ${(1 - reveal(frame, start + 2, 12)) * 100}%)` }
      if (name === 'bolt') return slam(reveal(frame, boltAt, 6), 1.8)
      if (name === 'arcs') return { opacity: flicker(frame, `${seed}-arcs`, boltAt + 2) }
      const index = WORDMARK_LETTERS.indexOf(name as typeof WORDMARK_LETTERS[number])
      return slam(reveal(frame, start + 4 + index * step, 8))
    },
  })
}

/** The full emblem: the ring draws, letters slam in `step` frames apart, then the bolt. */
const EmblemBuild: React.FC<{
  colors: Colors
  width: number
  frame: number
  start?: number
  seed: string
  step?: number
}> = ({ colors, width, frame, start = 0, seed, step = 1 }) => {
  const ring = reveal(frame, start, 16)
  const boltAt = start + 8 + EMBLEM_LETTERS.length * step
  return h(LogoArt, {
    logo: 'emblem',
    width,
    colors,
    layer: (name) => {
      if (name === 'frame') return ringMask(ring)
      if (name === 'bolt') return slam(reveal(frame, boltAt, 6), 1.8)
      if (name === 'arcs') return { opacity: flicker(frame, `${seed}-arcs`, boltAt + 2) }
      const index = EMBLEM_LETTERS.indexOf(name as typeof EMBLEM_LETTERS[number])
      return slam(reveal(frame, start + 4 + index * step, 8))
    },
  })
}

/** Dark glass panel with a neon edge, skewed like the logo's type. */
const NeonPanel: React.FC<{
  colors: Colors
  /** Horizontal skew in degrees; 0 gives a straight box. */
  skew?: number
  style?: React.CSSProperties
  children?: React.ReactNode
}> = ({ colors, skew = -12, style, children }) =>
  h(
    'div',
    {
      style: {
        padding: '18px 42px',
        background: 'rgba(6,4,10,.84)',
        border: `2px solid ${colors.accent}aa`,
        boxShadow: `0 0 36px ${colors.glow}55, inset 0 0 22px ${colors.glow}33`,
        transform: skew ? `skewX(${skew}deg)` : undefined,
        ...style,
      },
    },
    skew ? h('div', { style: { transform: `skewX(${-skew}deg)` } }, children) : children,
  )

/** A neon-tube edge for a box: it switches on at `from` and then flickers. */
function electricEdge(colors: Colors, frame: number, seed: string, from: number): React.CSSProperties {
  const on = frame < from ? 0 : Math.max(0.6, flicker(frame, seed, from))
  return {
    border: `3px solid ${colors.soft}`,
    boxShadow: [
      `0 0 0 ${5 * on}px ${colors.accent}`,
      `0 0 ${26 * on}px ${6 * on}px ${colors.glow}`,
      `0 0 ${90 * on}px ${16 * on}px ${colors.glow}99`,
      `inset 0 0 ${26 * on}px ${colors.accent}66`,
    ].join(', '),
  }
}

/** The logo's arcs crackling around the edges of the (positioned) parent box. */
const EdgeArcs: React.FC<{
  colors: Colors
  frame: number
  seed: string
  from: number
}> = ({ colors, frame, seed, from }) =>
  h(
    Fragment,
    null,
    [0, 180].map(turn =>
      h(Img, {
        key: turn,
        src: staticFile('brand/logo/emblem-arcs.webp'),
        style: {
          position: 'absolute',
          left: '-14%',
          top: '-12%',
          width: '128%',
          height: '124%',
          maxWidth: 'none',
          filter: artTint(colors),
          transform: `rotate(${turn}deg)`,
          opacity: flicker(frame, `${seed}-${turn}`, from),
        },
      }),
    ),
  )

/** Skewed call-to-action tag in the logo's violet. */
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
        background: `linear-gradient(90deg, ${colors.glow}, ${colors.accent})`,
        transform: 'skewX(-12deg) rotate(-3deg)',
        fontSize: 36,
        letterSpacing: 2,
        boxShadow: `0 0 30px ${colors.glow}aa`,
        ...style,
      },
    },
    children,
  )

/** Small letter-spaced label in the soft accent. */
const Kicker: React.FC<{
  colors: Colors
  size?: number
  style?: React.CSSProperties
  children?: React.ReactNode
}> = ({ colors, size = 28, style, children }) =>
  h('div', { style: { ...body, fontSize: size, fontWeight: 800, letterSpacing: size * 0.4, color: colors.soft, textShadow: `0 0 16px ${colors.glow}`, ...style } }, children)

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

// ── Templates ───────────────────────────────────────────────────────────────

const GigAnnouncement: React.FC<TemplateRenderProps> = ({ item, frame, width, height }) => {
  const colors = colorsFor(item)
  const props = item.templateProps
  const headline = textProp(props, 'headline')
  const words = headline.split(/\s+/).filter(Boolean)
  const rows = [
    { key: 'date', icon: iconOf(item, 'dateIcon'), text: textProp(props, 'date') },
    { key: 'time', icon: iconOf(item, 'timeIcon'), text: textProp(props, 'time') },
    { key: 'venue', icon: iconOf(item, 'venueIcon'), text: [textProp(props, 'venue'), textProp(props, 'location')].filter(Boolean).join('\n') },
  ].filter(row => row.text)
  // Keep the text column aligned when only some rows have an icon.
  const rowIcons = rows.some(row => row.icon)
  const landscape = width > height
  const safe = safeInsets(width, height)
  // Square canvases get a tighter stack so the CTA keeps clear of the edge.
  const compact = !landscape && height < 1400
  const k = compact ? 0.78 : 1
  const align = landscape ? 'flex-start' : 'center'
  const wordsAt = 12
  const cta = textProp(props, 'cta')
  return h(
    AbsoluteFill,
    {
      style: {
        padding: landscape ? '70px 120px' : compact ? '40px 80px 70px' : `${safe.top - 90}px 80px ${safe.bottom}px`,
        justifyContent: 'space-between',
        alignItems: align,
      },
    },
    h(
      'div',
      { style: { display: 'flex', flexDirection: 'column', alignItems: align } },
      h(WordmarkBuild, { colors, width: (landscape ? 500 : 580) * k, frame, start: 0, seed: `gig-mark-${item.id}`, step: 1.5 }),
      h(Kicker, { colors, size: 24, style: { marginTop: -6, opacity: reveal(frame, 18, 10) } }, 'PRESENTEERT'),
    ),
    h(
      'div',
      { style: { display: 'flex', flexDirection: 'column', alignItems: align, textAlign: landscape ? 'left' : 'center', transform: TILT } },
      words.map((word, index) =>
        h(
          'div',
          {
            key: `${word}-${index}`,
            style: slam(reveal(frame, wordsAt + index * 4, 8), 1.4, {
              ...gradientText(colors, 26, index % 2 === 1),
              fontSize: landscape ? 150 : Math.min(180, 1350 / Math.max(4, word.length)) * k,
              lineHeight: 0.9,
              letterSpacing: -4,
              transform: 'skewX(-8deg)',
            }),
          },
          word,
        ),
      ),
      h(NeonRule, { colors, width: (landscape ? 620 : 700) * k, progress: reveal(frame, wordsAt + words.length * 4, 14), style: { marginTop: -24 } }),
    ),
    h(
      'div',
      { style: { display: 'flex', flexDirection: 'column', gap: 30, alignItems: align, width: '100%', transform: compact ? `scale(${k})` : undefined, transformOrigin: 'bottom center' } },
      rows.length
        ? h(
            NeonPanel,
            { colors, style: { padding: '24px 46px', minWidth: 520, opacity: reveal(frame, 24, 10) } },
            h(
              'div',
              { style: { display: 'flex', flexDirection: 'column', gap: 16 } },
              rows.map((row, index) =>
                h(
                  'div',
                  {
                    key: row.key,
                    style: {
                      display: 'flex',
                      gap: 22,
                      alignItems: 'center',
                      opacity: reveal(frame, 26 + index * 3, 10),
                      transform: `translateX(${(1 - reveal(frame, 26 + index * 3, 10)) * -40}px)`,
                    },
                  },
                  rowIcons ? h('span', { style: { display: 'flex', justifyContent: 'center', width: 44, flexShrink: 0, color: colors.soft, filter: `drop-shadow(0 0 10px ${colors.glow})` } }, row.icon ? h(LucideIcon, { name: row.icon, size: 40 }) : null) : null,
                  h('span', { style: { ...display, fontStyle: 'normal', fontSize: 42, whiteSpace: 'pre-line', lineHeight: 1.1, color: index ? colors.soft : '#fff' } }, row.text),
                ),
              ),
            ),
          )
        : null,
      cta
        ? h(
            'div',
            { style: { opacity: reveal(frame, 36, 10), transform: `scale(${interpolate(reveal(frame, 36, 10), [0, 1], [1.4, 1])})` } },
            h(Pill, { colors, style: { fontSize: 44, padding: '18px 56px' } }, ctaLabel(cta, iconOf(item, 'ctaIcon'))),
          )
        : null,
    ),
  )
}

const RecapIntro: React.FC<TemplateRenderProps> = ({ item, frame, width }) => {
  const colors = colorsFor(item)
  const props = item.templateProps
  const headline = textProp(props, 'headline')
  const hit = reveal(frame, 4, 8)
  // RGB-split glitch on the beat, in the logo's colours.
  const split = interpolate(frame % 24, [0, 3, 6], [10, 0, 0], { extrapolateRight: 'clamp' })
  return h(
    AbsoluteFill,
    { style: { alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 80, gap: 30 } },
    textProp(props, 'kicker') ? h('div', { style: { opacity: reveal(frame, 0, 8) } }, h(Pill, { colors }, textProp(props, 'kicker'))) : null,
    h(
      'div',
      { style: { position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', transform: TILT } },
      h(ArcBurst, { colors, width: Math.min(width * 1.05, 1500), opacity: flicker(frame, `recap-arcs-${item.id}`, 12) }),
      h(
        'div',
        {
          style: slam(hit, 1.6, {
            ...gradientText(colors, 30),
            position: 'relative',
            fontSize: Math.min(170, 2000 / Math.max(8, headline.length)),
            lineHeight: 0.9,
            letterSpacing: -6,
            maxWidth: Math.min(width - 120, 1300),
            transform: 'skewX(-8deg)',
            filter: `drop-shadow(${split}px 0 0 ${colors.glow}) drop-shadow(${-split}px 0 0 ${colors.soft}) drop-shadow(0 0 30px ${colors.glow}) drop-shadow(0 12px 30px rgba(0,0,0,.7))`,
          }),
        },
        headline,
      ),
      h(NeonRule, { colors, width: 620, progress: reveal(frame, 12, 14), style: { marginTop: -20 } }),
    ),
    textProp(props, 'meta')
      ? h(Kicker, { colors, size: 36, style: { transform: TILT, opacity: reveal(frame, 18, 10) } }, textProp(props, 'meta'))
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
  const landscape = width > height
  const safe = safeInsets(width, height)
  const headline = textProp(props, 'headline')
  const cta = textProp(props, 'cta')
  const listAt = 16
  const header = h(
    'div',
    { key: 'header', style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 } },
    h(RuleFrame, { colors, width: landscape ? 760 : Math.min(width - 60, 940), frame, seed: `gigs-rules-${item.id}`, content: band => bandText(colors, band, headline, reveal(frame, 4, 12)) }),
    textProp(props, 'kicker') ? h(Kicker, { colors, style: { transform: TILT, opacity: reveal(frame, 12, 10) } }, textProp(props, 'kicker')) : null,
  )
  const dateIcon = iconOf(item, 'dateIcon')
  const timeIcon = iconOf(item, 'timeIcon')
  const placeIcon = iconOf(item, 'placeIcon')
  // Shrink the rows when they would not fit (square canvases, six gigs).
  const listSpace = landscape ? height - 220 : height - (safe.top - 60) - safe.bottom - 500
  const k = Math.min(1, listSpace / Math.max(1, gigs.length * 153 + 20))
  const dateSize = 42 * k
  const iconStyle = (size: number): React.CSSProperties => ({ display: 'flex', flexShrink: 0, color: colors.soft, filter: `drop-shadow(0 0 8px ${colors.glow})`, fontSize: size })
  // A straight card, so long lists keep their icons inside, with the electric edge.
  const rows = gigs.map((gig, index) => {
      const meta = [
        { key: 'time', icon: timeIcon, text: gig.time },
        { key: 'place', icon: placeIcon, text: gig.place },
      ].filter(part => part.text)
      return h(
        'div',
        {
          key: `${gig.date}-${index}`,
          style: {
            display: 'grid',
            gridTemplateColumns: `${(dateIcon ? 250 : 205) * k}px 1fr`,
            gap: 24 * k,
            alignItems: 'center',
            padding: `${32 * k}px 0`,
            borderBottom: index === gigs.length - 1 ? 'none' : `1px solid ${colors.accent}40`,
            opacity: reveal(frame, listAt + index * 4, 10),
            transform: `translateX(${(1 - reveal(frame, listAt + index * 4, 10)) * 80}px)`,
          },
        },
        h(
          'div',
          { style: { display: 'flex', alignItems: 'center', gap: 14 * k } },
          dateIcon ? h('span', { style: iconStyle(38 * k) }, h(LucideIcon, { name: dateIcon })) : null,
          h(
            'div',
            null,
            // Same italic as the date and indented along its slant, so both start on one line.
            gig.day ? h('div', { style: { ...display, fontSize: 22 * k, letterSpacing: 5 * k, color: colors.soft, lineHeight: 1.1, paddingLeft: dateSize * 0.28 } }, gig.day) : null,
            h('div', { style: { ...gradientText(colors, 14), fontSize: dateSize, lineHeight: 1.05, whiteSpace: 'nowrap' } }, gig.date),
          ),
        ),
        h(
          'div',
          { style: { minWidth: 0 } },
          h('div', { style: { ...body, fontSize: 40 * k, fontWeight: 900, lineHeight: 1.1 } }, gig.title),
          meta.length
            ? h(
                'div',
                { style: { display: 'flex', flexWrap: 'wrap', columnGap: 26 * k, rowGap: 4 * k, marginTop: 10 * k } },
                meta.map(part =>
                  h(
                    'span',
                    { key: part.key, style: { ...body, display: 'flex', alignItems: 'center', gap: 10 * k, fontSize: 28 * k, fontWeight: part.key === 'time' ? 800 : 500, color: colors.soft } },
                    part.icon ? h('span', { style: iconStyle(28 * k) }, h(LucideIcon, { name: part.icon })) : null,
                    part.text,
                  ),
                ),
              )
            : null,
        ),
      )
    })
  const list = h(
    'div',
    { key: 'list', style: { position: 'relative', width: '100%', maxWidth: landscape ? 860 : 900, opacity: reveal(frame, listAt - 2, 8) } },
    h(EdgeArcs, { colors, frame, seed: `gigs-arcs-${item.id}`, from: listAt + 4 }),
    h(
      NeonPanel,
      { colors, skew: 0, style: { position: 'relative', padding: `${10 * k}px ${40 * k}px`, ...electricEdge(colors, frame, `gigs-edge-${item.id}`, listAt) } },
      rows,
    ),
  )
  const ctaAt = listAt + gigs.length * 4 + 4
  const ctaNode = cta
    ? h('div', { key: 'cta', style: { opacity: reveal(frame, ctaAt, 10), transform: `scale(${interpolate(reveal(frame, ctaAt, 10), [0, 1], [1.4, 1])})` } }, h(Pill, { colors }, ctaLabel(cta, iconOf(item, 'ctaIcon'))))
    : null
  if (landscape) {
    return h(
      AbsoluteFill,
      { style: { padding: '70px 100px', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 60 } },
      h('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 40 } }, header, ctaNode),
      list,
    )
  }
  return h(
    AbsoluteFill,
    { style: { padding: `${safe.top - 60}px 70px ${safe.bottom}px`, alignItems: 'center', gap: 34 } },
    header,
    list,
    ctaNode ? h('div', { style: { marginTop: 'auto' } }, ctaNode) : null,
  )
}

/** Symmetric waveform under the logo sting, in the logo's gradient. */
const WaveMark: React.FC<{
  colors: Colors
  frame: number
  start: number
  height: number
}> = ({ colors, frame, start, height }) => {
  const bars = 15
  return h(
    'div',
    { style: { display: 'flex', alignItems: 'center', gap: height * 0.09, height } },
    Array.from({ length: bars }, (_, index) => {
      const center = 1 - Math.abs(index - (bars - 1) / 2) / ((bars - 1) / 2)
      const level = (0.15 + center * 0.7 + Math.sin(frame / 3 + index) * 0.12) * reveal(frame, start + Math.abs(index - (bars - 1) / 2), 10)
      return h('div', {
        key: index,
        style: {
          width: height * 0.08,
          height: Math.max(4, level * height),
          borderRadius: height,
          background: `linear-gradient(180deg, #fff, ${colors.soft} 40%, ${colors.accent})`,
          boxShadow: `0 0 12px ${colors.glow}`,
        },
      })
    }),
  )
}

const LogoSting: React.FC<TemplateRenderProps> = ({ item, frame, width }) => {
  const colors = colorsFor(item)
  const kicker = textProp(item.templateProps, 'title')
  const tagline = textProp(item.templateProps, 'tagline')
  // Fast build: the bolt strikes at frame 14 with a flash.
  const flash = interpolate(frame, [14, 16, 26], [0, 0.45, 0], clamp)
  return h(
    AbsoluteFill,
    { style: { alignItems: 'center', justifyContent: 'center', gap: 16 } },
    h(AbsoluteFill, { style: { background: `radial-gradient(circle, ${colors.glow}55, transparent 60%)`, opacity: reveal(frame, 0, 20) } }),
    kicker ? h(Kicker, { colors, size: 34, style: { letterSpacing: 18, transform: TILT, opacity: reveal(frame, 2, 8) } }, kicker) : null,
    h(WordmarkBuild, { colors, width: Math.min(width - 80, 1000), frame, start: 0, seed: `sting-${item.id}`, step: 1 }),
    h(WaveMark, { colors, frame, start: 12, height: 90 }),
    tagline ? h(Kicker, { colors, size: 30, style: { letterSpacing: 14, opacity: reveal(frame, 18, 10) } }, tagline) : null,
    h(AbsoluteFill, { style: { background: `radial-gradient(circle, #ffffff, ${colors.soft})`, opacity: flash } }),
  )
}

const LowerThird: React.FC<TemplateRenderProps> = ({ item, frame, width, height }) => {
  const colors = colorsFor(item)
  const title = textProp(item.templateProps, 'title')
  const subtitle = textProp(item.templateProps, 'subtitle')
  const emblemWidth = 230
  const frameWidth = Math.min(width - emblemWidth - 60, 800)
  return h(
    AbsoluteFill,
    null,
    h(
      'div',
      { style: { position: 'absolute', left: 30, bottom: safeInsets(width, height).bottom - 30, display: 'flex', alignItems: 'center' } },
      h(EmblemBuild, { colors, width: emblemWidth, frame, seed: `lt-emblem-${item.id}`, step: 0.6 }),
      h(
        'div',
        { style: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', marginLeft: -20 } },
        h(RuleFrame, { colors, width: frameWidth, frame, start: 4, seed: `lt-rules-${item.id}`, bolt: false, arcs: false, content: band => bandText(colors, band, title, reveal(frame, 8, 12)) }),
        subtitle
          ? h(
              'div',
              {
                style: {
                  ...body,
                  fontSize: 32,
                  fontWeight: 700,
                  marginTop: -10,
                  marginLeft: frameWidth * 0.12,
                  color: colors.soft,
                  transform: TILT,
                  opacity: reveal(frame, 14, 10),
                  textShadow: `0 0 14px ${colors.glow}, 0 4px 18px rgba(0,0,0,.8)`,
                },
              },
              subtitle,
            )
          : null,
      ),
    ),
  )
}

const HypeTitle: React.FC<TemplateRenderProps> = ({ item, frame, width }) => {
  const colors = colorsFor(item)
  const lines = listProp(item.templateProps, 'lines').filter(Boolean).slice(0, 4)
  const perLine = Math.max(4, Math.floor((item.duration * 0.6) / Math.max(1, lines.length)))
  // Every line hits with a flash and a burst of the logo's arcs.
  const hits = Math.min(lines.length, Math.floor(frame / perLine) + 1)
  const sinceHit = frame - (hits - 1) * perLine
  const flash = lines.length ? interpolate(sinceHit, [0, 1, 7], [0, 0.28, 0], clamp) : 0
  const arcs = sinceHit < 9 ? flicker(frame, `hype-arcs-${item.id}`, 0) : 0.3 * flicker(frame, `hype-idle-${item.id}`, 0)
  return h(
    AbsoluteFill,
    { style: { alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 60 } },
    h(ArcBurst, { colors, width: Math.min(width * 1.1, 1700), opacity: arcs }),
    h(
      'div',
      { style: { transform: TILT, display: 'flex', flexDirection: 'column', alignItems: 'center' } },
      lines.map((line, index) => {
        const local = frame - index * perLine
        if (local < 0) return null
        const punch = interpolate(local, [0, 4, 8], [1.6, 0.94, 1], { extrapolateRight: 'clamp' })
        return h(
          'div',
          {
            key: `${line}-${index}`,
            style: {
              ...gradientText(colors, 36, index % 2 === 1),
              fontSize: Math.min(220, 1700 / Math.max(4, line.length)),
              lineHeight: 0.92,
              letterSpacing: -5,
              transform: `skewX(-8deg) scale(${punch})`,
              filter: `${local < 6 ? `brightness(${1 + (6 - local) * 0.25}) ` : ''}drop-shadow(0 0 36px ${colors.glow}) drop-shadow(0 12px 30px rgba(0,0,0,.7))`,
            },
          },
          line,
        )
      }),
    ),
    h(AbsoluteFill, { style: { background: colors.soft, opacity: flash } }),
  )
}

const PhotoDrop: React.FC<TemplateRenderProps> = ({ item, frame, height, assets }) => {
  const colors = colorsFor(item)
  const assetId = textProp(item.templateProps, 'photo')
  const caption = textProp(item.templateProps, 'caption')
  const cardWidth = 760
  const cardHeight = cardWidth - 56 + 138
  const drop = reveal(frame, 0, 16)
  // Once the polaroid lands its neon edge switches on and the logo's arcs crackle around it.
  const landed = 12
  const edge = electricEdge(colors, frame, `photo-edge-${item.id}`, landed)
  const flash = interpolate(frame, [landed, landed + 2, landed + 10], [0, 0.35, 0], clamp)
  const [, , boltW, boltH] = BRAND_LOGOS.emblem.layers.bolt
  return h(
    AbsoluteFill,
    { style: { alignItems: 'center', justifyContent: 'center' } },
    h(AbsoluteFill, { style: { background: `radial-gradient(circle at 50% 45%, ${colors.glow}44, transparent 60%)`, opacity: reveal(frame, 0, 20) } }),
    h(
      'div',
      {
        style: {
          position: 'relative',
          width: cardWidth,
          height: cardHeight,
          transform: `translateY(${(1 - drop) * -height}px) rotate(${interpolate(drop, [0, 1], [-18, -4])}deg)`,
        },
      },
      h(EdgeArcs, { colors, frame, seed: `photo-arcs-${item.id}`, from: landed + 2 }),
      h(
        'div',
        {
          style: {
            position: 'absolute',
            inset: 0,
            padding: '28px 28px 0',
            background: '#f4f1ea',
            ...edge,
            boxShadow: `${edge.boxShadow}, 0 40px 90px rgba(0,0,0,.6)`,
          },
        },
        h(
          'div',
          { style: { position: 'relative', width: '100%', aspectRatio: '1 / 1', overflow: 'hidden', background: '#111' } },
          h(MediaFill, { asset: assetId ? assets[assetId] : undefined, muted: true }),
          h(AbsoluteFill, { style: { boxShadow: `inset 0 0 40px ${colors.glow}66` } }),
        ),
        caption
          ? h(
              'div',
              {
                style: {
                  ...display,
                  height: 110,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  whiteSpace: 'nowrap',
                  fontSize: Math.min(40, (cardWidth - 80) / (0.72 * Math.max(10, caption.length))),
                  color: 'transparent',
                  backgroundImage: `linear-gradient(180deg, #15101c 30%, ${colors.glow})`,
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  transform: 'rotate(-2deg)',
                  ...wipe(reveal(frame, landed + 4, 12)),
                },
              },
              caption,
            )
          : null,
      ),
      // The logo's bolt pins the polaroid like a strip of tape.
      h(Img, {
        src: staticFile('brand/logo/emblem-bolt.webp'),
        style: slam(reveal(frame, landed + 2, 6), 1.8, {
          position: 'absolute',
          top: -70,
          right: -60,
          width: 170,
          height: (170 * boltH) / boltW,
          maxWidth: 'none',
          filter: artTint(colors),
        }),
      }),
    ),
    h(AbsoluteFill, { style: { background: colors.soft, opacity: flash } }),
  )
}

const ClipRecap: React.FC<TemplateRenderProps> = ({ item, frame, width, height, assets }) => {
  const colors = colorsFor(item)
  const media = listProp(item.templateProps, 'media').filter(Boolean).slice(0, 5)
  const count = Math.max(1, media.length)
  const slot = Math.max(1, Math.floor(item.duration / count))
  // Each cut hits with a violet flash and the logo's arcs.
  const onCut = media.length > 1 && frame >= slot && frame < slot * count
  const sinceCut = frame % slot
  const title = textProp(item.templateProps, 'title')
  const frameWidth = Math.min(width - 100, 900)
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
    onCut && sinceCut < 6 ? h(ArcBurst, { colors, width: Math.max(width, height) * 1.1, opacity: flicker(frame, `recap-cut-${item.id}`, 0) }) : null,
    h(AbsoluteFill, {
      style: {
        background: `radial-gradient(circle, #ffffff, ${colors.soft})`,
        opacity: onCut ? interpolate(sinceCut, [0, 4], [0.7, 0], clamp) : 0,
      },
    }),
    h(AbsoluteFill, { style: { background: 'linear-gradient(180deg, transparent 50%, rgba(5,3,8,.88))' } }),
    h(
      'div',
      { style: { position: 'absolute', left: 30, bottom: safeInsets(width, height).bottom - 20, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' } },
      title ? h(RuleFrame, { colors, width: frameWidth, frame, start: 4, seed: `clips-${item.id}`, content: band => bandText(colors, band, title, reveal(frame, 8, 12)) }) : null,
      h(
        Kicker,
        { colors, size: 30, style: { marginTop: -6, marginLeft: frameWidth * 0.14, transform: TILT, opacity: reveal(frame, 14, 10) } },
        String(Math.min(count, Math.floor(frame / slot) + 1)).padStart(2, '0'),
        ' / ',
        String(count).padStart(2, '0'),
      ),
    ),
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
            if (name === 'frame') return ringMask(ring)
            if (name === 'bolt') return slam(strike, 2)
            if (name === 'arcs') return { opacity: flicker(frame, `reveal-arcs-${item.id}`, 28) }
            const index = EMBLEM_LETTERS.indexOf(name as typeof EMBLEM_LETTERS[number])
            return slam(reveal(frame, 6 + index * 2 + (index >= 5 ? 2 : 0), 8))
          },
        }),
        tagline
          ? h(
              Kicker,
              {
                colors,
                size: 34,
                style: {
                  position: 'absolute',
                  top: artHeight + 30,
                  left: -200,
                  right: -200,
                  textAlign: 'center',
                  letterSpacing: 14,
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
      ? h(Kicker, { colors, size: 32, style: { letterSpacing: 10, transform: TILT, opacity: reveal(frame, 16, 12) } }, subtitle)
      : null,
  )
}

const ElectricGigPoster: React.FC<TemplateRenderProps> = ({ item, frame, width, height }) => {
  const colors = colorsFor(item)
  const props = item.templateProps
  const landscape = width > height
  const safe = safeInsets(width, height)
  const padding = landscape ? { top: 70, bottom: 70 } : { top: safe.top - 60, bottom: safe.bottom - 60 }
  // Shrink the stack on short canvases (square) so nothing collides.
  const k = landscape ? 1 : Math.min(1, (height - padding.top - padding.bottom) / 1260)
  const headline = textProp(props, 'headline')
  const info = [
    { key: 'venue', icon: iconOf(item, 'venueIcon'), text: textProp(props, 'venue') },
    { key: 'time', icon: iconOf(item, 'timeIcon'), text: textProp(props, 'time') },
  ].filter(row => row.text)
  const infoIcons = info.some(row => row.icon)
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
          NeonPanel,
          { key: 'info', colors, style: { transform: `skewX(-12deg) scale(${k})`, opacity: reveal(frame, 28, 12) } },
          h(
            'div',
            { style: { display: 'flex', flexDirection: 'column', gap: 8 } },
            info.map((row, index) =>
              h(
                'div',
                { key: row.key, style: { ...display, fontStyle: 'normal', fontSize: index ? 34 : 40, color: index ? colors.soft : '#fff', display: 'flex', alignItems: 'center', gap: 16 } },
                infoIcons ? h('span', { style: { display: 'flex', width: 38, flexShrink: 0, color: colors.soft } }, row.icon ? h(LucideIcon, { name: row.icon, size: 38 }) : null) : null,
                row.text,
              ),
            ),
          ),
        )
      : null,
    cta
      ? h(
          'div',
          { key: 'cta', style: { opacity: reveal(frame, 32, 10), transform: `scale(${interpolate(reveal(frame, 32, 10), [0, 1], [1.4, 1]) * k})` } },
          h(Pill, { colors, style: { fontSize: 40 } }, ctaLabel(cta, iconOf(item, 'ctaIcon'))),
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

const NowPlaying: React.FC<TemplateRenderProps> = ({ item, frame, width, height }) => {
  const colors = colorsFor(item)
  const props = item.templateProps
  const frameWidth = Math.min(width - 100, 960)
  return h(
    AbsoluteFill,
    null,
    h(
      'div',
      { style: { position: 'absolute', left: 30, bottom: safeInsets(width, height).bottom, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' } },
      h(
        'div',
        { style: { display: 'flex', alignItems: 'center', gap: 18, marginLeft: frameWidth * 0.2, marginBottom: -6, transform: TILT, opacity: reveal(frame, 4, 10) } },
        h(EqBars, { colors, frame }),
        h(Kicker, { colors, size: 26, style: { letterSpacing: 9 } }, textProp(props, 'label')),
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
                transform: TILT,
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
                transform: `${TILT} skewX(-8deg) scale(${interpolate(wordIn, [0, 1], [1.5, 1])})`,
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
  const handleIcon = iconOf(item, 'handleIcon')
  const websiteIcon = iconOf(item, 'websiteIcon')
  return h(
    AbsoluteFill,
    { style: { alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 36, padding: 60 } },
    h(AbsoluteFill, { style: { background: `radial-gradient(circle at 50% 40%, ${colors.glow}40, transparent 60%)` } }),
    h(EmblemBuild, { colors, width: 560, frame, seed: `outro-${item.id}` }),
    headline
      ? h(RuleFrame, { colors, width: Math.min(width - 80, 900), frame, start: 14, seed: `outro-rules-${item.id}`, bolt: false, arcs: false, content: band => bandText(colors, band, headline, reveal(frame, 18, 12)) })
      : null,
    textProp(props, 'handle')
      ? h(
          'div',
          { style: { ...display, fontStyle: 'normal', textTransform: 'none', fontSize: 64, color: '#fff', textShadow: glow(colors, 24), opacity: reveal(frame, 26, 10), display: 'flex', alignItems: 'center', gap: 20 } },
          handleIcon ? h(LucideIcon, { name: handleIcon, size: '0.85em', style: { filter: `drop-shadow(0 0 14px ${colors.glow})` } }) : null,
          textProp(props, 'handle'),
        )
      : null,
    textProp(props, 'website')
      ? h(
          Kicker,
          { colors, size: 30, style: { letterSpacing: 10, opacity: reveal(frame, 30, 10), display: 'flex', alignItems: 'center', gap: 14, textShadow: undefined } },
          websiteIcon ? h(LucideIcon, { name: websiteIcon }) : null,
          textProp(props, 'website'),
        )
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
