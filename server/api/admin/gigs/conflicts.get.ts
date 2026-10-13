import { z } from 'zod'
import { findConflictingGigs } from '../../../utils/gig-conflicts'
import { requireStaff } from '../../../utils/require-staff'

const dateParam = z.string().max(40).optional().transform((value, ctx) => {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    ctx.addIssue({ code: 'custom', message: 'Ongeldige datum of tijd' })
    return z.NEVER
  }
  return date
})

const conflictQuerySchema = z.object({
  startsAt: dateParam,
  endsAt: dateParam,
  loadInAt: dateParam,
  excludeId: z.uuid().optional(),
})

/** Leads and booked gigs that overlap the given times, so the gig form can warn about a double booking. */
export default defineEventHandler(async (event) => {
  await requireStaff(event, ['owner', 'manager', 'dj'])
  const query = await getValidatedQuery(event, conflictQuerySchema.parse)
  const conflicts = await findConflictingGigs(query, query.excludeId)
  return { conflicts }
})
