import { eq } from 'drizzle-orm'
import { expenses, gigs } from '../../../../db/schema'
import { expenseInputSchema, MILEAGE_CATEGORY, mileageAmountCents } from '../../../../shared/finance'
import { recordAudit } from '../../../utils/audit'
import { db } from '../../../utils/db'
import { requireStaff } from '../../../utils/require-staff'
import { requireUuidParam } from '../../../utils/route-params'

export default defineEventHandler(async (event) => {
  const user = await requireStaff(event, ['owner', 'manager'])
  const id = requireUuidParam(event, 'id')
  const parsed = expenseInputSchema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 422, statusMessage: parsed.error.issues[0]?.message || 'Ongeldige invoer' })
  const input = parsed.data
  if (input.gigId) {
    const [gig] = await db.select({ id: gigs.id }).from(gigs).where(eq(gigs.id, input.gigId)).limit(1)
    if (!gig) throw createError({ statusCode: 422, statusMessage: 'Deze gig bestaat niet' })
  }
  // Only an item with a gig can be passed on: the invoice belongs to the gig.
  const gigId = input.gigId
  const values = input.kind === 'mileage'
    ? {
        kind: 'mileage' as const, gigId: input.gigId, spentOn: input.spentOn, category: MILEAGE_CATEGORY,
        description: input.description || 'Kilometers', amountCents: mileageAmountCents(input.kilometers, input.kmRateCents), vatCents: 0,
        kilometers: input.kilometers.toFixed(1), kmRateCents: input.kmRateCents, billable: Boolean(gigId && input.billable),
      }
    : {
        kind: 'cost' as const, gigId: input.gigId, spentOn: input.spentOn, category: input.category,
        description: input.description, amountCents: input.amountCents, vatCents: input.vatCents, kilometers: null, kmRateCents: null, billable: Boolean(gigId && input.billable),
      }
  const [updated] = await db.update(expenses).set({ ...values, updatedAt: new Date() }).where(eq(expenses.id, id)).returning()
  if (!updated) throw createError({ statusCode: 404, statusMessage: 'Niet gevonden' })
  await recordAudit({ userId: user.id, entityType: 'expense', entityId: id, action: 'updated', metadata: { kind: updated.kind, amountCents: updated.amountCents } })
  return { expense: updated }
})
