import { describe, expect, it } from 'vitest'
import { createPortalToken, hashPortalToken, portalExpiry, portalLinkState } from '../server/utils/portal-token'

describe('portal tokens', () => {
  it('creates high-entropy URL-safe tokens and stores only deterministic one-way hashes', () => {
    const first = createPortalToken()
    const second = createPortalToken()
    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(second).not.toBe(first)
    expect(hashPortalToken(first)).toMatch(/^[a-f0-9]{64}$/)
    expect(hashPortalToken(first)).toBe(hashPortalToken(first))
    expect(hashPortalToken(first)).not.toContain(first)
  })

  it('clamps configurable expiration to safe bounds', () => {
    const now = new Date('2026-01-01T00:00:00.000Z')
    expect(portalExpiry(7, now).toISOString()).toBe('2026-01-08T00:00:00.000Z')
    expect(portalExpiry(-999, now).toISOString()).toBe('2026-01-02T00:00:00.000Z')
    expect(portalExpiry(99999, now).toISOString()).toBe('2027-01-01T00:00:00.000Z')
  })

  it('rejects revoked and expired links', () => {
    const now = new Date('2026-01-10T00:00:00.000Z')
    expect(portalLinkState({ expiresAt: new Date('2026-01-11'), revokedAt: null }, now)).toBe('active')
    expect(portalLinkState({ expiresAt: new Date('2026-01-09'), revokedAt: null }, now)).toBe('expired')
    expect(portalLinkState({ expiresAt: new Date('2026-01-11'), revokedAt: now }, now)).toBe('revoked')
  })
})
