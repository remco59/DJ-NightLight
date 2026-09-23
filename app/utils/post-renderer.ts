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
  context.globalAlpha = .9
  context.fillStyle = palette.accentStrong
  context.translate(x, y)
  context.rotate(-.045)
  context.fillRect(0, 0, width, 12)
  context.fillRect(width * .08, 18, width * .78, 7)
  context.restore()
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
  const right = width - safe.right
  const contentWidth = right - left

  context.fillStyle = 'rgba(5,3,8,.5)'
  context.fillRect(0, 0, width, height)
  const vignette = context.createLinearGradient(0, height * .2, 0, height)
  vignette.addColorStop(0, 'rgba(0,0,0,.04)')
  vignette.addColorStop(.64, 'rgba(5,3,8,.32)')
  vignette.addColorStop(1, palette.overlay)
  context.globalAlpha = Math.max(.45, design.overlayOpacity)
  context.fillStyle = vignette
  context.fillRect(0, 0, width, height)
  context.globalAlpha = 1

  drawBrand(context, design, width, palette)
  drawBrushAccent(context, left, safe.top + width * .11, width * .2, palette)

  let y = safe.top + width * .19
  if (isVisible(design, 'headline') && design.headline.trim()) {
    const size = Math.round(width * .095)
    context.textAlign = 'center'
    context.textBaseline = 'top'
    context.shadowColor = palette.shadow
    context.shadowBlur = 26
    context.fillStyle = palette.text
    context.font = `900 italic ${size}px Arial, sans-serif`
    const lines = wrapLines(context, design.headline.toUpperCase(), contentWidth, 3)
    for (const line of lines) {
      context.fillText(line, width / 2, y, contentWidth)
      y += size * .9
    }
  }

  if (isVisible(design, 'subline') && design.subline.trim()) {
    const pillHeight = Math.max(82, Math.round(width * .105))
    y += Math.round(width * .025)
    fillRoundedRect(
      context,
      left + width * .08,
      y,
      contentWidth - width * .16,
      pillHeight,
      pillHeight / 2,
      palette.accentStrong,
      palette.accent,
      Math.max(4, width * .004),
    )
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillStyle = palette.text
    context.shadowBlur = 12
    context.font = `900 ${Math.round(width * .06)}px Arial, sans-serif`
    context.fillText(design.subline.toUpperCase(), width / 2, y + pillHeight / 2, contentWidth - width * .22)
    context.shadowBlur = 0
    y += pillHeight + Math.round(width * .04)
  }

  const cardGap = Math.round(width * .02)
  const cards = [
    { visible: isVisible(design, 'date'), label: 'DATE', value: design.dateText },
    { visible: isVisible(design, 'time'), label: 'TIME', value: design.timeText },
  ].filter(card => card.visible && card.value.trim())
  if (cards.length) {
    const cardWidth = (contentWidth - cardGap * (cards.length - 1)) / cards.length
    const cardHeight = Math.max(118, Math.round(width * .14))
    cards.forEach((card, index) => {
      const x = left + index * (cardWidth + cardGap)
      fillRoundedRect(context, x, y, cardWidth, cardHeight, 22, palette.panel, palette.accentStrong, 3)
      context.textAlign = 'center'
      context.textBaseline = 'top'
      context.fillStyle = palette.accent
      context.font = `800 ${Math.round(width * .022)}px Arial, sans-serif`
      context.fillText(card.label, x + cardWidth / 2, y + cardHeight * .16)
      context.fillStyle = palette.text
      context.font = `900 ${Math.round(width * .037)}px Arial, sans-serif`
      context.fillText(card.value.toUpperCase(), x + cardWidth / 2, y + cardHeight * .48, cardWidth * .84)
    })
    y += cardHeight + cardGap
  }

  if (isVisible(design, 'location') && design.locationText.trim()) {
    const cardHeight = Math.max(104, Math.round(width * .115))
    fillRoundedRect(context, left, y, contentWidth, cardHeight, 22, palette.panel, palette.accentStrong, 3)
    context.textAlign = 'left'
    context.textBaseline = 'middle'
    context.fillStyle = palette.accent
    context.font = `900 ${Math.round(width * .038)}px Arial, sans-serif`
    context.fillText('●', left + width * .035, y + cardHeight / 2)
    context.fillStyle = palette.text
    context.font = `800 ${Math.round(width * .036)}px Arial, sans-serif`
    context.fillText(design.locationText, left + width * .085, y + cardHeight / 2, contentWidth - width * .12)
    y += cardHeight + cardGap
  }

  if (isVisible(design, 'cta') && design.ctaText.trim()) {
    const ctaY = Math.min(height - safe.bottom - width * .12, Math.max(y + width * .05, height * .79))
    context.textAlign = 'center'
    context.textBaseline = 'top'
    context.fillStyle = palette.accent
    context.shadowColor = palette.shadow
    context.shadowBlur = 18
    context.font = `900 italic ${Math.round(width * .055)}px Arial, sans-serif`
    const lines = wrapLines(context, design.ctaText.toUpperCase(), contentWidth * .82, 2)
    lines.forEach((line, index) => context.fillText(line, width / 2, ctaY + index * width * .052, contentWidth * .82))
    drawBrushAccent(context, width * .35, ctaY + lines.length * width * .058, width * .3, palette)
    context.shadowBlur = 0
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

  const overlay = context.createLinearGradient(0, 0, 0, height)
  overlay.addColorStop(0, 'rgba(4,2,7,.28)')
  overlay.addColorStop(.55, 'rgba(9,4,14,.5)')
  overlay.addColorStop(1, palette.overlay)
  context.globalAlpha = Math.max(.5, design.overlayOpacity)
  context.fillStyle = overlay
  context.fillRect(0, 0, width, height)
  context.globalAlpha = 1

  drawBrand(context, design, width, palette)

  let y = safe.top + width * .16
  context.textAlign = 'center'
  context.textBaseline = 'top'

  if (isVisible(design, 'headline') && design.headline.trim()) {
    const size = Math.round(width * .095)
    context.fillStyle = palette.text
    context.shadowColor = palette.shadow
    context.shadowBlur = 28
    context.font = `900 italic ${size}px Arial, sans-serif`
    const lines = wrapLines(context, design.headline.toUpperCase(), contentWidth, 3)
    for (const line of lines) {
      context.fillText(line, width / 2, y, contentWidth)
      y += size * .9
    }
  }

  if (isVisible(design, 'subline') && design.subline.trim()) {
    y += width * .02
    const pillWidth = contentWidth * .54
    const pillHeight = Math.max(76, width * .09)
    fillRoundedRect(
      context,
      (width - pillWidth) / 2,
      y,
      pillWidth,
      pillHeight,
      pillHeight / 2,
      palette.accentStrong,
      palette.accent,
      3,
    )
    context.textBaseline = 'middle'
    context.fillStyle = palette.text
    context.font = `900 ${Math.round(width * .05)}px Arial, sans-serif`
    context.fillText(design.subline.toUpperCase(), width / 2, y + pillHeight / 2, pillWidth * .86)
    y += pillHeight + width * .035
  }

  const metaParts = [
    isVisible(design, 'date') ? design.dateText : '',
    isVisible(design, 'location') ? design.locationText : '',
  ].filter(Boolean)
  if (metaParts.length) {
    const metaHeight = Math.max(120, width * .14)
    fillRoundedRect(context, left, y, contentWidth, metaHeight, 22, palette.panel, palette.accentStrong, 3)
    context.textAlign = 'left'
    context.textBaseline = 'top'
    context.fillStyle = palette.text
    context.font = `900 ${Math.round(width * .035)}px Arial, sans-serif`
    context.fillText(metaParts[0]!.toUpperCase(), left + width * .04, y + metaHeight * .22, contentWidth * .82)
    if (metaParts[1]) {
      context.fillStyle = palette.accent
      context.font = `800 ${Math.round(width * .027)}px Arial, sans-serif`
      context.fillText(metaParts[1]!.toUpperCase(), left + width * .04, y + metaHeight * .58, contentWidth * .82)
    }
    y += metaHeight + width * .055
  }

  const tileTop = Math.max(y, height * .59)
  const gap = width * .025
  const tileWidth = (contentWidth - gap * 2) / 3
  const tileHeight = Math.min(width * .22, height - safe.bottom - tileTop - width * .16)
  if (tileHeight > 70) {
    const labels = ['GOOD PEOPLE', 'AMAZING VIBES', 'GREAT ENERGY']
    labels.forEach((label, index) => {
      const x = left + index * (tileWidth + gap)
      fillRoundedRect(context, x, tileTop, tileWidth, tileHeight, 18, palette.panel, palette.accentStrong, 2)
      context.textAlign = 'center'
      context.textBaseline = 'middle'
      context.fillStyle = palette.accent
      context.font = `900 ${Math.round(width * .025)}px Arial, sans-serif`
      context.fillText(label, x + tileWidth / 2, tileTop + tileHeight / 2, tileWidth * .8)
    })
  }

  if (isVisible(design, 'cta') && design.ctaText.trim()) {
    const ctaY = height - safe.bottom - width * .1
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillStyle = palette.text
    context.font = `900 ${Math.round(width * .036)}px Arial, sans-serif`
    fillRoundedRect(
      context,
      left + width * .06,
      ctaY - width * .045,
      contentWidth - width * .12,
      width * .09,
      width * .045,
      palette.accentStrong,
      palette.accent,
      3,
    )
    context.fillText(design.ctaText.toUpperCase(), width / 2, ctaY, contentWidth - width * .2)
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

  context.fillStyle = 'rgba(6,3,9,.5)'
  context.fillRect(0, 0, width, height)
  const overlay = context.createLinearGradient(0, 0, 0, height)
  overlay.addColorStop(0, 'rgba(34,8,58,.3)')
  overlay.addColorStop(.48, 'rgba(8,4,13,.58)')
  overlay.addColorStop(1, palette.overlay)
  context.globalAlpha = Math.max(.5, design.overlayOpacity)
  context.fillStyle = overlay
  context.fillRect(0, 0, width, height)
  context.globalAlpha = 1

  drawBrand(context, design, width, palette)

  let y = safe.top + width * .15
  context.textAlign = 'center'
  context.textBaseline = 'top'

  if (isVisible(design, 'headline') && design.headline.trim()) {
    const size = Math.round(width * .09)
    context.fillStyle = palette.text
    context.shadowColor = palette.shadow
    context.shadowBlur = 28
    context.font = `900 italic ${size}px Arial, sans-serif`
    const lines = wrapLines(context, design.headline.toUpperCase(), contentWidth, 2)
    for (const line of lines) {
      context.fillText(line, width / 2, y, contentWidth)
      y += size * .88
    }
  }

  if (isVisible(design, 'subline') && design.subline.trim()) {
    y += width * .02
    const pillWidth = contentWidth * .68
    const pillHeight = Math.max(72, width * .09)
    fillRoundedRect(
      context,
      (width - pillWidth) / 2,
      y,
      pillWidth,
      pillHeight,
      pillHeight / 2,
      palette.accentStrong,
      palette.accent,
      3,
    )
    context.textBaseline = 'middle'
    context.fillStyle = palette.text
    context.font = `900 ${Math.round(width * .05)}px Arial, sans-serif`
    context.fillText(design.subline.toUpperCase(), width / 2, y + pillHeight / 2, pillWidth * .88)
    y += pillHeight + width * .045
  }

  if (isVisible(design, 'gigList')) {
    const items = design.gigItems.filter(item => item.enabled).slice(0, 6)
    const available = height - safe.bottom - y - (isVisible(design, 'cta') && design.ctaText.trim() ? width * .18 : width * .05)
    const gap = Math.max(16, width * .018)
    const cardHeight = Math.min(width * .145, Math.max(width * .09, (available - gap * Math.max(0, items.length - 1)) / Math.max(1, items.length)))

    items.forEach((item, index) => {
      const cardY = y + index * (cardHeight + gap)
      fillRoundedRect(context, left, cardY, contentWidth, cardHeight, 22, palette.panel, palette.accentStrong, 3)

      const dateWidth = Math.min(width * .18, contentWidth * .23)
      fillRoundedRect(
        context,
        left + width * .018,
        cardY + width * .014,
        dateWidth,
        cardHeight - width * .028,
        18,
        'rgba(143,44,255,.16)',
        palette.accentStrong,
        2,
      )

      const dateParts = item.dateText.trim().split(/\s+/)
      context.textAlign = 'center'
      context.textBaseline = 'middle'
      context.fillStyle = palette.text
      context.font = `900 ${Math.round(width * .043)}px Arial, sans-serif`
      context.fillText(dateParts[0] || '', left + width * .018 + dateWidth / 2, cardY + cardHeight * .42, dateWidth * .8)
      if (dateParts.length > 1) {
        context.font = `800 ${Math.round(width * .021)}px Arial, sans-serif`
        context.fillText(dateParts.slice(1).join(' ').toUpperCase(), left + width * .018 + dateWidth / 2, cardY + cardHeight * .7, dateWidth * .8)
      }

      const textX = left + width * .018 + dateWidth + width * .035
      const textWidth = contentWidth - dateWidth - width * .085
      context.textAlign = 'left'
      context.fillStyle = palette.text
      context.font = `900 ${Math.round(width * .034)}px Arial, sans-serif`
      context.fillText(item.title, textX, cardY + cardHeight * .35, textWidth)
      context.fillStyle = palette.accent
      context.font = `700 ${Math.round(width * .024)}px Arial, sans-serif`
      context.fillText(item.locationText, textX, cardY + cardHeight * .68, textWidth)
    })
  }

  if (isVisible(design, 'cta') && design.ctaText.trim()) {
    const ctaY = height - safe.bottom - width * .085
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillStyle = palette.accent
    context.shadowColor = palette.shadow
    context.shadowBlur = 16
    context.font = `900 italic ${Math.round(width * .042)}px Arial, sans-serif`
    context.fillText(design.ctaText.toUpperCase(), width / 2, ctaY, contentWidth * .85)
    context.shadowBlur = 0
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
