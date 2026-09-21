import { z } from 'zod'

const optionalUrl = z.string().trim().max(2000).optional().transform((value, ctx) => {
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

const optionalImageUrl = z.string().trim().max(2000).optional().transform((value, ctx) => {
  if (!value) return null
  const parsed = siteImageUrl.safeParse(value)
  if (!parsed.success) {
    ctx.addIssue({ code: 'custom', message: 'Enter a valid image URL' })
    return z.NEVER
  }
  return parsed.data
})

const optionalEmail = z.string().trim().max(320).optional().transform((value, ctx) => {
  if (!value) return null
  const parsed = z.email().safeParse(value)
  if (!parsed.success) {
    ctx.addIssue({ code: 'custom', message: 'Enter a valid email address' })
    return z.NEVER
  }
  return parsed.data.toLowerCase()
})

export const siteServiceSchema = z.object({
  title: z.string().trim().min(1).max(160),
  body: z.string().trim().min(1).max(1500),
})

export const siteGalleryItemSchema = z.object({
  url: siteImageUrl,
  alt: z.string().trim().max(240),
})

export const siteContentInputSchema = z.object({
  brandName: z.string().trim().min(1).max(120),
  heroEyebrow: z.string().trim().min(1).max(160),
  heroTitle: z.string().trim().min(1).max(300),
  heroBody: z.string().trim().min(1).max(3000),
  heroImageUrl: optionalImageUrl,
  heroCtaLabel: z.string().trim().min(1).max(120),
  aboutEyebrow: z.string().trim().min(1).max(160),
  aboutTitle: z.string().trim().min(1).max(300),
  aboutBody: z.string().trim().min(1).max(8000),
  mediaEyebrow: z.string().trim().min(1).max(160),
  mediaTitle: z.string().trim().min(1).max(300),
  mediaBody: z.string().trim().min(1).max(4000),
  showreelUrl: optionalUrl,
  agendaEyebrow: z.string().trim().min(1).max(160),
  agendaTitle: z.string().trim().min(1).max(300),
  agendaBody: z.string().trim().min(1).max(4000),
  bookingEyebrow: z.string().trim().min(1).max(160),
  bookingTitle: z.string().trim().min(1).max(300),
  bookingBody: z.string().trim().min(1).max(4000),
  contactEmail: optionalEmail,
  contactPhone: z.string().trim().max(64).optional().transform(value => value || null),
  instagramUrl: optionalUrl,
  spotifyUrl: optionalUrl,
  seoTitle: z.string().trim().min(1).max(180),
  seoDescription: z.string().trim().min(1).max(320),
  seoImageUrl: optionalImageUrl,
  services: z.array(siteServiceSchema).max(12),
  gallery: z.array(siteGalleryItemSchema).max(40),
})

export type SiteContentInput = z.infer<typeof siteContentInputSchema>
