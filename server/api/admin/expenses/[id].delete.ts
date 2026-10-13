import { eq } from 'drizzle-orm'
import { expenses } from '../../../../db/schema'
import { recordAudit } from '../../../utils/audit'
import { db } from '../../../utils/db'
import { requireStaff } from '../../../utils/require-staff'
import { requireUuidParam } from '../../../utils/route-params'

export default defineEventHandler(async (event) => {
  const user = await requireStaff(event, ['owner', 'manager'])
  const id = requireUuidParam(event, 'id')
  const [deleted] = await db.delete(expenses).where(eq(expenses.id, id)).returning({ id: expenses.id, amountCents: expenses.amountCents, kind: expenses.kind })
  if (!deleted) throw createError({ statusCode: 404, statusMessage: 'Niet gevonden' })
  await recordAudit({ userId: user.id, entityType: 'expense', entityId: id, action: 'deleted', metadata: { kind: deleted.kind, amountCents: deleted.amountCents } })
  return { ok: true }
})
