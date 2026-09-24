import { and, asc, count, desc, eq, gt, gte, isNull, lt, lte, ne } from 'drizzle-orm'
import { contractSubmissions, gigs, invoices, venues } from '../../../db/schema'
import { db } from '../../utils/db'
import { requireStaff } from '../../utils/require-staff'
import { gigTitleSql } from '../../utils/gig-title'

function dateOnly(value: Date) {
  return value.toISOString().slice(0, 10)
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
      summary: { upcoming: 0, leads: 0, unpaidInvoices: 0, unpaidAmountCents: 0, attention: 0 },
      upcoming: [],
      attention: [],
      week: { gigs: 0, bookedRevenueCents: 0, invoicesDue: 0, contractsOpen: 0 },
      planned: { clientPortal: true, finance: true, calendarSync: true, payments: true },
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
    })
    .from(gigs)
    .leftJoin(venues, eq(gigs.venueId, venues.id))
    .where(upcomingWhere)
    .orderBy(asc(gigs.startsAt))
    .limit(5)

  const invoiceWhere = and(ne(invoices.status, 'void'), ne(invoices.paymentStatus, 'paid'))
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
      href: `/admin/gigs/${invoice.gigId}`,
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
      title: 'Nieuwe lead in behandeling',
      description: `${lead.title}${lead.venueName ? ` · ${lead.venueName}` : ''}`,
      meta: lead.createdAt,
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

  return {
    summary: {
      upcoming: upcomingCountRow?.value ?? 0,
      leads,
      unpaidInvoices,
      unpaidAmountCents,
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
    planned: { clientPortal: true, finance: true, calendarSync: true, payments: true },
  }
})
