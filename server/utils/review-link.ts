import { portalLinks } from '../../db/schema'
import { db } from './db'
import { createPortalToken, hashPortalToken, portalExpiry } from './portal-token'

const REVIEW_LINK_TTL_DAYS = 60

/** Issues a fresh portal link for the review request mail; tokens are only stored hashed, so it can't reuse an old one. */
export async function createReviewPortalUrl(gigId: string) {
  const token = createPortalToken()
  await db.insert(portalLinks).values({
    gigId,
    tokenHash: hashPortalToken(token),
    expiresAt: portalExpiry(REVIEW_LINK_TTL_DAYS),
  })
  const baseUrl = String(useRuntimeConfig().public.siteUrl).replace(/\/$/, '')
  return `${baseUrl}/client/${token}#review`
}
