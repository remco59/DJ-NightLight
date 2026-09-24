// NightLight motion graphics templates. A template is a reusable, locked
// animated layout (like a Premiere MOGRT) with a small set of editable fields
// and controlled style options. The Remotion side lives in
// remotion/motion-templates.tsx and must implement every key listed here.

import { isLucideIcon, type LucideIconName } from './lucide-icons'

export const MOTION_TEMPLATE_KEYS = [
  'gig-announcement',
  'recap-intro',
  'upcoming-gigs',
  'logo-sting',
  'lower-third',
  'hype-title',
  'photo-drop',
  'clip-recap',
  'neon-logo-reveal',
  'lightning-banner',
  'electric-gig-poster',
  'now-playing',
  'bolt-transition',
  'neon-outro',
] as const
export type MotionTemplateKey = typeof MOTION_TEMPLATE_KEYS[number]

export const MOTION_ACCENTS = {
  'neon-purple': { label: 'Neon Purple', accent: '#a855f7', soft: '#d8b4fe', glow: '#7c3aed' },
  // Matches the NightLight logo: white-to-violet type, violet neon rules.
  'ultraviolet': { label: 'Ultraviolet', accent: '#9d5cff', soft: '#eadcff', glow: '#6d28d9' },
  'hot-pink': { label: 'Hot Pink', accent: '#ff2d95', soft: '#ffb3d9', glow: '#db2777' },
  'electric-blue': { label: 'Electric Blue', accent: '#38bdf8', soft: '#bae6fd', glow: '#0284c7' },
  'sunset': { label: 'Sunset', accent: '#ff8d58', soft: '#ffc2a4', glow: '#ea580c' },
  'mono': { label: 'Mono', accent: '#ffffff', soft: '#d7d3dc', glow: '#71717a' },
} as const
export type MotionAccent = keyof typeof MOTION_ACCENTS
export const MOTION_ACCENT_KEYS = Object.keys(MOTION_ACCENTS) as MotionAccent[]

export const ENTRANCE_ANIMATIONS = {
  'none': 'None',
  'fade': 'Fade',
  'fade-slide-up': 'Fade + Slide Up',
  'zoom': 'Zoom In',
  'whip': 'Whip',
  'glitch': 'Glitch',
} as const
export type EntranceAnimation = keyof typeof ENTRANCE_ANIMATIONS
export const ENTRANCE_ANIMATION_KEYS = Object.keys(ENTRANCE_ANIMATIONS) as EntranceAnimation[]

export const EXIT_ANIMATIONS = {
  'none': 'None',
  'fade': 'Fade Out',
  'slide-down': 'Fade + Slide Down',
  'zoom-out': 'Zoom Out',
  'whip': 'Whip',
  'glitch': 'Glitch',
} as const
export type ExitAnimation = keyof typeof EXIT_ANIMATIONS
export const EXIT_ANIMATION_KEYS = Object.keys(EXIT_ANIMATIONS) as ExitAnimation[]

/** How a template treats the footage behind it; strength is set per item. */
export const BACKDROP_STYLES = {
  dim: 'Dark',
  blur: 'Blur',
  gradient: 'Gradient',
} as const
export type BackdropStyle = keyof typeof BACKDROP_STYLES
export const BACKDROP_STYLE_KEYS = Object.keys(BACKDROP_STYLES) as BackdropStyle[]

export type TemplateFieldKind = 'text' | 'textarea' | 'list' | 'asset' | 'assets' | 'icon'

/**
 * One input of a structured list row. Rows are stored as "a | b | c"; `slot`
 * is the position in that string, so new columns can be appended without
 * breaking saved rows. Columns are listed in the order the editor shows them.
 */
export type TemplateColumn = {
  key: string
  label: string
  slot: number
  maxLength: number
  placeholder?: string
  /** Takes the full width of the row in the editor. */
  wide?: boolean
}

export type TemplateField = {
  key: string
  label: string
  kind: TemplateFieldKind
  maxLength?: number
  maxItems?: number
  placeholder?: string
  /** Edit each list row as separate inputs instead of one text field. */
  columns?: TemplateColumn[]
}

/** Upcoming Gigs rows: "date | title | place | day | time"; day and time are optional. */
export const GIG_ROW_COLUMNS: TemplateColumn[] = [
  { key: 'day', label: 'Day', slot: 3, maxLength: 6, placeholder: 'ZA' },
  { key: 'date', label: 'Date', slot: 0, maxLength: 12, placeholder: '06 DEC' },
  { key: 'time', label: 'Time', slot: 4, maxLength: 16, placeholder: '22:00' },
  { key: 'title', label: 'Title', slot: 1, maxLength: 50, placeholder: 'Club Nova', wide: true },
  { key: 'place', label: 'Place', slot: 2, maxLength: 50, placeholder: 'Amsterdam', wide: true },
]

export type TemplateFieldValue = string | string[]
export type TemplateProps = Record<string, TemplateFieldValue>

export type MotionTemplateDefinition = {
  key: MotionTemplateKey
  label: string
  description: string
  category: 'Announce' | 'Titles' | 'Brand' | 'Recap'
  defaultDurationSeconds: number
  defaultAccent: MotionAccent
  defaultEntrance: EntranceAnimation
  defaultExit: ExitAnimation
  /** Default darkening (0–1) of the footage behind the template; adjustable per item. */
  defaultBackdrop: number
  fields: TemplateField[]
  defaults: TemplateProps
}

const text = (key: string, label: string, maxLength = 120, placeholder?: string): TemplateField => ({ key, label, kind: 'text', maxLength, placeholder })
/** A Lucide icon the user can swap, or hide with an empty value. */
const icon = (key: string, label: string): TemplateField => ({ key, label, kind: 'icon' })

export const MOTION_TEMPLATES: Record<MotionTemplateKey, MotionTemplateDefinition> = {
  'gig-announcement': {
    key: 'gig-announcement',
    label: 'Gig Announcement',
    description: 'Logo header, headline words slamming in over the logo\'s neon rule, date, time and venue.',
    category: 'Announce',
    defaultDurationSeconds: 6,
    defaultAccent: 'ultraviolet',
    defaultEntrance: 'fade-slide-up',
    defaultExit: 'fade',
    defaultBackdrop: 0.45,
    fields: [
      text('headline', 'Headline', 60),
      text('venue', 'Venue', 60),
      text('date', 'Date', 40),
      icon('dateIcon', 'Date icon'),
      text('time', 'Time', 40),
      icon('timeIcon', 'Time icon'),
      text('location', 'Location', 60),
      icon('venueIcon', 'Venue icon'),
      text('cta', 'CTA', 60),
      icon('ctaIcon', 'CTA icon'),
    ],
    defaults: {
      headline: 'DIT WEEKEND',
      venue: 'CLUB NOVA',
      date: 'ZAT 26 APR',
      dateIcon: 'calendar',
      time: '22:00 - 04:00',
      timeIcon: 'clock',
      location: 'Amsterdam',
      venueIcon: 'map-pin',
      cta: 'TOT DAN',
      ctaIcon: 'arrow-right',
    },
  },
  'recap-intro': {
    key: 'recap-intro',
    label: 'Recap Intro',
    description: 'Opening title for an aftermovie, with a glitching headline and the logo\'s arcs.',
    category: 'Recap',
    defaultDurationSeconds: 3,
    defaultAccent: 'ultraviolet',
    defaultEntrance: 'zoom',
    defaultExit: 'whip',
    defaultBackdrop: 0.35,
    fields: [
      text('kicker', 'Kicker', 40),
      text('headline', 'Headline', 60),
      text('meta', 'Date / venue', 80),
    ],
    defaults: { kicker: 'TERUGBLIK', headline: 'WAT EEN AVOND', meta: 'CLUB NOVA · 26.04' },
  },
  'upcoming-gigs': {
    key: 'upcoming-gigs',
    label: 'Upcoming Gigs',
    description: 'Agenda of up to six dates under a headline between the logo\'s rules.',
    category: 'Announce',
    defaultDurationSeconds: 6,
    defaultAccent: 'ultraviolet',
    defaultEntrance: 'fade-slide-up',
    defaultExit: 'fade',
    defaultBackdrop: 0.5,
    fields: [
      text('headline', 'Headline', 40),
      text('kicker', 'Kicker', 40),
      { key: 'gigs', label: 'Gigs', kind: 'list', maxItems: 6, maxLength: 160, columns: GIG_ROW_COLUMNS },
      icon('dateIcon', 'Date icon'),
      icon('timeIcon', 'Time icon'),
      icon('placeIcon', 'Place icon'),
      text('cta', 'CTA', 60),
      icon('ctaIcon', 'CTA icon'),
    ],
    defaults: {
      headline: 'BINNENKORT',
      kicker: 'DJ NIGHTLIGHT',
      gigs: [
        '06 DEC | Eredivisie Dames | VC Sneek | ZO | 20:00',
        '17 DEC | Tjas & Skeuvel | Collabo | DO | 21:00',
        '27 DEC | ’T Portiertje | Uitgeest | ZO | 16:00',
      ],
      dateIcon: 'calendar',
      timeIcon: 'clock',
      placeIcon: 'map-pin',
      cta: 'BOEK NU',
      ctaIcon: 'arrow-right',
    },
  },
  'logo-sting': {
    key: 'logo-sting',
    label: 'DJ NightLight Logo Sting',
    description: 'Fast build of the real wordmark with a bolt flash and waveform, for intros and outros.',
    category: 'Brand',
    defaultDurationSeconds: 2.5,
    defaultAccent: 'ultraviolet',
    defaultEntrance: 'zoom',
    defaultExit: 'fade',
    defaultBackdrop: 0.4,
    fields: [
      text('title', 'Kicker', 40),
      text('tagline', 'Tagline', 60),
    ],
    defaults: { title: 'DJ', tagline: 'MAKEN · DRAAIEN · DELEN' },
  },
  'lower-third': {
    key: 'lower-third',
    label: 'Lower Third',
    description: 'The logo emblem with a name between its neon rules and a role underneath.',
    category: 'Titles',
    defaultDurationSeconds: 4,
    defaultAccent: 'ultraviolet',
    defaultEntrance: 'whip',
    defaultExit: 'whip',
    defaultBackdrop: 0,
    fields: [
      text('title', 'Title', 50),
      text('subtitle', 'Subtitle', 70),
    ],
    defaults: { title: 'DJ NIGHTLIGHT', subtitle: 'Live in Club Nova' },
  },
  'hype-title': {
    key: 'hype-title',
    label: 'Hype Title',
    description: 'Huge punchy words that hit on the beat with the logo\'s arcs.',
    category: 'Titles',
    defaultDurationSeconds: 3,
    defaultAccent: 'ultraviolet',
    defaultEntrance: 'glitch',
    defaultExit: 'zoom-out',
    defaultBackdrop: 0.35,
    fields: [
      { key: 'lines', label: 'Lines (one per row)', kind: 'list', maxItems: 4, maxLength: 30, placeholder: 'HARDER' },
    ],
    defaults: { lines: ['GOEIE MUZIEK', 'HARDER', 'SAMEN'] },
  },
  'photo-drop': {
    key: 'photo-drop',
    label: 'Photo Drop',
    description: 'Polaroid that drops in, lights up with an electric edge and carries a caption.',
    category: 'Recap',
    defaultDurationSeconds: 3,
    defaultAccent: 'ultraviolet',
    defaultEntrance: 'fade-slide-up',
    defaultExit: 'fade',
    defaultBackdrop: 0.35,
    fields: [
      { key: 'photo', label: 'Photo', kind: 'asset' },
      text('caption', 'Caption', 60),
    ],
    defaults: { photo: '', caption: 'MUZIEK · MENSEN · BETERE DAGEN' },
  },
  'clip-recap': {
    key: 'clip-recap',
    label: 'Clip Recap',
    description: '3–5 photos or clips cut together with bolt flashes and a title between the logo\'s rules.',
    category: 'Recap',
    defaultDurationSeconds: 6,
    defaultAccent: 'ultraviolet',
    defaultEntrance: 'fade',
    defaultExit: 'fade',
    defaultBackdrop: 0,
    fields: [
      text('title', 'Title', 50),
      { key: 'media', label: 'Media (3–5)', kind: 'assets', maxItems: 5 },
    ],
    defaults: { title: 'GISTERAVOND', media: [] },
  },
  'neon-logo-reveal': {
    key: 'neon-logo-reveal',
    label: 'Neon Logo Reveal',
    description: 'Your real logo builds up: ring draws, letters slam in, bolt strikes, arcs crackle.',
    category: 'Brand',
    defaultDurationSeconds: 3.5,
    defaultAccent: 'ultraviolet',
    defaultEntrance: 'none',
    defaultExit: 'fade',
    defaultBackdrop: 0.45,
    fields: [
      text('tagline', 'Tagline', 50),
    ],
    defaults: { tagline: 'DJ · LIVE · ENERGIE' },
  },
  'lightning-banner': {
    key: 'lightning-banner',
    label: 'Lightning Banner',
    description: 'Your title between the logo\'s own neon rules, with its bolt and arcs.',
    category: 'Titles',
    defaultDurationSeconds: 4,
    defaultAccent: 'ultraviolet',
    defaultEntrance: 'none',
    defaultExit: 'whip',
    defaultBackdrop: 0.4,
    fields: [
      text('title', 'Title', 24),
      text('subtitle', 'Subtitle', 60),
    ],
    defaults: { title: 'VANAVOND LIVE', subtitle: 'DJ NIGHTLIGHT OP DE DECKS' },
  },
  'electric-gig-poster': {
    key: 'electric-gig-poster',
    label: 'Electric Gig Poster',
    description: 'Logo header, date inside the logo ring, headline between the logo rules.',
    category: 'Announce',
    defaultDurationSeconds: 6,
    defaultAccent: 'ultraviolet',
    defaultEntrance: 'none',
    defaultExit: 'fade',
    defaultBackdrop: 0.5,
    fields: [
      text('headline', 'Headline', 30),
      text('day', 'Day', 4),
      text('month', 'Month', 10),
      text('venue', 'Venue', 50),
      icon('venueIcon', 'Venue icon'),
      text('time', 'Time', 30),
      icon('timeIcon', 'Time icon'),
      text('cta', 'CTA', 40),
      icon('ctaIcon', 'CTA icon'),
    ],
    defaults: {
      headline: 'DEZE ZATERDAG',
      day: '26',
      month: 'APR',
      venue: 'CLUB NOVA · AMSTERDAM',
      venueIcon: 'map-pin',
      time: '22:00 – 04:00',
      timeIcon: 'clock',
      cta: 'TICKETS VIA BIO',
      ctaIcon: 'arrow-right',
    },
  },
  'now-playing': {
    key: 'now-playing',
    label: 'Now Playing',
    description: 'Track ID between the logo\'s neon rules, with its bolt and live EQ bars.',
    category: 'Titles',
    defaultDurationSeconds: 5,
    defaultAccent: 'ultraviolet',
    defaultEntrance: 'whip',
    defaultExit: 'whip',
    defaultBackdrop: 0,
    fields: [
      text('label', 'Label', 24),
      text('artist', 'Artist', 40),
      text('track', 'Track', 60),
    ],
    defaults: { label: 'NU TE HOREN', artist: 'DJ NIGHTLIGHT', track: 'Midnight Voltage (Extended Mix)' },
  },
  'bolt-transition': {
    key: 'bolt-transition',
    label: 'Bolt Transition',
    description: 'The logo\'s bolt strikes with its arcs and a flash that hides a cut.',
    category: 'Brand',
    defaultDurationSeconds: 1,
    defaultAccent: 'ultraviolet',
    defaultEntrance: 'none',
    defaultExit: 'none',
    defaultBackdrop: 0,
    fields: [
      text('word', 'Flash word (optional)', 14),
    ],
    defaults: { word: '' },
  },
  'neon-outro': {
    key: 'neon-outro',
    label: 'Neon Outro',
    description: 'End card with the real logo, headline between its rules, handle and website.',
    category: 'Brand',
    defaultDurationSeconds: 4,
    defaultAccent: 'ultraviolet',
    defaultEntrance: 'none',
    defaultExit: 'fade',
    defaultBackdrop: 0.5,
    fields: [
      text('headline', 'Headline', 24),
      text('handle', 'Handle', 40),
      icon('handleIcon', 'Handle icon'),
      text('website', 'Website', 50),
      icon('websiteIcon', 'Website icon'),
    ],
    defaults: {
      headline: 'ALTIJD FEEST!',
      handle: 'dj_nightlight',
      handleIcon: 'instagram',
      website: 'DJNIGHTLIGHT.NL',
      websiteIcon: 'globe',
    },
  },
}

export function motionTemplate(key: string): MotionTemplateDefinition | null {
  return (MOTION_TEMPLATES as Record<string, MotionTemplateDefinition>)[key] || null
}

export function textProp(props: TemplateProps, key: string) {
  const value = props[key]
  return typeof value === 'string' ? value : ''
}

/**
 * The icon a template draws for `key`, or null when the user hid it. Projects
 * saved before the icon became editable fall back to the template default.
 */
export function iconProp(templateKey: MotionTemplateKey, props: TemplateProps, key: string): LucideIconName | null {
  const value = props[key] ?? MOTION_TEMPLATES[templateKey]?.defaults[key]
  return isLucideIcon(value) ? value : null
}

export function listProp(props: TemplateProps, key: string) {
  const value = props[key]
  return Array.isArray(value) ? value.filter(item => typeof item === 'string') : []
}

/**
 * Splits a structured list row into its columns for editing. Only the single
 * space either side of each separator is removed, so a value keeps the spaces
 * someone is still typing.
 */
export function splitListRow(row: string, columns: TemplateColumn[]) {
  const parts = row.split('|').map(part => part.replace(/^ /, '').replace(/ $/, ''))
  return Object.fromEntries(columns.map(column => [column.key, parts[column.slot] ?? ''])) as Record<string, string>
}

/** Joins edited columns back into a row; empty trailing columns are dropped. */
export function joinListRow(values: Record<string, string>, columns: TemplateColumn[]) {
  const parts: string[] = []
  for (const column of columns) parts[column.slot] = (values[column.key] || '').replaceAll('|', '/')
  const filled = Array.from(parts, part => part ?? '')
  while (filled.length && !filled[filled.length - 1]!.trim()) filled.pop()
  return filled.join(' | ')
}

/** Splits an Upcoming Gigs row in the "date | title | place | day | time" notation. */
export function parseGigRow(row: string) {
  const values = splitListRow(row, GIG_ROW_COLUMNS)
  const [date, title, place, day, time] = ['date', 'title', 'place', 'day', 'time'].map(key => values[key]!.trim()) as [string, string, string, string, string]
  return { date, title, place, day, time }
}
