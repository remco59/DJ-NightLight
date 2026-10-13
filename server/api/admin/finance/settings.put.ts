import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { businessSettings } from '../../../../db/schema'
import { db } from '../../../utils/db'
import { requireStaff } from '../../../utils/require-staff'

const bodySchema = z.object({ kmRateCents: z.number().int().min(0).max(500) })

/** The default reimbursement per kilometre. Existing mileage keeps the rate it was registered with. */
export default defineEventHandler(async (event) => {
  await requireStaff(event, ['owner'])
  const { kmRateCents } = await readValidatedBody(event, bodySchema.parse)
  const [updated] = await db.update(businessSettings).set({ kmRateCents, updatedAt: new Date() }).where(eq(businessSettings.key, 'default')).returning({ kmRateCents: businessSettings.kmRateCents })
  if (!updated) throw createError({ statusCode: 500, statusMessage: 'Bedrijfsinstellingen zijn nog niet ingesteld' })
  return updated
})
