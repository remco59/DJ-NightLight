import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import {
  buildFacebookAuthorizeUrl,
  hasPublishScope,
  instagramHealth,
  instagramRedirectUri,
  maskAppId,
  maskExternalId,
  shouldCheckConnection,
  tokenDaysLeft,
} from '../shared/instagram'
import { signOAuthState, verifyOAuthState } from '../server/utils/instagram-state'
import {
  exchangeCodeForToken,
  exchangeForLongLivedToken,
  inspectToken,
  InstagramApiError,
  listInstagramPages,
} from '../server/utils/instagram'

const DAY = 24 * 60 * 60 * 1000
const now = Date.UTC(2026, 9, 7, 12, 0, 0)
const password = 'x'.repeat(40)

describe('Facebook Login setup', () => {
  it('builds the redirect URI without a double slash', () => {
    expect(instagramRedirectUri('https://nightlight.example/')).toBe('https://nightlight.example/api/admin/social/instagram/callback')
    expect(instagramRedirectUri('http://localhost:3000')).toBe('http://localhost:3000/api/admin/social/instagram/callback')
  })

  it('asks for the Instagram and Page permissions when no configuration is set', () => {
    const url = new URL(buildFacebookAuthorizeUrl({ appId: '123456', redirectUri: 'https://x.test/cb', state: 'abc' }))
    expect(url.origin + url.pathname).toMatch(/^https:\/\/www\.facebook\.com\/v\d+\.\d+\/dialog\/oauth$/)
    expect(url.searchParams.get('client_id')).toBe('123456')
    expect(url.searchParams.get('response_type')).toBe('code')
    expect(url.searchParams.get('state')).toBe('abc')
    expect(url.searchParams.get('scope')).toBe('instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement,business_management')
    expect(url.searchParams.has('config_id')).toBe(false)
  })

  it('uses the Facebook Login for Business configuration instead of scopes when one is set', () => {
    const url = new URL(buildFacebookAuthorizeUrl({ appId: '123456', redirectUri: 'https://x.test/cb', state: 'abc', configId: '987654321' }))
    expect(url.searchParams.get('config_id')).toBe('987654321')
    expect(url.searchParams.get('override_default_response_type')).toBe('true')
    expect(url.searchParams.has('scope')).toBe(false)
  })

  it('accepts either spelling of the publish permission', () => {
    expect(hasPublishScope(['instagram_basic', 'instagram_content_publish'])).toBe(true)
    expect(hasPublishScope(['instagram_content_publishing'])).toBe(true)
    expect(hasPublishScope(['instagram_basic'])).toBe(false)
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

describe('connection checks', () => {
  it('checks an active account at most once a day', () => {
    expect(shouldCheckConnection({ status: 'active', lastCheckedAt: null, now })).toBe(true)
    expect(shouldCheckConnection({ status: 'active', lastCheckedAt: new Date(now - 3_600_000), now })).toBe(false)
    expect(shouldCheckConnection({ status: 'active', lastCheckedAt: new Date(now - 25 * 3_600_000), now })).toBe(true)
  })

  it('does not check accounts that already need attention', () => {
    expect(shouldCheckConnection({ status: 'needs_reauth', lastCheckedAt: null, now })).toBe(false)
    expect(shouldCheckConnection({ status: 'disabled', lastCheckedAt: null, now })).toBe(false)
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
    scopes: ['instagram_basic', 'instagram_content_publish'],
    lastError: null,
  }
  const base = { appConfigured: true, account, workerLastRunAt: new Date(now - 10_000), now }

  it('reports ok when access, permission and worker are fine', () => {
    expect(instagramHealth(base)).toMatchObject({ level: 'ok', title: 'Instagram-koppeling werkt' })
  })

  it('is inactive without app or account', () => {
    expect(instagramHealth({ ...base, appConfigured: false }).level).toBe('inactive')
    expect(instagramHealth({ ...base, account: null }).level).toBe('inactive')
  })

  it('is an error when reauth is needed, access expired or the publish permission is missing', () => {
    expect(instagramHealth({ ...base, account: { ...account, status: 'needs_reauth' } }).level).toBe('error')
    expect(instagramHealth({ ...base, account: { ...account, tokenExpiresAt: new Date(now - 1) } }).level).toBe('error')
    expect(instagramHealth({ ...base, account: { ...account, scopes: ['instagram_basic'] } }).title).toBe('Publicatierechten ontbreken')
  })

  it('warns about expiring access, a failed check and an offline worker', () => {
    expect(instagramHealth({ ...base, account: { ...account, tokenExpiresAt: new Date(now + 3 * DAY) } }).title).toBe('Toegang verloopt binnenkort')
    expect(instagramHealth({ ...base, account: { ...account, lastError: 'boom' } }).title).toBe('Controle van de verbinding mislukt')
    expect(instagramHealth({ ...base, workerLastRunAt: new Date(now - 10 * 60_000) }).title).toBe('Worker niet actief')
    expect(instagramHealth({ ...base, workerLastRunAt: null }).level).toBe('warning')
  })
})

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

describe('Facebook Graph client', () => {
  it('exchanges a code and then a long-lived user token', async () => {
    const code = vi.fn().mockResolvedValue(jsonResponse({ access_token: 'short', token_type: 'bearer', expires_in: 3600 }))
    expect(await exchangeCodeForToken({ appId: '1', appSecret: 's', redirectUri: 'https://x/cb', code: 'c' }, code))
      .toEqual({ accessToken: 'short', expiresInSeconds: 3600 })
    const codeUrl = new URL(String(code.mock.calls[0]![0]))
    expect(codeUrl.pathname).toMatch(/\/oauth\/access_token$/)
    expect(codeUrl.searchParams.get('code')).toBe('c')
    expect(codeUrl.searchParams.get('redirect_uri')).toBe('https://x/cb')

    const long = vi.fn().mockResolvedValue(jsonResponse({ access_token: 'long', expires_in: 5184000 }))
    expect(await exchangeForLongLivedToken({ appId: '1', appSecret: 's', accessToken: 'short' }, long))
      .toEqual({ accessToken: 'long', expiresInSeconds: 5184000 })
    const longUrl = new URL(String(long.mock.calls[0]![0]))
    expect(longUrl.searchParams.get('grant_type')).toBe('fb_exchange_token')
    expect(longUrl.searchParams.get('fb_exchange_token')).toBe('short')
  })

  it('accepts a token response without an expiry', async () => {
    const none = vi.fn().mockResolvedValue(jsonResponse({ access_token: 'tok' }))
    expect(await exchangeCodeForToken({ appId: '1', appSecret: 's', redirectUri: 'r', code: 'c' }, none))
      .toEqual({ accessToken: 'tok', expiresInSeconds: null })
  })

  it('lists only Pages that have an Instagram account', async () => {
    const pages = vi.fn().mockResolvedValue(jsonResponse({
      data: [
        { id: 'p1', name: 'Zonder Instagram', access_token: 'pt1' },
        { id: 'p2', name: 'DJ NightLight', access_token: 'pt2', instagram_business_account: { id: '17841400', username: 'djnightlight' } },
      ],
    }))
    expect(await listInstagramPages('user-token', pages)).toEqual([
      { pageId: 'p2', pageName: 'DJ NightLight', pageAccessToken: 'pt2', instagramId: '17841400', username: 'djnightlight' },
    ])
    expect(new URL(String(pages.mock.calls[0]![0])).searchParams.get('fields')).toContain('instagram_business_account')
  })

  it('returns an empty list when no Page has an Instagram account', async () => {
    const empty = vi.fn().mockResolvedValue(jsonResponse({ data: [] }))
    expect(await listInstagramPages('t', empty)).toEqual([])
  })

  it('inspects a token: owning app, scopes and the earliest expiry', async () => {
    const soon = Math.floor((now + 30 * DAY) / 1000)
    const later = Math.floor((now + 90 * DAY) / 1000)
    const inspect = vi.fn().mockResolvedValue(jsonResponse({
      data: { is_valid: true, app_id: '1234', expires_at: 0, data_access_expires_at: soon, scopes: ['instagram_basic', 'instagram_content_publish'] },
    }))
    const result = await inspectToken({ appId: '1234', appSecret: 'secret', token: 'page-token' }, inspect)
    expect(result).toMatchObject({ isValid: true, appId: '1234', scopes: ['instagram_basic', 'instagram_content_publish'] })
    expect(result.expiresAt?.getTime()).toBe(soon * 1000)
    const url = new URL(String(inspect.mock.calls[0]![0]))
    expect(url.searchParams.get('input_token')).toBe('page-token')
    expect(url.searchParams.get('access_token')).toBe('1234|secret')

    const both = vi.fn().mockResolvedValue(jsonResponse({ data: { is_valid: true, app_id: '1', expires_at: later, data_access_expires_at: soon } }))
    expect((await inspectToken({ appId: '1', appSecret: 's', token: 't' }, both)).expiresAt?.getTime()).toBe(soon * 1000)

    const never = vi.fn().mockResolvedValue(jsonResponse({ data: { is_valid: true, app_id: '1', expires_at: 0, data_access_expires_at: 0 } }))
    expect((await inspectToken({ appId: '1', appSecret: 's', token: 't' }, never)).expiresAt).toBeNull()
  })

  it('reports an invalid token with Meta’s reason', async () => {
    const invalid = vi.fn().mockResolvedValue(jsonResponse({ data: { is_valid: false, error: { message: 'Session has expired' } } }))
    expect(await inspectToken({ appId: '1', appSecret: 's', token: 't' }, invalid))
      .toMatchObject({ isValid: false, errorMessage: 'Session has expired' })
  })

  it('marks rejected tokens as permanent errors and never leaks the token', async () => {
    const rejected = vi.fn().mockResolvedValue(jsonResponse({ error: { message: 'Error validating access token', code: 190 } }, 400))
    const error = await listInstagramPages('secret-token', rejected).catch(e => e)
    expect(error).toBeInstanceOf(InstagramApiError)
    expect(error).toMatchObject({ permanent: true, code: 190 })
    expect(error.message).not.toContain('secret-token')

    const transient = vi.fn().mockResolvedValue(jsonResponse({ error: { message: 'Service unavailable', code: 2 } }, 503))
    expect(await listInstagramPages('t', transient).catch(e => e)).toMatchObject({ permanent: false })
  })

  it('fails clearly on an empty token response', async () => {
    const empty = vi.fn().mockResolvedValue(jsonResponse({}))
    await expect(exchangeForLongLivedToken({ appId: '1', appSecret: 's', accessToken: 'x' }, empty)).rejects.toThrow('geen toegangstoken')
  })
})
