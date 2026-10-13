import { and, gte, inArray, isNull, lte, ne } from 'drizzle-orm'
import { gigs } from '../../db/schema'
import { gigWindow, windowsOverlap, type GigTimes } from '../../shared/gig-overlap'
import { db } from './db'
import { gigTitleSql } from './gig-title'

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Other leads and booked gigs whose time overlaps the given gig times.
 * Declined and cancelled gigs, and archived ones, never conflict.
 */
export async function findConflictingGigs(times: GigTimes, excludeId?: string | null) {
  const window = gigWindow(times)
  if (!window) return []

  // A gig starting up to two days before could still run into the window, so fetch generously and compare exactly.
  const rows = await db
    .select({
      id: gigs.id,
      title: gigTitleSql(),
      status: gigs.status,
      startsAt: gigs.startsAt,
      endsAt: gigs.endsAt,
      loadInAt: gigs.loadInAt,
    })
    .from(gigs)
    .where(and(
      inArray(gigs.status, ['lead', 'booked']),
      isNull(gigs.deletedAt),
      gte(gigs.startsAt, new Date(window.start - 2 * DAY_MS)),
      lte(gigs.startsAt, new Date(window.end)),
      excludeId ? ne(gigs.id, excludeId) : undefined,
    ))

  return rows
    .filter((row) => {
      const other = gigWindow(row)
      return other ? windowsOverlap(window, other) : false
    })
    .map(({ id, title, status, startsAt, endsAt }) => ({ id, title, status, startsAt, endsAt }))
    .sort((a, b) => (a.startsAt?.getTime() ?? 0) - (b.startsAt?.getTime() ?? 0))
}
