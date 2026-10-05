import {
  coverImageRect,
  DEFAULT_POST_BRAND,
  postPresetSize,
  safeAreaInsets,
  type PostDesign,
  type PostFieldVisibility,
} from '~~/shared/post-generator'
import { MOTION_ACCENTS } from '~~/shared/video-templates'
import {
  BODY_FONT,
  DISPLAY_FONT,
  TYPE,
  ctaBlock,
  drawBackdrop,
  drawElectricEdge,
  drawGradientText,
  drawKicker,
  drawStack,
  heroFrameBlock,
  heroLinesBlock,
  infoBlock,
  kickerBlock,
  leadInBlock,
  loadPostAssets,
  logoBlock,
  neonRuleBlock,
  stackHeight,
  wrapText,
  type AccentColors,
  type Block,
  type InfoRow,
  type PostAssets,
  type Scene,
} from './post-lightning'

// Photo templates share one look with the video templates (see post-lightning.ts):
// the lightning wordmark, gradient hero type, white facts in a neon panel,
// kicker support text and a single CTA pill. Colours are the video accents.

function isVisible(design: PostDesign, field: keyof PostFieldVisibility) {
  return design.visibility[field]
}

function filled(design: PostDesign, field: keyof PostFieldVisibility, value: string) {
  return isVisible(design, field) && value.trim() ? value.trim() : ''
}

/** Whether the logo text is the brand name, so the real wordmark artwork stands in for it. */
function usesWordmark(design: PostDesign) {
  return design.logoText.trim().toUpperCase() === 'NIGHTLIGHT' || !design.logoText.trim()
}

function sceneFor(context: CanvasRenderingContext2D, assets: PostAssets, colors: AccentColors, width: number, scale: number, cx: number): Scene {
  return { context, assets, colors, width, u: (width / 1080) * scale, cx }
}

// ── Campaign templates ──────────────────────────────────────────────────────

type CampaignLayout = {
  /** The logo, pinned to the top of the safe area. */
  header: Block | null
  /** Everything else, grouped and centred in the space below the header. */
  body: Block[]
}

/**
 * Lays a campaign template out. `build` is called with a scene scaled by `scale`;
 * the scale is lowered until the stack fits the safe area, so a square post
 * gets the same composition as a story, only tighter.
 */
function drawCampaign(
  context: CanvasRenderingContext2D,
  design: PostDesign,
  width: number,
  height: number,
  colors: AccentColors,
  assets: PostAssets,
  build: (scene: Scene, contentWidth: number) => CampaignLayout,
) {
  const safe = safeAreaInsets(design.preset)
  const contentWidth = width - safe.left - safe.right
  const usable = height - safe.top - safe.bottom
  const cx = width / 2

  const measure = (scale: number) => {
    const scene = sceneFor(context, assets, colors, width, scale, cx)
    const layout = build(scene, contentWidth)
    const gap = 36 * scene.u
    const blocks = layout.header ? [layout.header, ...layout.body] : layout.body
    return { scene, layout, gap, total: stackHeight(blocks, gap) }
  }

  let attempt = measure(1)
  for (let pass = 0; pass < 2 && attempt.total > usable; pass++) {
    attempt = measure(Math.max(0.4, attempt.scene.u / (width / 1080) * usable / attempt.total))
  }

  const { layout, gap } = attempt
  let top = safe.top
  if (layout.header) {
    layout.header.draw(top)
    top += layout.header.height + gap
  }
  const bodyHeight = stackHeight(layout.body, gap)
  const space = height - safe.bottom - top
  drawStack(layout.body, top + Math.max(0, (space - bodyHeight) / 2), gap)
}

function headerBlock(scene: Scene, design: PostDesign, widthPx: number, presents?: string): Block | null {
  if (!isVisible(design, 'logo')) return null
  if (usesWordmark(design)) return logoBlock(scene, widthPx, presents)
  // A custom logo text is set as gradient type instead of the wordmark.
  const size = TYPE.lead * scene.u
  return {
    height: size * 1.2,
    draw: top => drawGradientText(scene, design.logoText.trim().toUpperCase(), scene.cx, top + size * 0.6, size, widthPx),
  }
}

/** Date is the hero; the headline leads in above it; time and place are facts. */
function drawGigAnnouncement(context: CanvasRenderingContext2D, design: PostDesign, width: number, height: number, colors: AccentColors, assets: PostAssets) {
  drawCampaign(context, design, width, height, colors, assets, (scene, contentWidth) => {
    const headline = filled(design, 'headline', design.headline)
    const date = filled(design, 'date', design.dateText)
    const subline = filled(design, 'subline', design.subline)
    const rows: InfoRow[] = [
      { icon: 'clock' as const, text: filled(design, 'time', design.timeText) },
      { icon: 'pin' as const, text: filled(design, 'location', design.locationText) },
    ].filter(row => row.text)
    const cta = filled(design, 'cta', design.ctaText)
    // Without a date the headline takes the hero's place.
    const hero = date || headline
    const body: Block[] = [
      date && headline ? leadInBlock(scene, headline, contentWidth) : null,
      hero ? heroFrameBlock(scene, hero, Math.min(contentWidth, 1040 * scene.u)) : null,
      subline ? kickerBlock(scene, subline, contentWidth) : null,
      rows.length ? infoBlock(scene, rows, contentWidth) : null,
      cta ? ctaBlock(scene, cta, contentWidth) : null,
    ].filter((block): block is Block => Boolean(block))
    return { header: headerBlock(scene, design, 480 * scene.u, 'PRESENTEERT'), body }
  })
}

/** The headline is the hero; the subline sets the scene above it; date and place are facts. */
function drawRecap(context: CanvasRenderingContext2D, design: PostDesign, width: number, height: number, colors: AccentColors, assets: PostAssets) {
  drawCampaign(context, design, width, height, colors, assets, (scene, contentWidth) => {
    const headline = filled(design, 'headline', design.headline)
    const subline = filled(design, 'subline', design.subline)
    const rows: InfoRow[] = [
      { icon: 'calendar' as const, text: filled(design, 'date', design.dateText) },
      { icon: 'pin' as const, text: filled(design, 'location', design.locationText) },
    ].filter(row => row.text)
    const cta = filled(design, 'cta', design.ctaText)
    const body: Block[] = [
      subline ? kickerBlock(scene, subline, contentWidth) : null,
      headline ? heroLinesBlock(scene, headline, contentWidth, 3, 170 * scene.u) : null,
      headline ? neonRuleBlock(scene, Math.min(contentWidth * 0.62, 620 * scene.u)) : null,
      rows.length ? infoBlock(scene, rows, contentWidth) : null,
      cta ? ctaBlock(scene, cta, contentWidth) : null,
    ].filter((block): block is Block => Boolean(block))
    return { header: headerBlock(scene, design, 420 * scene.u), body }
  })
}

/** The quote is the hero; the stars and the source are support. */
function drawReview(context: CanvasRenderingContext2D, design: PostDesign, width: number, height: number, colors: AccentColors, assets: PostAssets) {
  drawCampaign(context, design, width, height, colors, assets, (scene, contentWidth) => {
    const stars = filled(design, 'headline', design.headline)
    const quote = filled(design, 'subline', design.subline)
    const source = filled(design, 'location', design.locationText)
    const quoteWidth = contentWidth * 0.9
    const body: Block[] = [
      stars ? kickerBlock(scene, stars, contentWidth, 46 * scene.u) : null,
      stars || quote ? neonRuleBlock(scene, Math.min(contentWidth * 0.5, 460 * scene.u)) : null,
      quote ? quoteBlock(scene, quote, quoteWidth) : null,
      source ? kickerBlock(scene, source, contentWidth) : null,
    ].filter((block): block is Block => Boolean(block))
    return { header: headerBlock(scene, design, 420 * scene.u), body }
  })
}

/** Review quote: big white bold type, in curly quotes, wrapped over up to seven lines. */
function quoteBlock(scene: Scene, text: string, maxWidth: number): Block {
  const { context, u, cx } = scene
  // The sample copy already carries curly quotes; wrap exactly once either way.
  const quoted = `“${text.replace(/^[“”"„‟]+|[“”"„‟]+$/g, '').trim()}”`
  let size = 66 * u
  let lines: string[] = []
  for (let attempt = 0; attempt < 10; attempt++) {
    context.font = `800 ${size}px ${BODY_FONT}`
    lines = wrapText(context, quoted, maxWidth, 7)
    if (lines.length <= 5 || size < 40 * u) break
    size *= 0.92
  }
  const lineHeight = size * 1.16
  return {
    height: lines.length * lineHeight,
    draw: (top) => {
      context.save()
      context.font = `800 ${size}px ${BODY_FONT}`
      context.textAlign = 'center'
      context.textBaseline = 'top'
      context.shadowColor = 'rgba(0,0,0,.78)'
      context.shadowBlur = 30 * u
      context.shadowOffsetY = 10 * u
      context.fillStyle = '#ffffff'
      lines.forEach((line, index) => context.fillText(line, cx, top + index * lineHeight, maxWidth))
      context.restore()
    },
  }
}

/** The headline is the hero; each gig is a date, a title and a place. */
function drawUpcomingGigs(context: CanvasRenderingContext2D, design: PostDesign, width: number, height: number, colors: AccentColors, assets: PostAssets) {
  drawCampaign(context, design, width, height, colors, assets, (scene, contentWidth) => {
    const headline = filled(design, 'headline', design.headline)
    const subline = filled(design, 'subline', design.subline)
    const cta = filled(design, 'cta', design.ctaText)
    const items = isVisible(design, 'gigList') ? design.gigItems.filter(item => item.enabled).slice(0, 6) : []
    const body: Block[] = [
      headline ? heroFrameBlock(scene, headline, Math.min(contentWidth, 940 * scene.u)) : null,
      subline ? kickerBlock(scene, subline, contentWidth) : null,
      items.length ? gigListBlock(scene, items, contentWidth) : null,
      cta ? ctaBlock(scene, cta, contentWidth) : null,
    ].filter((block): block is Block => Boolean(block))
    // The list needs the height, so only story posts also carry the logo.
    const header = design.preset === 'story' ? headerBlock(scene, design, 420 * scene.u) : null
    return { header, body }
  })
}

/** Gig rows in a neon-edged card: date in gradient type, title in white, place as support. */
function gigListBlock(scene: Scene, items: PostDesign['gigItems'], maxWidth: number): Block {
  const { context, colors, u, cx } = scene
  const rowHeight = 150 * u
  const padX = 40 * u
  const padY = 10 * u
  const width = Math.min(maxWidth, 900 * u)
  const height = items.length * rowHeight + padY * 2
  const dateColumn = 250 * u
  return {
    height,
    draw: (top) => {
      const left = cx - width / 2
      drawElectricEdge(scene, left, top, width, height)
      items.forEach((item, index) => {
        const y = top + padY + index * rowHeight
        if (index) {
          context.save()
          context.fillStyle = `${colors.accent}40`
          context.fillRect(left + padX, y, width - padX * 2, Math.max(1, u))
          context.restore()
        }
        const [day = '', ...rest] = item.dateText.trim().split(/\s+/)
        drawGradientText(scene, [day, ...rest].join(' ').toUpperCase(), left + padX, y + rowHeight / 2, 46 * u, dateColumn - padX, { align: 'left' })
        const textX = left + padX + dateColumn
        const textWidth = width - padX * 2 - dateColumn
        context.save()
        context.font = `900 ${TYPE.fact * 0.95 * u}px ${BODY_FONT}`
        context.textAlign = 'left'
        context.textBaseline = 'middle'
        context.shadowColor = 'rgba(0,0,0,.6)'
        context.shadowBlur = 12 * u
        context.fillStyle = '#ffffff'
        context.fillText(item.title, textX, y + rowHeight * (item.locationText ? 0.38 : 0.5), textWidth)
        context.restore()
        if (item.locationText) {
          drawKicker(scene, item.locationText, textX, y + rowHeight * 0.58, { size: TYPE.support * 0.85 * u, align: 'left', maxWidth: textWidth })
        }
      })
    },
  }
}

// ── Flexible templates (gradient, poster, minimal) ──────────────────────────

function drawTemplateOverlay(context: CanvasRenderingContext2D, design: PostDesign, width: number, height: number, colors: AccentColors) {
  const opacity = Math.max(0, Math.min(.9, design.overlayOpacity))

  if (design.templateKey === 'gradient') {
    const gradient = context.createLinearGradient(0, 0, 0, height)
    gradient.addColorStop(0, 'rgba(0,0,0,.08)')
    gradient.addColorStop(.42, 'rgba(0,0,0,.05)')
    gradient.addColorStop(1, '#09070d')
    context.globalAlpha = opacity
    context.fillStyle = gradient
    context.fillRect(0, 0, width, height)
    context.globalAlpha = 1
    return
  }

  if (design.templateKey === 'poster') {
    context.globalAlpha = Math.max(.25, opacity * .78)
    context.fillStyle = '#09070d'
    context.fillRect(0, 0, width, height)
    context.globalAlpha = 1
    const inset = Math.round(width * .035)
    context.save()
    context.strokeStyle = colors.soft
    context.lineWidth = Math.max(4, Math.round(width * .004))
    context.shadowColor = colors.glow
    context.shadowBlur = Math.round(width * .03)
    context.strokeRect(inset, inset, width - inset * 2, height - inset * 2)
    context.shadowBlur = Math.round(width * .012)
    context.strokeStyle = colors.accent
    context.lineWidth = Math.max(2, Math.round(width * .002))
    context.strokeRect(inset - width * .007, inset - width * .007, width - inset * 2 + width * .014, height - inset * 2 + width * .014)
    context.restore()
    return
  }

  if (design.templateKey === 'minimal') {
    const panelWidth = design.textAlign === 'center' ? width : Math.round(width * .76)
    const panelX = design.textAlign === 'right' ? width - panelWidth : 0
    context.globalAlpha = Math.max(.38, opacity)
    context.fillStyle = 'rgba(8,5,14,.86)'
    context.fillRect(panelX, 0, panelWidth, height)
    context.globalAlpha = 1
    context.save()
    context.fillStyle = colors.accent
    context.shadowColor = colors.glow
    context.shadowBlur = Math.round(width * .02)
    if (design.textAlign === 'right') context.fillRect(width - 12, 0, 12, height)
    else context.fillRect(0, 0, 12, height)
    context.restore()
  }
}

/** Corner logo of the flexible templates: the wordmark, or the custom logo text as gradient type. */
function drawBrand(scene: Scene, design: PostDesign, width: number) {
  if (!isVisible(design, 'logo')) return
  const safe = safeAreaInsets(design.preset)
  const brand = headerBlock({ ...scene, cx: safe.left + width * .14 }, design, width * .28)
  if (!brand) return
  if (usesWordmark(design)) brand.draw(safe.top - width * .02)
  else {
    const size = width * .04
    drawGradientText(scene, design.logoText.trim().toUpperCase(), safe.left, safe.top + size * .6, size, width - safe.left - safe.right, { align: 'left' })
  }
}

/** Headline (hero), subline (support), facts (white) and CTA for the flexible templates. */
function drawGenericTextBlock(scene: Scene, design: PostDesign, width: number, height: number) {
  const { context, colors } = scene
  const safe = safeAreaInsets(design.preset)
  const left = safe.left
  const right = width - safe.right
  const maxWidth = right - left
  const align = design.textAlign as CanvasTextAlign
  const x = align === 'center' ? (left + right) / 2 : align === 'right' ? right : left
  // The text region is its own scene so the CTA pill aligns with the text.
  const region: Scene = { ...scene, cx: (left + right) / 2 }

  const baseHeadline = Math.round(width * (design.preset === 'story' ? .105 : .085))
  const headlineSize = Math.max(64, Math.min(126, baseHeadline)) * 1.05
  context.font = `italic 900 ${headlineSize}px ${DISPLAY_FONT}`
  const headlineLines = isVisible(design, 'headline')
    ? wrapText(context, design.headline.toUpperCase(), maxWidth, design.preset === 'story' ? 5 : 4)
    : []
  const headlineLineHeight = Math.round(headlineSize * .92)

  const sublineSize = Math.round(headlineSize * .3)
  context.font = `700 ${sublineSize}px ${BODY_FONT}`
  const sublineLines = isVisible(design, 'subline') ? wrapText(context, design.subline, maxWidth, 3) : []
  const sublineLineHeight = Math.round(sublineSize * 1.3)

  const factSize = Math.round(headlineSize * .36)
  const meta = [
    isVisible(design, 'date') ? design.dateText : '',
    isVisible(design, 'time') ? design.timeText : '',
    isVisible(design, 'location') ? design.locationText : '',
  ].filter(Boolean).join('  ·  ').toUpperCase()

  const cta = filled(design, 'cta', design.ctaText)
  const ctaBlockInstance = cta ? ctaBlock({ ...region, u: width / 1080 }, cta, maxWidth, align === 'center' ? 'center' : align) : null

  const blockHeight = headlineLines.length * headlineLineHeight
    + (sublineLines.length ? 28 + sublineLines.length * sublineLineHeight : 0)
    + (meta ? 36 + factSize * 1.2 : 0)
    + (ctaBlockInstance ? 36 + ctaBlockInstance.height : 0)

  let y = safe.top + 110
  if (design.textPosition === 'middle') y = Math.max(safe.top, (height - blockHeight) / 2)
  if (design.textPosition === 'bottom') y = Math.max(safe.top, height - safe.bottom - blockHeight)

  headlineLines.forEach((line, index) => {
    drawGradientText(scene, line, x, y + headlineLineHeight / 2, headlineSize, maxWidth, { align, deep: index % 2 === 1 })
    y += headlineLineHeight
  })

  if (sublineLines.length) {
    y += 28
    context.save()
    context.font = `700 ${sublineSize}px ${BODY_FONT}`
    context.textAlign = align
    context.textBaseline = 'top'
    context.shadowColor = 'rgba(0,0,0,.72)'
    context.shadowBlur = 16
    context.fillStyle = colors.soft
    for (const line of sublineLines) {
      context.fillText(line, x, y, maxWidth)
      y += sublineLineHeight
    }
    context.restore()
  }

  if (meta) {
    y += 36
    context.save()
    context.font = `900 ${factSize}px ${DISPLAY_FONT}`
    context.textAlign = align
    context.textBaseline = 'top'
    context.shadowColor = 'rgba(0,0,0,.72)'
    context.shadowBlur = 14
    context.fillStyle = '#ffffff'
    context.fillText(meta, x, y, maxWidth)
    context.restore()
    y += factSize * 1.2
  }

  if (ctaBlockInstance) ctaBlockInstance.draw(y + 36)
}

// ── Editor plumbing ─────────────────────────────────────────────────────────

function drawSafeArea(context: CanvasRenderingContext2D, design: PostDesign, width: number, height: number) {
  const safe = safeAreaInsets(design.preset)
  context.save()
  context.setLineDash([22, 16])
  context.lineWidth = 3
  context.strokeStyle = 'rgba(255,255,255,.75)'
  context.shadowColor = 'rgba(0,0,0,.6)'
  context.shadowBlur = 8
  context.strokeRect(
    safe.left,
    safe.top,
    width - safe.left - safe.right,
    height - safe.top - safe.bottom,
  )
  context.restore()
}

export type PostTextBox = { x: number, y: number, width: number, height: number }

/**
 * Record the bounds of every text run drawn on `context`, so the editor can
 * make text on the canvas clickable. Drawing itself is unchanged. Text is
 * often tilted or skewed, so each run's box is mapped through the current
 * transform and stored as its axis-aligned bounds.
 */
function recordTextBoxes(context: CanvasRenderingContext2D, boxes: PostTextBox[]) {
  const fillText = context.fillText.bind(context)
  const restore = () => {
    // Drop the instance override so the prototype method applies again.
    delete (context as Partial<CanvasRenderingContext2D>).fillText
  }
  context.fillText = (text: string, x: number, y: number, maxWidth?: number) => {
    if (text.trim()) {
      const metrics = context.measureText(text)
      const width = maxWidth === undefined ? metrics.width : Math.min(metrics.width, maxWidth)
      const align = context.textAlign
      const left = align === 'center' ? x - width / 2 : align === 'right' || align === 'end' ? x - width : x
      const top = y - metrics.actualBoundingBoxAscent
      const height = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent
      const matrix = context.getTransform()
      const corners = [[left, top], [left + width, top], [left, top + height], [left + width, top + height]]
        .map(([px, py]) => ({ x: matrix.a * px! + matrix.c * py! + matrix.e, y: matrix.b * px! + matrix.d * py! + matrix.f }))
      const minX = Math.min(...corners.map(corner => corner.x))
      const minY = Math.min(...corners.map(corner => corner.y))
      boxes.push({
        x: minX,
        y: minY,
        width: Math.max(...corners.map(corner => corner.x)) - minX,
        height: Math.max(...corners.map(corner => corner.y)) - minY,
      })
    }
    if (maxWidth === undefined) fillText(text, x, y)
    else fillText(text, x, y, maxWidth)
  }
  return restore
}

export async function renderPostCanvas(
  canvas: HTMLCanvasElement,
  image: ImageBitmap,
  design: PostDesign,
  showGuides = false,
  textBoxes?: PostTextBox[],
) {
  const size = postPresetSize(design.preset)
  canvas.width = size.width
  canvas.height = size.height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas is not available')

  context.clearRect(0, 0, size.width, size.height)
  context.fillStyle = '#08070a'
  context.fillRect(0, 0, size.width, size.height)

  const rect = coverImageRect({
    sourceWidth: image.width,
    sourceHeight: image.height,
    targetWidth: size.width,
    targetHeight: size.height,
    zoom: design.zoom,
    imageX: design.imageX,
    imageY: design.imageY,
  })
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.drawImage(image, rect.x, rect.y, rect.width, rect.height)

  const assets = await loadPostAssets()
  const colors = MOTION_ACCENTS[design.brandPreset] ?? MOTION_ACCENTS[DEFAULT_POST_BRAND]
  const campaign = {
    'gig-announcement': drawGigAnnouncement,
    'recap': drawRecap,
    'review': drawReview,
    'upcoming-gigs': drawUpcomingGigs,
  } as const
  const drawTemplate = campaign[design.templateKey as keyof typeof campaign]

  const stopRecording = textBoxes ? recordTextBoxes(context, textBoxes) : null
  try {
    if (drawTemplate) {
      const boost = design.templateKey === 'review' ? .08 : 0
      drawBackdrop(context, colors, size.width, size.height, Math.min(.9, design.overlayOpacity + boost))
      drawTemplate(context, design, size.width, size.height, colors, assets)
    } else {
      drawTemplateOverlay(context, design, size.width, size.height, colors)
      const scene = sceneFor(context, assets, colors, size.width, 1, size.width / 2)
      drawBrand(scene, design, size.width)
      drawGenericTextBlock(scene, design, size.width, size.height)
    }
  } finally {
    stopRecording?.()
  }

  if (showGuides && design.showSafeArea) drawSafeArea(context, design, size.width, size.height)
}
