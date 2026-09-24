import { asc, eq } from 'drizzle-orm'
import { gigContacts, gigs, gigTimelineItems } from '../../../../../db/schema'
import { recordAudit } from '../../../../utils/audit'
import { db } from '../../../../utils/db'
import { requireStaff } from '../../../../utils/require-staff'

export default defineEventHandler(async (event) => {
  const user = await requireStaff(event, ['owner', 'manager'])
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Gig id is required' })

  const [source] = await db.select().from(gigs).where(eq(gigs.id, id)).limit(1)
  if (!source) throw createError({ statusCode: 404, statusMessage: 'Gig not found' })

  const contacts = await db.select().from(gigContacts).where(eq(gigContacts.gigId, id))
  const timeline = await db.select().from(gigTimelineItems).where(eq(gigTimelineItems.gigId, id)).orderBy(asc(gigTimelineItems.ordering))

  const created = await db.transaction(async (tx) => {
    const [gig] = await tx.insert(gigs).values({
      title: source.title ? `${source.title} (copy)` : null,
      eventType: source.eventType,
      clientId: source.clientId,
      venueId: source.venueId,
      assignedUserId: source.assignedUserId,
      status: 'lead',
      startsAt: source.startsAt,
      endsAt: source.endsAt,
      loadInAt: source.loadInAt,
      fee: source.fee,
      currency: source.currency,
      publicVisibility: false,
      publicTitle: source.publicTitle,
      publicDescription: source.publicDescription,
      internalNotes: source.internalNotes,
      source: source.source,
    }).returning()

    if (!gig) throw createError({ statusCode: 500, statusMessage: 'Could not duplicate gig' })
    if (contacts.length) {
      await tx.insert(gigContacts).values(contacts.map(contact => ({
        gigId: gig.id, name: contact.name, role: contact.role, email: contact.email, phone: contact.phone, notes: contact.notes,
      })))
    }
    if (timeline.length) {
      await tx.insert(gigTimelineItems).values(timeline.map(item => ({
        gigId: gig.id, time: item.time, title: item.title, description: item.description, ordering: item.ordering,
      })))
    }
    return gig
  })

  await recordAudit({
    userId: user.id,
    entityType: 'gig',
    entityId: created.id,
    action: 'duplicated',
    metadata: { sourceGigId: id, assignedUserId: created.assignedUserId },
  })

  event.node.res.statusCode = 201
  return { gig: created }
})
