import { asc, desc, eq } from 'drizzle-orm'
import { auditLogs, clients, gigContacts, gigs, gigTimelineItems, venues } from '../../../../db/schema'
import { db } from '../../../utils/db'
import { requireStaff } from '../../../utils/require-staff'

export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Gig id is required' })

  const [gig] = await db
    .select({
      id: gigs.id,
      title: gigs.title,
      eventType: gigs.eventType,
      clientId: gigs.clientId,
      venueId: gigs.venueId,
      status: gigs.status,
      startsAt: gigs.startsAt,
      endsAt: gigs.endsAt,
      loadInAt: gigs.loadInAt,
      fee: gigs.fee,
      currency: gigs.currency,
      publicVisibility: gigs.publicVisibility,
      publicTitle: gigs.publicTitle,
      publicDescription: gigs.publicDescription,
      internalNotes: gigs.internalNotes,
      source: gigs.source,
      createdAt: gigs.createdAt,
      updatedAt: gigs.updatedAt,
      clientFirstName: clients.firstName,
      clientLastName: clients.lastName,
      clientCompanyName: clients.companyName,
      venueName: venues.name,
    })
    .from(gigs)
    .leftJoin(clients, eq(gigs.clientId, clients.id))
    .leftJoin(venues, eq(gigs.venueId, venues.id))
    .where(eq(gigs.id, id))
    .limit(1)

  if (!gig) throw createError({ statusCode: 404, statusMessage: 'Gig not found' })

  const contacts = await db.select().from(gigContacts).where(eq(gigContacts.gigId, id)).orderBy(asc(gigContacts.createdAt))
  const timeline = await db.select().from(gigTimelineItems).where(eq(gigTimelineItems.gigId, id)).orderBy(asc(gigTimelineItems.ordering))
  const activity = await db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      metadata: auditLogs.metadata,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .where(eq(auditLogs.entityId, id))
    .orderBy(desc(auditLogs.createdAt))
    .limit(25)

  const clientOptions = await db
    .select({ id: clients.id, type: clients.type, firstName: clients.firstName, lastName: clients.lastName, companyName: clients.companyName })
    .from(clients)
    .orderBy(asc(clients.companyName), asc(clients.lastName), asc(clients.firstName))
  const venueOptions = await db
    .select({ id: venues.id, name: venues.name, city: venues.city })
    .from(venues)
    .orderBy(asc(venues.name))

  return { gig, contacts, timeline, activity, options: { clients: clientOptions, venues: venueOptions } }
})
