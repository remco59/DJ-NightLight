// NightLight motion graphics templates. A template is a reusable, locked
// animated layout (like a Premiere MOGRT) with a small set of editable fields
// and controlled style options. The Remotion side lives in
// remotion/motion-templates.tsx and must implement every key listed here.

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

export type TemplateFieldKind = 'text' | 'textarea' | 'list' | 'asset' | 'assets'

export type TemplateField = {
  key: string
  label: string
  kind: TemplateFieldKind
  maxLength?: number
  maxItems?: number
  placeholder?: string
}

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
  fields: TemplateField[]
  defaults: TemplateProps
}

const text = (key: string, label: string, maxLength = 120, placeholder?: string): TemplateField => ({ key, label, kind: 'text', maxLength, placeholder })

export const MOTION_TEMPLATES: Record<MotionTemplateKey, MotionTemplateDefinition> = {
  'gig-announcement': {
    key: 'gig-announcement',
    label: 'Gig Announcement',
    description: 'Big rough headline with date, time and venue blocks.',
    category: 'Announce',
    defaultDurationSeconds: 6,
    defaultAccent: 'neon-purple',
    defaultEntrance: 'fade-slide-up',
    defaultExit: 'fade',
    fields: [
      text('headline', 'Headline', 60),
      text('venue', 'Venue', 60),
      text('date', 'Date', 40),
      text('time', 'Time', 40),
      text('location', 'Location', 60),
      text('cta', 'CTA', 60),
    ],
    defaults: {
      headline: 'DIT WEEKEND',
      venue: 'CLUB NOVA',
      date: 'ZAT 26 APR',
      time: '22:00 - 04:00',
      location: 'Amsterdam',
      cta: 'SEE YOU THERE',
    },
  },
  'recap-intro': {
    key: 'recap-intro',
    label: 'Recap Intro',
    description: 'Opening title for an aftermovie or night recap.',
    category: 'Recap',
    defaultDurationSeconds: 3,
    defaultAccent: 'hot-pink',
    defaultEntrance: 'zoom',
    defaultExit: 'whip',
    fields: [
      text('kicker', 'Kicker', 40),
      text('headline', 'Headline', 60),
      text('meta', 'Date / venue', 80),
    ],
    defaults: { kicker: 'RECAP', headline: 'WHAT A NIGHT', meta: 'CLUB NOVA · 26.04' },
  },
  'upcoming-gigs': {
    key: 'upcoming-gigs',
    label: 'Upcoming Gigs',
    description: 'Agenda list with up to six dates.',
    category: 'Announce',
    defaultDurationSeconds: 6,
    defaultAccent: 'neon-purple',
    defaultEntrance: 'fade-slide-up',
    defaultExit: 'fade',
    fields: [
      text('headline', 'Headline', 40),
      text('kicker', 'Kicker', 40),
      { key: 'gigs', label: 'Gigs (date | title | place)', kind: 'list', maxItems: 6, maxLength: 120, placeholder: '06 DEC | Club Nova | Amsterdam' },
      text('cta', 'CTA', 60),
    ],
    defaults: {
      headline: 'UPCOMING',
      kicker: 'DJ NIGHTLIGHT',
      gigs: [
        '06 DEC | Eredivisie Dames | VC Sneek',
        '17 DEC | Tjas & Skeuvel | Collabo',
        '27 DEC | ’T Portiertje | Uitgeest',
      ],
      cta: 'BOOK NOW',
    },
  },
  'logo-sting': {
    key: 'logo-sting',
    label: 'DJ NightLight Logo Sting',
    description: 'Short waveform logo reveal for intros and outros.',
    category: 'Brand',
    defaultDurationSeconds: 2.5,
    defaultAccent: 'neon-purple',
    defaultEntrance: 'zoom',
    defaultExit: 'fade',
    fields: [
      text('title', 'Title', 40),
      text('tagline', 'Tagline', 60),
    ],
    defaults: { title: 'DJ NightLight', tagline: 'CREATE · PLAY · SHARE' },
  },
  'lower-third': {
    key: 'lower-third',
    label: 'Lower Third',
    description: 'Name and role bar for the lower part of the frame.',
    category: 'Titles',
    defaultDurationSeconds: 4,
    defaultAccent: 'neon-purple',
    defaultEntrance: 'whip',
    defaultExit: 'whip',
    fields: [
      text('title', 'Title', 50),
      text('subtitle', 'Subtitle', 70),
    ],
    defaults: { title: 'DJ NIGHTLIGHT', subtitle: 'Live at Club Nova' },
  },
  'hype-title': {
    key: 'hype-title',
    label: 'Hype Title',
    description: 'Huge punchy words that hit on the beat.',
    category: 'Titles',
    defaultDurationSeconds: 3,
    defaultAccent: 'hot-pink',
    defaultEntrance: 'glitch',
    defaultExit: 'zoom-out',
    fields: [
      { key: 'lines', label: 'Lines (one per row)', kind: 'list', maxItems: 4, maxLength: 30, placeholder: 'LOUDER' },
    ],
    defaults: { lines: ['GOOD MUSIC', 'BIGGER', 'PEOPLE'] },
  },
  'photo-drop': {
    key: 'photo-drop',
    label: 'Photo Drop',
    description: 'Polaroid-style photo that drops in with a caption.',
    category: 'Recap',
    defaultDurationSeconds: 3,
    defaultAccent: 'neon-purple',
    defaultEntrance: 'fade-slide-up',
    defaultExit: 'fade',
    fields: [
      { key: 'photo', label: 'Photo', kind: 'asset' },
      text('caption', 'Caption', 60),
    ],
    defaults: { photo: '', caption: 'MUSIC · PEOPLE · BETTER DAYS' },
  },
  'clip-recap': {
    key: 'clip-recap',
    label: 'Clip Recap',
    description: '3–5 photos or clips cut together with a title overlay.',
    category: 'Recap',
    defaultDurationSeconds: 6,
    defaultAccent: 'neon-purple',
    defaultEntrance: 'fade',
    defaultExit: 'fade',
    fields: [
      text('title', 'Title', 50),
      { key: 'media', label: 'Media (3–5)', kind: 'assets', maxItems: 5 },
    ],
    defaults: { title: 'LAST NIGHT', media: [] },
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
    fields: [
      text('headline', 'Headline', 30),
      text('day', 'Day', 4),
      text('month', 'Month', 10),
      text('venue', 'Venue', 50),
      text('time', 'Time', 30),
      text('cta', 'CTA', 40),
    ],
    defaults: {
      headline: 'DEZE ZATERDAG',
      day: '26',
      month: 'APR',
      venue: 'CLUB NOVA · AMSTERDAM',
      time: '22:00 – 04:00',
      cta: 'TICKETS VIA BIO',
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
    fields: [
      text('word', 'Flash word (optional)', 14),
    ],
    defaults: { word: '' },
  },
  'neon-outro': {
    key: 'neon-outro',
    label: 'Neon Outro',
    description: 'End card with the real logo, headline between its rules, handle and booking line.',
    category: 'Brand',
    defaultDurationSeconds: 4,
    defaultAccent: 'ultraviolet',
    defaultEntrance: 'none',
    defaultExit: 'fade',
    fields: [
      text('headline', 'Headline', 24),
      text('handle', 'Handle', 40),
      text('website', 'Website / booking', 50),
    ],
    defaults: { headline: 'BLIJF GELADEN', handle: '@dj_nightlight', website: 'BOEKINGEN · DJNIGHTLIGHT.NL' },
  },
}

export function motionTemplate(key: string): MotionTemplateDefinition | null {
  return (MOTION_TEMPLATES as Record<string, MotionTemplateDefinition>)[key] || null
}

export function textProp(props: TemplateProps, key: string) {
  const value = props[key]
  return typeof value === 'string' ? value : ''
}

export function listProp(props: TemplateProps, key: string) {
  const value = props[key]
  return Array.isArray(value) ? value.filter(item => typeof item === 'string') : []
}

/** Splits an Upcoming Gigs row in the "date | title | place" notation. */
export function parseGigRow(row: string) {
  const [date = '', title = '', place = ''] = row.split('|').map(part => part.trim())
  return { date, title, place }
}
