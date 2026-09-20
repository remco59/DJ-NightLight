import { gigContacts, gigs, gigTimelineItems } from '../../../../db/schema'
import { gigInputSchema } from '../../../../shared/schemas/gig'
import { recordAudit } from '../../../utils/audit'
import { queueCalendarSync } from '../../../utils/calendar-sync'
import { queueGigEmail } from '../../../utils/email-automation'
import { db } from '../../../utils/db'
import { requireStaff } from '../../../utils/require-staff'

export default defineEventHandler(async (event) => {
  const user = await requireStaff(event)
  const input = await readValidatedBody(event, gigInputSchema.parse)
  const { contacts, timeline, ...gigValues } = input

  const gig = await db.transaction(async (tx) => {
    const [created] = await tx.insert(gigs).values(gigValues).returning()
    if (!created) {
      throw createError({ statusCode: 500, statusMessage: 'Could not create gig' })
    }

    if (contacts.length) {
      await tx.insert(gigContacts).values(contacts.map(contact => ({
        ...contact,
        gigId: created.id,
      })))
    }

    if (timeline.length) {
      await tx.insert(gigTimelineItems).values(timeline.map((item, index) => ({
        ...item,
        gigId: created.id,
        ordering: index,
      })))
    }

    return created
  })

  await recordAudit({
    userId: user.id,
    entityType: 'gig',
    entityId: gig.id,
    action: 'created',
    metadata: { status: gig.status },
  })

  await queueCalendarSync(gig.id)
  if (gig.status === 'lead') await queueGigEmail('lead_acknowledgement', gig.id, `lead-acknowledgement:${gig.id}`)

  event.node.res.statusCode = 201
  return { gig }
})
