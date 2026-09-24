import { and, eq, gt, isNull } from 'drizzle-orm'
import { clients, gigs, portalLinks, venues } from '../../db/schema'
import { db } from './db'
import { hashPortalToken } from './portal-token'
import { gigTitleSql } from './gig-title'

export async function resolvePortalAccess(token: string) {
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(token)) return null

  const [result] = await db
    .select({
      linkId: portalLinks.id,
      gigId: gigs.id,
      title: gigTitleSql(),
      eventType: gigs.eventType,
      status: gigs.status,
      startsAt: gigs.startsAt,
      endsAt: gigs.endsAt,
      venueName: venues.name,
      venueCity: venues.city,
      clientFirstName: clients.firstName,
      clientLastName: clients.lastName,
      clientCompanyName: clients.companyName,
      expiresAt: portalLinks.expiresAt,
    })
    .from(portalLinks)
    .innerJoin(gigs, eq(portalLinks.gigId, gigs.id))
    .leftJoin(clients, eq(gigs.clientId, clients.id))
    .leftJoin(venues, eq(gigs.venueId, venues.id))
    .where(and(
      eq(portalLinks.tokenHash, hashPortalToken(token)),
      isNull(portalLinks.revokedAt),
      gt(portalLinks.expiresAt, new Date()),
      isNull(gigs.deletedAt),
    ))
    .limit(1)

  return result ?? null
}
