import { and, desc, eq, inArray, ne } from 'drizzle-orm'
import { gigReviews, invoices, payments, portalLinks, quotes, termsVersions } from '../../../../db/schema'
import { todayInAmsterdam } from '../../../../shared/dates'
import { gigHasStarted, gigIsFinished } from '../../../../shared/gig-phase'
import { quoteDisplayStatus, quoteIsOpenForResponse } from '../../../../shared/quote'
import { recordAudit } from '../../../utils/audit'
import { db, sql } from '../../../utils/db'
import { resolvePortalAccess } from '../../../utils/portal-access'
import { getInvoiceAmountDue } from '../../../utils/invoice-balance'
import { getPortalForm } from '../../../utils/portal-form'
import { assertRateLimit } from '../../../utils/rate-limit'
import { getLatestPublishedTerms } from '../../../utils/terms'
import { hashPortalToken } from '../../../utils/portal-token'

export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, 'token') || ''
  const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  assertRateLimit(event, 'portal', `${hashPortalToken(ip).slice(0, 16)}:${hashPortalToken(token).slice(0, 16)}`)

  const access = await resolvePortalAccess(token)
  if (!access) throw createError({ statusCode: 404, statusMessage: 'Deze portaallink is ongeldig of verlopen' })

  await db.update(portalLinks).set({ lastUsedAt: new Date() }).where(eq(portalLinks.id, access.linkId))
  await recordAudit({
    userId: null,
    entityType: 'gig',
    entityId: access.gigId,
    action: 'portal_accessed',
    metadata: { linkId: access.linkId, requestFingerprint: hashPortalToken(ip).slice(0, 16) },
  })
  const finished = gigIsFinished(access)
  const form = await getPortalForm(access.gigId)
  const [review] = await db.select({ rating: gigReviews.rating, comment: gigReviews.comment, createdAt: gigReviews.createdAt })
    .from(gigReviews).where(eq(gigReviews.gigId, access.gigId)).limit(1)
  const [invoice] = await db.select({
    id: invoices.id, invoiceNumber: invoices.invoiceNumber, totalCents: invoices.totalCents, currency: invoices.currency,
    status: invoices.status, paymentStatus: invoices.paymentStatus, dueDate: invoices.dueDate,
    paymentRecordStatus: payments.status, paidAt: payments.paidAt,
  }).from(invoices).leftJoin(payments, eq(payments.invoiceId, invoices.id)).where(and(
    eq(invoices.gigId, access.gigId), ne(invoices.status, 'void'),
  )).orderBy(desc(invoices.finalizedAt), desc(invoices.createdAt)).limit(1)

  const balance = invoice ? await getInvoiceAmountDue({ id: invoice.id, totalCents: invoice.totalCents }) : null

  // The newest quote the client can see: sent, accepted or declined (never a draft or a withdrawn one).
  const [quoteRow] = await db.select().from(quotes)
    .where(and(eq(quotes.gigId, access.gigId), inArray(quotes.status, ['sent', 'accepted', 'declined'])))
    .orderBy(desc(quotes.sentAt)).limit(1)
  const [acceptedTerms] = quoteRow?.acceptedTermsVersionId
    ? await db.select({ version: termsVersions.version }).from(termsVersions).where(eq(termsVersions.id, quoteRow.acceptedTermsVersionId)).limit(1)
    : []
  const latestTerms = await getLatestPublishedTerms()
  const today = todayInAmsterdam()
  const quote = quoteRow?.documentSnapshot
    ? {
        id: quoteRow.id,
        quoteNumber: quoteRow.quoteNumber,
        status: quoteDisplayStatus(quoteRow, today),
        open: quoteIsOpenForResponse(quoteRow, today) && access.status !== 'declined' && access.status !== 'cancelled',
        issueDate: quoteRow.issueDate,
        validUntil: quoteRow.validUntil,
        currency: quoteRow.currency,
        vatMode: quoteRow.vatMode,
        vatRateBasisPoints: quoteRow.vatRateBasisPoints,
        subtotalCents: quoteRow.subtotalCents,
        vatAmountCents: quoteRow.vatAmountCents,
        totalCents: quoteRow.totalCents,
        terms: quoteRow.terms,
        notes: quoteRow.notes,
        lines: quoteRow.documentSnapshot.lines,
        acceptedName: quoteRow.acceptedName,
        acceptedAt: quoteRow.acceptedAt,
        acceptedTermsVersion: acceptedTerms?.version ?? null,
        /** Non-refundable reservation costs, paid after accepting. Null when the quote has none. */
        reservation: quoteRow.reservationCents > 0 ? { cents: quoteRow.reservationCents, paidAt: quoteRow.reservationPaidAt } : null,
        bookingConfirmedAt: quoteRow.bookingConfirmedAt,
        declinedAt: quoteRow.declinedAt,
      }
    : null

  const imageRows = await sql<[{ imageUrl: string | null }]>`
    SELECT coalesce(g.client_portal_image_url, bs.client_portal_default_image_url) AS "imageUrl"
    FROM gigs g
    LEFT JOIN business_settings bs ON bs.key = 'default'
    WHERE g.id = ${access.gigId}
    LIMIT 1
  `

  return {
    gig: {
      id: access.gigId,
      title: access.title,
      eventType: access.eventType,
      status: access.status,
      startsAt: access.startsAt,
      endsAt: access.endsAt,
      imageUrl: imageRows[0]?.imageUrl || null,
      venue: access.venueName ? { name: access.venueName, city: access.venueCity } : null,
    },
    client: {
      name: access.clientCompanyName || [access.clientFirstName, access.clientLastName].filter(Boolean).join(' ') || null,
    },
    expiresAt: access.expiresAt,
    finished,
    review: review || null,
    reviewOpen: finished && access.status === 'booked',
    // Once the gig is over, the party details and music wishes are no longer shown.
    questionnaire: {
      /** Off unless the owner switched the booking form on for this gig. */
      enabled: form.enabled,
      /** The client can still change the form until the party begins. */
      editable: form.enabled && !gigHasStarted(access),
      version: form.templateVersion ?? 0,
      fields: finished || !form.enabled ? [] : form.fields,
      answers: finished ? {} : form.submission?.answers || {},
      status: form.submission?.status || 'not_started',
      acceptedName: form.submission?.acceptedName || null,
      submittedAt: form.submission?.submittedAt || null,
    },
    wishes: finished || !form.enabled ? [] : form.wishes.map(wish => ({
      category: wish.category,
      artist: wish.artist,
      title: wish.title,
      spotifyUrl: wish.spotifyUrl,
      note: wish.note,
      ordering: wish.ordering,
    })),
    invoice: invoice ? { ...invoice, paidCents: balance?.paidCents ?? 0, amountDueCents: balance?.amountDueCents ?? invoice.totalCents } : null,
    quote,
    /** The terms a client accepts together with the quote. Null until the owner has published a version. */
    terms: latestTerms ? { version: latestTerms.version, title: latestTerms.title, summary: latestTerms.summary } : null,
  }
})
