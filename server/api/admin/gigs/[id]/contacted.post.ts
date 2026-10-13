import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { gigs } from '../../../../../db/schema'
import { DEFAULT_FOLLOW_UP_DAYS, followUpDate } from '../../../../../shared/lead-followup'
import { recordAudit } from '../../../../utils/audit'
import { db } from '../../../../utils/db'
import { requireStaff } from '../../../../utils/require-staff'
import { requireUuidParam } from '../../../../utils/route-params'

const bodySchema = z.object({
  // Days until the next follow-up; null means no follow-up.
  followUpInDays: z.union([z.number().int().min(1).max(90), z.null()]).default(DEFAULT_FOLLOW_UP_DAYS),
})

/** Marks an open lead as answered and plans the follow-up. */
export default defineEventHandler(async (event) => {
  const user = await requireStaff(event, ['owner', 'manager'])
  const id = requireUuidParam(event, 'id')
  const { followUpInDays } = await readValidatedBody(event, bodySchema.parse)

  const [existing] = await db.select({ status: gigs.status, deletedAt: gigs.deletedAt }).from(gigs).where(eq(gigs.id, id)).limit(1)
  if (!existing || existing.deletedAt) throw createError({ statusCode: 404, statusMessage: 'Gig niet gevonden' })
  if (existing.status !== 'lead') throw createError({ statusCode: 409, statusMessage: 'Alleen een open aanvraag kan als beantwoord worden gemarkeerd.' })

  const now = new Date()
  const followUpAt = followUpDate(followUpInDays, now)
  // updatedAt stays as it is: answering a lead is not an edit of the gig itself.
  const [gig] = await db.update(gigs).set({ lastContactedAt: now, followUpAt }).where(eq(gigs.id, id)).returning({
    id: gigs.id, lastContactedAt: gigs.lastContactedAt, followUpAt: gigs.followUpAt,
  })

  await recordAudit({
    userId: user.id,
    entityType: 'gig',
    entityId: id,
    action: 'lead_contacted',
    metadata: { followUpAt: followUpAt?.toISOString() ?? null },
  })
  return { gig }
})
