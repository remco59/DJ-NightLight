import { and, eq } from 'drizzle-orm'
import { portalLinks } from '../../../../../../db/schema'
import { recordAudit } from '../../../../../utils/audit'
import { db } from '../../../../../utils/db'
import { requireStaff } from '../../../../../utils/require-staff'
import { requireUuidParam } from '../../../../../utils/route-params'

export default defineEventHandler(async (event) => {
  const user = await requireStaff(event, ['owner', 'manager'])
  const gigId = requireUuidParam(event, 'id')
  const linkId = requireUuidParam(event, 'linkId')

  const [link] = await db.update(portalLinks).set({ revokedAt: new Date() }).where(and(
    eq(portalLinks.id, linkId),
    eq(portalLinks.gigId, gigId),
  )).returning({ id: portalLinks.id })
  if (!link) throw createError({ statusCode: 404, statusMessage: 'Portaallink niet gevonden' })

  await recordAudit({ userId: user.id, entityType: 'gig', entityId: gigId, action: 'portal_link_revoked', metadata: { linkId } })
  return { ok: true }
})
