import { eq } from 'drizzle-orm'
import { businessSettings } from '../../../db/schema'
import { businessSettingsInputSchema } from '../../../shared/invoice'
import { db } from '../../utils/db'
import { requireStaff } from '../../utils/require-staff'

export default defineEventHandler(async (event) => {
  await requireStaff(event, ['owner'])
  const parsed = businessSettingsInputSchema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 422, statusMessage: parsed.error.issues[0]?.message || 'Invalid business settings' })
  const [settings] = await db.update(businessSettings).set({ ...parsed.data, updatedAt: new Date() }).where(eq(businessSettings.key, 'default')).returning()
  if (!settings) throw createError({ statusCode: 500, statusMessage: 'Could not save business settings' })
  return { settings }
})
