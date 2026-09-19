import { and, eq } from 'drizzle-orm'
import { landingPages } from '../../../../db/schema'
import { db } from '../../../utils/db'

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')
  if (!slug) throw createError({ statusCode: 400, statusMessage: 'Landing page slug is required' })

  const [page] = await db
    .select({
      slug: landingPages.slug,
      navLabel: landingPages.navLabel,
      eyebrow: landingPages.eyebrow,
      title: landingPages.title,
      intro: landingPages.intro,
      body: landingPages.body,
      heroImageUrl: landingPages.heroImageUrl,
      ctaLabel: landingPages.ctaLabel,
      ctaHref: landingPages.ctaHref,
      indexable: landingPages.indexable,
      seoTitle: landingPages.seoTitle,
      seoDescription: landingPages.seoDescription,
      seoImageUrl: landingPages.seoImageUrl,
    })
    .from(landingPages)
    .where(and(
      eq(landingPages.slug, slug),
      eq(landingPages.published, true),
    ))
    .limit(1)

  if (!page) throw createError({ statusCode: 404, statusMessage: 'Landing page not found' })
  return { page }
})
