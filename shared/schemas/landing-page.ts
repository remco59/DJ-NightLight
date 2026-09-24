import { z } from 'zod'

const optionalUrl = z.string().trim().max(2000).optional().transform((value, ctx) => {
  if (!value) return null
  const parsed = z.url().safeParse(value)
  if (!parsed.success) {
    ctx.addIssue({ code: 'custom', message: 'Vul een geldige URL in' })
    return z.NEVER
  }
  return parsed.data
})

const hrefSchema = z.string().trim().min(1).max(500).refine((value) => {
  if (value.startsWith('/')) return true
  return z.url().safeParse(value).success
}, 'Gebruik een intern pad of een volledige URL')

export const landingPageInputSchema = z.object({
  slug: z.string().trim().min(1).max(160).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Gebruik alleen kleine letters, cijfers en koppeltekens'),
  navLabel: z.string().trim().min(1).max(120),
  eyebrow: z.string().trim().min(1).max(160),
  title: z.string().trim().min(1).max(300),
  intro: z.string().trim().min(1).max(3000),
  body: z.string().trim().min(1).max(12000),
  heroImageUrl: optionalUrl,
  ctaLabel: z.string().trim().min(1).max(120),
  ctaHref: hrefSchema,
  published: z.boolean(),
  showInNavigation: z.boolean(),
  indexable: z.boolean(),
  seoTitle: z.string().trim().min(1).max(180),
  seoDescription: z.string().trim().min(1).max(320),
  seoImageUrl: optionalUrl,
  ordering: z.number().int().min(0).max(10000),
})

export type LandingPageInput = z.infer<typeof landingPageInputSchema>
