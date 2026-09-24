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


export function postImageDragDelta(input: {
  deltaX: number
  deltaY: number
  displayWidth: number
  displayHeight: number
  targetWidth: number
  targetHeight: number
  renderedWidth: number
  renderedHeight: number
}) {
  const scaleX = input.targetWidth > 0 ? input.displayWidth / input.targetWidth : 0
  const scaleY = input.targetHeight > 0 ? input.displayHeight / input.targetHeight : 0
  const overflowX = Math.max(0, input.renderedWidth - input.targetWidth)
  const overflowY = Math.max(0, input.renderedHeight - input.targetHeight)

  return {
    x: overflowX > 0 && scaleX > 0 ? (input.deltaX * 2) / (overflowX * scaleX) : 0,
    y: overflowY > 0 && scaleY > 0 ? (input.deltaY * 2) / (overflowY * scaleY) : 0,
  }
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
    throw new Error('Afmetingen van de afbeelding moeten positief zijn')
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

export const POST_BRAND_PRESETS = ['night', 'mono', 'warm'] as const

export type PostTemplateCategory = 'Algemeen' | 'Minimaal' | 'Aankondigingen' | 'Terugblikken' | 'Aankomende gigs'

/** Text fields the editor exposes; each template renders a subset of them. */
export type PostTextField = 'headline' | 'subline' | 'date' | 'time' | 'location' | 'cta' | 'gigList'

export type PostTemplateInfo = {
  key: PostTemplateKey
  label: string
  description: string
  category: PostTemplateCategory
  /** Text fields the renderer draws for this template. */
  fields: PostTextField[]
  /** Whether the renderer honours `textAlign` / `textPosition`. */
  flexibleText: boolean
  /** What the overlay-strength control changes for this template. */
  overlay: string
}

const FLEXIBLE_FIELDS: PostTextField[] = ['headline', 'subline', 'date', 'time', 'location', 'cta']

export const POST_TEMPLATES: PostTemplateInfo[] = [
  { key: 'gradient', label: 'Gradient', description: 'Sfeervolle foto met filmische fade.', category: 'Algemeen', fields: FLEXIBLE_FIELDS, flexibleText: true, overlay: 'Filmische fade achter de tekst.' },
  { key: 'poster', label: 'Poster', description: 'Krachtige eventposter met kader.', category: 'Algemeen', fields: FLEXIBLE_FIELDS, flexibleText: true, overlay: 'Donkere laag onder het posterkader.' },
  { key: 'minimal', label: 'Minimaal', description: 'Strak redactioneel paneel.', category: 'Minimaal', fields: FLEXIBLE_FIELDS, flexibleText: true, overlay: 'Dekking van het redactionele zijpaneel.' },
  { key: 'gig-announcement', label: 'Gig-aankondiging', description: 'Krachtige eventpromo met datum, tijd, locatie en CTA.', category: 'Aankondigingen', fields: ['headline', 'subline', 'date', 'time', 'location', 'cta'], flexibleText: false, overlay: 'Sterkte van de campagnetextuur en gloed.' },
  { key: 'recap', label: 'Recap', description: 'Energieke terugblik na een event, geïnspireerd op Sneekweek.', category: 'Terugblikken', fields: ['headline', 'subline', 'date', 'location', 'cta'], flexibleText: false, overlay: 'Sterkte van de campagnetextuur en gloed.' },
  { key: 'upcoming-gigs', label: 'Aankomende gigs', description: 'Planningslayout met een bewerkbare lijst van aankomende data.', category: 'Aankomende gigs', fields: ['headline', 'subline', 'gigList', 'cta'], flexibleText: false, overlay: 'Sterkte van de campagnetextuur en gloed.' },
]

export function postTemplateInfo(key: PostTemplateKey) {
  return POST_TEMPLATES.find(template => template.key === key) ?? POST_TEMPLATES[0]!
}

export function defaultPostDesign(): PostDesign {
  return {
    preset: 'square',
    templateKey: 'gradient',
    brandPreset: 'night',
    headline: 'JOUW AVOND. JOUW SOUND.',
    subline: 'DJ NightLight · allround DJ',
    dateText: '',
    timeText: '',
    locationText: '',
    ctaText: '',
    logoText: 'NIGHTLIGHT',
    visibility: defaultPostVisibility(),
    gigItems: defaultPostGigItems(),
    imageX: 0,
    imageY: 0,
    zoom: 1,
    overlayOpacity: .72,
    textAlign: 'left',
    textPosition: 'bottom',
    showSafeArea: true,
  }
}

type TemplateCopyField = 'headline' | 'subline' | 'dateText' | 'timeText' | 'locationText' | 'ctaText'

type TemplateDefaults = {
  copy: Record<TemplateCopyField, string>
  hidden: Array<keyof PostFieldVisibility>
}

// Campaign templates own their composition (story format, centred text) and
// come with sample copy; the flexible templates only swap the visual style.
const CAMPAIGN_TEMPLATE_DEFAULTS: Partial<Record<PostTemplateKey, TemplateDefaults>> = {
  'gig-announcement': {
    copy: { headline: 'DIT WEEKEND', subline: 'DJ NIGHTLIGHT', dateText: '12 DEC', timeText: '22:00 – 02:00', locationText: 'Groningen', ctaText: 'TOT DAN!' },
    hidden: ['gigList'],
  },
  'recap': {
    copy: { headline: 'WAT EEN AVOND', subline: 'TERUGBLIK', dateText: '05 AUG', timeText: '', locationText: 'Sneekweek · Sneek', ctaText: 'TOT DE VOLGENDE!' },
    hidden: ['time', 'gigList'],
  },
  'upcoming-gigs': {
    copy: { headline: 'DECEMBER', subline: 'PLANNING', dateText: '', timeText: '', locationText: '', ctaText: 'TOT OP DE DANSVLOER!' },
    hidden: ['date', 'time', 'location'],
  },
}

/** Copy that only ever came from a default or a template sample. */
function isSampleCopy(field: TemplateCopyField, value: string) {
  if (!value.trim()) return true
  if (defaultPostDesign()[field] === value) return true
  return Object.values(CAMPAIGN_TEMPLATE_DEFAULTS).some(defaults => defaults.copy[field] === value)
}

export function clonePostDesign(design: PostDesign): PostDesign {
  return JSON.parse(JSON.stringify(design)) as PostDesign
}

/**
 * Switch template. The template decides the composition (format, visible
 * fields, text layout); copy the user wrote is kept, while empty fields and
 * untouched sample copy take the new template's sample copy.
 */
export function applyPostTemplate(design: PostDesign, templateKey: PostTemplateKey): PostDesign {
  const next = clonePostDesign(design)
  next.templateKey = templateKey
  const defaults = CAMPAIGN_TEMPLATE_DEFAULTS[templateKey]
  if (!defaults) return next

  next.preset = 'story'
  for (const field of Object.keys(defaults.copy) as TemplateCopyField[]) {
    if (isSampleCopy(field, next[field])) next[field] = defaults.copy[field]
  }
  for (const field of Object.keys(next.visibility) as Array<keyof PostFieldVisibility>) {
    next.visibility[field] = !defaults.hidden.includes(field)
  }
  if (templateKey === 'upcoming-gigs' && !next.gigItems.length) next.gigItems = defaultPostGigItems()
  next.textAlign = 'center'
  next.textPosition = 'middle'
  return next
}

function clampNumber(value: unknown, min: number, max: number) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : null
}

function pickEnum<T extends string>(value: unknown, options: readonly T[]) {
  return typeof value === 'string' && (options as readonly string[]).includes(value) ? value as T : null
}

/**
 * Load a design stored with a generated post back into the editor. Stored
 * metadata is untrusted JSON, so every field is validated and anything
 * missing or invalid keeps its value from `base`.
 */
export function restorePostDesign(base: PostDesign, stored: unknown): PostDesign {
  const next = clonePostDesign(base)
  if (!stored || typeof stored !== 'object') return next
  const source = stored as Record<string, unknown>

  next.preset = pickEnum(source.preset, Object.keys(POST_PRESETS) as PostPreset[]) ?? next.preset
  next.templateKey = pickEnum(source.templateKey, POST_TEMPLATE_KEYS) ?? next.templateKey
  next.brandPreset = pickEnum(source.brandPreset, POST_BRAND_PRESETS) ?? next.brandPreset
  next.textAlign = pickEnum(source.textAlign, ['left', 'center', 'right'] as const) ?? next.textAlign
  next.textPosition = pickEnum(source.textPosition, ['top', 'middle', 'bottom'] as const) ?? next.textPosition

  for (const field of ['headline', 'subline', 'dateText', 'timeText', 'locationText', 'ctaText', 'logoText'] as const) {
    if (typeof source[field] === 'string') next[field] = source[field]
  }

  next.imageX = clampNumber(source.imageX, -1, 1) ?? next.imageX
  next.imageY = clampNumber(source.imageY, -1, 1) ?? next.imageY
  next.zoom = clampNumber(source.zoom, 1, 3) ?? next.zoom
  next.overlayOpacity = clampNumber(source.overlayOpacity, 0, .9) ?? next.overlayOpacity

  if (source.visibility && typeof source.visibility === 'object') {
    const visibility = source.visibility as Record<string, unknown>
    for (const field of Object.keys(next.visibility) as Array<keyof PostFieldVisibility>) {
      if (typeof visibility[field] === 'boolean') next.visibility[field] = visibility[field]
    }
  }

  if (Array.isArray(source.gigItems)) {
    next.gigItems = source.gigItems
      .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
      .slice(0, 6)
      .map(item => ({
        enabled: typeof item.enabled === 'boolean' ? item.enabled : true,
        dateText: typeof item.dateText === 'string' ? item.dateText : '',
        title: typeof item.title === 'string' ? item.title : '',
        locationText: typeof item.locationText === 'string' ? item.locationText : '',
      }))
  }

  return next
}
