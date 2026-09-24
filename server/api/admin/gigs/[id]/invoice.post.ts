import { eq } from 'drizzle-orm'
import { auditLogs, businessSettings, gigs, invoiceLineItems, invoices } from '../../../../../db/schema'
import { calculateInvoiceTotals } from '../../../../../shared/invoice'
import { db } from '../../../../utils/db'
import { gigTitleSql } from '../../../../utils/gig-title'
import { requireStaff } from '../../../../utils/require-staff'

function dateOnly(value: Date) { return value.toISOString().slice(0, 10) }

export default defineEventHandler(async (event) => {
  const user = await requireStaff(event, ['owner', 'manager'])
  const gigId = getRouterParam(event, 'id')
  if (!gigId) throw createError({ statusCode: 400, statusMessage: 'Gig-ID is verplicht' })
  const [row] = await db.select({ gig: gigs, displayTitle: gigTitleSql() }).from(gigs).where(eq(gigs.id, gigId)).limit(1)
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Gig niet gevonden' })
  const { gig, displayTitle } = row
  if (!gig.clientId) throw createError({ statusCode: 422, statusMessage: 'Koppel eerst een klant voordat je een factuur maakt' })
  const [settings] = await db.select().from(businessSettings).where(eq(businessSettings.key, 'default')).limit(1)
  if (!settings) throw createError({ statusCode: 500, statusMessage: 'Bedrijfsinstellingen zijn nog niet ingesteld' })

  const issue = gig.startsAt ? new Date(gig.startsAt) : new Date()
  const due = new Date(issue); due.setUTCDate(due.getUTCDate() + settings.defaultPaymentTermDays)
  const unitPriceCents = Math.round(Number(gig.fee || 0) * 100)
  const lines = [{ description: `DJ-diensten — ${displayTitle}`, quantity: '1.000', unitPriceCents }]
  const totals = calculateInvoiceTotals(lines, settings.defaultVatMode, settings.defaultVatRateBasisPoints)

  const invoice = await db.transaction(async (tx) => {
    const [created] = await tx.insert(invoices).values({
      gigId: gig.id, clientId: gig.clientId, issueDate: dateOnly(issue), dueDate: dateOnly(due), currency: gig.currency,
      vatMode: settings.defaultVatMode, vatRateBasisPoints: settings.defaultVatRateBasisPoints,
      ...totals, paymentTerms: settings.paymentTerms, legalText: settings.legalText,
    }).returning()
    if (!created) throw createError({ statusCode: 500, statusMessage: 'Factuur aanmaken is niet gelukt' })
    await tx.insert(invoiceLineItems).values({ invoiceId: created.id, ...lines[0]!, ordering: 0 })
    await tx.insert(auditLogs).values({ userId: user.id, entityType: 'invoice', entityId: created.id, action: 'invoice_created', metadata: { gigId } })
    return created
  })
  return { invoice }
})
