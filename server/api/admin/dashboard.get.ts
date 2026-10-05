import { and, asc, count, desc, eq, gt, gte, isNull, lt, lte, ne } from 'drizzle-orm'
import { contractSubmissions, emailJobs, gigCalendarSync, gigs, invoices, outboxEvents, payments, venues } from '../../../db/schema'
import { db } from '../../utils/db'
import { requireStaff } from '../../utils/require-staff'
import { gigTitleSql } from '../../utils/gig-title'
import { emailProviderConfigured } from '../../utils/email-provider'
import { stripeStatus } from '../../utils/stripe-settings'

function dateOnly(value: Date) {
  return value.toISOString().slice(0, 10)
}

function shortDate(value: Date) {
  return new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short', timeZone: 'Europe/Amsterdam' }).format(value).replace('.', '')
}

function startOfWeek(value: Date) {
  const date = new Date(value)
  const day = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() - day + 1)
  date.setUTCHours(0, 0, 0, 0)
  return date
}

export default defineEventHandler(async (event) => {
  const user = await requireStaff(event)
  const now = new Date()

  if (user.role === 'content_editor') {
    return {
      summary: { upcoming: 0, leads: 0, unpaidInvoices: 0, unpaidAmountCents: 0, bookedRevenueThisMonthCents: 0, attention: 0 },
      upcoming: [],
      attention: [],
      week: { gigs: 0, bookedRevenueCents: 0, invoicesDue: 0, contractsOpen: 0 },
      system: { issues: 0, warnings: [] as Array<{ label: string, to: string }> },
    }
  }

  const assignment = user.role === 'dj' ? eq(gigs.assignedUserId, user.id) : null
  const upcomingWhere = assignment
    ? and(eq(gigs.status, 'booked'), gt(gigs.startsAt, now), isNull(gigs.deletedAt), assignment)
    : and(eq(gigs.status, 'booked'), gt(gigs.startsAt, now), isNull(gigs.deletedAt))
  const leadWhere = assignment
    ? and(eq(gigs.status, 'lead'), isNull(gigs.deletedAt), assignment)
    : and(eq(gigs.status, 'lead'), isNull(gigs.deletedAt))

  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
  const weekStart = startOfWeek(now)
  const weekEnd = new Date(weekStart)
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7)
  weekEnd.setUTCMilliseconds(-1)
  const today = dateOnly(now)
  const weekStartDate = dateOnly(weekStart)
  const weekEndDate = dateOnly(weekEnd)

  const [upcomingCountRow] = await db.select({ value: count() }).from(gigs).where(upcomingWhere)
  const [leadCountRow] = await db.select({ value: count() }).from(gigs).where(leadWhere)

  const monthGigWhere = assignment
    ? and(
        eq(gigs.status, 'booked'),
        gte(gigs.startsAt, monthStart),
        lt(gigs.startsAt, monthEnd),
        isNull(gigs.deletedAt),
        assignment,
      )
    : and(
        eq(gigs.status, 'booked'),
        gte(gigs.startsAt, monthStart),
        lt(gigs.startsAt, monthEnd),
        isNull(gigs.deletedAt),
      )

  const monthGigs = await db
    .select({ fee: gigs.fee })
    .from(gigs)
    .where(monthGigWhere)

  const bookedRevenueThisMonthCents = monthGigs.reduce((total, gig) => {
    return total + Math.round(Number(gig.fee ?? 0) * 100)
  }, 0)

  const upcoming = await db
    .select({
      id: gigs.id,
      title: gigTitleSql(),
      eventType: gigs.eventType,
      startsAt: gigs.startsAt,
      endsAt: gigs.endsAt,
      venueName: venues.name,
    })
    .from(gigs)
    .leftJoin(venues, eq(gigs.venueId, venues.id))
    .where(upcomingWhere)
    .orderBy(asc(gigs.startsAt))
    .limit(5)

  // Only finalized invoices are owed; drafts have not been sent to anyone yet.
  const invoiceWhere = and(eq(invoices.status, 'finalized'), ne(invoices.paymentStatus, 'paid'))
  const unpaidInvoiceRows = user.role === 'dj'
    ? []
    : await db
        .select({ totalCents: invoices.totalCents })
        .from(invoices)
        .where(invoiceWhere)

  const unpaidInvoices = unpaidInvoiceRows.length
  const unpaidAmountCents = unpaidInvoiceRows.reduce((total, invoice) => total + invoice.totalCents, 0)
  const leads = leadCountRow?.value ?? 0

  const overdueInvoices = user.role === 'dj'
    ? []
    : await db
        .select({
          id: invoices.id,
          gigId: invoices.gigId,
          invoiceNumber: invoices.invoiceNumber,
          dueDate: invoices.dueDate,
          totalCents: invoices.totalCents,
          gigTitle: gigTitleSql(),
        })
        .from(invoices)
        .innerJoin(gigs, eq(invoices.gigId, gigs.id))
        .where(and(invoiceWhere, lt(invoices.dueDate, today)))
        .orderBy(asc(invoices.dueDate))
        .limit(3)

  const [overdueCountRow] = user.role === 'dj'
    ? [{ value: 0 }]
    : await db
        .select({ value: count() })
        .from(invoices)
        .where(and(invoiceWhere, lt(invoices.dueDate, today)))

  const openContractWhere = assignment
    ? and(
        eq(gigs.status, 'booked'),
        gt(gigs.startsAt, now),
        isNull(gigs.deletedAt),
        assignment,
        isNull(contractSubmissions.acceptedAt),
      )
    : and(
        eq(gigs.status, 'booked'),
        gt(gigs.startsAt, now),
        isNull(gigs.deletedAt),
        isNull(contractSubmissions.acceptedAt),
      )

  const openContracts = await db
    .select({
      gigId: gigs.id,
      title: gigTitleSql(),
      startsAt: gigs.startsAt,
    })
    .from(gigs)
    .leftJoin(contractSubmissions, eq(contractSubmissions.gigId, gigs.id))
    .where(openContractWhere)
    .orderBy(asc(gigs.startsAt))
    .limit(3)

  const [openContractCountRow] = await db
    .select({ value: count() })
    .from(gigs)
    .leftJoin(contractSubmissions, eq(contractSubmissions.gigId, gigs.id))
    .where(openContractWhere)

  const leadItems = await db
    .select({
      gigId: gigs.id,
      title: gigTitleSql(),
      createdAt: gigs.createdAt,
      startsAt: gigs.startsAt,
      venueName: venues.name,
    })
    .from(gigs)
    .leftJoin(venues, eq(gigs.venueId, venues.id))
    .where(leadWhere)
    .orderBy(desc(gigs.createdAt))
    .limit(3)

  const attention = [
    ...overdueInvoices.map(invoice => ({
      id: `invoice-${invoice.id}`,
      kind: 'invoice' as const,
      title: 'Factuur verlopen',
      description: `${invoice.invoiceNumber ? `Factuur ${invoice.invoiceNumber}` : 'Factuur'} voor ${invoice.gigTitle} is over de vervaldatum.`,
      meta: invoice.dueDate,
      href: `/admin/invoices/${invoice.id}`,
    })),
    ...openContracts.map(contract => ({
      id: `contract-${contract.gigId}`,
      kind: 'contract' as const,
      title: 'Contract wacht op handtekening',
      description: `Het contract voor ${contract.title} is nog niet ondertekend.`,
      meta: contract.startsAt,
      href: `/admin/gigs/${contract.gigId}`,
    })),
    ...leadItems.map(lead => ({
      id: `lead-${lead.gigId}`,
      kind: 'lead' as const,
      title: lead.title,
      description: `Nieuwe aanvraag · binnengekomen ${shortDate(lead.createdAt)}${lead.venueName && lead.venueName !== lead.title ? ` · ${lead.venueName}` : ''}`,
      // The calendar date on a lead row is the event date, not when the request came in.
      meta: lead.startsAt,
      href: `/admin/gigs/${lead.gigId}`,
    })),
  ].slice(0, 3)

  const weekGigWhere = assignment
    ? and(
        eq(gigs.status, 'booked'),
        gte(gigs.startsAt, weekStart),
        lte(gigs.startsAt, weekEnd),
        isNull(gigs.deletedAt),
        assignment,
      )
    : and(
        eq(gigs.status, 'booked'),
        gte(gigs.startsAt, weekStart),
        lte(gigs.startsAt, weekEnd),
        isNull(gigs.deletedAt),
      )

  const weekGigs = await db
    .select({ fee: gigs.fee })
    .from(gigs)
    .where(weekGigWhere)

  const invoicesDue = user.role === 'dj'
    ? 0
    : (await db
        .select({ value: count() })
        .from(invoices)
        .where(and(invoiceWhere, gte(invoices.dueDate, weekStartDate), lte(invoices.dueDate, weekEndDate))))[0]?.value ?? 0

  const bookedRevenueCents = weekGigs.reduce((total, gig) => {
    return total + Math.round(Number(gig.fee ?? 0) * 100)
  }, 0)

  const contractsOpen = openContractCountRow?.value ?? 0
  const attentionCount = (overdueCountRow?.value ?? 0) + contractsOpen + leads

  const staleOutboxBefore = new Date(Date.now() - 5 * 60_000)
  const [failedEmailsRow, failedCalendarRow, failedPaymentsRow, staleOutboxRow] = await Promise.all([
    db.select({ value: count() }).from(emailJobs).where(eq(emailJobs.status, 'failed')).then(rows => rows[0]),
    db.select({ value: count() }).from(gigCalendarSync).where(eq(gigCalendarSync.status, 'failed')).then(rows => rows[0]),
    db.select({ value: count() }).from(payments).where(eq(payments.status, 'failed')).then(rows => rows[0]),
    db.select({ value: count() }).from(outboxEvents).where(and(isNull(outboxEvents.processedAt), lt(outboxEvents.occurredAt, staleOutboxBefore))).then(rows => rows[0]),
  ])
  const systemIssues = Number(failedEmailsRow?.value || 0)
    + Number(failedCalendarRow?.value || 0)
    + Number(failedPaymentsRow?.value || 0)
    + Number(staleOutboxRow?.value || 0)

  // Missing configuration is not a failure yet, but it silently stops client-facing work.
  const [emailReady, stripe] = await Promise.all([emailProviderConfigured(), stripeStatus()])
  const warnings: Array<{ label: string, to: string }> = []
  if (!emailReady) warnings.push({ label: 'E-mails aan klanten worden niet verstuurd: er is geen e-mailprovider ingesteld.', to: '/admin/settings' })
  if (!stripe.keyConfigured) warnings.push({ label: 'Klanten kunnen niet online betalen: Stripe is niet gekoppeld.', to: '/admin/settings' })

  return {
    summary: {
      upcoming: upcomingCountRow?.value ?? 0,
      leads,
      unpaidInvoices,
      unpaidAmountCents,
      bookedRevenueThisMonthCents,
      attention: attentionCount,
    },
    upcoming,
    attention,
    week: {
      gigs: weekGigs.length,
      bookedRevenueCents,
      invoicesDue,
      contractsOpen,
    },
    system: { issues: systemIssues, warnings },
  }
})
