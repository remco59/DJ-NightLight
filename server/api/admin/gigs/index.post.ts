import { gigContacts, gigs, gigTimelineItems } from '../../../../db/schema'
import { gigInputSchema } from '../../../../shared/schemas/gig'
import { recordAudit } from '../../../utils/audit'
import { db } from '../../../utils/db'
import { requireStaff } from '../../../utils/require-staff'

export default defineEventHandler(async (event) => {
  const user = await requireStaff(event)
  const input = await readValidatedBody(event, gigInputSchema.parse)
  const { contacts, timeline, ...gigValues } = input

  const gig = await db.transaction(async (tx) => {
    const [created] = await tx.insert(gigs).values(gigValues).returning()

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

  event.node.res.statusCode = 201
  return { gig }
})
