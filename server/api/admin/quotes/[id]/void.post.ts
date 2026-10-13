import { and, eq } from 'drizzle-orm'
import { auditLogs, quotes } from '../../../../../db/schema'
import { db } from '../../../../utils/db'
import { requireStaff } from '../../../../utils/require-staff'
import { requireUuidParam } from '../../../../utils/route-params'

/** Withdraws a sent quote. The number stays; the client can no longer accept it. */
export default defineEventHandler(async (event) => {
  const user = await requireStaff(event, ['owner', 'manager'])
  const id = requireUuidParam(event, 'id')
  const [quote] = await db.update(quotes).set({ status: 'void', voidedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(quotes.id, id), eq(quotes.status, 'sent'))).returning()
  if (!quote) throw createError({ statusCode: 409, statusMessage: 'Alleen een verstuurde offerte kan vervallen' })
  await db.insert(auditLogs).values({ userId: user.id, entityType: 'gig', entityId: quote.gigId, action: 'quote_voided', metadata: { quoteId: id, quoteNumber: quote.quoteNumber } })
  return { quote }
})
