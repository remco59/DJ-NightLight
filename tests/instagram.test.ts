import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import {
  buildInstagramAuthorizeUrl,
  instagramHealth,
  instagramRedirectUri,
  INSTAGRAM_PUBLISH_SCOPE,
  maskAppId,
  maskExternalId,
  shouldRefreshToken,
  tokenDaysLeft,
} from '../shared/instagram'
import { signOAuthState, verifyOAuthState } from '../server/utils/instagram-state'
import {
  exchangeCodeForToken,
  exchangeForLongLivedToken,
  fetchInstagramProfile,
  InstagramApiError,
  refreshLongLivedToken,
} from '../server/utils/instagram'

const DAY = 24 * 60 * 60 * 1000
const now = Date.UTC(2026, 9, 7, 12, 0, 0)
const password = 'x'.repeat(40)

describe('Instagram OAuth setup', () => {
  it('builds the redirect URI without a double slash', () => {
    expect(instagramRedirectUri('https://nightlight.example/')).toBe('https://nightlight.example/api/admin/social/instagram/callback')
    expect(instagramRedirectUri('http://localhost:3000')).toBe('http://localhost:3000/api/admin/social/instagram/callback')
  })

  it('asks for the basic and publish scopes', () => {
    const url = new URL(buildInstagramAuthorizeUrl({ appId: '123456', redirectUri: 'https://x.test/cb', state: 'abc' }))
    expect(url.origin + url.pathname).toBe('https://www.instagram.com/oauth/authorize')
    expect(url.searchParams.get('client_id')).toBe('123456')
    expect(url.searchParams.get('response_type')).toBe('code')
    expect(url.searchParams.get('scope')).toBe('instagram_business_basic,instagram_business_content_publish')
    expect(url.searchParams.get('state')).toBe('abc')
  })

  it('masks identifiers', () => {
    expect(maskAppId('1234567890124819')).toBe('••••••••••••4819')
    expect(maskExternalId('17841400000000821')).toBe('1784••••821')
    expect(maskAppId('12')).toBe('••••')
  })
})

describe('shared Instagram module', () => {
  // The admin UI imports shared/instagram.ts; a Node import there breaks the page in the browser.
  it('stays browser-safe', () => {
    const source = readFileSync(join(process.cwd(), 'shared', 'instagram.ts'), 'utf8')
    expect(source).not.toMatch(/from\s+['"]node:/)
  })
})

describe('OAuth state', () => {
  const state = signOAuthState({ nonce: 'nonce1', userId: 'user-1', password, now })

  it('accepts a fresh state for the same user and browser', () => {
    expect(verifyOAuthState({ state, cookieNonce: 'nonce1', userId: 'user-1', password, now: now + 60_000 })).toBe(true)
  })

  it('rejects another user, another browser, a wrong secret and tampering', () => {
    expect(verifyOAuthState({ state, cookieNonce: 'nonce1', userId: 'user-2', password, now })).toBe(false)
    expect(verifyOAuthState({ state, cookieNonce: 'other', userId: 'user-1', password, now })).toBe(false)
    expect(verifyOAuthState({ state, cookieNonce: undefined, userId: 'user-1', password, now })).toBe(false)
    expect(verifyOAuthState({ state, cookieNonce: 'nonce1', userId: 'user-1', password: 'y'.repeat(40), now })).toBe(false)
    expect(verifyOAuthState({ state: `${state}0`, cookieNonce: 'nonce1', userId: 'user-1', password, now })).toBe(false)
    expect(verifyOAuthState({ state: 'garbage', cookieNonce: 'nonce1', userId: 'user-1', password, now })).toBe(false)
  })

  it('expires after ten minutes', () => {
    expect(verifyOAuthState({ state, cookieNonce: 'nonce1', userId: 'user-1', password, now: now + 11 * 60_000 })).toBe(false)
  })
})

describe('token refresh rules', () => {
  const base = {
    status: 'active',
    tokenIssuedAt: new Date(now - 50 * DAY),
    tokenExpiresAt: new Date(now + 10 * DAY),
    lastRefreshAttemptAt: null,
    now,
  }

  it('refreshes a token that expires within 14 days', () => {
    expect(shouldRefreshToken(base)).toBe(true)
  })

  it('leaves a token with plenty of time alone', () => {
    expect(shouldRefreshToken({ ...base, tokenExpiresAt: new Date(now + 40 * DAY) })).toBe(false)
  })

  it('never refreshes a token younger than 24 hours, an expired token or an inactive account', () => {
    expect(shouldRefreshToken({ ...base, tokenIssuedAt: new Date(now - 3_600_000) })).toBe(false)
    expect(shouldRefreshToken({ ...base, tokenExpiresAt: new Date(now - 1000) })).toBe(false)
    expect(shouldRefreshToken({ ...base, status: 'needs_reauth' })).toBe(false)
  })

  it('waits twelve hours between attempts', () => {
    expect(shouldRefreshToken({ ...base, lastRefreshAttemptAt: new Date(now - 3_600_000) })).toBe(false)
    expect(shouldRefreshToken({ ...base, lastRefreshAttemptAt: new Date(now - 13 * 3_600_000) })).toBe(true)
  })

  it('counts whole days left', () => {
    expect(tokenDaysLeft(new Date(now + 10.5 * DAY), now)).toBe(10)
    expect(tokenDaysLeft(null, now)).toBeNull()
  })
})

describe('Instagram health', () => {
  const account = {
    status: 'active',
    tokenExpiresAt: new Date(now + 40 * DAY),
    scopes: ['instagram_business_basic', INSTAGRAM_PUBLISH_SCOPE],
    lastRefreshError: null,
  }
  const base = { appConfigured: true, account, workerLastRunAt: new Date(now - 10_000), now }

  it('reports ok when token, scope and worker are fine', () => {
    expect(instagramHealth(base)).toMatchObject({ level: 'ok', title: 'Instagram-koppeling werkt' })
  })

  it('is inactive without app or account', () => {
    expect(instagramHealth({ ...base, appConfigured: false }).level).toBe('inactive')
    expect(instagramHealth({ ...base, account: null }).level).toBe('inactive')
  })

  it('is an error when reauth is needed, the token expired or the publish scope is missing', () => {
    expect(instagramHealth({ ...base, account: { ...account, status: 'needs_reauth' } }).level).toBe('error')
    expect(instagramHealth({ ...base, account: { ...account, tokenExpiresAt: new Date(now - 1) } }).level).toBe('error')
    expect(instagramHealth({ ...base, account: { ...account, scopes: ['instagram_business_basic'] } }).title).toBe('Publicatierechten ontbreken')
  })

  it('warns about an expiring token, a failed refresh and an offline worker', () => {
    expect(instagramHealth({ ...base, account: { ...account, tokenExpiresAt: new Date(now + 3 * DAY) } }).title).toBe('Token verloopt binnenkort')
    expect(instagramHealth({ ...base, account: { ...account, lastRefreshError: 'boom' } }).title).toBe('Vernieuwen van het token mislukt')
    expect(instagramHealth({ ...base, workerLastRunAt: new Date(now - 10 * 60_000) }).title).toBe('Worker niet actief')
    expect(instagramHealth({ ...base, workerLastRunAt: null }).level).toBe('warning')
  })
})

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

describe('Instagram API client', () => {
  it('exchanges a code and accepts both response shapes', async () => {
    const flat = vi.fn().mockResolvedValue(jsonResponse({ access_token: 'short', user_id: 17841, permissions: 'a,b' }))
    expect(await exchangeCodeForToken({ appId: '1', appSecret: 's', redirectUri: 'https://x/cb', code: 'c' }, flat))
      .toEqual({ accessToken: 'short', userId: '17841', permissions: ['a', 'b'] })
    const [url, init] = flat.mock.calls[0]!
    expect(url).toBe('https://api.instagram.com/oauth/access_token')
    expect((init.body as URLSearchParams).get('grant_type')).toBe('authorization_code')

    const wrapped = vi.fn().mockResolvedValue(jsonResponse({ data: [{ access_token: 'short', user_id: 9, permissions: ['a'] }] }))
    expect((await exchangeCodeForToken({ appId: '1', appSecret: 's', redirectUri: 'r', code: 'c' }, wrapped)).permissions).toEqual(['a'])
  })

  it('exchanges and refreshes long-lived tokens', async () => {
    const ok = vi.fn().mockResolvedValue(jsonResponse({ access_token: 'long', expires_in: 5184000 }))
    expect(await exchangeForLongLivedToken({ appSecret: 's', accessToken: 'short' }, ok)).toEqual({ accessToken: 'long', expiresInSeconds: 5184000 })
    expect(String(ok.mock.calls[0]![0])).toContain('grant_type=ig_exchange_token')

    const refreshed = vi.fn().mockResolvedValue(jsonResponse({ access_token: 'long2', expires_in: 5184000 }))
    await refreshLongLivedToken('long', refreshed)
    expect(String(refreshed.mock.calls[0]![0])).toContain('refresh_access_token?grant_type=ig_refresh_token')
  })

  it('reads the professional account id and username', async () => {
    const profile = vi.fn().mockResolvedValue(jsonResponse({ id: 'app-scoped', user_id: '17841400', username: 'djnightlight', account_type: 'BUSINESS' }))
    expect(await fetchInstagramProfile('t', profile)).toEqual({ externalId: '17841400', username: 'djnightlight', accountType: 'BUSINESS' })
  })

  it('marks rejected tokens as permanent errors and never leaks the token', async () => {
    const rejected = vi.fn().mockResolvedValue(jsonResponse({ error: { message: 'Error validating access token', code: 190 } }, 400))
    const error = await refreshLongLivedToken('secret-token', rejected).catch(e => e)
    expect(error).toBeInstanceOf(InstagramApiError)
    expect(error).toMatchObject({ permanent: true, code: 190 })
    expect(error.message).not.toContain('secret-token')

    const transient = vi.fn().mockResolvedValue(jsonResponse({ error: { message: 'Service unavailable', code: 2 } }, 503))
    expect(await refreshLongLivedToken('t', transient).catch(e => e)).toMatchObject({ permanent: false })
  })

  it('fails clearly on an empty token response', async () => {
    const empty = vi.fn().mockResolvedValue(jsonResponse({}))
    await expect(exchangeForLongLivedToken({ appSecret: 's', accessToken: 'x' }, empty)).rejects.toThrow('geldig langlopend token')
  })
})
