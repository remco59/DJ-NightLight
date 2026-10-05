import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { clients, gigs } from '../../../../../db/schema'
import { db } from '../../../../utils/db'
import { clientEmailPlan } from '../../../../utils/email-plan'
import { requireStaff } from '../../../../utils/require-staff'
import { requireUuidParam } from '../../../../utils/route-params'

// Client emails that a button on the gig page can trigger.
const querySchema = z.object({ template: z.enum(['booking_accepted', 'client_portal_invitation']) })

export default defineEventHandler(async (event) => {
  await requireStaff(event, ['owner', 'manager'])
  const id = requireUuidParam(event, 'id')
  const query = querySchema.safeParse(getQuery(event))
  if (!query.success) throw createError({ statusCode: 422, statusMessage: 'Onbekende e-mail' })
  const [row] = await db.select({ clientEmail: clients.email }).from(gigs).leftJoin(clients, eq(gigs.clientId, clients.id)).where(eq(gigs.id, id)).limit(1)
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Gig niet gevonden' })
  return clientEmailPlan({ templateKey: query.data.template, gigId: id, recipient: row.clientEmail })
})
