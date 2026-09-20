import { createHash, randomBytes } from 'node:crypto'

export const DEFAULT_PORTAL_LINK_TTL_DAYS = 30
export const MAX_PORTAL_LINK_TTL_DAYS = 365

export function createPortalToken() {
  return randomBytes(32).toString('base64url')
}

export function hashPortalToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export function portalExpiry(days: number, now = new Date()) {
  const safeDays = Number.isFinite(days)
    ? Math.min(MAX_PORTAL_LINK_TTL_DAYS, Math.max(1, Math.floor(days)))
    : DEFAULT_PORTAL_LINK_TTL_DAYS
  return new Date(now.getTime() + safeDays * 24 * 60 * 60 * 1000)
}

export function portalLinkState(link: { expiresAt: Date, revokedAt: Date | null }, now = new Date()) {
  if (link.revokedAt) return 'revoked' as const
  if (link.expiresAt <= now) return 'expired' as const
  return 'active' as const
}
