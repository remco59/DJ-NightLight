import { and, eq } from 'drizzle-orm'
import { portalLinks } from '../../../../../../db/schema'
import { recordAudit } from '../../../../../utils/audit'
import { db } from '../../../../../utils/db'
import { requireStaff } from '../../../../../utils/require-staff'

export default defineEventHandler(async (event) => {
  const user = await requireStaff(event, ['owner', 'manager'])
  const gigId = getRouterParam(event, 'id')
  const linkId = getRouterParam(event, 'linkId')
  if (!gigId || !linkId) throw createError({ statusCode: 400, statusMessage: 'Gig and link id are required' })

  const [link] = await db.update(portalLinks).set({ revokedAt: new Date() }).where(and(
    eq(portalLinks.id, linkId),
    eq(portalLinks.gigId, gigId),
  )).returning({ id: portalLinks.id })
  if (!link) throw createError({ statusCode: 404, statusMessage: 'Portal link not found' })

  await recordAudit({ userId: user.id, entityType: 'gig', entityId: gigId, action: 'portal_link_revoked', metadata: { linkId } })
  return { ok: true }
})
