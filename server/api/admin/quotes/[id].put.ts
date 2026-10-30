import { and, eq } from 'drizzle-orm'
import { auditLogs, quoteLineItems, quotes } from '../../../../db/schema'
import { calculateInvoiceTotals } from '../../../../shared/invoice'
import { quoteDraftInputSchema } from '../../../../shared/quote'
import { reservationCents, reservationProblem } from '../../../../shared/reservation'
import { db } from '../../../utils/db'
import { requireStaff } from '../../../utils/require-staff'
import { requireUuidParam } from '../../../utils/route-params'

export default defineEventHandler(async (event) => {
  const user = await requireStaff(event, ['owner', 'manager'])
  const id = requireUuidParam(event, 'id')
  const parsed = quoteDraftInputSchema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 422, statusMessage: parsed.error.issues[0]?.message || 'Ongeldige offerte' })
  const { lines, reservation, ...values } = parsed.data
  const totals = calculateInvoiceTotals(lines, values.vatMode, values.vatRateBasisPoints)
  const reservationIssue = reservationProblem(totals.totalCents, reservation)
  if (reservationIssue) throw createError({ statusCode: 422, statusMessage: reservationIssue })

  const quote = await db.transaction(async (tx) => {
    const [updated] = await tx.update(quotes).set({
      ...values, ...totals, updatedAt: new Date(),
      reservationMode: reservation?.mode ?? null, reservationValue: reservation?.value ?? null, reservationCents: reservationCents(totals.totalCents, reservation),
    })
      .where(and(eq(quotes.id, id), eq(quotes.status, 'draft'))).returning()
    if (!updated) throw createError({ statusCode: 409, statusMessage: 'Alleen een concept kan worden bewerkt' })
    await tx.delete(quoteLineItems).where(eq(quoteLineItems.quoteId, id))
    await tx.insert(quoteLineItems).values(lines.map((line, ordering) => ({ quoteId: id, ...line, ordering })))
    await tx.insert(auditLogs).values({ userId: user.id, entityType: 'gig', entityId: updated.gigId, action: 'quote_draft_updated', metadata: { quoteId: id, ...totals } })
    return updated
  })
  return { quote }
})
