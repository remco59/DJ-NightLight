import { OAUTH_STATE_MAX_AGE_MS } from '../../shared/instagram'
import { decryptSecret, encryptSecret } from '../../shared/secret-box'

export const INSTAGRAM_PENDING_COOKIE = 'nl_instagram_pending'

/**
 * When Facebook grants access to several Instagram accounts the owner picks one. Until then the
 * long-lived user token waits in a short-lived, encrypted, HttpOnly cookie. It is bound to the user
 * and never stored in the database, so abandoning the choice leaves nothing behind.
 */
export function sealPendingToken(input: { userToken: string, userId: string, password: string, now?: number }) {
  return encryptSecret(JSON.stringify({ t: input.userToken, u: input.userId, iat: input.now ?? Date.now() }), input.password)
}

export function openPendingToken(input: { value: string | undefined, userId: string, password: string, now?: number }) {
  if (!input.value) return null
  try {
    const data = JSON.parse(decryptSecret(input.value, input.password)) as { t?: unknown, u?: unknown, iat?: unknown }
    const now = input.now ?? Date.now()
    if (typeof data.t !== 'string' || data.u !== input.userId || typeof data.iat !== 'number') return null
    if (data.iat > now + 60_000 || now - data.iat > OAUTH_STATE_MAX_AGE_MS) return null
    return data.t
  } catch {
    return null
  }
}
