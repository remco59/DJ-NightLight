export type SiteService = { title: string, body: string }
export type SiteGalleryItem = { url: string, alt: string }

export type PublicSiteContent = {
  brandName: string
  heroEyebrow: string
  heroTitle: string
  heroBody: string
  heroImageUrl: string | null
  heroCtaLabel: string
  aboutEyebrow: string
  aboutTitle: string
  aboutBody: string
  mediaEyebrow: string
  mediaTitle: string
  mediaBody: string
  showreelUrl: string | null
  agendaEyebrow: string
  agendaTitle: string
  agendaBody: string
  bookingEyebrow: string
  bookingTitle: string
  bookingBody: string
  contactEmail: string | null
  contactPhone: string | null
  instagramUrl: string | null
  spotifyUrl: string | null
  seoTitle: string
  seoDescription: string
  seoImageUrl: string | null
  services: SiteService[]
  gallery: SiteGalleryItem[]
}
