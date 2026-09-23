export const POST_PRESETS = {
  square: { label: '1:1', width: 1080, height: 1080 },
  portrait: { label: '4:5', width: 1080, height: 1350 },
  story: { label: '9:16', width: 1080, height: 1920 },
} as const

export const POST_TEMPLATE_KEYS = [
  'gradient',
  'poster',
  'minimal',
  'gig-announcement',
  'recap',
  'upcoming-gigs',
] as const

export type PostPreset = keyof typeof POST_PRESETS
export type PostTemplateKey = typeof POST_TEMPLATE_KEYS[number]
export type PostBrandPreset = 'night' | 'mono' | 'warm'
export type PostTextAlign = 'left' | 'center' | 'right'
export type PostTextPosition = 'top' | 'middle' | 'bottom'

export type PostFieldVisibility = {
  logo: boolean
  headline: boolean
  subline: boolean
  date: boolean
  time: boolean
  location: boolean
  cta: boolean
  gigList: boolean
}

export type PostGigItem = {
  enabled: boolean
  dateText: string
  title: string
  locationText: string
}

export type PostDesign = {
  preset: PostPreset
  templateKey: PostTemplateKey
  brandPreset: PostBrandPreset
  headline: string
  subline: string
  dateText: string
  timeText: string
  locationText: string
  ctaText: string
  logoText: string
  visibility: PostFieldVisibility
  gigItems: PostGigItem[]
  imageX: number
  imageY: number
  zoom: number
  overlayOpacity: number
  textAlign: PostTextAlign
  textPosition: PostTextPosition
  showSafeArea: boolean
}

export function defaultPostVisibility(): PostFieldVisibility {
  return {
    logo: true,
    headline: true,
    subline: true,
    date: true,
    time: true,
    location: true,
    cta: true,
    gigList: true,
  }
}

export function defaultPostGigItems(): PostGigItem[] {
  return [
    { enabled: true, dateText: '06 DEC', title: 'Eredivisie Dames', locationText: 'VC Sneek' },
    { enabled: true, dateText: '10 DEC', title: 'Eredivisie Dames', locationText: 'VC Sneek' },
    { enabled: true, dateText: '17 DEC', title: 'Tjas & Skeuvel', locationText: 'Collabo / Klobenstein' },
    { enabled: true, dateText: '27 DEC', title: '’T Portiertje', locationText: 'Uitgeest' },
  ]
}

export function postPresetSize(preset: PostPreset) {
  return POST_PRESETS[preset]
}

export function coverImageRect(input: {
  sourceWidth: number
  sourceHeight: number
  targetWidth: number
  targetHeight: number
  zoom: number
  imageX: number
  imageY: number
}) {
  const { sourceWidth, sourceHeight, targetWidth, targetHeight } = input
  if (sourceWidth <= 0 || sourceHeight <= 0 || targetWidth <= 0 || targetHeight <= 0) {
    throw new Error('Image dimensions must be positive')
  }
  const zoom = Math.max(1, Math.min(input.zoom, 3))
  const baseScale = Math.max(targetWidth / sourceWidth, targetHeight / sourceHeight)
  const scale = baseScale * zoom
  const width = sourceWidth * scale
  const height = sourceHeight * scale
  const overflowX = Math.max(0, width - targetWidth)
  const overflowY = Math.max(0, height - targetHeight)
  const normalizedX = Math.max(-1, Math.min(1, input.imageX))
  const normalizedY = Math.max(-1, Math.min(1, input.imageY))
  const x = -overflowX / 2 + normalizedX * overflowX / 2
  const y = -overflowY / 2 + normalizedY * overflowY / 2
  return { x, y, width, height }
}

export function safeAreaInsets(preset: PostPreset) {
  if (preset === 'story') return { top: 180, right: 90, bottom: 260, left: 90 }
  if (preset === 'portrait') return { top: 90, right: 80, bottom: 110, left: 80 }
  return { top: 80, right: 80, bottom: 80, left: 80 }
}
