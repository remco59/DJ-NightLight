import { desc, eq } from 'drizzle-orm'
import { portalLinks } from '../../../../../../db/schema'
import { decryptSecret } from '../../../../../../shared/secret-box'
import { db } from '../../../../../utils/db'
import { portalLinkState } from '../../../../../utils/portal-token'
import { requireStaff } from '../../../../../utils/require-staff'

export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const gigId = getRouterParam(event, 'id')
  if (!gigId) throw createError({ statusCode: 400, statusMessage: 'Gig-ID is verplicht' })

  const rows = await db.select({
    id: portalLinks.id,
    expiresAt: portalLinks.expiresAt,
    revokedAt: portalLinks.revokedAt,
    lastUsedAt: portalLinks.lastUsedAt,
    lastInvitedAt: portalLinks.lastInvitedAt,
    invitationCount: portalLinks.invitationCount,
    createdAt: portalLinks.createdAt,
    tokenEncrypted: portalLinks.tokenEncrypted,
  }).from(portalLinks).where(eq(portalLinks.gigId, gigId)).orderBy(desc(portalLinks.createdAt))

  const baseUrl = String(useRuntimeConfig().public.siteUrl).replace(/\/$/, '')
  const password = String(useRuntimeConfig().session.password || '')
  return {
    links: rows.map(({ tokenEncrypted, ...link }) => {
      const state = portalLinkState(link)
      let url: string | null = null
      if (state === 'active' && tokenEncrypted) {
        try { url = `${baseUrl}/client/${decryptSecret(tokenEncrypted, password)}` }
        catch { url = null }
      }
      return { ...link, state, url }
    }),
  }
})
