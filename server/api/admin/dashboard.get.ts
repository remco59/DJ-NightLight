import { and, asc, count, eq, gt, isNull, ne } from 'drizzle-orm'
import { gigs, invoices, venues } from '../../../db/schema'
import { db } from '../../utils/db'
import { requireStaff } from '../../utils/require-staff'

export default defineEventHandler(async (event) => {
  await requireStaff(event)

  const now = new Date()

  const [upcomingCountRow] = await db
    .select({ value: count() })
    .from(gigs)
    .where(and(
      eq(gigs.status, 'booked'),
      gt(gigs.startsAt, now),
      isNull(gigs.deletedAt),
    ))

  const [leadCountRow] = await db
    .select({ value: count() })
    .from(gigs)
    .where(and(
      eq(gigs.status, 'lead'),
      isNull(gigs.deletedAt),
    ))

  const upcoming = await db
    .select({
      id: gigs.id,
      title: gigs.title,
      eventType: gigs.eventType,
      startsAt: gigs.startsAt,
      venueName: venues.name,
    })
    .from(gigs)
    .leftJoin(venues, eq(gigs.venueId, venues.id))
    .where(and(
      eq(gigs.status, 'booked'),
      gt(gigs.startsAt, now),
      isNull(gigs.deletedAt),
    ))
    .orderBy(asc(gigs.startsAt))
    .limit(5)

  const [unpaidInvoiceRow] = await db.select({ value: count() }).from(invoices).where(and(
    ne(invoices.status, 'void'),
    ne(invoices.paymentStatus, 'paid'),
  ))

  const leads = leadCountRow?.value ?? 0

  return {
    summary: {
      upcoming: upcomingCountRow?.value ?? 0,
      leads,
      unpaidInvoices: unpaidInvoiceRow?.value ?? 0,
      attention: leads + (unpaidInvoiceRow?.value ?? 0),
    },
    upcoming,
    planned: {
      clientPortal: true,
      finance: true,
      calendarSync: false,
      payments: false,
    },
  }
})
