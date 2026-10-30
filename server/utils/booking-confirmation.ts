import { and, eq, isNull } from 'drizzle-orm'
import { auditLogs, gigs, quotes, termsVersions } from '../../db/schema'
import { db } from './db'
import { queueCalendarSync } from './calendar-sync'
import { loadGigEmailContext, queueEmailJob } from './email-automation'

/**
 * Makes a booking definite: the gig becomes "booked" and the client gets one confirmation mail with the
 * quote and the terms version they accepted. Safe to call twice; the quote carries the confirmation moment.
 */
export async function confirmBooking(quoteId: string, source: 'quote_accepted' | 'reservation_paid') {
  const now = new Date()
  const [quote] = await db.update(quotes).set({ bookingConfirmedAt: now, updatedAt: now })
    .where(and(eq(quotes.id, quoteId), eq(quotes.status, 'accepted'), isNull(quotes.bookingConfirmedAt))).returning()
  if (!quote) return false

  const [gig] = await db.select({ status: gigs.status }).from(gigs).where(eq(gigs.id, quote.gigId)).limit(1)
  if (gig?.status === 'lead') {
    await db.update(gigs).set({ status: 'booked', updatedAt: now }).where(eq(gigs.id, quote.gigId))
    await queueCalendarSync(quote.gigId)
  }
  await db.insert(auditLogs).values({ userId: null, entityType: 'gig', entityId: quote.gigId, action: 'booking_confirmed', metadata: { quoteId, source } })

  const context = await loadGigEmailContext(quote.gigId)
  if (!context) return true
  const [terms] = quote.acceptedTermsVersionId
    ? await db.select().from(termsVersions).where(eq(termsVersions.id, quote.acceptedTermsVersionId)).limit(1)
    : []
  const siteUrl = String(useRuntimeConfig().public.siteUrl).replace(/\/$/, '')
  await queueEmailJob({
    templateKey: 'booking_confirmed',
    gigId: quote.gigId,
    recipient: context.recipient,
    variables: {
      ...context.variables,
      quoteNumber: quote.quoteNumber || '',
      termsVersionLabel: terms ? `Versie ${terms.version} (bijgevoegd)` : 'Zie website',
      termsUrl: terms ? `${siteUrl}/voorwaarden?version=${terms.version}` : `${siteUrl}/voorwaarden`,
    },
    dedupeKey: `booking-confirmed:${quote.id}`,
    attachments: [
      ...(quote.quoteNumber ? [{ kind: 'quote' as const, quoteId: quote.id, filename: `${quote.quoteNumber}.pdf` }] : []),
      ...(terms ? [{ kind: 'terms' as const, termsVersionId: terms.id, filename: `voorwaarden-nightlight-v${terms.version}.txt` }] : []),
    ],
  })
  return true
}
