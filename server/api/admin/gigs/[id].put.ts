import { eq } from 'drizzle-orm'
import { gigContacts, gigs, gigTimelineItems } from '../../../../db/schema'
import { gigInputSchema } from '../../../../shared/schemas/gig'
import { recordAudit } from '../../../utils/audit'
import { queueCalendarSync } from '../../../utils/calendar-sync'
import { queueGigEmail } from '../../../utils/email-automation'
import { db } from '../../../utils/db'
import { validateGigAssignee } from '../../../utils/gig-assignee'
import { requireStaff } from '../../../utils/require-staff'
import { requireUuidParam } from '../../../utils/route-params'

export default defineEventHandler(async (event) => {
  const user = await requireStaff(event, ['owner', 'manager'])
  const id = requireUuidParam(event, 'id')

  const input = await readValidatedBody(event, gigInputSchema.parse)
  const { contacts, timeline, assignedUserId, ...gigValues } = input
  const validAssignee = await validateGigAssignee(assignedUserId)

  // The page sends the `updatedAt` its form was loaded with; a gig changed in the meantime (on another
  // device, or by an offline note that was synced) is not silently overwritten.
  const version = getQuery(event).version
  const expectedVersion = typeof version === 'string' && version ? new Date(version).getTime() : null
  if (expectedVersion !== null && Number.isNaN(expectedVersion)) throw createError({ statusCode: 400, statusMessage: 'Ongeldige versie' })

  const [existing] = await db.select({
    id: gigs.id,
    status: gigs.status,
    assignedUserId: gigs.assignedUserId,
  }).from(gigs).where(eq(gigs.id, id)).limit(1)
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Gig niet gevonden' })

  const gig = await db.transaction(async (tx) => {
    if (expectedVersion !== null) {
      const [current] = await tx.select({ updatedAt: gigs.updatedAt }).from(gigs).where(eq(gigs.id, id)).limit(1).for('update')
      if (current && current.updatedAt.getTime() !== expectedVersion) {
        throw createError({ statusCode: 409, statusMessage: 'Deze gig is ondertussen gewijzigd, bijvoorbeeld op een ander apparaat. Laad de gig opnieuw en pas je wijziging dan opnieuw toe.' })
      }
    }
    const [updated] = await tx
      .update(gigs)
      .set({ ...gigValues, assignedUserId: validAssignee, updatedAt: new Date() })
      .where(eq(gigs.id, id))
      .returning()

    if (!updated) throw createError({ statusCode: 404, statusMessage: 'Gig niet gevonden' })

    await tx.delete(gigContacts).where(eq(gigContacts.gigId, id))
    await tx.delete(gigTimelineItems).where(eq(gigTimelineItems.gigId, id))
    if (contacts.length) await tx.insert(gigContacts).values(contacts.map(contact => ({ ...contact, gigId: id })))
    if (timeline.length) await tx.insert(gigTimelineItems).values(timeline.map((item, index) => ({ ...item, gigId: id, ordering: index })))
    return updated
  })

  const statusChanged = existing.status !== gig.status
  const assignmentChanged = existing.assignedUserId !== gig.assignedUserId
  await recordAudit({
    userId: user.id,
    entityType: 'gig',
    entityId: id,
    action: statusChanged ? 'status_changed' : assignmentChanged ? 'assignment_changed' : 'updated',
    metadata: {
      status: gig.status,
      ...(statusChanged ? { from: existing.status, to: gig.status } : {}),
      ...(assignmentChanged ? { fromAssignedUserId: existing.assignedUserId, assignedUserId: gig.assignedUserId } : {}),
    },
  })

  await queueCalendarSync(gig.id)
  // The gig page asks before this email goes out; ?notify=0 means "zonder e-mail".
  const notifyClient = getQuery(event).notify !== '0'
  if (notifyClient && existing.status !== 'booked' && gig.status === 'booked') {
    await queueGigEmail('booking_accepted', gig.id, `booking-accepted:${gig.id}:${gig.updatedAt.toISOString()}`)
  }

  return { gig }
})
