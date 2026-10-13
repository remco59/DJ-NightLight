import { and, asc, eq, gt, inArray, isNull, or, sql } from 'drizzle-orm'
import {
  auditLogs,
  clients,
  contractSubmissions,
  emailJobs,
  gigContacts,
  gigReviews,
  gigs,
  gigTimelineItems,
  invoiceLineItems,
  invoices,
  musicWishes,
  outboxEvents,
  payments,
  portalLinks,
  quoteLineItems,
  quotes,
  venues,
} from '../../db/schema'
import {
  anonymizeBlocker,
  anonymizedClientValues,
  CLIENT_EXPORT_VERSION,
  REMOVED_RECIPIENT,
  scrubQuoteSnapshot,
  type AnonymizeSummary,
} from '../../shared/client-privacy'
import { queueCalendarSync } from './calendar-sync'
import { db } from './db'

async function loadClientGigs(clientId: string) {
  return db.select({ id: gigs.id }).from(gigs).where(eq(gigs.clientId, clientId))
}

/**
 * Everything the app holds about one client, for a data access or portability request.
 * Secrets (portal tokens, hashes, the hashed IP of an acceptance) are left out on purpose.
 */
export async function exportClientData(clientId: string) {
  const [client] = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1)
  if (!client) return null

  const gigRows = await db.select({
    id: gigs.id,
    title: gigs.title,
    eventType: gigs.eventType,
    status: gigs.status,
    startsAt: gigs.startsAt,
    endsAt: gigs.endsAt,
    loadInAt: gigs.loadInAt,
    fee: gigs.fee,
    currency: gigs.currency,
    internalNotes: gigs.internalNotes,
    source: gigs.source,
    createdAt: gigs.createdAt,
    venueName: venues.name,
    venueCity: venues.city,
  }).from(gigs).leftJoin(venues, eq(gigs.venueId, venues.id)).where(eq(gigs.clientId, clientId)).orderBy(asc(gigs.startsAt))
  const gigIds = gigRows.map(gig => gig.id)
  const forGigs = <T>(query: (ids: string[]) => Promise<T[]>) => gigIds.length ? query(gigIds) : Promise.resolve([] as T[])

  const contacts = await forGigs(ids => db.select({
    gigId: gigContacts.gigId, name: gigContacts.name, role: gigContacts.role, email: gigContacts.email, phone: gigContacts.phone, notes: gigContacts.notes,
  }).from(gigContacts).where(inArray(gigContacts.gigId, ids)))
  const timeline = await forGigs(ids => db.select({
    gigId: gigTimelineItems.gigId, time: gigTimelineItems.time, title: gigTimelineItems.title, description: gigTimelineItems.description,
  }).from(gigTimelineItems).where(inArray(gigTimelineItems.gigId, ids)).orderBy(asc(gigTimelineItems.ordering)))

  const quoteRows = await db.select({
    id: quotes.id, gigId: quotes.gigId, quoteNumber: quotes.quoteNumber, status: quotes.status, issueDate: quotes.issueDate, validUntil: quotes.validUntil,
    currency: quotes.currency, subtotalCents: quotes.subtotalCents, vatAmountCents: quotes.vatAmountCents, totalCents: quotes.totalCents,
    terms: quotes.terms, notes: quotes.notes, sentAt: quotes.sentAt, acceptedAt: quotes.acceptedAt, acceptedName: quotes.acceptedName,
    declinedAt: quotes.declinedAt, declineReason: quotes.declineReason,
  }).from(quotes).where(eq(quotes.clientId, clientId)).orderBy(asc(quotes.createdAt))
  const quoteLines = quoteRows.length
    ? await db.select({ quoteId: quoteLineItems.quoteId, description: quoteLineItems.description, quantity: quoteLineItems.quantity, unitPriceCents: quoteLineItems.unitPriceCents })
      .from(quoteLineItems).where(inArray(quoteLineItems.quoteId, quoteRows.map(quote => quote.id))).orderBy(asc(quoteLineItems.ordering))
    : []

  const invoiceRows = await db.select({
    id: invoices.id, gigId: invoices.gigId, invoiceNumber: invoices.invoiceNumber, status: invoices.status, paymentStatus: invoices.paymentStatus,
    issueDate: invoices.issueDate, dueDate: invoices.dueDate, currency: invoices.currency, subtotalCents: invoices.subtotalCents,
    vatAmountCents: invoices.vatAmountCents, totalCents: invoices.totalCents, notes: invoices.notes,
  }).from(invoices).where(eq(invoices.clientId, clientId)).orderBy(asc(invoices.issueDate))
  const invoiceIds = invoiceRows.map(invoice => invoice.id)
  const invoiceLines = invoiceIds.length
    ? await db.select({ invoiceId: invoiceLineItems.invoiceId, description: invoiceLineItems.description, quantity: invoiceLineItems.quantity, unitPriceCents: invoiceLineItems.unitPriceCents })
      .from(invoiceLineItems).where(inArray(invoiceLineItems.invoiceId, invoiceIds)).orderBy(asc(invoiceLineItems.ordering))
    : []
  const paymentRows = invoiceIds.length
    ? await db.select({ invoiceId: payments.invoiceId, provider: payments.provider, status: payments.status, amountCents: payments.amountCents, currency: payments.currency, paidAt: payments.paidAt })
      .from(payments).where(inArray(payments.invoiceId, invoiceIds))
    : []

  const submissions = await forGigs(ids => db.select({
    gigId: contractSubmissions.gigId, status: contractSubmissions.status, answers: contractSubmissions.answers,
    acceptedName: contractSubmissions.acceptedName, acceptedAt: contractSubmissions.acceptedAt, submittedAt: contractSubmissions.submittedAt,
  }).from(contractSubmissions).where(inArray(contractSubmissions.gigId, ids)))
  const wishes = await forGigs(ids => db.select({
    gigId: musicWishes.gigId, category: musicWishes.category, artist: musicWishes.artist, title: musicWishes.title, spotifyUrl: musicWishes.spotifyUrl, note: musicWishes.note,
  }).from(musicWishes).where(inArray(musicWishes.gigId, ids)).orderBy(asc(musicWishes.ordering)))
  const reviews = await forGigs(ids => db.select({
    gigId: gigReviews.gigId, rating: gigReviews.rating, comment: gigReviews.comment, authorName: gigReviews.authorName,
    publicConsent: gigReviews.publicConsent, published: gigReviews.published, createdAt: gigReviews.createdAt,
  }).from(gigReviews).where(inArray(gigReviews.gigId, ids)))
  const links = await forGigs(ids => db.select({
    gigId: portalLinks.gigId, createdAt: portalLinks.createdAt, expiresAt: portalLinks.expiresAt, revokedAt: portalLinks.revokedAt,
    lastUsedAt: portalLinks.lastUsedAt, invitationCount: portalLinks.invitationCount,
  }).from(portalLinks).where(inArray(portalLinks.gigId, ids)))

  const addresses = [client.email, client.invoiceEmail].filter((value): value is string => Boolean(value)).map(value => value.toLowerCase())
  const mailFilters = [gigIds.length ? inArray(emailJobs.gigId, gigIds) : undefined, addresses.length ? inArray(sql`lower(${emailJobs.recipient})`, addresses) : undefined].filter(Boolean)
  const emails = mailFilters.length
    ? await db.select({
      templateKey: emailJobs.templateKey, recipient: emailJobs.recipient, status: emailJobs.status, runAt: emailJobs.runAt, sentAt: emailJobs.sentAt, variables: emailJobs.variables,
      subject: emailJobs.subjectOverride, manual: emailJobs.manual,
    }).from(emailJobs).where(or(...mailFilters)).orderBy(asc(emailJobs.runAt))
    : []

  return {
    export: { version: CLIENT_EXPORT_VERSION, exportedAt: new Date().toISOString(), note: 'Alle gegevens die DJ NightLight over deze klant bewaart. Geheime toegangscodes zijn bewust weggelaten.' },
    client: {
      id: client.id, type: client.type, firstName: client.firstName, lastName: client.lastName, companyName: client.companyName, email: client.email,
      invoiceEmail: client.invoiceEmail, phone: client.phone, billingAddress: client.billingAddress, notes: client.notes,
      stripeCustomerId: client.stripeCustomerId, emailAutomationDisabled: client.emailAutomationDisabled, createdAt: client.createdAt,
    },
    gigs: gigRows.map(gig => ({
      ...gig,
      contacts: contacts.filter(item => item.gigId === gig.id).map(({ gigId: _gigId, ...rest }) => rest),
      timeline: timeline.filter(item => item.gigId === gig.id).map(({ gigId: _gigId, ...rest }) => rest),
      questionnaire: submissions.filter(item => item.gigId === gig.id).map(({ gigId: _gigId, ...rest }) => rest)[0] ?? null,
      musicWishes: wishes.filter(item => item.gigId === gig.id).map(({ gigId: _gigId, ...rest }) => rest),
      review: reviews.filter(item => item.gigId === gig.id).map(({ gigId: _gigId, ...rest }) => rest)[0] ?? null,
      portalLinks: links.filter(item => item.gigId === gig.id).map(({ gigId: _gigId, ...rest }) => rest),
    })),
    quotes: quoteRows.map(quote => ({ ...quote, lines: quoteLines.filter(line => line.quoteId === quote.id).map(({ quoteId: _quoteId, ...rest }) => rest) })),
    invoices: invoiceRows.map(invoice => ({
      ...invoice,
      lines: invoiceLines.filter(line => line.invoiceId === invoice.id).map(({ invoiceId: _invoiceId, ...rest }) => rest),
      payment: paymentRows.filter(payment => payment.invoiceId === invoice.id).map(({ invoiceId: _invoiceId, ...rest }) => rest)[0] ?? null,
    })),
    emails,
  }
}

export async function countUpcomingBookedGigs(clientId: string, now = new Date()) {
  const rows = await db.select({ id: gigs.id }).from(gigs)
    .where(and(eq(gigs.clientId, clientId), eq(gigs.status, 'booked'), isNull(gigs.deletedAt), gt(gigs.startsAt, now)))
  return rows.length
}

/**
 * Erases a client's personal data while keeping what the law makes us keep: invoices and their frozen documents.
 * The client row stays, as "Verwijderde klant", because invoices point at it. Returns what was done,
 * or `{ blocked }` when a booked gig is still to come.
 */
export async function anonymizeClient(clientId: string, userId: string): Promise<{ blocked: string } | { summary: AnonymizeSummary } | null> {
  const [client] = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1)
  if (!client) return null
  const blocker = anonymizeBlocker(await countUpcomingBookedGigs(clientId))
  if (blocker) return { blocked: blocker }

  const gigIds = (await loadClientGigs(clientId)).map(gig => gig.id)
  const addresses = [client.email, client.invoiceEmail].filter((value): value is string => Boolean(value)).map(value => value.toLowerCase())
  const now = new Date()

  const summary = await db.transaction(async (tx) => {
    const quoteRows = await tx.select({ id: quotes.id, documentSnapshot: quotes.documentSnapshot }).from(quotes).where(eq(quotes.clientId, clientId))
    const quoteIds = quoteRows.map(quote => quote.id)
    const reviewRows = gigIds.length ? await tx.select({ id: gigReviews.id }).from(gigReviews).where(inArray(gigReviews.gigId, gigIds)) : []
    const invoiceCount = await tx.select({ id: invoices.id }).from(invoices).where(eq(invoices.clientId, clientId))

    await tx.update(clients).set({ ...anonymizedClientValues(), emailAutomationDisabled: [], updatedAt: now }).where(eq(clients.id, clientId))

    let contactsRemoved = 0
    let portalLinksRevoked = 0
    if (gigIds.length) {
      contactsRemoved = (await tx.delete(gigContacts).where(inArray(gigContacts.gigId, gigIds)).returning({ id: gigContacts.id })).length
      // The gig name often holds the client's name (a website inquiry is named after them), so it goes with the notes.
      await tx.update(gigs).set({ title: null, internalNotes: null, updatedAt: now }).where(inArray(gigs.id, gigIds))
      await tx.update(contractSubmissions).set({ answers: {}, acceptedName: null, updatedAt: now }).where(inArray(contractSubmissions.gigId, gigIds))
      await tx.update(musicWishes).set({ note: null, updatedAt: now }).where(inArray(musicWishes.gigId, gigIds))
      await tx.update(gigReviews).set({ authorName: null, comment: null, publicConsent: false, published: false }).where(inArray(gigReviews.gigId, gigIds))
      portalLinksRevoked = (await tx.update(portalLinks).set({ revokedAt: now, tokenEncrypted: null })
        .where(and(inArray(portalLinks.gigId, gigIds), isNull(portalLinks.revokedAt))).returning({ id: portalLinks.id })).length
      await tx.update(auditLogs).set({ metadata: sql`${auditLogs.metadata} - 'acceptedName'` })
        .where(and(eq(auditLogs.entityType, 'gig'), inArray(auditLogs.entityId, gigIds), eq(auditLogs.action, 'quote_accepted')))
    }

    if (quoteRows.length) {
      await tx.update(quotes).set({ acceptedName: null, acceptedIpHash: null, declineReason: null, notes: '', updatedAt: now }).where(inArray(quotes.id, quoteIds))
      for (const quote of quoteRows) {
        if (quote.documentSnapshot) await tx.update(quotes).set({ documentSnapshot: scrubQuoteSnapshot(quote.documentSnapshot) }).where(eq(quotes.id, quote.id))
      }
    }

    // Mail to this client: nothing pending goes out any more, and no address or content stays on the rows.
    const mailFilters = [gigIds.length ? inArray(emailJobs.gigId, gigIds) : undefined, addresses.length ? inArray(sql`lower(${emailJobs.recipient})`, addresses) : undefined].filter(Boolean)
    let emailsScrubbed = 0
    if (mailFilters.length) {
      const filter = or(...mailFilters)!
      await tx.update(emailJobs).set({ status: 'cancelled', updatedAt: now }).where(and(filter, inArray(emailJobs.status, ['pending', 'failed', 'processing'])))
      emailsScrubbed = (await tx.update(emailJobs).set({ recipient: REMOVED_RECIPIENT, variables: {}, subjectOverride: null, bodyOverride: null, attachments: [], updatedAt: now }).where(filter).returning({ id: emailJobs.id })).length
    }

    // Owner notifications in the outbox carry the client's name and contact details.
    const outboxIds = [...gigIds, ...quoteIds, ...reviewRows.map(review => review.id)]
    if (outboxIds.length) await tx.delete(outboxEvents).where(and(eq(outboxEvents.type, 'owner_notification'), inArray(outboxEvents.aggregateId, outboxIds)))

    await tx.insert(auditLogs).values({
      userId, entityType: 'client', entityId: clientId, action: 'anonymized',
      metadata: { gigs: gigIds.length, invoicesKept: invoiceCount.length, emailsScrubbed },
    })
    return { gigs: gigIds.length, contactsRemoved, invoicesKept: invoiceCount.length, emailsScrubbed, portalLinksRevoked } satisfies AnonymizeSummary
  })

  // Calendar events were made from the gig name and notes, so let them catch up.
  for (const gigId of gigIds) await queueCalendarSync(gigId)
  return { summary }
}
