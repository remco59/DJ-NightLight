import { and, asc, count, eq, gt, isNull, ne } from 'drizzle-orm'
import { gigs, invoices, venues } from '../../../db/schema'
import { db } from '../../utils/db'
import { requireStaff } from '../../utils/require-staff'
import { gigTitleSql } from '../../utils/gig-title'

export default defineEventHandler(async (event) => {
  const user = await requireStaff(event)
  const now = new Date()

  if (user.role === 'content_editor') {
    return {
      summary: { upcoming: 0, leads: 0, unpaidInvoices: 0, attention: 0 },
      upcoming: [],
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

  const [upcomingCountRow] = await db.select({ value: count() }).from(gigs).where(upcomingWhere)
  const [leadCountRow] = await db.select({ value: count() }).from(gigs).where(leadWhere)

  const upcoming = await db
    .select({ id: gigs.id, title: gigTitleSql(), eventType: gigs.eventType, startsAt: gigs.startsAt, venueName: venues.name })
    .from(gigs)
    .leftJoin(venues, eq(gigs.venueId, venues.id))
    .where(upcomingWhere)
    .orderBy(asc(gigs.startsAt))
    .limit(5)

  const unpaidInvoices = user.role === 'dj'
    ? 0
    : (await db.select({ value: count() }).from(invoices).where(and(ne(invoices.status, 'void'), ne(invoices.paymentStatus, 'paid'))))[0]?.value ?? 0
  const leads = leadCountRow?.value ?? 0

  return {
    summary: {
      upcoming: upcomingCountRow?.value ?? 0,
      leads,
      unpaidInvoices,
      attention: leads + unpaidInvoices,
    },
    upcoming,
    planned: { clientPortal: true, finance: true, calendarSync: true, payments: true },
  }
})
