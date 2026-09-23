import {
  coverImageRect,
  postPresetSize,
  safeAreaInsets,
  type PostBrandPreset,
  type PostDesign,
  type PostFieldVisibility,
} from '~~/shared/post-generator'

type Palette = {
  text: string
  accent: string
  accentStrong: string
  shadow: string
  overlay: string
  panel: string
  panelSolid: string
}

const palettes: Record<PostBrandPreset, Palette> = {
  night: {
    text: '#ffffff',
    accent: '#b18cff',
    accentStrong: '#8f2cff',
    shadow: 'rgba(0,0,0,.68)',
    overlay: '#09070d',
    panel: 'rgba(12,9,18,.78)',
    panelSolid: '#120c1a',
  },
  mono: {
    text: '#ffffff',
    accent: '#ffffff',
    accentStrong: '#d9d9d9',
    shadow: 'rgba(0,0,0,.72)',
    overlay: '#000000',
    panel: 'rgba(0,0,0,.78)',
    panelSolid: '#0d0d0d',
  },
  warm: {
    text: '#fffaf5',
    accent: '#ff9a7c',
    accentStrong: '#ff5f35',
    shadow: 'rgba(26,8,3,.68)',
    overlay: '#1e0b06',
    panel: 'rgba(35,11,5,.76)',
    panelSolid: '#2a1009',
  },
}

function isVisible(design: PostDesign, field: keyof PostFieldVisibility) {
  return design.visibility[field]
}

function alignX(align: CanvasTextAlign, left: number, right: number) {
  if (align === 'center') return (left + right) / 2
  if (align === 'right') return right
  return left
}

function wrapLines(context: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines = 4) {
  const words = text.trim().split(/\s+/).filter(Boolean)
  if (!words.length) return []
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word
    if (context.measureText(candidate).width <= maxWidth || !line) {
      line = candidate
      continue
    }
    lines.push(line)
    line = word
    if (lines.length >= maxLines - 1) break
  }
  if (line && lines.length < maxLines) lines.push(line)
  if (lines.length === maxLines && words.join(' ') !== lines.join(' ')) {
    while (lines[maxLines - 1] && context.measureText(`${lines[maxLines - 1]}…`).width > maxWidth) {
      lines[maxLines - 1] = lines[maxLines - 1]!.slice(0, -1)
    }
    lines[maxLines - 1] = `${lines[maxLines - 1]}…`
  }
  return lines
}

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const r = Math.min(radius, width / 2, height / 2)
  context.beginPath()
  context.moveTo(x + r, y)
  context.lineTo(x + width - r, y)
  context.quadraticCurveTo(x + width, y, x + width, y + r)
  context.lineTo(x + width, y + height - r)
  context.quadraticCurveTo(x + width, y + height, x + width - r, y + height)
  context.lineTo(x + r, y + height)
  context.quadraticCurveTo(x, y + height, x, y + height - r)
  context.lineTo(x, y + r)
  context.quadraticCurveTo(x, y, x + r, y)
  context.closePath()
}

function fillRoundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fill: string,
  stroke?: string,
  lineWidth = 2,
) {
  roundedRect(context, x, y, width, height, radius)
  context.fillStyle = fill
  context.fill()
  if (stroke) {
    context.strokeStyle = stroke
    context.lineWidth = lineWidth
    context.stroke()
  }
}

function drawBrushAccent(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  palette: Palette,
) {
  context.save()
  context.globalAlpha = .92
  context.fillStyle = palette.accentStrong
  context.translate(x, y)
  context.rotate(-.045)
  context.fillRect(0, 0, width, 12)
  context.fillRect(width * .08, 18, width * .78, 7)
  context.fillRect(width * .16, -8, width * .55, 4)
  context.restore()
}

function drawLightningBolt(
  context: CanvasRenderingContext2D,
  points: Array<[number, number]>,
  palette: Palette,
  width: number,
) {
  if (points.length < 2) return

  context.save()
  context.lineCap = 'round'
  context.lineJoin = 'round'
  context.strokeStyle = '#ffffff'
  context.lineWidth = Math.max(2, width * .003)
  context.shadowColor = palette.accentStrong
  context.shadowBlur = Math.max(14, width * .025)
  context.beginPath()
  points.forEach(([x, y], index) => {
    if (index === 0) context.moveTo(x, y)
    else context.lineTo(x, y)
  })
  context.stroke()

  context.globalAlpha = .7
  context.strokeStyle = palette.accent
  context.lineWidth = Math.max(1, width * .0015)
  context.shadowBlur = Math.max(22, width * .035)
  context.stroke()
  context.restore()
}

function drawRoughPanel(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  palette: Palette,
) {
  const tooth = Math.max(8, Math.round(width * .018))
  context.save()
  context.beginPath()
  context.moveTo(x + tooth, y)
  context.lineTo(x + width - tooth * 1.6, y)
  context.lineTo(x + width, y + tooth * .7)
  context.lineTo(x + width - tooth * .35, y + height - tooth * .8)
  context.lineTo(x + width - tooth * 1.25, y + height)
  context.lineTo(x + tooth * 1.2, y + height)
  context.lineTo(x, y + height - tooth * .5)
  context.lineTo(x + tooth * .35, y + tooth)
  context.closePath()
  context.fillStyle = 'rgba(6,4,9,.9)'
  context.fill()
  context.strokeStyle = palette.accentStrong
  context.lineWidth = Math.max(2, width * .004)
  context.shadowColor = palette.accentStrong
  context.shadowBlur = Math.max(8, width * .015)
  context.stroke()
  context.shadowBlur = 0

  context.globalAlpha = .5
  context.fillStyle = palette.accentStrong
  context.fillRect(x - tooth * .3, y + tooth * .3, tooth * .45, height - tooth * .55)
  context.fillRect(x + width - tooth * .1, y + tooth * .8, tooth * .35, height - tooth * 1.4)
  context.restore()
}

function drawCampaignTexture(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  palette: Palette,
  opacity: number,
) {
  const shade = context.createLinearGradient(0, 0, 0, height)
  shade.addColorStop(0, 'rgba(3,2,5,.38)')
  shade.addColorStop(.48, 'rgba(7,3,12,.58)')
  shade.addColorStop(1, 'rgba(2,1,4,.92)')
  context.globalAlpha = Math.max(.58, opacity)
  context.fillStyle = shade
  context.fillRect(0, 0, width, height)
  context.globalAlpha = 1

  context.save()
  context.globalAlpha = .32
  context.fillStyle = palette.accentStrong
  context.translate(-width * .08, height * .08)
  context.rotate(-.18)
  context.fillRect(0, 0, width * .34, width * .02)
  context.fillRect(width * .04, width * .03, width * .26, width * .008)
  context.restore()

  context.save()
  context.globalAlpha = .28
  context.fillStyle = palette.accentStrong
  context.translate(width * .76, height * .82)
  context.rotate(-.18)
  context.fillRect(0, 0, width * .34, width * .02)
  context.fillRect(width * .02, width * .035, width * .22, width * .008)
  context.restore()

  drawLightningBolt(context, [
    [width * .08, height * .08],
    [width * .16, height * .15],
    [width * .12, height * .2],
    [width * .22, height * .27],
    [width * .18, height * .34],
  ], palette, width)

  drawLightningBolt(context, [
    [width * .91, height * .06],
    [width * .84, height * .13],
    [width * .88, height * .2],
    [width * .78, height * .28],
    [width * .82, height * .36],
  ], palette, width)
}

function drawBrand(context: CanvasRenderingContext2D, design: PostDesign, width: number, palette: Palette) {
  if (!isVisible(design, 'logo')) return
  const safe = safeAreaInsets(design.preset)
  context.textBaseline = 'top'
  context.textAlign = 'left'
  context.shadowColor = palette.shadow
  context.shadowBlur = 14
  context.fillStyle = palette.text
  context.font = `900 ${Math.round(width * .034)}px Arial, sans-serif`
  context.fillText((design.logoText || 'NIGHTLIGHT').toUpperCase(), safe.left, safe.top, width - safe.left - safe.right)
  context.fillStyle = palette.accent
  context.fillRect(safe.left, safe.top + Math.round(width * .052), Math.round(width * .08), Math.max(6, Math.round(width * .007)))
  context.shadowBlur = 0
}

function drawGenericTextBlock(
  context: CanvasRenderingContext2D,
  design: PostDesign,
  width: number,
  height: number,
  palette: Palette,
) {
  const safe = safeAreaInsets(design.preset)
  const left = safe.left
  const right = width - safe.right
  const maxWidth = right - left
  const canvasAlign = design.textAlign as CanvasTextAlign
  const x = alignX(canvasAlign, left, right)
  context.textAlign = canvasAlign
  context.textBaseline = 'top'
  context.shadowColor = palette.shadow
  context.shadowBlur = 22

  const baseHeadline = Math.round(width * (design.preset === 'story' ? .105 : .085))
  const headlineSize = Math.max(64, Math.min(126, baseHeadline))
  context.font = `900 ${headlineSize}px Arial, sans-serif`
  const headlineLines = isVisible(design, 'headline')
    ? wrapLines(context, design.headline, maxWidth, design.preset === 'story' ? 5 : 4)
    : []
  const headlineLineHeight = Math.round(headlineSize * .92)

  context.font = `600 ${Math.round(headlineSize * .34)}px Arial, sans-serif`
  const sublineLines = isVisible(design, 'subline') ? wrapLines(context, design.subline, maxWidth, 3) : []
  const sublineLineHeight = Math.round(headlineSize * .43)
  const metaSize = Math.round(headlineSize * .27)
  const meta = [
    isVisible(design, 'date') ? design.dateText : '',
    isVisible(design, 'time') ? design.timeText : '',
    isVisible(design, 'location') ? design.locationText : '',
  ].filter(Boolean).join('  ·  ').toUpperCase()
  const ctaLines = isVisible(design, 'cta') ? wrapLines(context, design.ctaText, maxWidth, 2) : []
  const blockHeight = headlineLines.length * headlineLineHeight
    + (sublineLines.length ? 28 + sublineLines.length * sublineLineHeight : 0)
    + (meta ? 42 + metaSize * 1.25 : 0)
    + (ctaLines.length ? 36 + metaSize * 1.35 : 0)

  let y = safe.top + 110
  if (design.textPosition === 'middle') y = Math.max(safe.top, (height - blockHeight) / 2)
  if (design.textPosition === 'bottom') y = Math.max(safe.top, height - safe.bottom - blockHeight)

  context.fillStyle = palette.text
  context.font = `900 ${headlineSize}px Arial, sans-serif`
  for (const line of headlineLines) {
    context.fillText(line, x, y, maxWidth)
    y += headlineLineHeight
  }

  if (sublineLines.length) {
    y += 28
    context.globalAlpha = .92
    context.font = `600 ${Math.round(headlineSize * .34)}px Arial, sans-serif`
    for (const line of sublineLines) {
      context.fillText(line, x, y, maxWidth)
      y += sublineLineHeight
    }
    context.globalAlpha = 1
  }

  if (meta) {
    y += 42
    context.shadowBlur = 10
    context.fillStyle = palette.accent
    context.font = `800 ${metaSize}px Arial, sans-serif`
    context.fillText(meta, x, y, maxWidth)
    y += metaSize * 1.25
  }

  if (ctaLines.length) {
    y += 30
    context.fillStyle = palette.text
    context.font = `800 ${Math.round(metaSize * 1.06)}px Arial, sans-serif`
    for (const line of ctaLines) {
      context.fillText(line.toUpperCase(), x, y, maxWidth)
      y += metaSize * 1.2
    }
  }

  context.shadowBlur = 0
  context.globalAlpha = 1
}

function drawGigAnnouncement(
  context: CanvasRenderingContext2D,
  design: PostDesign,
  width: number,
  height: number,
  palette: Palette,
) {
  const safe = safeAreaInsets(design.preset)
  const left = safe.left
  const contentWidth = width - safe.left - safe.right

  drawCampaignTexture(context, width, height, palette, design.overlayOpacity)
  drawBrand(context, design, width, palette)

  let y = safe.top + width * .16
  if (isVisible(design, 'headline') && design.headline.trim()) {
    const size = Math.round(width * .098)
    context.textAlign = 'center'
    context.textBaseline = 'top'
    context.shadowColor = palette.accentStrong
    context.shadowBlur = 30
    context.fillStyle = '#ffffff'
    context.font = `900 italic ${size}px Arial, sans-serif`
    const lines = wrapLines(context, design.headline.toUpperCase(), contentWidth, 3)
    for (const line of lines) {
      context.fillText(line, width / 2, y, contentWidth)
      y += size * .88
    }
    context.shadowBlur = 0
    drawBrushAccent(context, width * .28, y + width * .005, width * .44, palette)
    y += width * .06
  }

  if (isVisible(design, 'subline') && design.subline.trim()) {
    const pillWidth = contentWidth * .72
    const pillHeight = Math.max(78, width * .095)
    fillRoundedRect(
      context,
      (width - pillWidth) / 2,
      y,
      pillWidth,
      pillHeight,
      pillHeight / 2,
      palette.accentStrong,
      '#ffffff',
      3,
    )
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillStyle = '#ffffff'
    context.font = `900 ${Math.round(width * .052)}px Arial, sans-serif`
    context.fillText(design.subline.toUpperCase(), width / 2, y + pillHeight / 2, pillWidth * .86)
    y += pillHeight + width * .055
  }

  const cardGap = Math.round(width * .022)
  const cards = [
    { visible: isVisible(design, 'date'), label: 'DATUM', value: design.dateText },
    { visible: isVisible(design, 'time'), label: 'TIJD', value: design.timeText },
  ].filter(card => card.visible && card.value.trim())

  if (cards.length) {
    const cardWidth = (contentWidth - cardGap * (cards.length - 1)) / cards.length
    const cardHeight = Math.max(126, Math.round(width * .145))
    cards.forEach((card, index) => {
      const x = left + index * (cardWidth + cardGap)
      drawRoughPanel(context, x, y, cardWidth, cardHeight, palette)
      context.textAlign = 'center'
      context.textBaseline = 'top'
      context.fillStyle = palette.accent
      context.font = `800 ${Math.round(width * .021)}px Arial, sans-serif`
      context.fillText(card.label, x + cardWidth / 2, y + cardHeight * .15)
      context.fillStyle = '#ffffff'
      context.font = `900 ${Math.round(width * .038)}px Arial, sans-serif`
      context.fillText(card.value.toUpperCase(), x + cardWidth / 2, y + cardHeight * .48, cardWidth * .82)
    })
    y += cardHeight + cardGap
  }

  if (isVisible(design, 'location') && design.locationText.trim()) {
    const cardHeight = Math.max(108, Math.round(width * .12))
    drawRoughPanel(context, left, y, contentWidth, cardHeight, palette)
    context.textAlign = 'left'
    context.textBaseline = 'middle'
    context.fillStyle = palette.accent
    context.font = `900 ${Math.round(width * .033)}px Arial, sans-serif`
    context.fillText('◆', left + width * .035, y + cardHeight / 2)
    context.fillStyle = '#ffffff'
    context.font = `800 ${Math.round(width * .034)}px Arial, sans-serif`
    context.fillText(design.locationText, left + width * .085, y + cardHeight / 2, contentWidth - width * .12)
    y += cardHeight
  }

  if (isVisible(design, 'cta') && design.ctaText.trim()) {
    const ctaY = Math.min(height - safe.bottom - width * .11, Math.max(y + width * .065, height * .8))
    context.textAlign = 'center'
    context.textBaseline = 'top'
    context.fillStyle = '#ffffff'
    context.shadowColor = palette.shadow
    context.shadowBlur = 16
    context.font = `900 italic ${Math.round(width * .052)}px Arial, sans-serif`
    const lines = wrapLines(context, design.ctaText.toUpperCase(), contentWidth * .84, 2)
    lines.forEach((line, index) => context.fillText(line, width / 2, ctaY + index * width * .05, contentWidth * .84))
    context.shadowBlur = 0
    drawBrushAccent(context, width * .34, ctaY + lines.length * width * .057, width * .32, palette)
  }
}

function drawRecap(
  context: CanvasRenderingContext2D,
  design: PostDesign,
  width: number,
  height: number,
  palette: Palette,
) {
  const safe = safeAreaInsets(design.preset)
  const left = safe.left
  const contentWidth = width - safe.left - safe.right

  drawCampaignTexture(context, width, height, palette, design.overlayOpacity)
  drawBrand(context, design, width, palette)

  let y = safe.top + width * .17
  context.textAlign = 'center'
  context.textBaseline = 'top'

  if (isVisible(design, 'headline') && design.headline.trim()) {
    const size = Math.round(width * .1)
    context.fillStyle = '#ffffff'
    context.shadowColor = palette.accentStrong
    context.shadowBlur = 30
    context.font = `900 italic ${size}px Arial, sans-serif`
    const lines = wrapLines(context, design.headline.toUpperCase(), contentWidth, 3)
    for (const line of lines) {
      context.fillText(line, width / 2, y, contentWidth)
      y += size * .88
    }
    context.shadowBlur = 0
    drawBrushAccent(context, width * .3, y + width * .004, width * .4, palette)
    y += width * .055
  }

  if (isVisible(design, 'subline') && design.subline.trim()) {
    const pillWidth = contentWidth * .56
    const pillHeight = Math.max(76, width * .092)
    fillRoundedRect(
      context,
      (width - pillWidth) / 2,
      y,
      pillWidth,
      pillHeight,
      pillHeight / 2,
      palette.accentStrong,
      '#ffffff',
      3,
    )
    context.textBaseline = 'middle'
    context.fillStyle = '#ffffff'
    context.font = `900 ${Math.round(width * .048)}px Arial, sans-serif`
    context.fillText(design.subline.toUpperCase(), width / 2, y + pillHeight / 2, pillWidth * .86)
    y += pillHeight + width * .055
  }

  const metaParts = [
    isVisible(design, 'date') ? design.dateText : '',
    isVisible(design, 'location') ? design.locationText : '',
  ].filter(Boolean)

  if (metaParts.length) {
    const metaHeight = Math.max(142, width * .16)
    drawRoughPanel(context, left, y, contentWidth, metaHeight, palette)
    context.textAlign = 'left'
    context.textBaseline = 'top'
    context.fillStyle = '#ffffff'
    context.font = `900 ${Math.round(width * .038)}px Arial, sans-serif`
    context.fillText(metaParts[0]!.toUpperCase(), left + width * .045, y + metaHeight * .2, contentWidth * .82)
    if (metaParts[1]) {
      context.fillStyle = palette.accent
      context.font = `800 ${Math.round(width * .028)}px Arial, sans-serif`
      context.fillText(metaParts[1]!.toUpperCase(), left + width * .045, y + metaHeight * .58, contentWidth * .82)
    }
  }

  if (isVisible(design, 'cta') && design.ctaText.trim()) {
    const ctaWidth = contentWidth * .78
    const ctaHeight = Math.max(86, width * .095)
    const ctaX = (width - ctaWidth) / 2
    const ctaY = height - safe.bottom - ctaHeight - width * .04
    fillRoundedRect(context, ctaX, ctaY, ctaWidth, ctaHeight, ctaHeight / 2, palette.accentStrong, '#ffffff', 3)
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillStyle = '#ffffff'
    context.font = `900 ${Math.round(width * .034)}px Arial, sans-serif`
    context.fillText(design.ctaText.toUpperCase(), width / 2, ctaY + ctaHeight / 2, ctaWidth * .86)
  }
}

function drawUpcomingGigs(
  context: CanvasRenderingContext2D,
  design: PostDesign,
  width: number,
  height: number,
  palette: Palette,
) {
  const safe = safeAreaInsets(design.preset)
  const left = safe.left
  const contentWidth = width - safe.left - safe.right

  drawCampaignTexture(context, width, height, palette, design.overlayOpacity)
  drawBrand(context, design, width, palette)

  let y = safe.top + width * .16
  context.textAlign = 'center'
  context.textBaseline = 'top'

  if (isVisible(design, 'headline') && design.headline.trim()) {
    const size = Math.round(width * .092)
    context.fillStyle = '#ffffff'
    context.shadowColor = palette.accentStrong
    context.shadowBlur = 28
    context.font = `900 italic ${size}px Arial, sans-serif`
    const lines = wrapLines(context, design.headline.toUpperCase(), contentWidth, 2)
    for (const line of lines) {
      context.fillText(line, width / 2, y, contentWidth)
      y += size * .86
    }
    context.shadowBlur = 0
  }

  if (isVisible(design, 'subline') && design.subline.trim()) {
    y += width * .025
    const pillWidth = contentWidth * .58
    const pillHeight = Math.max(72, width * .088)
    fillRoundedRect(
      context,
      (width - pillWidth) / 2,
      y,
      pillWidth,
      pillHeight,
      pillHeight / 2,
      '#ffffff',
      palette.accentStrong,
      3,
    )
    context.textBaseline = 'middle'
    context.fillStyle = '#08070a'
    context.font = `900 ${Math.round(width * .047)}px Arial, sans-serif`
    context.fillText(design.subline.toUpperCase(), width / 2, y + pillHeight / 2, pillWidth * .86)
    y += pillHeight + width * .052
  }

  if (isVisible(design, 'gigList')) {
    const items = design.gigItems.filter(item => item.enabled).slice(0, 6)
    const available = height - safe.bottom - y - (isVisible(design, 'cta') && design.ctaText.trim() ? width * .18 : width * .05)
    const gap = Math.max(18, width * .019)
    const cardHeight = Math.min(width * .145, Math.max(width * .095, (available - gap * Math.max(0, items.length - 1)) / Math.max(1, items.length)))

    items.forEach((item, index) => {
      const cardY = y + index * (cardHeight + gap)
      drawRoughPanel(context, left, cardY, contentWidth, cardHeight, palette)

      const dateWidth = Math.min(width * .19, contentWidth * .24)
      const dateX = left + width * .018
      const dateY = cardY + width * .012
      const dateHeight = cardHeight - width * .024
      fillRoundedRect(
        context,
        dateX,
        dateY,
        dateWidth,
        dateHeight,
        16,
        palette.accentStrong,
        '#ffffff',
        2,
      )

      const dateParts = item.dateText.trim().split(/\s+/)
      context.textAlign = 'center'
      context.textBaseline = 'middle'
      context.fillStyle = '#ffffff'
      context.font = `900 ${Math.round(width * .042)}px Arial, sans-serif`
      context.fillText(dateParts[0] || '', dateX + dateWidth / 2, cardY + cardHeight * .42, dateWidth * .8)
      if (dateParts.length > 1) {
        context.font = `800 ${Math.round(width * .02)}px Arial, sans-serif`
        context.fillText(dateParts.slice(1).join(' ').toUpperCase(), dateX + dateWidth / 2, cardY + cardHeight * .71, dateWidth * .8)
      }

      const textX = dateX + dateWidth + width * .034
      const textWidth = contentWidth - dateWidth - width * .085
      context.textAlign = 'left'
      context.fillStyle = '#ffffff'
      context.font = `900 ${Math.round(width * .033)}px Arial, sans-serif`
      context.fillText(item.title, textX, cardY + cardHeight * .36, textWidth)
      context.fillStyle = palette.accent
      context.font = `800 ${Math.round(width * .023)}px Arial, sans-serif`
      context.fillText(item.locationText, textX, cardY + cardHeight * .7, textWidth)
    })
  }

  if (isVisible(design, 'cta') && design.ctaText.trim()) {
    const ctaY = height - safe.bottom - width * .08
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillStyle = '#ffffff'
    context.shadowColor = palette.shadow
    context.shadowBlur = 16
    context.font = `900 italic ${Math.round(width * .04)}px Arial, sans-serif`
    context.fillText(design.ctaText.toUpperCase(), width / 2, ctaY, contentWidth * .85)
    context.shadowBlur = 0
    drawBrushAccent(context, width * .35, ctaY + width * .04, width * .3, palette)
  }
}

function drawTemplateOverlay(
  context: CanvasRenderingContext2D,
  design: PostDesign,
  width: number,
  height: number,
  palette: Palette,
) {
  const opacity = Math.max(0, Math.min(.9, design.overlayOpacity))

  if (design.templateKey === 'gradient') {
    const gradient = context.createLinearGradient(0, 0, 0, height)
    gradient.addColorStop(0, 'rgba(0,0,0,.08)')
    gradient.addColorStop(.42, 'rgba(0,0,0,.05)')
    gradient.addColorStop(1, palette.overlay)
    context.globalAlpha = opacity
    context.fillStyle = gradient
    context.fillRect(0, 0, width, height)
    context.globalAlpha = 1
    return
  }

  if (design.templateKey === 'poster') {
    context.globalAlpha = Math.max(.25, opacity * .78)
    context.fillStyle = palette.overlay
    context.fillRect(0, 0, width, height)
    context.globalAlpha = 1
    const inset = Math.round(width * .035)
    context.strokeStyle = palette.accent
    context.lineWidth = Math.max(8, Math.round(width * .009))
    context.strokeRect(inset, inset, width - inset * 2, height - inset * 2)
    return
  }

  if (design.templateKey === 'minimal') {
    const panelWidth = design.textAlign === 'center' ? width : Math.round(width * .76)
    const panelX = design.textAlign === 'right' ? width - panelWidth : 0
    context.globalAlpha = Math.max(.38, opacity)
    context.fillStyle = palette.panel
    context.fillRect(panelX, 0, panelWidth, height)
    context.globalAlpha = 1
    context.fillStyle = palette.accent
    if (design.textAlign === 'right') context.fillRect(width - 16, 0, 16, height)
    else context.fillRect(0, 0, 16, height)
  }
}

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

export function renderPostCanvas(
  canvas: HTMLCanvasElement,
  image: ImageBitmap,
  design: PostDesign,
  showGuides = false,
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

  const palette = palettes[design.brandPreset]

  if (design.templateKey === 'gig-announcement') {
    drawGigAnnouncement(context, design, size.width, size.height, palette)
  } else if (design.templateKey === 'recap') {
    drawRecap(context, design, size.width, size.height, palette)
  } else if (design.templateKey === 'upcoming-gigs') {
    drawUpcomingGigs(context, design, size.width, size.height, palette)
  } else {
    drawTemplateOverlay(context, design, size.width, size.height, palette)
    drawBrand(context, design, size.width, palette)
    drawGenericTextBlock(context, design, size.width, size.height, palette)
  }

  if (showGuides && design.showSafeArea) drawSafeArea(context, design, size.width, size.height)
}
