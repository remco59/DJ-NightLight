import { and, asc, eq } from 'drizzle-orm'
import { landingPages } from '../../../../db/schema'
import { db } from '../../../utils/db'

export default defineEventHandler(async () => {
  const pages = await db
    .select({
      slug: landingPages.slug,
      label: landingPages.navLabel,
    })
    .from(landingPages)
    .where(and(
      eq(landingPages.published, true),
      eq(landingPages.showInNavigation, true),
    ))
    .orderBy(asc(landingPages.ordering), asc(landingPages.navLabel))

  return { pages }
})
