import {
  coverImageRect,
  postPresetSize,
  safeAreaInsets,
  type PostBrandPreset,
  type PostDesign,
} from '../../shared/post-generator'

type Palette = {
  text: string
  accent: string
  shadow: string
  overlay: string
  panel: string
}

const palettes: Record<PostBrandPreset, Palette> = {
  night: {
    text: '#ffffff',
    accent: '#b18cff',
    shadow: 'rgba(0,0,0,.6)',
    overlay: '#09070d',
    panel: 'rgba(12,9,18,.72)',
  },
  mono: {
    text: '#ffffff',
    accent: '#ffffff',
    shadow: 'rgba(0,0,0,.72)',
    overlay: '#000000',
    panel: 'rgba(0,0,0,.7)',
  },
  warm: {
    text: '#fffaf5',
    accent: '#ff765c',
    shadow: 'rgba(26,8,3,.62)',
    overlay: '#1e0b06',
    panel: 'rgba(35,11,5,.68)',
  },
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

function drawTextBlock(
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
  const headlineLines = wrapLines(context, design.headline || 'YOUR NIGHT. YOUR SOUND.', maxWidth, design.preset === 'story' ? 5 : 4)
  const headlineLineHeight = Math.round(headlineSize * .92)

  context.font = `600 ${Math.round(headlineSize * .34)}px Arial, sans-serif`
  const sublineLines = wrapLines(context, design.subline, maxWidth, 3)
  const sublineLineHeight = Math.round(headlineSize * .43)
  const metaSize = Math.round(headlineSize * .27)
  const metaCount = [design.dateText, design.locationText].filter(Boolean).length
  const blockHeight = headlineLines.length * headlineLineHeight
    + (sublineLines.length ? 28 + sublineLines.length * sublineLineHeight : 0)
    + (metaCount ? 42 + metaSize * 1.25 : 0)

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

  if (metaCount) {
    y += 42
    context.shadowBlur = 10
    context.fillStyle = palette.accent
    context.font = `800 ${metaSize}px Arial, sans-serif`
    const meta = [design.dateText, design.locationText].filter(Boolean).join('  ·  ').toUpperCase()
    context.fillText(meta, x, y, maxWidth)
  }

  context.shadowBlur = 0
  context.globalAlpha = 1
}

function drawBrand(context: CanvasRenderingContext2D, design: PostDesign, width: number, palette: Palette) {
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
  drawTemplateOverlay(context, design, size.width, size.height, palette)
  drawBrand(context, design, size.width, palette)
  drawTextBlock(context, design, size.width, size.height, palette)

  if (showGuides && design.showSafeArea) drawSafeArea(context, design, size.width, size.height)
}
