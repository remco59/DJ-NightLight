import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { emailTemplates } from '../../../../../db/schema'
import { db } from '../../../../utils/db'
import { requireStaff } from '../../../../utils/require-staff'

const schema = z.object({
  enabled: z.boolean(),
  subject: z.string().trim().min(1).max(300),
  body: z.string().trim().min(1).max(20_000),
  scheduleAnchor: z.enum(['event', 'gig_start', 'gig_end', 'invoice_due']),
  offsetMinutes: z.coerce.number().int().min(-525600).max(525600),
})

export default defineEventHandler(async (event) => {
  await requireStaff(event, ['owner', 'manager'])
  const key = getRouterParam(event, 'key')
  if (!key) throw createError({ statusCode: 400, statusMessage: 'Templatesleutel is verplicht' })
  const input = await readValidatedBody(event, schema.parse)
  const [template] = await db.update(emailTemplates)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(emailTemplates.key, key))
    .returning()
  if (!template) throw createError({ statusCode: 404, statusMessage: 'Template niet gevonden' })
  return { template }
})
