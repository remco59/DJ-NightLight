import { z } from 'zod'

const nullableString = (maxLength: number) => z.preprocess(
  value => value ?? '',
  z.string().trim().max(maxLength),
)

const optionalUrl = nullableString(2000).transform((value, ctx) => {
  if (!value) return null
  const parsed = z.url().safeParse(value)
  if (!parsed.success) {
    ctx.addIssue({ code: 'custom', message: 'Enter a valid URL' })
    return z.NEVER
  }
  return parsed.data
})

const internalMediaUrlPattern = /^\/api\/media\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const siteImageUrl = z.string().trim().max(2000).refine(
  value => internalMediaUrlPattern.test(value) || z.url().safeParse(value).success,
  { message: 'Enter a valid image URL' },
)

const optionalImageUrl = nullableString(2000).transform((value, ctx) => {
  if (!value) return null
  const parsed = siteImageUrl.safeParse(value)
  if (!parsed.success) {
    ctx.addIssue({ code: 'custom', message: 'Enter a valid image URL' })
    return z.NEVER
  }
  return parsed.data
})

const optionalEmail = nullableString(320).transform((value, ctx) => {
  if (!value) return null
  const parsed = z.email().safeParse(value)
  if (!parsed.success) {
    ctx.addIssue({ code: 'custom', message: 'Enter a valid email address' })
    return z.NEVER
  }
  return parsed.data.toLowerCase()
})

const optionalPhone = nullableString(64).transform(value => value || null)
const copy = (max = 2000) => z.string().trim().min(1).max(max)
const copyList = (maxItems = 12) => z.array(copy(240)).min(1).max(maxItems)

export const siteServiceSchema = z.object({
  title: copy(160),
  body: copy(1500),
  imageUrl: optionalImageUrl,
  imageAlt: z.string().trim().max(240).default(''),
})

export const siteGalleryItemSchema = z.object({
  url: siteImageUrl,
  alt: z.string().trim().max(240),
})

export const sitePublicCopySchema = z.object({
  navigation: z.object({
    home: copy(80),
    about: copy(80),
    media: copy(80),
    agenda: copy(80),
    booking: copy(80),
    menu: copy(80),
    close: copy(80),
    mobileEyebrow: copy(160),
    mobileBooking: copy(160),
  }),
  footer: z.object({
    eyebrow: copy(240),
    title: copy(400),
    cta: copy(160),
    location: copy(160),
    instagram: copy(80),
    spotify: copy(80),
    email: copy(80),
  }),
  home: z.object({
    secondaryCta: copy(160),
    heroCaption: copy(240),
    scrollLabel: copy(80),
    visualEyebrow: copy(160),
    visualBody: copy(500),
    visualCaption: copy(240),
    aboutCta: copy(160),
    aboutImageCaption: copy(300),
    servicesEyebrow: copy(160),
    servicesBody: copy(500),
    proofEyebrow: copy(160),
    proofQuote: copy(600),
    proofTags: copyList(12),
    bookingCta: copy(160),
  }),
  about: z.object({
    imageEyebrow: copy(160),
    imageCaption: copy(240),
    storyTitle: copy(500),
    storyBody1: copy(1200),
    storyBody2: copy(1200),
    momentEyebrow: copy(160),
    momentQuote: copy(500),
    momentBody: copy(700),
    principlesEyebrow: copy(160),
    principlesTitle: copy(300),
    principles: z.array(z.object({ title: copy(160), body: copy(700) })).min(1).max(8),
    ctaEyebrow: copy(160),
    ctaTitle: copy(400),
    ctaLabel: copy(160),
  }),
  media: z.object({
    typeLabels: copyList(8),
    showreelEyebrow: copy(160),
    showreelExternalLabel: copy(160),
    showreelTitle: copy(240),
    showreelBody: copy(500),
    galleryEyebrow: copy(160),
    imageSingular: copy(80),
    imagePlural: copy(80),
    emptyEyebrow: copy(160),
    emptyTitle: copy(300),
    emptyBody: copy(800),
    emptyMeta: copyList(8),
    closeLabel: copy(80),
  }),
  agenda: z.object({
    statusEyebrow: copy(160),
    loadingLabel: copy(80),
    dateSingular: copy(80),
    datePlural: copy(80),
    statusBody: copy(500),
    emptyMarkerLabel: copy(80),
    emptyEyebrow: copy(160),
    emptyTitle: copy(300),
    emptyBody: copy(900),
    emptyCta: copy(160),
    listEyebrow: copy(160),
    momentSingular: copy(80),
    momentPlural: copy(80),
    footerEyebrow: copy(200),
    footerTitle: copy(300),
    footerBody: copy(600),
    footerCta: copy(160),
  }),
  landing: z.object({
    asideEyebrow: copy(160),
    asideTitle: copy(300),
    asideBody: copy(800),
    asideCta: copy(160),
  }),
  booking: z.object({
    successEyebrow: copy(120),
    successTitle: copy(300),
    successBody: copy(600),
    nameLabel: copy(120),
    companyLabel: copy(120),
    emailLabel: copy(120),
    phoneLabel: copy(120),
    eventTypeLabel: copy(120),
    dateLabel: copy(120),
    locationLabel: copy(120),
    messageLabel: copy(160),
    optionalLabel: copy(80),
    eventTypePlaceholder: copy(240),
    locationPlaceholder: copy(240),
    messagePlaceholder: copy(400),
    submitLabel: copy(160),
    sendingLabel: copy(160),
    errorFallback: copy(500),
  }),
  visuals: z.object({
    homeFeatureImageUrl: optionalImageUrl,
    homeFeatureAlt: z.string().trim().max(240),
    homeAboutImageUrl: optionalImageUrl,
    homeAboutAlt: z.string().trim().max(240),
    aboutLeadImageUrl: optionalImageUrl,
    aboutLeadAlt: z.string().trim().max(240),
    aboutRoomImageUrl: optionalImageUrl,
    aboutRoomAlt: z.string().trim().max(240),
    mediaShowreelImageUrl: optionalImageUrl,
    mediaShowreelAlt: z.string().trim().max(240),
  }),
})

export const siteContentInputSchema = z.object({
  brandName: copy(120),
  heroEyebrow: copy(160),
  heroTitle: copy(300),
  heroBody: copy(3000),
  heroImageUrl: optionalImageUrl,
  heroCtaLabel: copy(120),
  aboutEyebrow: copy(160),
  aboutTitle: copy(300),
  aboutBody: copy(8000),
  mediaEyebrow: copy(160),
  mediaTitle: copy(300),
  mediaBody: copy(4000),
  showreelUrl: optionalUrl,
  agendaEyebrow: copy(160),
  agendaTitle: copy(300),
  agendaBody: copy(4000),
  bookingEyebrow: copy(160),
  bookingTitle: copy(300),
  bookingBody: copy(4000),
  contactEmail: optionalEmail,
  contactPhone: optionalPhone,
  instagramUrl: optionalUrl,
  spotifyUrl: optionalUrl,
  seoTitle: copy(180),
  seoDescription: copy(320),
  seoImageUrl: optionalImageUrl,
  services: z.array(siteServiceSchema).max(12),
  gallery: z.array(siteGalleryItemSchema).max(40),
  publicCopy: sitePublicCopySchema,
})

export type SitePublicCopy = z.infer<typeof sitePublicCopySchema>
export type SiteContentInput = z.infer<typeof siteContentInputSchema>
