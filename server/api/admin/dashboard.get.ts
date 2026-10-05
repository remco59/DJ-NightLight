import { and, asc, count, desc, eq, gt, gte, inArray, isNull, lt, lte, ne, sql } from 'drizzle-orm'
import { clients, contractSubmissions, emailJobs, gigCalendarSync, gigs, invoices, outboxEvents, payments, venues } from '../../../db/schema'
import { db } from '../../utils/db'
import { requireStaff } from '../../utils/require-staff'
import { gigTitleSql } from '../../utils/gig-title'
import { emailProviderConfigured } from '../../utils/email-provider'
import { stripeStatus } from '../../utils/stripe-settings'
import { addMonths, buildRevenueSeries, countdownLabel, daysBetween, gigUrgency, monthKey, revenueTrend } from '../../../shared/dashboard'
import type { Urgency } from '../../../shared/dashboard'

function dateOnly(value: Date) {
  return value.toISOString().slice(0, 10)
}

function shortDate(value: Date) {
  return new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short', timeZone: 'Europe/Amsterdam' }).format(value).replace('.', '')
}

function formatEuro(cents: number) {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(cents / 100)
}

function clientName(client: { companyName: string | null, firstName: string | null, lastName: string | null }) {
  return client.companyName?.trim() || [client.firstName, client.lastName].filter(Boolean).join(' ').trim() || null
}

function monthStartDate(key: string) {
  const [year, month] = key.split('-').map(Number) as [number, number]
  return new Date(Date.UTC(year, month - 1, 1))
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
      summary: { upcoming: 0, leads: 0, unpaidInvoices: 0, unpaidAmountCents: 0, overdueInvoices: 0, overdueAmountCents: 0, bookedRevenueThisMonthCents: 0, attention: 0 },
      upcoming: [],
      attention: [],
      week: { gigs: 0, bookedRevenueCents: 0, invoicesDue: 0, contractsOpen: 0 },
      nextGigChecklist: null,
      revenue: { months: [], previousMonthCents: 0, trendPercent: null },
      calendarGigs: [],
      generatedAt: now.toISOString(),
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

  const weekStart = startOfWeek(now)
  const weekEnd = new Date(weekStart)
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7)
  weekEnd.setUTCMilliseconds(-1)
  const today = dateOnly(now)
  const weekStartDate = dateOnly(weekStart)
  const weekEndDate = dateOnly(weekEnd)

  const [upcomingCountRow] = await db.select({ value: count() }).from(gigs).where(upcomingWhere)
  const [leadCountRow] = await db.select({ value: count() }).from(gigs).where(leadWhere)

  const upcoming = await db
    .select({
      id: gigs.id,
      title: gigTitleSql(),
      eventType: gigs.eventType,
      startsAt: gigs.startsAt,
      endsAt: gigs.endsAt,
      venueName: venues.name,
      feeCents: sql<number>`round(coalesce(${gigs.fee}, 0) * 100)::int`,
      clientCompany: clients.companyName,
      clientFirstName: clients.firstName,
      clientLastName: clients.lastName,
    })
    .from(gigs)
    .leftJoin(venues, eq(gigs.venueId, venues.id))
    .leftJoin(clients, eq(gigs.clientId, clients.id))
    .where(upcomingWhere)
    .orderBy(asc(gigs.startsAt))
    .limit(6)

  // Contract and invoice progress for the gigs we list, in two queries instead of one per row.
  const upcomingIds = upcoming.map(gig => gig.id)
  const contractRows = upcomingIds.length
    ? await db
        .select({ gigId: contractSubmissions.gigId, acceptedAt: contractSubmissions.acceptedAt, status: contractSubmissions.status })
        .from(contractSubmissions)
        .where(inArray(contractSubmissions.gigId, upcomingIds))
    : []
  const invoiceRows = upcomingIds.length && user.role !== 'dj'
    ? await db
        .select({ gigId: invoices.gigId, paymentStatus: invoices.paymentStatus, dueDate: invoices.dueDate })
        .from(invoices)
        .where(and(inArray(invoices.gigId, upcomingIds), eq(invoices.status, 'finalized')))
    : []
  const contractByGig = new Map(contractRows.map(row => [row.gigId, row]))
  function invoiceState(gigId: string): 'none' | 'open' | 'overdue' | 'paid' {
    const rows = invoiceRows.filter(row => row.gigId === gigId)
    if (!rows.length) return 'none'
    if (rows.every(row => row.paymentStatus === 'paid')) return 'paid'
    return rows.some(row => row.paymentStatus !== 'paid' && row.dueDate && row.dueDate < today) ? 'overdue' : 'open'
  }

  const upcomingGigs = upcoming.map(({ clientCompany, clientFirstName, clientLastName, ...gig }) => {
    const contract = contractByGig.get(gig.id)
    const daysUntil = gig.startsAt ? daysBetween(now, new Date(gig.startsAt)) : null
    const contractSigned = Boolean(contract?.acceptedAt)
    return {
      ...gig,
      clientName: clientName({ companyName: clientCompany, firstName: clientFirstName, lastName: clientLastName }),
      daysUntil,
      countdown: daysUntil === null ? null : countdownLabel(daysUntil),
      contractSigned,
      invoice: invoiceState(gig.id),
      urgency: (daysUntil === null ? 'normal' : gigUrgency(daysUntil, contractSigned ? 0 : 1)) as Urgency,
    }
  })

  // Only finalized invoices are owed; drafts have not been sent to anyone yet.
  const invoiceWhere = and(eq(invoices.status, 'finalized'), ne(invoices.paymentStatus, 'paid'))
  const unpaidInvoiceRows = user.role === 'dj'
    ? []
    : await db
        .select({ totalCents: invoices.totalCents, dueDate: invoices.dueDate })
        .from(invoices)
        .where(invoiceWhere)

  const unpaidInvoices = unpaidInvoiceRows.length
  const unpaidAmountCents = unpaidInvoiceRows.reduce((total, invoice) => total + invoice.totalCents, 0)
  const overdueRows = unpaidInvoiceRows.filter(invoice => invoice.dueDate && invoice.dueDate < today)
  const overdueAmountCents = overdueRows.reduce((total, invoice) => total + invoice.totalCents, 0)
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
    .limit(5)

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

  // Most urgent first: money that is late, then contracts for gigs that are close, then new requests.
  const attention = [
    ...overdueInvoices.map(invoice => ({
      id: `invoice-${invoice.id}`,
      kind: 'invoice' as const,
      title: invoice.gigTitle,
      description: `${invoice.invoiceNumber ? `Factuur ${invoice.invoiceNumber}` : 'Factuur'} is over de vervaldatum · ${formatEuro(invoice.totalCents)}`,
      meta: invoice.dueDate,
      metaLabel: 'Vervallen',
      urgency: 'danger' as Urgency,
      href: `/admin/invoices/${invoice.id}`,
    })),
    ...openContracts.map((contract) => {
      const daysUntil = contract.startsAt ? daysBetween(now, new Date(contract.startsAt)) : null
      return {
        id: `contract-${contract.gigId}`,
        kind: 'contract' as const,
        title: contract.title,
        description: daysUntil === null ? 'Contract nog niet ondertekend' : `Contract nog niet ondertekend · gig ${countdownLabel(daysUntil)}`,
        meta: contract.startsAt,
        metaLabel: 'Gig',
        urgency: (daysUntil === null ? 'normal' : gigUrgency(daysUntil, 1)) as Urgency,
        href: `/admin/gigs/${contract.gigId}`,
      }
    }),
    ...leadItems.map(lead => ({
      id: `lead-${lead.gigId}`,
      kind: 'lead' as const,
      title: lead.title,
      description: `Nieuwe aanvraag · binnengekomen ${shortDate(lead.createdAt)}${lead.venueName && lead.venueName !== lead.title ? ` · ${lead.venueName}` : ''}`,
      // The calendar date on a lead row is the event date, not when the request came in.
      meta: lead.startsAt,
      metaLabel: 'Event',
      urgency: 'warn' as Urgency,
      href: `/admin/gigs/${lead.gigId}`,
    })),
  ].slice(0, 5)

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

  // Booked revenue for the chart: five months back, this month and six ahead.
  const thisMonth = monthKey(now)
  const chartStart = monthStartDate(addMonths(thisMonth, -5))
  chartStart.setUTCDate(chartStart.getUTCDate() - 1)
  const chartEnd = monthStartDate(addMonths(thisMonth, 7))
  chartEnd.setUTCDate(chartEnd.getUTCDate() + 1)
  const chartWhere = and(
    eq(gigs.status, 'booked'),
    gte(gigs.startsAt, chartStart),
    lt(gigs.startsAt, chartEnd),
    isNull(gigs.deletedAt),
    ...(assignment ? [assignment] : []),
  )
  const chartGigs = await db
    .select({ startsAt: gigs.startsAt, feeCents: sql<number>`round(coalesce(${gigs.fee}, 0) * 100)::int` })
    .from(gigs)
    .where(chartWhere)
  const revenueMonths = buildRevenueSeries(chartGigs, now)
  const currentMonthCents = revenueMonths.find(month => month.current)?.cents ?? 0
  const previousMonthCents = revenueMonths.find(month => month.key === addMonths(thisMonth, -1))?.cents ?? 0

  // Gigs for the mini calendar: last month, this month and the two after, so it can page without refetching.
  const calendarStart = monthStartDate(addMonths(thisMonth, -1))
  calendarStart.setUTCDate(calendarStart.getUTCDate() - 1)
  const calendarEnd = monthStartDate(addMonths(thisMonth, 3))
  calendarEnd.setUTCDate(calendarEnd.getUTCDate() + 1)
  const calendarGigs = await db
    .select({ id: gigs.id, title: gigTitleSql(), startsAt: gigs.startsAt })
    .from(gigs)
    .where(and(
      eq(gigs.status, 'booked'),
      gte(gigs.startsAt, calendarStart),
      lt(gigs.startsAt, calendarEnd),
      isNull(gigs.deletedAt),
      ...(assignment ? [assignment] : []),
    ))
    .orderBy(asc(gigs.startsAt))
    .limit(200)

  const nextGig = upcomingGigs[0]
  const nextContract = nextGig ? contractByGig.get(nextGig.id) : undefined
  const nextGigChecklist = nextGig
    ? {
        contractSigned: nextGig.contractSigned,
        questionnaireSubmitted: nextContract?.status === 'submitted',
        // Invoices are not shown to DJs, so they get no invoice step.
        invoice: user.role === 'dj' ? null : nextGig.invoice,
      }
    : null

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
      overdueInvoices: overdueRows.length,
      overdueAmountCents,
      bookedRevenueThisMonthCents: currentMonthCents,
      attention: attentionCount,
    },
    upcoming: upcomingGigs,
    attention,
    week: {
      gigs: weekGigs.length,
      bookedRevenueCents,
      invoicesDue,
      contractsOpen,
    },
    nextGigChecklist,
    revenue: { months: revenueMonths, previousMonthCents, trendPercent: revenueTrend(currentMonthCents, previousMonthCents) },
    calendarGigs,
    generatedAt: now.toISOString(),
    system: { issues: systemIssues, warnings },
  }
})
