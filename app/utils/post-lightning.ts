// Lightning drawing kit for the photo editor. It is the canvas twin of the
// video templates' building blocks (remotion/motion-templates.ts) so a post and
// a video read as one family: the real NightLight wordmark art, gradient hero
// type between the logo's neon rules, white fact rows in a neon panel, small
// letter-spaced support text and one skewed CTA pill.
//
// Text is ranked on the same four levels as the videos:
//   1 hero     the one thing to get in a second (gradient type)
//   2 facts    what / when / where (white display type)
//   3 support  presenter line, source, counters (kicker)
//   action     the CTA pill, at most one, at the bottom

import { BRAND_LOGOS } from '~~/remotion/brand-logo'
import { MOTION_ACCENTS, type MotionAccent } from '~~/shared/video-templates'

export type AccentColors = (typeof MOTION_ACCENTS)[MotionAccent]

export const DISPLAY_FONT = '"Archivo Black", "Arial Black", sans-serif'
export const BODY_FONT = 'Archivo, Arial, sans-serif'

/** Type scale in px on a 1080-wide canvas; everything scales with the canvas width. */
export const TYPE = { lead: 54, fact: 44, support: 28, cta: 40 } as const

/** Text and panels lean with the logo. */
export const TILT_DEG = -6.2
const TILT = TILT_DEG * Math.PI / 180
/** tan(8°): the horizontal skew of the logo's italic type. */
const SKEW = -0.1405

// ── Assets ──────────────────────────────────────────────────────────────────

const FONT_FACES = [
  { family: 'Archivo Black', file: '/fonts/ArchivoBlack-Regular.woff2', weight: '100 900', style: 'normal' },
  { family: 'Archivo', file: '/fonts/Archivo-Variable.woff2', weight: '100 900', style: 'normal' },
  { family: 'Archivo', file: '/fonts/Archivo-Italic-Variable.woff2', weight: '100 900', style: 'italic' },
] as const

export type PostAssets = {
  /** Wordmark layers by name; a layer that failed to load is left out. */
  wordmark: Map<string, HTMLImageElement>
}

let assetsPromise: Promise<PostAssets> | null = null

function loadImage(src: string) {
  return new Promise<HTMLImageElement | null>((resolve) => {
    const image = new Image()
    image.decoding = 'async'
    image.onload = () => resolve(image)
    image.onerror = () => resolve(null)
    image.src = src
  })
}

async function loadFonts() {
  if (typeof FontFace === 'undefined' || typeof document === 'undefined') return
  await Promise.all(FONT_FACES.map(async (font) => {
    try {
      const face = new FontFace(font.family, `url(${font.file})`, { weight: font.weight, style: font.style })
      document.fonts.add(await face.load())
    } catch {
      // The font stack falls back to Arial Black / Arial.
    }
  }))
}

/** Fonts and wordmark artwork, loaded once and shared by every render. */
export function loadPostAssets() {
  if (!assetsPromise) {
    assetsPromise = (async () => {
      const names = Object.keys(BRAND_LOGOS.wordmark.layers)
      const [, ...images] = await Promise.all([
        loadFonts(),
        ...names.map(name => loadImage(`/brand/logo/wordmark-${name}.webp`)),
      ])
      const wordmark = new Map<string, HTMLImageElement>()
      names.forEach((name, index) => {
        const image = images[index]
        if (image) wordmark.set(name, image)
      })
      return { wordmark }
    })()
  }
  return assetsPromise
}

// ── Accent tint ─────────────────────────────────────────────────────────────

/** Dominant hue of the logo artwork. */
const LOGO_HUE = 268

function hueOf(hex: string) {
  const [r, g, b] = [1, 3, 5].map(offset => parseInt(hex.slice(offset, offset + 2), 16) / 255) as [number, number, number]
  const max = Math.max(r, g, b)
  const delta = max - Math.min(r, g, b)
  if (!delta) return LOGO_HUE
  const hue = max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4
  return (hue * 60 + 360) % 360
}

/** Degrees to rotate the violet artwork towards the accent; 0 leaves it untouched. */
export function logoHueShift(colors: AccentColors) {
  const shift = ((hueOf(colors.accent) - LOGO_HUE + 540) % 360) - 180
  return Math.abs(shift) < 12 ? 0 : Math.round(shift)
}

/** Safari has no canvas `filter`, so the CSS hue-rotate / grayscale maths runs on the pixels. */
function tintPixels(canvas: HTMLCanvasElement, colors: AccentColors) {
  const mono = colors === MOTION_ACCENTS.mono
  const shift = mono ? 0 : logoHueShift(colors)
  if (!mono && !shift) return
  const context = canvas.getContext('2d')
  if (!context || !canvas.width || !canvas.height) return
  const image = context.getImageData(0, 0, canvas.width, canvas.height)
  const data = image.data
  if (mono) {
    for (let i = 0; i < data.length; i += 4) {
      const lum = Math.min(255, (0.2126 * data[i]! + 0.7152 * data[i + 1]! + 0.0722 * data[i + 2]!) * 1.15)
      data[i] = data[i + 1] = data[i + 2] = lum
    }
  } else {
    const angle = shift * Math.PI / 180
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    const m = [
      0.213 + cos * 0.787 - sin * 0.213, 0.715 - cos * 0.715 - sin * 0.715, 0.072 - cos * 0.072 + sin * 0.928,
      0.213 - cos * 0.213 + sin * 0.143, 0.715 + cos * 0.285 + sin * 0.140, 0.072 - cos * 0.072 - sin * 0.283,
      0.213 - cos * 0.213 - sin * 0.787, 0.715 - cos * 0.715 + sin * 0.715, 0.072 + cos * 0.928 + sin * 0.072,
    ] as const
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i]!
      const g = data[i + 1]!
      const b = data[i + 2]!
      data[i] = Math.max(0, Math.min(255, m[0] * r + m[1] * g + m[2] * b))
      data[i + 1] = Math.max(0, Math.min(255, m[3] * r + m[4] * g + m[5] * b))
      data[i + 2] = Math.max(0, Math.min(255, m[6] * r + m[7] * g + m[8] * b))
    }
  }
  context.putImageData(image, 0, 0)
}

const wordmarkCache = new Map<string, HTMLCanvasElement>()

/**
 * The wordmark (or some of its layers) at `width` px, tinted to the accent.
 * Cached per accent, size and layer set, since a render redraws the same art.
 */
function wordmarkArt(assets: PostAssets, colors: AccentColors, width: number, layers: readonly string[] | null) {
  const spec = BRAND_LOGOS.wordmark
  const px = Math.max(1, Math.round(width))
  const key = `${colors.accent}|${px}|${layers ? layers.join(',') : 'all'}`
  const cached = wordmarkCache.get(key)
  if (cached) return cached
  const scale = px / spec.width
  const canvas = document.createElement('canvas')
  canvas.width = px
  canvas.height = Math.max(1, Math.round(spec.height * scale))
  const context = canvas.getContext('2d')
  if (context) {
    for (const [name, [x, y, w, h]] of Object.entries(spec.layers)) {
      if (layers && !layers.includes(name)) continue
      const image = assets.wordmark.get(name)
      if (image) context.drawImage(image, x * scale, y * scale, w * scale, h * scale)
    }
    tintPixels(canvas, colors)
  }
  if (wordmarkCache.size > 24) wordmarkCache.clear()
  wordmarkCache.set(key, canvas)
  return canvas
}

// ── Scene ───────────────────────────────────────────────────────────────────

/** What every block needs to draw itself. */
export type Scene = {
  context: CanvasRenderingContext2D
  assets: PostAssets
  colors: AccentColors
  /** Canvas width in px. */
  width: number
  /** Canvas px per design px (width / 1080), times the template's fit factor. */
  u: number
  /** Horizontal centre of the content. */
  cx: number
}

/** A piece of the layout: it knows its height and draws itself at a given top. */
export type Block = { height: number, draw: (top: number) => void }

function setFont(context: CanvasRenderingContext2D, weight: number, size: number, family: string, italic = false) {
  context.font = `${italic ? 'italic ' : ''}${weight} ${size}px ${family}`
}

function setTracking(context: CanvasRenderingContext2D, px: number) {
  ;(context as unknown as { letterSpacing: string }).letterSpacing = `${px}px`
}

/** Shrinks `size` until `text` fits `maxWidth` at the font set by `font(size)`. */
function fitSize(context: CanvasRenderingContext2D, text: string, size: number, maxWidth: number, font: (size: number) => void) {
  font(size)
  const width = context.measureText(text).width
  return width > maxWidth && width > 0 ? Math.max(8, size * maxWidth / width) : size
}

/** Logo-style type fill: white at the top fading into the accent. `deep` starts in the accent. */
function typeGradient(context: CanvasRenderingContext2D, colors: AccentColors, top: number, height: number, deep = false) {
  const gradient = context.createLinearGradient(0, top, 0, top + height)
  if (deep) {
    gradient.addColorStop(0, colors.soft)
    gradient.addColorStop(0.55, colors.accent)
    gradient.addColorStop(1, colors.glow)
  } else {
    gradient.addColorStop(0, '#ffffff')
    gradient.addColorStop(0.42, colors.soft)
    gradient.addColorStop(1, colors.accent)
  }
  return gradient
}

/** Draws `text` as gradient hero type in the logo's skewed italic, centred on (x, y). */
export function drawGradientText(scene: Scene, text: string, x: number, y: number, size: number, maxWidth: number, options: { deep?: boolean, align?: CanvasTextAlign, rotate?: number } = {}) {
  const { context, colors } = scene
  const fitted = fitSize(context, text, size, maxWidth, s => setFont(context, 900, s, DISPLAY_FONT, true))
  context.save()
  context.translate(x, y)
  if (options.rotate) context.rotate(options.rotate)
  context.transform(1, 0, SKEW, 1, 0, 0)
  setFont(context, 900, fitted, DISPLAY_FONT, true)
  context.textAlign = options.align ?? 'center'
  context.textBaseline = 'middle'
  context.shadowColor = colors.glow
  context.shadowBlur = Math.max(10, fitted * 0.18)
  context.shadowOffsetY = 0
  context.fillStyle = typeGradient(context, colors, -fitted * 0.5, fitted, options.deep)
  context.fillText(text, 0, 0, maxWidth)
  context.restore()
}

/** Soft dark halo so white text stays readable on a busy photo. */
function darkShadow(context: CanvasRenderingContext2D, blur: number) {
  context.shadowColor = 'rgba(0,0,0,.72)'
  context.shadowBlur = blur
  context.shadowOffsetY = blur * 0.3
}

function glowShadow(context: CanvasRenderingContext2D, colors: AccentColors, blur: number) {
  context.shadowColor = `${colors.glow}cc`
  context.shadowBlur = blur
  context.shadowOffsetY = 0
}

// ── Backdrop ────────────────────────────────────────────────────────────────

/** Darkens the photo (strength is the editor's overlay setting) and warms it with the accent. */
export function drawBackdrop(context: CanvasRenderingContext2D, colors: AccentColors, width: number, height: number, opacity: number) {
  const strength = Math.max(0.42, Math.min(0.9, opacity) * 0.82)
  const shade = context.createLinearGradient(0, 0, 0, height)
  shade.addColorStop(0, 'rgba(3,2,5,.34)')
  shade.addColorStop(0.5, 'rgba(7,3,12,.46)')
  shade.addColorStop(1, 'rgba(2,1,4,.86)')
  context.save()
  context.globalAlpha = strength
  context.fillStyle = shade
  context.fillRect(0, 0, width, height)
  const glow = context.createRadialGradient(width / 2, height * 0.45, 0, width / 2, height * 0.45, Math.max(width, height) * 0.7)
  glow.addColorStop(0, `${colors.glow}55`)
  glow.addColorStop(1, `${colors.glow}00`)
  context.globalAlpha = 1
  context.fillStyle = glow
  context.fillRect(0, 0, width, height)
  context.restore()
}

// ── Blocks ──────────────────────────────────────────────────────────────────

/** The wordmark once, small, with an optional presenter line under it. */
export function logoBlock(scene: Scene, widthPx: number, presents?: string): Block {
  const { context, colors, assets, u, cx } = scene
  const art = wordmarkArt(assets, colors, widthPx, null)
  const kicker = presents ? TYPE.support * u * 0.9 : 0
  const gap = presents ? 12 * u : 0
  return {
    height: art.height + gap + kicker * 1.2,
    draw: (top) => {
      context.save()
      context.shadowColor = `${colors.glow}aa`
      context.shadowBlur = 18 * u
      context.drawImage(art, cx - art.width / 2, top)
      context.restore()
      if (presents) drawKicker(scene, presents, cx, top + art.height + gap, { size: kicker })
    },
  }
}

/** Level 3: small, letter-spaced support text in the soft accent. */
export function drawKicker(scene: Scene, text: string, x: number, top: number, options: { size?: number, align?: CanvasTextAlign, maxWidth?: number, rotate?: number } = {}) {
  const { context, colors, u } = scene
  const size = options.size ?? TYPE.support * u
  context.save()
  context.translate(x, top)
  if (options.rotate) context.rotate(options.rotate)
  setFont(context, 800, size, BODY_FONT)
  setTracking(context, size * 0.36)
  context.textAlign = options.align ?? 'center'
  context.textBaseline = 'top'
  glowShadow(context, colors, size * 0.55)
  context.fillStyle = colors.soft
  context.fillText(text.toUpperCase(), 0, 0, options.maxWidth)
  context.restore()
}

/** Wraps `text` into at most `maxLines` lines that fit `maxWidth` at the current font. */
export function wrapText(context: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number) {
  const words = text.trim().split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ''
  let index = 0
  for (; index < words.length; index++) {
    const word = words[index]!
    const candidate = line ? `${line} ${word}` : word
    if (!line || context.measureText(candidate).width <= maxWidth) {
      line = candidate
      continue
    }
    if (lines.length >= maxLines - 1) break
    lines.push(line)
    line = word
  }
  if (line) {
    if (index < words.length) line = `${line} ${words.slice(index).join(' ')}`
    lines.push(line)
  }
  if (lines.length === maxLines && index < words.length) {
    let last = lines[maxLines - 1]!
    while (last.length > 1 && context.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1)
    lines[maxLines - 1] = `${last.trimEnd()}…`
  }
  return lines
}

/** Level 2 lead-in: white italic display type that leans with the logo. */
export function leadInBlock(scene: Scene, text: string, maxWidth: number): Block {
  const { context, colors, u, cx } = scene
  const size = TYPE.lead * u
  return {
    height: size * 1.1,
    draw: (top) => {
      const fitted = fitSize(context, text.toUpperCase(), size, maxWidth, s => setFont(context, 900, s, DISPLAY_FONT, true))
      context.save()
      context.translate(cx, top + size * 0.55)
      context.rotate(TILT)
      context.transform(1, 0, SKEW, 1, 0, 0)
      setFont(context, 900, fitted, DISPLAY_FONT, true)
      setTracking(context, 2 * u)
      context.textAlign = 'center'
      context.textBaseline = 'middle'
      glowShadow(context, colors, 26 * u)
      context.fillStyle = '#ffffff'
      context.fillText(text.toUpperCase(), 0, 0, maxWidth)
      context.restore()
    },
  }
}

/** A single line of support text as a block. */
export function kickerBlock(scene: Scene, text: string, maxWidth: number, size = TYPE.support * scene.u): Block {
  return {
    height: size * 1.3,
    draw: top => drawKicker(scene, text, scene.cx, top, { size, maxWidth }),
  }
}

/**
 * Level 1 hero for headlines: gradient type wrapped over up to `maxLines`
 * lines, alternating white-to-accent and accent-first like the logo, leaning
 * with the wordmark.
 */
export function heroLinesBlock(scene: Scene, text: string, maxWidth: number, maxLines: number, baseSize: number): Block {
  const { context, cx } = scene
  const upper = text.toUpperCase()
  // Shrink until the lines fit; a single long word is fitted by the draw itself.
  let size = baseSize
  let lines: string[] = []
  for (let attempt = 0; attempt < 12; attempt++) {
    setFont(context, 900, size, DISPLAY_FONT, true)
    lines = wrapText(context, upper, maxWidth, maxLines)
    const fits = lines.every(line => context.measureText(line).width <= maxWidth) && lines.join(' ').length >= upper.length - 1
    if (fits) break
    size *= 0.9
  }
  const lineHeight = size * 0.92
  return {
    height: Math.max(lineHeight, lines.length * lineHeight),
    draw: (top) => {
      const centreY = top + (lines.length * lineHeight) / 2
      context.save()
      context.translate(cx, centreY)
      context.rotate(TILT)
      lines.forEach((line, index) => {
        const y = (index - (lines.length - 1) / 2) * lineHeight
        drawGradientText(scene, line, 0, y, size, maxWidth, { deep: index % 2 === 1 })
      })
      context.restore()
    },
  }
}

/** Layer set of the wordmark's neon rules: both rules plus the electric arcs. */
const RULE_LAYERS = ['rule-top', 'rule-bottom', 'arcs'] as const
/** Vertical span of the wordmark's rules, and the letter band between them. */
const WORDMARK_RULES = { top: 95, bottom: 605 }
const WORDMARK_BAND = { x: 930, y: 348, width: 1260, height: 216 }

/**
 * Level 1 hero: `text` as gradient type in the band between the logo's own
 * neon rules. Falls back to bare type when the rule artwork did not load.
 */
export function heroFrameBlock(scene: Scene, text: string, frameWidth: number): Block {
  const { context, colors, assets, u, cx } = scene
  const spec = BRAND_LOGOS.wordmark
  const scale = frameWidth / spec.width
  const height = (WORDMARK_RULES.bottom - WORDMARK_RULES.top) * scale
  const band = { width: WORDMARK_BAND.width * scale, height: WORDMARK_BAND.height * scale }
  return {
    height,
    draw: (top) => {
      const art = wordmarkArt(assets, colors, frameWidth, RULE_LAYERS)
      const left = cx - frameWidth / 2
      context.save()
      context.shadowColor = `${colors.glow}99`
      context.shadowBlur = 16 * u
      context.drawImage(art, left, top - WORDMARK_RULES.top * scale)
      context.restore()
      const centre = { x: left + WORDMARK_BAND.x * scale, y: top + (WORDMARK_BAND.y - WORDMARK_RULES.top) * scale }
      const size = band.height * 0.86
      drawGradientText(scene, text.toUpperCase(), centre.x, centre.y, size, band.width * 0.98, { rotate: TILT })
    },
  }
}

/** The wordmark's bottom neon rule on its own, under a hero. */
export function neonRuleBlock(scene: Scene, width: number): Block {
  const { context, colors, assets, u, cx } = scene
  const spec = BRAND_LOGOS.wordmark
  const [x, y, w, h] = spec.layers['rule-bottom']
  const scale = width / w
  const art = wordmarkArt(assets, colors, spec.width * scale, ['rule-bottom'])
  return {
    height: h * scale,
    draw: (top) => {
      context.save()
      context.shadowColor = `${colors.glow}99`
      context.shadowBlur = 14 * u
      context.drawImage(art, cx - width / 2 - x * scale, top - y * scale)
      context.restore()
    },
  }
}

export type InfoIcon = 'clock' | 'pin' | 'calendar'
export type InfoRow = { icon?: InfoIcon, text: string, detail?: string }

/** Small line icons in the Lucide style, drawn centred on (0, 0) in a `size` box. */
function drawIcon(context: CanvasRenderingContext2D, icon: InfoIcon, size: number) {
  const r = size / 2
  context.beginPath()
  if (icon === 'clock') {
    context.arc(0, 0, r * 0.92, 0, Math.PI * 2)
    context.moveTo(0, -r * 0.5)
    context.lineTo(0, 0)
    context.lineTo(r * 0.38, r * 0.24)
  } else if (icon === 'pin') {
    context.moveTo(0, r * 0.95)
    context.bezierCurveTo(-r * 0.95, r * 0.1, -r * 0.8, -r * 0.95, 0, -r * 0.95)
    context.bezierCurveTo(r * 0.8, -r * 0.95, r * 0.95, r * 0.1, 0, r * 0.95)
    context.moveTo(r * 0.3, -r * 0.25)
    context.arc(0, -r * 0.25, r * 0.3, 0, Math.PI * 2)
  } else {
    context.rect(-r * 0.85, -r * 0.7, r * 1.7, r * 1.6)
    context.moveTo(-r * 0.85, -r * 0.2)
    context.lineTo(r * 0.85, -r * 0.2)
    context.moveTo(-r * 0.45, -r * 0.95)
    context.lineTo(-r * 0.45, -r * 0.45)
    context.moveTo(r * 0.45, -r * 0.95)
    context.lineTo(r * 0.45, -r * 0.45)
  }
  context.stroke()
}

/** Traces a parallelogram leaning like the logo, centred on (0, 0). */
function skewedBox(context: CanvasRenderingContext2D, width: number, height: number, skew: number) {
  const lean = Math.tan(-skew) * height / 2
  context.beginPath()
  context.moveTo(-width / 2 + lean, -height / 2)
  context.lineTo(width / 2 + lean, -height / 2)
  context.lineTo(width / 2 - lean, height / 2)
  context.lineTo(-width / 2 - lean, height / 2)
  context.closePath()
}

/** Level 2 facts (time, place, ...) as icon + white text rows in a dark neon panel. */
export function infoBlock(scene: Scene, rows: InfoRow[], maxWidth: number): Block {
  const { context, colors, u, cx } = scene
  const factSize = TYPE.fact * u
  const detailSize = TYPE.support * u * 0.85
  const iconColumn = rows.some(row => row.icon) ? factSize * 1.25 : 0
  const padX = 48 * u
  const padY = 26 * u
  const rowGap = 20 * u
  const rowHeights = rows.map(row => factSize * 1.1 + (row.detail ? detailSize * 1.5 : 0))
  const height = padY * 2 + rowHeights.reduce((sum, h) => sum + h, 0) + rowGap * Math.max(0, rows.length - 1)
  const skew = -12 * Math.PI / 180
  const lean = Math.tan(-skew) * height / 2

  setFont(context, 900, factSize, DISPLAY_FONT)
  const widest = Math.max(0, ...rows.map(row => context.measureText(row.text.toUpperCase()).width))
  const inner = Math.min(maxWidth - padX * 2 - lean * 2, Math.max(widest + iconColumn, 520 * u - padX * 2))
  const width = inner + padX * 2

  return {
    height,
    draw: (top) => {
      context.save()
      context.translate(cx, top + height / 2)
      context.save()
      skewedBox(context, width, height, skew)
      context.fillStyle = 'rgba(6,4,10,.84)'
      context.shadowColor = `${colors.glow}88`
      context.shadowBlur = 34 * u
      context.fill()
      context.shadowBlur = 0
      context.lineWidth = Math.max(2, 2 * u)
      context.strokeStyle = `${colors.accent}aa`
      context.stroke()
      context.restore()

      let y = -height / 2 + padY
      rows.forEach((row, index) => {
        const rowHeight = rowHeights[index]!
        const left = -inner / 2
        if (row.icon) {
          context.save()
          context.translate(left + iconColumn / 2 - factSize * 0.1, y + factSize * 0.55)
          context.strokeStyle = colors.soft
          context.lineWidth = Math.max(2, factSize * 0.07)
          context.lineCap = 'round'
          context.lineJoin = 'round'
          context.shadowColor = colors.glow
          context.shadowBlur = 10 * u
          drawIcon(context, row.icon, factSize * 0.9)
          context.restore()
        }
        context.save()
        setFont(context, 900, factSize, DISPLAY_FONT)
        context.textAlign = 'left'
        context.textBaseline = 'top'
        darkShadow(context, 14 * u)
        context.fillStyle = '#ffffff'
        context.fillText(row.text.toUpperCase(), left + iconColumn, y, inner - iconColumn)
        context.restore()
        if (row.detail) {
          // Drawn inside the panel's translation, so in the panel's own coordinates.
          drawKicker(scene, row.detail, left + iconColumn, y + factSize * 1.15, { size: detailSize, align: 'left', maxWidth: inner - iconColumn })
        }
        y += rowHeight + rowGap
      })
      context.restore()
    },
  }
}

/** The one action: a skewed accent pill, bottom of the stack. */
export function ctaBlock(scene: Scene, text: string, maxWidth: number, align: CanvasTextAlign = 'center'): Block {
  const { context, colors, u, cx } = scene
  const size = TYPE.cta * u
  const label = text.toUpperCase().replace(/\s*(?:->|[→>])$/, '')
  setFont(context, 900, size, DISPLAY_FONT, true)
  setTracking(context, 2 * u)
  const textWidth = Math.min(context.measureText(label).width, maxWidth - 130 * u)
  setTracking(context, 0)
  const width = textWidth + 104 * u
  const height = size * 1.0 + 36 * u
  return {
    height: height + 14 * u,
    draw: (top) => {
      const centre = align === 'left' ? cx - maxWidth / 2 + width / 2 : align === 'right' ? cx + maxWidth / 2 - width / 2 : cx
      context.save()
      context.translate(centre, top + height / 2 + 7 * u)
      context.rotate(-3 * Math.PI / 180)
      const fill = context.createLinearGradient(-width / 2, 0, width / 2, 0)
      fill.addColorStop(0, colors.glow)
      fill.addColorStop(1, colors.accent)
      skewedBox(context, width, height, -12 * Math.PI / 180)
      context.shadowColor = `${colors.glow}aa`
      context.shadowBlur = 30 * u
      context.fillStyle = fill
      context.fill()
      context.shadowBlur = 0
      context.transform(1, 0, SKEW, 1, 0, 0)
      setFont(context, 900, size, DISPLAY_FONT, true)
      setTracking(context, 2 * u)
      context.textAlign = 'center'
      context.textBaseline = 'middle'
      context.shadowColor = 'rgba(0,0,0,.35)'
      context.shadowBlur = 12 * u
      context.fillStyle = '#ffffff'
      context.fillText(label, 0, size * 0.04, textWidth)
      context.restore()
    },
  }
}

/** Neon-tube edge for a box: bright soft border with an accent ring and a wide glow. */
export function drawElectricEdge(scene: Scene, x: number, y: number, width: number, height: number) {
  const { context, colors, u } = scene
  context.save()
  context.fillStyle = 'rgba(6,4,10,.84)'
  context.shadowColor = `${colors.glow}99`
  context.shadowBlur = 70 * u
  context.fillRect(x, y, width, height)
  context.shadowBlur = 24 * u
  context.lineWidth = 3 * u
  context.strokeStyle = colors.soft
  context.strokeRect(x, y, width, height)
  context.shadowBlur = 0
  context.lineWidth = 2 * u
  context.strokeStyle = colors.accent
  context.strokeRect(x - 4 * u, y - 4 * u, width + 8 * u, height + 8 * u)
  context.restore()
}

/** Stacks `blocks` with `gap` between them; returns the total height. */
export function stackHeight(blocks: Block[], gap: number) {
  return blocks.reduce((sum, block) => sum + block.height, 0) + gap * Math.max(0, blocks.length - 1)
}

/** Draws `blocks` from `top` downwards with `gap` between them. */
export function drawStack(blocks: Block[], top: number, gap: number) {
  let y = top
  for (const block of blocks) {
    block.draw(y)
    y += block.height + gap
  }
  return y - gap
}
