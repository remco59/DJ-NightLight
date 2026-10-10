import { describe, expect, it, vi } from 'vitest'
import {
  buildInstagramAuthorizeUrl,
  hasPublishScope,
  instagramHealth,
  parseLoginType,
  shouldRenewToken,
} from '../shared/instagram'
import {
  createImageContainer,
  exchangeInstagramCode,
  exchangeInstagramLongLivedToken,
  getContainerStatus,
  getInstagramProfile,
  graphBase,
  InstagramApiError,
  publishContainer,
  refreshInstagramToken,
} from '../server/utils/instagram'

const DAY = 24 * 60 * 60 * 1000
const now = Date.UTC(2026, 9, 7, 12, 0, 0)

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

describe('login type', () => {
  it('defaults to Facebook Login and only accepts the two known values', () => {
    expect(parseLoginType(undefined)).toBe('facebook')
    expect(parseLoginType(null)).toBe('facebook')
    expect(parseLoginType('nonsense')).toBe('facebook')
    expect(parseLoginType('facebook')).toBe('facebook')
    expect(parseLoginType('instagram')).toBe('instagram')
  })

  it('picks the Graph host per login type', () => {
    expect(graphBase('facebook')).toMatch(/^https:\/\/graph\.facebook\.com\/v\d+\.\d+$/)
    expect(graphBase(undefined)).toMatch(/^https:\/\/graph\.facebook\.com\//)
    expect(graphBase('instagram')).toMatch(/^https:\/\/graph\.instagram\.com\/v\d+\.\d+$/)
  })

  it('accepts the Instagram Login publish permission', () => {
    expect(hasPublishScope(['instagram_business_basic', 'instagram_business_content_publish'])).toBe(true)
    expect(hasPublishScope(['instagram_business_basic'])).toBe(false)
  })
})

describe('Instagram Login dialog', () => {
  it('asks Instagram for the business permissions, without a Facebook configuration', () => {
    const url = new URL(buildInstagramAuthorizeUrl({ appId: '123456', redirectUri: 'https://x.test/cb', state: 'abc' }))
    expect(url.origin + url.pathname).toBe('https://www.instagram.com/oauth/authorize')
    expect(url.searchParams.get('client_id')).toBe('123456')
    expect(url.searchParams.get('response_type')).toBe('code')
    expect(url.searchParams.get('state')).toBe('abc')
    expect(url.searchParams.get('scope')).toBe('instagram_business_basic,instagram_business_content_publish')
    expect(url.searchParams.has('config_id')).toBe(false)
  })
})

describe('Instagram Login client', () => {
  it('exchanges the code (dropping the #_ suffix) and reads the flat response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ access_token: 'short', user_id: 1784140000, permissions: 'instagram_business_basic,instagram_business_content_publish' }))
    const session = await exchangeInstagramCode({ appId: '1', appSecret: 's', redirectUri: 'https://x/cb', code: 'abc#_' }, fetchImpl)
    expect(session).toEqual({ accessToken: 'short', userId: '1784140000', permissions: ['instagram_business_basic', 'instagram_business_content_publish'] })

    const [url, init] = fetchImpl.mock.calls[0]!
    expect(String(url)).toBe('https://api.instagram.com/oauth/access_token')
    expect(init.method).toBe('POST')
    const body = new URLSearchParams(String(init.body))
    expect(body.get('code')).toBe('abc')
    expect(body.get('grant_type')).toBe('authorization_code')
    expect(body.get('redirect_uri')).toBe('https://x/cb')
  })

  it('reads the wrapped response and falls back to the requested permissions', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ data: [{ access_token: 'short', user_id: '17' }] }))
    const session = await exchangeInstagramCode({ appId: '1', appSecret: 's', redirectUri: 'r', code: 'c' }, fetchImpl)
    expect(session.accessToken).toBe('short')
    expect(session.permissions).toEqual(['instagram_business_basic', 'instagram_business_content_publish'])
  })

  it('surfaces Instagram’s own error text from the code exchange', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ error_type: 'OAuthException', code: 400, error_message: 'Invalid authorization code' }, 400))
    await expect(exchangeInstagramCode({ appId: '1', appSecret: 's', redirectUri: 'r', code: 'c' }, fetchImpl))
      .rejects.toMatchObject({ message: 'Invalid authorization code', status: 400 })
  })

  it('fails clearly on an empty token response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}))
    await expect(exchangeInstagramCode({ appId: '1', appSecret: 's', redirectUri: 'r', code: 'c' }, fetchImpl))
      .rejects.toBeInstanceOf(InstagramApiError)
  })

  it('swaps the short-lived token for a long-lived one on graph.instagram.com', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ access_token: 'long', token_type: 'bearer', expires_in: 5184000 }))
    expect(await exchangeInstagramLongLivedToken({ appSecret: 's', accessToken: 'short' }, fetchImpl)).toEqual({ accessToken: 'long', expiresInSeconds: 5184000 })
    const url = new URL(String(fetchImpl.mock.calls[0]![0]))
    expect(url.origin + url.pathname).toBe('https://graph.instagram.com/access_token')
    expect(url.searchParams.get('grant_type')).toBe('ig_exchange_token')
    expect(url.searchParams.get('client_secret')).toBe('s')
    expect(url.searchParams.get('access_token')).toBe('short')
  })

  it('renews a token through the refresh endpoint', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ access_token: 'renewed', expires_in: 5184000 }))
    expect(await refreshInstagramToken('old', fetchImpl)).toEqual({ accessToken: 'renewed', expiresInSeconds: 5184000 })
    const url = new URL(String(fetchImpl.mock.calls[0]![0]))
    expect(url.pathname).toBe('/refresh_access_token')
    expect(url.searchParams.get('grant_type')).toBe('ig_refresh_token')
  })

  it('reads the professional account, preferring user_id over the app-scoped id', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ id: '999', user_id: '1784140000', username: 'dj_nightlight', account_type: 'BUSINESS' }))
    expect(await getInstagramProfile('tok', fetchImpl)).toEqual({ instagramId: '1784140000', username: 'dj_nightlight', accountType: 'BUSINESS' })
    const url = new URL(String(fetchImpl.mock.calls[0]![0]))
    expect(url.origin).toBe('https://graph.instagram.com')
    expect(url.pathname).toMatch(/^\/v\d+\.\d+\/me$/)
  })

  it('treats a rejected token as a permanent error, without leaking it', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ error: { message: 'Invalid OAuth access token', code: 190 } }, 400))
    const error = await getInstagramProfile('super-secret-token', fetchImpl).catch((cause: unknown) => cause) as InstagramApiError
    expect(error).toBeInstanceOf(InstagramApiError)
    expect(error.permanent).toBe(true)
    expect(error.message).not.toContain('super-secret-token')
  })
})

describe('publishing on Instagram Login', () => {
  it('sends publishing calls to graph.instagram.com for an Instagram Login account', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ id: 'container-1' }))
      .mockResolvedValueOnce(jsonResponse({ status_code: 'FINISHED' }))
      .mockResolvedValueOnce(jsonResponse({ id: 'media-1' }))

    expect(await createImageContainer({ instagramId: '17', accessToken: 't', loginType: 'instagram', imageUrl: 'https://x/i.jpg', caption: 'hi' }, fetchImpl)).toBe('container-1')
    expect(await getContainerStatus({ containerId: 'container-1', accessToken: 't', loginType: 'instagram' }, fetchImpl)).toMatchObject({ status: 'FINISHED' })
    expect(await publishContainer({ instagramId: '17', accessToken: 't', containerId: 'container-1', loginType: 'instagram' }, fetchImpl)).toBe('media-1')

    for (const call of fetchImpl.mock.calls) expect(String(call[0])).toMatch(/^https:\/\/graph\.instagram\.com\/v\d+\.\d+\//)
  })

  it('keeps using graph.facebook.com when no login type is given', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ id: 'container-1' }))
    await createImageContainer({ instagramId: '17', accessToken: 't', imageUrl: 'https://x/i.jpg', caption: '' }, fetchImpl)
    expect(String(fetchImpl.mock.calls[0]![0])).toMatch(/^https:\/\/graph\.facebook\.com\//)
  })
})

describe('renewing Instagram Login tokens', () => {
  const issued = new Date(now - 10 * DAY)

  it('renews once fewer than 30 days are left', () => {
    expect(shouldRenewToken({ expiresAt: new Date(now + 29 * DAY), issuedAt: issued, now })).toBe(true)
    expect(shouldRenewToken({ expiresAt: new Date(now + 31 * DAY), issuedAt: issued, now })).toBe(false)
  })

  it('never renews a token that is under a day old or already expired', () => {
    expect(shouldRenewToken({ expiresAt: new Date(now + 5 * DAY), issuedAt: new Date(now - 3_600_000), now })).toBe(false)
    expect(shouldRenewToken({ expiresAt: new Date(now - 1), issuedAt: issued, now })).toBe(false)
    expect(shouldRenewToken({ expiresAt: null, issuedAt: issued, now })).toBe(false)
  })
})

describe('health for Instagram Login', () => {
  it('points at the automatic renewal, not at a manual reconnect, when expiry nears', () => {
    const result = instagramHealth({
      appConfigured: true,
      account: { status: 'active', tokenExpiresAt: new Date(now + 3 * DAY), scopes: ['instagram_business_content_publish'], lastError: null, loginType: 'instagram' },
      workerLastRunAt: new Date(now - 10_000),
      now,
    })
    expect(result.title).toBe('Toegang verloopt binnenkort')
    expect(result.detail).toContain('automatische verlenging')
  })
})
