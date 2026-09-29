import { z } from 'zod'

const mediaReference = z.string().trim().max(2000).refine((value) => {
  if (value.startsWith('/')) return true
  return z.url().safeParse(value).success
}, 'Vul een geldige URL in')

const optionalMediaReference = z.string().trim().max(2000).optional().transform((value, ctx) => {
  if (!value) return null
  const parsed = mediaReference.safeParse(value)
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

const benefitSchema = z.object({
  icon: z.string().trim().min(1).max(120),
  title: z.string().trim().min(1).max(160),
  body: z.string().trim().min(1).max(500),
})

const galleryImageSchema = z.object({
  url: optionalMediaReference,
  alt: z.string().trim().max(300),
})

export const landingPageSectionsSchema = z.object({
  benefits: z.array(benefitSchema).length(3),
  storyEyebrow: z.string().trim().min(1).max(160),
  storyTitle: z.string().trim().min(1).max(300),
  storyImageUrl: optionalMediaReference,
  galleryTitle: z.string().trim().min(1).max(160),
  galleryCtaLabel: z.string().trim().min(1).max(120),
  galleryCtaHref: hrefSchema,
  galleryImages: z.array(galleryImageSchema).length(4),
  closingEyebrow: z.string().trim().min(1).max(160),
  closingTitle: z.string().trim().min(1).max(300),
  closingBody: z.string().trim().min(1).max(1500),
  closingCtaLabel: z.string().trim().min(1).max(120),
  closingCtaHref: hrefSchema,
  closingImageUrl: optionalMediaReference,
})

export type LandingPageSections = z.infer<typeof landingPageSectionsSchema>

export function defaultLandingPageSections(slug = ''): LandingPageSections {
  const emptyGallery = Array.from({ length: 4 }, () => ({ url: null, alt: '' }))

  if (/bruiloft|wedding/i.test(slug)) {
    return {
      benefits: [
        { icon: 'lucide:music-2', title: 'Muziek op maat', body: 'Van ontspannen diner tot volle dansvloer.' },
        { icon: 'lucide:users-round', title: 'Voor alle generaties', body: 'Een set die iedereen in beweging krijgt.' },
        { icon: 'lucide:heart', title: 'Zorgeloos genieten', body: 'Heldere afspraken en professionele setup.' },
      ],
      storyEyebrow: 'Mijn aanpak',
      storyTitle: 'Meer dan alleen een DJ.',
      storyImageUrl: null,
      galleryTitle: 'Sfeerimpressie',
      galleryCtaLabel: 'Bekijk meer',
      galleryCtaHref: '/media',
      galleryImages: emptyGallery,
      closingEyebrow: 'Jullie avond, mijn focus',
      closingTitle: 'Laten we kennismaken.',
      closingBody: 'Ik denk graag met jullie mee over de invulling, muziekstijl en planning. Zo wordt het een avond die echt bij jullie past.',
      closingCtaLabel: 'Neem contact op',
      closingCtaHref: '/boeken',
      closingImageUrl: null,
    }
  }

  if (/student/i.test(slug)) {
    return {
      benefits: [
        { icon: 'lucide:zap', title: 'Energie van begin tot eind', body: 'Een set die de avond momentum blijft geven.' },
        { icon: 'lucide:users-round', title: 'Muziek die iedereen kent', body: 'Van meezingers tot de nieuwste clubtracks.' },
        { icon: 'lucide:star', title: 'Ervaring met studentenfeesten', body: 'Introducties, gala’s, verenigingen en themafeesten.' },
      ],
      storyEyebrow: 'Mijn aanpak',
      storyTitle: 'Een set die zich aanpast aan het moment.',
      storyImageUrl: null,
      galleryTitle: 'Sfeerimpressie',
      galleryCtaLabel: 'Bekijk meer',
      galleryCtaHref: '/media',
      galleryImages: emptyGallery,
      closingEyebrow: 'Van plan tot dansvloer',
      closingTitle: 'Lets make it happen.',
      closingBody: 'Vertel me meer over jullie feest, locatie en wensen. Ik denk graag mee over de perfecte invulling.',
      closingCtaLabel: 'Neem contact op',
      closingCtaHref: '/boeken',
      closingImageUrl: null,
    }
  }

  return {
    benefits: [
      { icon: 'lucide:music-2', title: 'Muziek op maat', body: 'Een set die past bij publiek, locatie en moment.' },
      { icon: 'lucide:users-round', title: 'Ervaring met publiek', body: 'Herkennen wanneer het tijd is om te schakelen.' },
      { icon: 'lucide:sparkles', title: 'Professionele uitstraling', body: 'Van voorbereiding tot laatste track verzorgd.' },
    ],
    storyEyebrow: 'Mijn aanpak',
    storyTitle: 'Een set die zich aanpast aan het moment.',
    storyImageUrl: null,
    galleryTitle: 'Sfeerimpressie',
    galleryCtaLabel: 'Bekijk meer',
    galleryCtaHref: '/media',
    galleryImages: emptyGallery,
    closingEyebrow: 'Samen iets neerzetten',
    closingTitle: 'Klaar voor jullie feest?',
    closingBody: 'Vertel me wat je in gedachten hebt. Ik denk graag mee over muziek, planning en sfeer.',
    closingCtaLabel: 'Neem contact op',
    closingCtaHref: '/boeken',
    closingImageUrl: null,
  }
}

export const landingPageInputSchema = z.object({
  slug: z.string().trim().min(1).max(160).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Gebruik alleen kleine letters, cijfers en koppeltekens'),
  navLabel: z.string().trim().min(1).max(120),
  eyebrow: z.string().trim().min(1).max(160),
  title: z.string().trim().min(1).max(300),
  intro: z.string().trim().min(1).max(3000),
  body: z.string().trim().min(1).max(12000),
  heroImageUrl: optionalMediaReference,
  ctaLabel: z.string().trim().min(1).max(120),
  ctaHref: hrefSchema,
  published: z.boolean(),
  showInNavigation: z.boolean(),
  indexable: z.boolean(),
  seoTitle: z.string().trim().min(1).max(180),
  seoDescription: z.string().trim().min(1).max(320),
  seoImageUrl: optionalMediaReference,
  ordering: z.number().int().min(0).max(10000),
  sections: landingPageSectionsSchema.optional(),
}).transform((value) => ({
  ...value,
  sections: value.sections ?? defaultLandingPageSections(value.slug),
}))

export type LandingPageInput = z.infer<typeof landingPageInputSchema>
