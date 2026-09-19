import { eq } from 'drizzle-orm'
import { gigs } from '../../../../db/schema'
import { canPermanentlyDeleteGig } from '../../../../shared/gig-rules'
import { recordAudit } from '../../../utils/audit'
import { db } from '../../../utils/db'
import { requireStaff } from '../../../utils/require-staff'

export default defineEventHandler(async (event) => {
  const user = await requireStaff(event, ['owner'])
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Gig id is required' })

  const [gig] = await db.select({ id: gigs.id, status: gigs.status, title: gigs.title }).from(gigs).where(eq(gigs.id, id)).limit(1)
  if (!gig) throw createError({ statusCode: 404, statusMessage: 'Gig not found' })

  if (!canPermanentlyDeleteGig(gig.status)) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Only declined gigs can be permanently deleted',
    })
  }

  await recordAudit({
    userId: user.id,
    entityType: 'gig',
    entityId: id,
    action: 'deleted',
    metadata: { title: gig.title, status: gig.status },
  })
  await db.delete(gigs).where(eq(gigs.id, id))

  return { ok: true }
})
