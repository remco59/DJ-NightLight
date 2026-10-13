import { and, eq, inArray } from 'drizzle-orm'
import { auditLogs, businessSettings, gigs, quoteLineItems, quotes } from '../../../../../db/schema'
import { todayInAmsterdam } from '../../../../../shared/dates'
import { calculateInvoiceTotals } from '../../../../../shared/invoice'
import { addDaysToDate, DEFAULT_QUOTE_TERMS, QUOTE_DEFAULT_VALID_DAYS } from '../../../../../shared/quote'
import { db } from '../../../../utils/db'
import { gigTitleSql } from '../../../../utils/gig-title'
import { requireStaff } from '../../../../utils/require-staff'
import { requireUuidParam } from '../../../../utils/route-params'

/** Starts a draft quote for a gig, with one line for the gig's fee. */
export default defineEventHandler(async (event) => {
  const user = await requireStaff(event, ['owner', 'manager'])
  const gigId = requireUuidParam(event, 'id')
  const [row] = await db.select({ gig: gigs, displayTitle: gigTitleSql() }).from(gigs).where(eq(gigs.id, gigId)).limit(1)
  if (!row || row.gig.deletedAt) throw createError({ statusCode: 404, statusMessage: 'Gig niet gevonden' })
  const { gig, displayTitle } = row
  if (!gig.clientId) throw createError({ statusCode: 422, statusMessage: 'Koppel eerst een klant voordat je een offerte maakt' })

  const [open] = await db.select({ id: quotes.id }).from(quotes)
    .where(and(eq(quotes.gigId, gigId), inArray(quotes.status, ['draft', 'sent']))).limit(1)
  if (open) throw createError({ statusCode: 409, statusMessage: 'Er is al een lopende offerte voor deze gig. Laat die eerst vervallen of verwijder het concept.', data: { quoteId: open.id } })

  const [settings] = await db.select().from(businessSettings).where(eq(businessSettings.key, 'default')).limit(1)
  if (!settings) throw createError({ statusCode: 500, statusMessage: 'Bedrijfsinstellingen zijn nog niet ingesteld' })

  const today = todayInAmsterdam()
  const lines = [{ description: `DJ-diensten — ${displayTitle}`, quantity: '1.000', unitPriceCents: Math.round(Number(gig.fee || 0) * 100) }]
  const totals = calculateInvoiceTotals(lines, settings.defaultVatMode, settings.defaultVatRateBasisPoints)

  const quote = await db.transaction(async (tx) => {
    const [created] = await tx.insert(quotes).values({
      gigId: gig.id, clientId: gig.clientId, issueDate: today, validUntil: addDaysToDate(today, QUOTE_DEFAULT_VALID_DAYS),
      currency: gig.currency, vatMode: settings.defaultVatMode, vatRateBasisPoints: settings.defaultVatRateBasisPoints,
      ...totals, terms: DEFAULT_QUOTE_TERMS,
    }).returning()
    if (!created) throw createError({ statusCode: 500, statusMessage: 'Offerte aanmaken is niet gelukt' })
    await tx.insert(quoteLineItems).values({ quoteId: created.id, ...lines[0]!, ordering: 0 })
    await tx.insert(auditLogs).values({ userId: user.id, entityType: 'gig', entityId: gigId, action: 'quote_created', metadata: { quoteId: created.id } })
    return created
  })
  event.node.res.statusCode = 201
  return { quote }
})
