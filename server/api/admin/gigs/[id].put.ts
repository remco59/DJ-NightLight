import { eq } from 'drizzle-orm'
import { gigContacts, gigs, gigTimelineItems } from '../../../../db/schema'
import { gigInputSchema } from '../../../../shared/schemas/gig'
import { recordAudit } from '../../../utils/audit'
import { queueCalendarSync } from '../../../utils/calendar-sync'
import { queueGigEmail } from '../../../utils/email-automation'
import { db } from '../../../utils/db'
import { requireStaff } from '../../../utils/require-staff'

export default defineEventHandler(async (event) => {
  const user = await requireStaff(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Gig id is required' })

  const input = await readValidatedBody(event, gigInputSchema.parse)
  const { contacts, timeline, ...gigValues } = input

  const [existing] = await db.select({ id: gigs.id, status: gigs.status }).from(gigs).where(eq(gigs.id, id)).limit(1)
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Gig not found' })

  const gig = await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(gigs)
      .set({ ...gigValues, updatedAt: new Date() })
      .where(eq(gigs.id, id))
      .returning()

    if (!updated) {
      throw createError({ statusCode: 404, statusMessage: 'Gig not found' })
    }

    await tx.delete(gigContacts).where(eq(gigContacts.gigId, id))
    await tx.delete(gigTimelineItems).where(eq(gigTimelineItems.gigId, id))

    if (contacts.length) {
      await tx.insert(gigContacts).values(contacts.map(contact => ({ ...contact, gigId: id })))
    }
    if (timeline.length) {
      await tx.insert(gigTimelineItems).values(timeline.map((item, index) => ({ ...item, gigId: id, ordering: index })))
    }

    return updated
  })

  await recordAudit({
    userId: user.id,
    entityType: 'gig',
    entityId: id,
    action: existing.status === gig.status ? 'updated' : 'status_changed',
    metadata: existing.status === gig.status
      ? { status: gig.status }
      : { from: existing.status, to: gig.status },
  })

  await queueCalendarSync(gig.id)
  if (existing.status !== 'booked' && gig.status === 'booked') {
    await queueGigEmail('booking_accepted', gig.id, `booking-accepted:${gig.id}:${gig.updatedAt.toISOString()}`)
  }

  return { gig }
})
