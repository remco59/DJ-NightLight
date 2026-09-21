import { count, eq } from 'drizzle-orm'
import { gigs, invoices } from '../../../../db/schema'
import { gigRemovalMode } from '../../../../shared/gig-rules'
import { recordAudit } from '../../../utils/audit'
import { db } from '../../../utils/db'
import { requireStaff } from '../../../utils/require-staff'

export default defineEventHandler(async (event) => {
  const user = await requireStaff(event, ['owner'])
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Gig id is required' })

  const [gig] = await db.select({ id: gigs.id, status: gigs.status, title: gigs.title }).from(gigs).where(eq(gigs.id, id)).limit(1)
  if (!gig) throw createError({ statusCode: 404, statusMessage: 'Gig not found' })

  if (gig.status !== 'declined') {
    throw createError({
      statusCode: 409,
      statusMessage: 'Only declined gigs can be removed',
    })
  }

  const [invoiceUsage] = await db
    .select({ value: count() })
    .from(invoices)
    .where(eq(invoices.gigId, id))
  const invoiceCount = invoiceUsage?.value ?? 0
  const mode = gigRemovalMode(gig.status, invoiceCount > 0)

  if (mode === 'archive') {
    const now = new Date()
    await db.update(gigs).set({
      deletedAt: now,
      publicVisibility: false,
      updatedAt: now,
    }).where(eq(gigs.id, id))

    await recordAudit({
      userId: user.id,
      entityType: 'gig',
      entityId: id,
      action: 'archived',
      metadata: {
        title: gig.title,
        status: gig.status,
        reason: 'financial_history',
        invoiceCount,
      },
    })

    return { ok: true, mode }
  }

  await recordAudit({
    userId: user.id,
    entityType: 'gig',
    entityId: id,
    action: 'deleted',
    metadata: { title: gig.title, status: gig.status },
  })
  await db.delete(gigs).where(eq(gigs.id, id))

  return { ok: true, mode: 'delete' as const }
})
