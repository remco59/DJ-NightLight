import { createHash } from 'node:crypto'
import { and, eq, sql } from 'drizzle-orm'
import { auditLogs, businessSettings, portalLinks, quotes } from '../../../../../db/schema'
import { todayInAmsterdam } from '../../../../../shared/dates'
import { calculateInvoiceTotals, formatInvoiceNumber } from '../../../../../shared/invoice'
import { QUOTE_NUMBER_PREFIX } from '../../../../../shared/quote'
import { quoteReservation, reservationCents } from '../../../../../shared/reservation'
import { db } from '../../../../utils/db'
import { queueQuoteEmail } from '../../../../utils/email-automation'
import { loadBusinessSettings } from '../../../../utils/invoice-finalize'
import { createPortalToken, hashPortalToken, portalExpiry } from '../../../../utils/portal-token'
import { buildQuoteSnapshot, getQuoteDetail, quoteLineInputs, quoteSendBlockers } from '../../../../utils/quote-data'
import { requireStaff } from '../../../../utils/require-staff'
import { requireUuidParam } from '../../../../utils/route-params'

/** Locks the draft: gives it a number, freezes the document and mails the client a link to the portal. */
export default defineEventHandler(async (event) => {
  const user = await requireStaff(event, ['owner', 'manager'])
  const id = requireUuidParam(event, 'id')
  const detail = await getQuoteDetail(id)
  if (!detail) throw createError({ statusCode: 404, statusMessage: 'Offerte niet gevonden' })
  if (detail.quote.status !== 'draft') throw createError({ statusCode: 409, statusMessage: 'De offerte is al verstuurd' })
  const today = todayInAmsterdam()
  const blockers = quoteSendBlockers(detail, await loadBusinessSettings(), today)
  if (blockers.length) throw createError({ statusCode: 422, statusMessage: blockers.join(' ') })

  const totals = calculateInvoiceTotals(quoteLineInputs(detail), detail.quote.vatMode, detail.quote.vatRateBasisPoints)
  const baseUrl = String(useRuntimeConfig().public.siteUrl).replace(/\/$/, '')
  const portalToken = createPortalToken()
  // The link outlives the quote a little, so the client can still read what they accepted or missed.
  const daysValid = Math.ceil((new Date(`${detail.quote.validUntil}T23:59:59.999Z`).getTime() - Date.now()) / 86_400_000)
  const portalExpiresAt = portalExpiry(Math.min(365, Math.max(30, daysValid + 30)))
  const portalUrl = `${baseUrl}/client/${portalToken}`

  const sent = await db.transaction(async (tx) => {
    const [settings] = await tx.update(businessSettings).set({ nextQuoteNumber: sql`${businessSettings.nextQuoteNumber} + 1` }).where(eq(businessSettings.key, 'default')).returning()
    if (!settings) throw createError({ statusCode: 500, statusMessage: 'Bedrijfsinstellingen zijn nog niet ingesteld' })
    const quoteNumber = formatInvoiceNumber(QUOTE_NUMBER_PREFIX, Number(detail.quote.issueDate.slice(0, 4)), settings.nextQuoteNumber - 1)
    const [portalLink] = await tx.insert(portalLinks).values({
      gigId: detail.quote.gigId, tokenHash: hashPortalToken(portalToken), expiresAt: portalExpiresAt, createdByUserId: user.id,
    }).returning({ id: portalLinks.id })
    if (!portalLink) throw createError({ statusCode: 500, statusMessage: 'Klantportaallink aanmaken is niet gelukt' })
    const snapshot = buildQuoteSnapshot(detail, settings, quoteNumber, portalUrl)
    const documentHash = createHash('sha256').update(JSON.stringify(snapshot)).digest('hex')
    const [quote] = await tx.update(quotes).set({
      quoteNumber, status: 'sent', ...totals, reservationCents: reservationCents(totals.totalCents, quoteReservation(detail.quote)), documentSnapshot: snapshot, documentHash, sentAt: new Date(), updatedAt: new Date(),
    }).where(and(eq(quotes.id, id), eq(quotes.status, 'draft'))).returning()
    if (!quote) throw createError({ statusCode: 409, statusMessage: 'De offerte is intussen via een ander verzoek verstuurd' })
    await tx.insert(auditLogs).values([
      { userId: user.id, entityType: 'gig', entityId: detail.quote.gigId, action: 'quote_sent', metadata: { quoteId: id, quoteNumber, documentHash } },
      { userId: user.id, entityType: 'gig', entityId: detail.quote.gigId, action: 'portal_link_created', metadata: { linkId: portalLink.id, expiresAt: portalExpiresAt.toISOString(), source: 'quote_sent' } },
    ])
    return quote
  })
  const job = await queueQuoteEmail(sent.id, `quote-sent:${sent.id}`)
  return { quote: sent, email: job ? { recipient: job.recipient, runAt: job.runAt } : null }
})
