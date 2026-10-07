import { createHmac, timingSafeEqual } from 'node:crypto'
import { OAUTH_STATE_MAX_AGE_MS } from '../../shared/instagram'

function stateSignature(nonce: string, issuedAt: number, userId: string, password: string) {
  return createHmac('sha256', `nightlight-instagram-state-v1:${password}`)
    .update(`${nonce}.${issuedAt}.${userId}`)
    .digest('base64url')
}

/** The state binds the OAuth round trip to one user and one browser (via the nonce cookie). */
export function signOAuthState(input: { nonce: string, userId: string, password: string, now?: number }) {
  const issuedAt = input.now ?? Date.now()
  return `${input.nonce}.${issuedAt}.${stateSignature(input.nonce, issuedAt, input.userId, input.password)}`
}

export function verifyOAuthState(input: { state: string, cookieNonce: string | undefined, userId: string, password: string, now?: number }) {
  const [nonce, issuedAtText, signature] = input.state.split('.')
  if (!nonce || !issuedAtText || !signature || !input.cookieNonce || nonce !== input.cookieNonce) return false

  const issuedAt = Number(issuedAtText)
  const now = input.now ?? Date.now()
  if (!Number.isFinite(issuedAt) || issuedAt > now + 60_000 || now - issuedAt > OAUTH_STATE_MAX_AGE_MS) return false

  const expected = Buffer.from(stateSignature(nonce, issuedAt, input.userId, input.password))
  const actual = Buffer.from(signature)
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}
