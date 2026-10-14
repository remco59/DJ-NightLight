import { eq } from 'drizzle-orm'
import { expenses, gigs } from '../../../../db/schema'
import { expenseInputSchema, MILEAGE_CATEGORY, mileageAmountCents } from '../../../../shared/finance'
import { recordAudit } from '../../../utils/audit'
import { db } from '../../../utils/db'
import { requireStaff } from '../../../utils/require-staff'

/** Registers a cost or a trip. A trip's amount is worked out from the kilometres and the rate. */
export default defineEventHandler(async (event) => {
  const user = await requireStaff(event, ['owner', 'manager'])
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
  const [created] = await db.insert(expenses).values({ ...values, createdByUserId: user.id }).returning()
  if (!created) throw createError({ statusCode: 500, statusMessage: 'Opslaan is niet gelukt' })
  await recordAudit({ userId: user.id, entityType: 'expense', entityId: created.id, action: 'created', metadata: { kind: created.kind, amountCents: created.amountCents, gigId: created.gigId } })
  event.node.res.statusCode = 201
  return { expense: created }
})
