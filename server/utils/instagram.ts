// Thin client for the Instagram API with Instagram Login. Pure functions with an
// injectable fetch so the response handling can be unit tested without Nuxt.

/** Meta versions the Graph API; change it here only. */
export const INSTAGRAM_GRAPH_VERSION = 'v23.0'

const GRAPH_HOST = 'https://graph.instagram.com'
const OAUTH_TOKEN_URL = 'https://api.instagram.com/oauth/access_token'

type FetchLike = typeof fetch

/** Error codes that mean the token itself is no longer usable, so retrying is pointless. */
const PERMANENT_AUTH_CODES = new Set([102, 190, 463, 467])

export class InstagramApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: number | null,
    readonly permanent: boolean,
  ) {
    super(message)
    this.name = 'InstagramApiError'
  }
}

type MetaErrorPayload = {
  error?: { message?: string, code?: number, type?: string }
  error_message?: string
  error_type?: string
  code?: number
}

function metaError(status: number, payload: unknown) {
  const body = (payload && typeof payload === 'object' ? payload : {}) as MetaErrorPayload
  const message = body.error?.message || body.error_message || `Instagram antwoordde met status ${status}`
  const code = body.error?.code ?? body.code ?? null
  const permanent = status === 401 || (code !== null && PERMANENT_AUTH_CODES.has(code))
  return new InstagramApiError(message.slice(0, 500), status, code, permanent)
}

async function readJson(response: Response) {
  const text = await response.text()
  try {
    return text ? JSON.parse(text) as unknown : {}
  } catch {
    return {}
  }
}

async function request(url: string, init: RequestInit | undefined, fetchImpl: FetchLike) {
  const response = await fetchImpl(url, init)
  const payload = await readJson(response)
  if (!response.ok) throw metaError(response.status, payload)
  return payload as Record<string, unknown>
}

function permissionList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean)
  if (typeof value === 'string') return value.split(',').map(item => item.trim()).filter(Boolean)
  return []
}

export type ShortLivedToken = { accessToken: string, userId: string, permissions: string[] }

export async function exchangeCodeForToken(
  input: { appId: string, appSecret: string, redirectUri: string, code: string },
  fetchImpl: FetchLike = fetch,
): Promise<ShortLivedToken> {
  const payload = await request(OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: input.appId,
      client_secret: input.appSecret,
      grant_type: 'authorization_code',
      redirect_uri: input.redirectUri,
      code: input.code,
    }),
  }, fetchImpl)

  // Meta has returned both a flat object and { data: [ … ] }.
  const first = Array.isArray(payload.data) ? (payload.data[0] as Record<string, unknown> | undefined) ?? {} : payload
  const accessToken = typeof first.access_token === 'string' ? first.access_token : ''
  if (!accessToken) throw new InstagramApiError('Instagram gaf geen toegangstoken terug', 200, null, false)
  return {
    accessToken,
    userId: String(first.user_id ?? ''),
    permissions: permissionList(first.permissions),
  }
}

export type LongLivedToken = { accessToken: string, expiresInSeconds: number }

function longLived(payload: Record<string, unknown>): LongLivedToken {
  const accessToken = typeof payload.access_token === 'string' ? payload.access_token : ''
  const expiresInSeconds = Number(payload.expires_in)
  if (!accessToken || !Number.isFinite(expiresInSeconds) || expiresInSeconds <= 0) {
    throw new InstagramApiError('Instagram gaf geen geldig langlopend token terug', 200, null, false)
  }
  return { accessToken, expiresInSeconds }
}

export async function exchangeForLongLivedToken(
  input: { appSecret: string, accessToken: string },
  fetchImpl: FetchLike = fetch,
) {
  const params = new URLSearchParams({
    grant_type: 'ig_exchange_token',
    client_secret: input.appSecret,
    access_token: input.accessToken,
  })
  return longLived(await request(`${GRAPH_HOST}/access_token?${params}`, undefined, fetchImpl))
}

export async function refreshLongLivedToken(accessToken: string, fetchImpl: FetchLike = fetch) {
  const params = new URLSearchParams({ grant_type: 'ig_refresh_token', access_token: accessToken })
  return longLived(await request(`${GRAPH_HOST}/refresh_access_token?${params}`, undefined, fetchImpl))
}

export type InstagramProfile = { externalId: string, username: string, accountType: string | null }

export async function fetchInstagramProfile(accessToken: string, fetchImpl: FetchLike = fetch): Promise<InstagramProfile> {
  const params = new URLSearchParams({ fields: 'user_id,username,account_type', access_token: accessToken })
  const payload = await request(`${GRAPH_HOST}/${INSTAGRAM_GRAPH_VERSION}/me?${params}`, undefined, fetchImpl)
  // `user_id` is the professional account id that the publishing endpoints use; `id` is app-scoped.
  const externalId = String(payload.user_id ?? payload.id ?? '')
  const username = typeof payload.username === 'string' ? payload.username : ''
  if (!externalId || !username) throw new InstagramApiError('Instagram gaf geen accountgegevens terug', 200, null, false)
  return {
    externalId,
    username,
    accountType: typeof payload.account_type === 'string' ? payload.account_type : null,
  }
}
