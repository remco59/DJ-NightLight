// Browser-safe: the admin UI imports this file, so it must not import Node modules.
// The OAuth state signing (node:crypto) lives in server/utils/instagram-state.ts.

export const INSTAGRAM_PUBLISH_SCOPE = 'instagram_business_content_publish'
export const INSTAGRAM_SCOPES = ['instagram_business_basic', INSTAGRAM_PUBLISH_SCOPE] as const
export const INSTAGRAM_CALLBACK_PATH = '/api/admin/social/instagram/callback'
export const INSTAGRAM_STATE_COOKIE = 'nl_instagram_state'

const DAY_MS = 24 * 60 * 60 * 1000
const HOUR_MS = 60 * 60 * 1000

/** Meta only allows a long-lived token to be refreshed once it is at least 24 hours old. */
export const MIN_TOKEN_AGE_MS = DAY_MS
/** Start refreshing this long before the token expires (the daily check leaves room for retries). */
export const TOKEN_REFRESH_WINDOW_MS = 14 * DAY_MS
export const TOKEN_REFRESH_RETRY_MS = 12 * HOUR_MS
/** Warn in the UI when fewer days than this are left on the token. */
export const TOKEN_WARNING_DAYS = 7
export const OAUTH_STATE_MAX_AGE_MS = 10 * 60_000
/** The worker ticks every minute; offline after three missed ticks. */
export const WORKER_ONLINE_WINDOW_MS = 3 * 60_000

export function instagramRedirectUri(siteUrl: string) {
  return `${siteUrl.replace(/\/+$/, '')}${INSTAGRAM_CALLBACK_PATH}`
}

export function buildInstagramAuthorizeUrl(input: { appId: string, redirectUri: string, state: string }) {
  const params = new URLSearchParams({
    client_id: input.appId,
    redirect_uri: input.redirectUri,
    response_type: 'code',
    scope: INSTAGRAM_SCOPES.join(','),
    state: input.state,
  })
  return `https://www.instagram.com/oauth/authorize?${params.toString()}`
}

type DateLike = Date | string | number | null | undefined

function ms(value: DateLike) {
  if (value === null || value === undefined) return null
  const time = value instanceof Date ? value.getTime() : new Date(value).getTime()
  return Number.isFinite(time) ? time : null
}

export function tokenDaysLeft(expiresAt: DateLike, now = Date.now()) {
  const expires = ms(expiresAt)
  if (expires === null) return null
  return Math.floor((expires - now) / DAY_MS)
}

export function shouldRefreshToken(input: {
  status: string
  tokenIssuedAt: DateLike
  tokenExpiresAt: DateLike
  lastRefreshAttemptAt: DateLike
  now?: number
}) {
  const now = input.now ?? Date.now()
  const issued = ms(input.tokenIssuedAt)
  const expires = ms(input.tokenExpiresAt)
  const lastAttempt = ms(input.lastRefreshAttemptAt)
  if (input.status !== 'active' || issued === null || expires === null) return false
  if (expires <= now) return false
  if (expires - now > TOKEN_REFRESH_WINDOW_MS) return false
  if (now - issued < MIN_TOKEN_AGE_MS) return false
  return lastAttempt === null || now - lastAttempt >= TOKEN_REFRESH_RETRY_MS
}

export function isTokenExpired(expiresAt: DateLike, now = Date.now()) {
  const expires = ms(expiresAt)
  return expires !== null && expires <= now
}

export type InstagramHealthLevel = 'ok' | 'warning' | 'error' | 'inactive'

export function instagramHealth(input: {
  appConfigured: boolean
  account: {
    status: string
    tokenExpiresAt: DateLike
    scopes: readonly string[]
    lastRefreshError: string | null
  } | null
  workerLastRunAt: DateLike
  now?: number
}): { level: InstagramHealthLevel, title: string, detail: string } {
  const now = input.now ?? Date.now()

  if (!input.appConfigured) {
    return { level: 'inactive', title: 'Meta-app niet ingesteld', detail: 'Vul het app-ID en het app secret in om Instagram te kunnen koppelen.' }
  }
  const account = input.account
  if (!account) {
    return { level: 'inactive', title: 'Nog niet gekoppeld', detail: 'Verbind je Instagram-account om posts te kunnen publiceren.' }
  }
  if (account.status === 'needs_reauth' || isTokenExpired(account.tokenExpiresAt, now)) {
    return { level: 'error', title: 'Opnieuw verbinden nodig', detail: 'De toegang tot Instagram is verlopen of ingetrokken. Verbind het account opnieuw.' }
  }
  if (account.status === 'disabled') {
    return { level: 'inactive', title: 'Koppeling uitgeschakeld', detail: 'Dit account wordt niet gebruikt voor publicaties.' }
  }
  if (!account.scopes.includes(INSTAGRAM_PUBLISH_SCOPE)) {
    return { level: 'error', title: 'Publicatierechten ontbreken', detail: 'Verbind het account opnieuw en geef toestemming om content te publiceren.' }
  }

  const daysLeft = tokenDaysLeft(account.tokenExpiresAt, now)
  if (daysLeft !== null && daysLeft < TOKEN_WARNING_DAYS) {
    return { level: 'warning', title: 'Token verloopt binnenkort', detail: `Nog ${Math.max(0, daysLeft)} dag(en) geldig. Vernieuwen gebeurt automatisch; lukt dat niet, verbind dan opnieuw.` }
  }
  if (account.lastRefreshError) {
    return { level: 'warning', title: 'Vernieuwen van het token mislukt', detail: account.lastRefreshError }
  }
  const lastRun = ms(input.workerLastRunAt)
  if (lastRun === null || now - lastRun > WORKER_ONLINE_WINDOW_MS) {
    return { level: 'warning', title: 'Worker niet actief', detail: 'De achtergrondtaak voor Instagram heeft zich niet recent gemeld.' }
  }
  return { level: 'ok', title: 'Instagram-koppeling werkt', detail: 'Token geldig, publicatierechten aanwezig en worker actief.' }
}

export function maskExternalId(value: string) {
  return value.length <= 8 ? value : `${value.slice(0, 4)}••••${value.slice(-3)}`
}

export function maskAppId(value: string) {
  return value.length <= 4 ? '••••' : `${'•'.repeat(12)}${value.slice(-4)}`
}

export const instagramAccountTypeLabels: Record<string, string> = {
  BUSINESS: 'Business account',
  MEDIA_CREATOR: 'Creator account',
  CREATOR: 'Creator account',
}
