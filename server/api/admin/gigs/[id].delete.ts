import { and, eq, isNull } from 'drizzle-orm'
import { auditLogs, gigs, invoices } from '../../../../db/schema'
import { gigRemovalMode } from '../../../../shared/gig-rules'
import { db } from '../../../utils/db'
import { requireStaff } from '../../../utils/require-staff'

export default defineEventHandler(async (event) => {
  const user = await requireStaff(event, ['owner'])
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Gig id is required' })

  const result = await db.transaction(async (tx) => {
    const [gig] = await tx
      .select({ id: gigs.id, status: gigs.status, title: gigs.title })
      .from(gigs)
      .where(and(eq(gigs.id, id), isNull(gigs.deletedAt)))
      .limit(1)
      .for('update')

    if (!gig) throw createError({ statusCode: 404, statusMessage: 'Gig not found' })

    const [invoice] = await tx
      .select({ id: invoices.id })
      .from(invoices)
      .where(eq(invoices.gigId, id))
      .limit(1)

    const mode = gigRemovalMode(gig.status, Boolean(invoice))
    if (!mode) {
      throw createError({
        statusCode: 409,
        statusMessage: 'Only declined gigs can be removed',
      })
    }

    if (mode === 'archive') {
      const now = new Date()
      await tx.insert(auditLogs).values({
        userId: user.id,
        entityType: 'gig',
        entityId: id,
        action: 'archived',
        metadata: {
          title: gig.title,
          status: gig.status,
          reason: 'financial_history',
        },
      })
      await tx
        .update(gigs)
        .set({
          deletedAt: now,
          publicVisibility: false,
          updatedAt: now,
        })
        .where(eq(gigs.id, id))

      return { mode }
    }

    await tx.insert(auditLogs).values({
      userId: user.id,
      entityType: 'gig',
      entityId: id,
      action: 'deleted',
      metadata: { title: gig.title, status: gig.status },
    })
    await tx.delete(gigs).where(eq(gigs.id, id))

    return { mode }
  })

  return {
    ok: true,
    mode: result.mode,
  }
})
