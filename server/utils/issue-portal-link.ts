import { and, eq, isNull } from 'drizzle-orm'
import { auditLogs, gigs, portalLinks } from '../../db/schema'
import { db } from './db'
import { createPortalToken, hashPortalToken, portalExpiry } from './portal-token'

export async function issuePortalLink(input: {
  gigId: string
  userId: string
  expiresInDays: number
  revokeExisting?: boolean
  action: 'portal_link_created' | 'portal_invitation_resent'
}) {
  const [gig] = await db.select({ id: gigs.id }).from(gigs).where(eq(gigs.id, input.gigId)).limit(1)
  if (!gig) throw createError({ statusCode: 404, statusMessage: 'Gig niet gevonden' })

  const token = createPortalToken()
  const expiresAt = portalExpiry(input.expiresInDays)

  return db.transaction(async (tx) => {
    if (input.revokeExisting) {
      await tx.update(portalLinks).set({ revokedAt: new Date() }).where(and(
        eq(portalLinks.gigId, input.gigId),
        isNull(portalLinks.revokedAt),
      ))
    }

    const [link] = await tx.insert(portalLinks).values({
      gigId: input.gigId,
      tokenHash: hashPortalToken(token),
      expiresAt,
      createdByUserId: input.userId,
    }).returning({ id: portalLinks.id, expiresAt: portalLinks.expiresAt })
    if (!link) throw createError({ statusCode: 500, statusMessage: 'Portaallink aanmaken is niet gelukt' })

    await tx.insert(auditLogs).values({
      userId: input.userId,
      entityType: 'gig',
      entityId: input.gigId,
      action: input.action,
      metadata: { linkId: link.id, expiresAt: link.expiresAt.toISOString() },
    })

    return { link, token }
  })
}
