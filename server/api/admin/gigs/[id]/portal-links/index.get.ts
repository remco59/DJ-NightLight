import { desc, eq } from 'drizzle-orm'
import { portalLinks } from '../../../../../../db/schema'
import { db } from '../../../../../utils/db'
import { portalLinkState } from '../../../../../utils/portal-token'
import { requireStaff } from '../../../../../utils/require-staff'

export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const gigId = getRouterParam(event, 'id')
  if (!gigId) throw createError({ statusCode: 400, statusMessage: 'Gig id is required' })

  const rows = await db.select({
    id: portalLinks.id,
    expiresAt: portalLinks.expiresAt,
    revokedAt: portalLinks.revokedAt,
    lastUsedAt: portalLinks.lastUsedAt,
    lastInvitedAt: portalLinks.lastInvitedAt,
    invitationCount: portalLinks.invitationCount,
    createdAt: portalLinks.createdAt,
  }).from(portalLinks).where(eq(portalLinks.gigId, gigId)).orderBy(desc(portalLinks.createdAt))

  return { links: rows.map(link => ({ ...link, state: portalLinkState(link) })) }
})
