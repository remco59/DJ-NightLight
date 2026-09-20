import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { gigEmailSuppressions } from '../../../../db/schema'
import { db } from '../../../utils/db'
import { requireStaff } from '../../../utils/require-staff'

const schema = z.object({
  gigId: z.string().uuid(),
  templateKey: z.string().min(1).max(80),
  suppressed: z.boolean(),
})

export default defineEventHandler(async (event) => {
  await requireStaff(event, ['owner', 'manager'])
  const input = await readValidatedBody(event, schema.parse)
  if (input.suppressed) {
    await db.insert(gigEmailSuppressions).values({
      gigId: input.gigId,
      templateKey: input.templateKey,
    }).onConflictDoNothing()
  } else {
    await db.delete(gigEmailSuppressions).where(and(
      eq(gigEmailSuppressions.gigId, input.gigId),
      eq(gigEmailSuppressions.templateKey, input.templateKey),
    ))
  }
  return { ok: true }
})
