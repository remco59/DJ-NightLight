// Browser-safe: the admin UI imports this file, so it must not import Node modules.
// The OAuth state signing (node:crypto) lives in server/utils/instagram-state.ts.
//
// NightLight talks to Instagram through the "Instagram API with Facebook Login":
// the owner logs in with Facebook, and the Instagram professional account linked to
// a Facebook Page is found through that Page.

/** Meta versions the Graph API; change it here only. */
export const META_GRAPH_VERSION = 'v23.0'

/** Meta's documentation calls it `instagram_content_publish`; the app dashboard lists `instagram_content_publishing`. Accept both. */
export const INSTAGRAM_PUBLISH_SCOPES = ['instagram_content_publish', 'instagram_content_publishing'] as const
/** Needed to post on the Facebook Page; optional for the Instagram connection itself. */
export const FACEBOOK_PUBLISH_SCOPE = 'pages_manage_posts'
export const FACEBOOK_LOGIN_SCOPES = [
  'instagram_basic',
  'instagram_content_publish',
  FACEBOOK_PUBLISH_SCOPE,
  'pages_show_list',
  'pages_read_engagement',
  'business_management',
] as const
export const INSTAGRAM_CALLBACK_PATH = '/api/admin/social/instagram/callback'
export const INSTAGRAM_STATE_COOKIE = 'nl_instagram_state'

const DAY_MS = 24 * 60 * 60 * 1000

/** The worker verifies the stored access with Meta at most this often. */
export const CONNECTION_CHECK_INTERVAL_MS = DAY_MS
/** Warn in the UI when fewer days than this are left on the access. */
export const TOKEN_WARNING_DAYS = 7
export const OAUTH_STATE_MAX_AGE_MS = 10 * 60_000
/** The worker ticks every minute; offline after three missed ticks. */
export const WORKER_ONLINE_WINDOW_MS = 3 * 60_000

export function instagramRedirectUri(siteUrl: string) {
  return `${siteUrl.replace(/\/+$/, '')}${INSTAGRAM_CALLBACK_PATH}`
}

/**
 * Facebook Login dialog. With a Facebook Login for Business configuration the permissions
 * come from the configuration (`config_id`); without one the classic `scope` list is sent.
 */
export function buildFacebookAuthorizeUrl(input: { appId: string, redirectUri: string, state: string, configId?: string | null }) {
  const params = new URLSearchParams({
    client_id: input.appId,
    redirect_uri: input.redirectUri,
    response_type: 'code',
    state: input.state,
  })
  if (input.configId) {
    params.set('config_id', input.configId)
    params.set('override_default_response_type', 'true')
  } else {
    params.set('scope', FACEBOOK_LOGIN_SCOPES.join(','))
  }
  return `https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth?${params.toString()}`
}

export function hasPublishScope(scopes: readonly string[]) {
  return INSTAGRAM_PUBLISH_SCOPES.some(scope => scopes.includes(scope))
}

export function hasFacebookPublishScope(scopes: readonly string[]) {
  return scopes.includes(FACEBOOK_PUBLISH_SCOPE)
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

export function shouldCheckConnection(input: { status: string, lastCheckedAt: DateLike, now?: number }) {
  if (input.status !== 'active') return false
  const now = input.now ?? Date.now()
  const last = ms(input.lastCheckedAt)
  return last === null || now - last >= CONNECTION_CHECK_INTERVAL_MS
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
    lastError: string | null
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
  if (!hasPublishScope(account.scopes)) {
    return { level: 'error', title: 'Publicatierechten ontbreken', detail: 'Verbind het account opnieuw en geef toestemming om content te publiceren.' }
  }

  const daysLeft = tokenDaysLeft(account.tokenExpiresAt, now)
  if (daysLeft !== null && daysLeft < TOKEN_WARNING_DAYS) {
    return { level: 'warning', title: 'Toegang verloopt binnenkort', detail: `Nog ${Math.max(0, daysLeft)} dag(en) geldig. Verbind het account opnieuw om de toegang te verlengen.` }
  }
  if (account.lastError) {
    return { level: 'warning', title: 'Controle van de verbinding mislukt', detail: account.lastError }
  }
  const lastRun = ms(input.workerLastRunAt)
  if (lastRun === null || now - lastRun > WORKER_ONLINE_WINDOW_MS) {
    return { level: 'warning', title: 'Worker niet actief', detail: 'De achtergrondtaak voor Instagram heeft zich niet recent gemeld.' }
  }
  return { level: 'ok', title: 'Instagram-koppeling werkt', detail: 'Toegang geldig, publicatierechten aanwezig en worker actief.' }
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
