import { eq } from 'drizzle-orm'
import { landingPages } from '../../../../db/schema'
import { landingPageInputSchema } from '../../../../shared/schemas/landing-page'
import { db } from '../../../utils/db'
import { requireStaff } from '../../../utils/require-staff'

export default defineEventHandler(async (event) => {
  await requireStaff(event, ['owner'])
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Landing page-ID is verplicht' })

  const input = await readValidatedBody(event, landingPageInputSchema.parse)
  const [sameSlug] = await db.select({ id: landingPages.id }).from(landingPages).where(eq(landingPages.slug, input.slug)).limit(1)
  if (sameSlug && sameSlug.id !== id) {
    throw createError({ statusCode: 409, statusMessage: 'Er bestaat al een landing page met deze slug' })
  }

  const [page] = await db
    .update(landingPages)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(landingPages.id, id))
    .returning()

  if (!page) throw createError({ statusCode: 404, statusMessage: 'Landing page niet gevonden' })
  return { page }
})
