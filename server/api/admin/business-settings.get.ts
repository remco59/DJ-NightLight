import { eq } from 'drizzle-orm'
import { businessSettings } from '../../../db/schema'
import { db } from '../../utils/db'
import { requireStaff } from '../../utils/require-staff'

export default defineEventHandler(async (event) => {
  await requireStaff(event, ['owner', 'manager'])
  const [settings] = await db.select().from(businessSettings).where(eq(businessSettings.key, 'default')).limit(1)
  if (!settings) throw createError({ statusCode: 500, statusMessage: 'Bedrijfsinstellingen zijn nog niet ingesteld' })
  return { settings }
})
