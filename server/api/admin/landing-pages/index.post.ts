import { eq } from 'drizzle-orm'
import { landingPages } from '../../../../db/schema'
import { landingPageInputSchema } from '../../../../shared/schemas/landing-page'
import { db } from '../../../utils/db'
import { requireStaff } from '../../../utils/require-staff'

export default defineEventHandler(async (event) => {
  await requireStaff(event, ['owner'])
  const input = await readValidatedBody(event, landingPageInputSchema.parse)

  const [existing] = await db.select({ id: landingPages.id }).from(landingPages).where(eq(landingPages.slug, input.slug)).limit(1)
  if (existing) {
    throw createError({ statusCode: 409, statusMessage: 'A landing page with this slug already exists' })
  }

  const [page] = await db.insert(landingPages).values(input).returning()
  if (!page) throw createError({ statusCode: 500, statusMessage: 'Could not create landing page' })

  event.node.res.statusCode = 201
  return { page }
})
