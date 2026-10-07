// Thin client for the Instagram API with Facebook Login (Graph API). Pure functions
// with an injectable fetch so response handling can be unit tested without Nuxt.
import { META_GRAPH_VERSION } from '../../shared/instagram'

const GRAPH = `https://graph.facebook.com/${META_GRAPH_VERSION}`

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

type MetaErrorPayload = { error?: { message?: string, code?: number, type?: string } }

function metaError(status: number, payload: unknown) {
  const body = (payload && typeof payload === 'object' ? payload : {}) as MetaErrorPayload
  const message = body.error?.message || `Meta antwoordde met status ${status}`
  const code = body.error?.code ?? null
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

async function get(path: string, params: Record<string, string>, fetchImpl: FetchLike) {
  const response = await fetchImpl(`${GRAPH}${path}?${new URLSearchParams(params)}`)
  const payload = await readJson(response)
  if (!response.ok) throw metaError(response.status, payload)
  return payload as Record<string, unknown>
}

async function post(path: string, params: Record<string, string>, fetchImpl: FetchLike) {
  const response = await fetchImpl(`${GRAPH}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  })
  const payload = await readJson(response)
  if (!response.ok) throw metaError(response.status, payload)
  return payload as Record<string, unknown>
}

export type UserToken = { accessToken: string, expiresInSeconds: number | null }

function userToken(payload: Record<string, unknown>): UserToken {
  const accessToken = typeof payload.access_token === 'string' ? payload.access_token : ''
  if (!accessToken) throw new InstagramApiError('Meta gaf geen toegangstoken terug', 200, null, false)
  const expires = Number(payload.expires_in)
  return { accessToken, expiresInSeconds: Number.isFinite(expires) && expires > 0 ? expires : null }
}

export async function exchangeCodeForToken(
  input: { appId: string, appSecret: string, redirectUri: string, code: string },
  fetchImpl: FetchLike = fetch,
) {
  return userToken(await get('/oauth/access_token', {
    client_id: input.appId,
    client_secret: input.appSecret,
    redirect_uri: input.redirectUri,
    code: input.code,
  }, fetchImpl))
}

export async function exchangeForLongLivedToken(
  input: { appId: string, appSecret: string, accessToken: string },
  fetchImpl: FetchLike = fetch,
) {
  return userToken(await get('/oauth/access_token', {
    grant_type: 'fb_exchange_token',
    client_id: input.appId,
    client_secret: input.appSecret,
    fb_exchange_token: input.accessToken,
  }, fetchImpl))
}

export type InstagramPage = {
  pageId: string
  pageName: string
  pageAccessToken: string
  instagramId: string
  username: string
}

/** Facebook Pages the user manages that have an Instagram professional account linked. */
export async function listInstagramPages(accessToken: string, fetchImpl: FetchLike = fetch): Promise<InstagramPage[]> {
  const payload = await get('/me/accounts', {
    fields: 'id,name,access_token,instagram_business_account{id,username}',
    limit: '100',
    access_token: accessToken,
  }, fetchImpl)

  const pages = Array.isArray(payload.data) ? payload.data as Array<Record<string, unknown>> : []
  const found: InstagramPage[] = []
  for (const page of pages) {
    const instagram = page.instagram_business_account as Record<string, unknown> | undefined
    if (!instagram?.id || typeof page.access_token !== 'string') continue
    found.push({
      pageId: String(page.id),
      pageName: String(page.name ?? ''),
      pageAccessToken: page.access_token,
      instagramId: String(instagram.id),
      username: typeof instagram.username === 'string' ? instagram.username : '',
    })
  }
  return found
}

export type TokenInspection = {
  isValid: boolean
  appId: string
  /** Earliest moment the access stops working; null when Meta reports no expiry. */
  expiresAt: Date | null
  scopes: string[]
  errorMessage: string | null
}

function unixDate(value: unknown) {
  const seconds = Number(value)
  return Number.isFinite(seconds) && seconds > 0 ? new Date(seconds * 1000) : null
}

/** Asks Meta what a token is worth: validity, owning app, permissions and expiry. */
export async function inspectToken(
  input: { appId: string, appSecret: string, token: string },
  fetchImpl: FetchLike = fetch,
): Promise<TokenInspection> {
  const payload = await get('/debug_token', {
    input_token: input.token,
    access_token: `${input.appId}|${input.appSecret}`,
  }, fetchImpl)
  const data = (payload.data ?? {}) as Record<string, unknown>

  // A Page token has no expiry of its own, but Meta also limits how long user data stays accessible.
  const candidates = [unixDate(data.expires_at), unixDate(data.data_access_expires_at)].filter((date): date is Date => date !== null)
  const expiresAt = candidates.length ? new Date(Math.min(...candidates.map(date => date.getTime()))) : null
  const error = data.error as { message?: string } | undefined

  return {
    isValid: data.is_valid === true,
    appId: String(data.app_id ?? ''),
    expiresAt,
    scopes: Array.isArray(data.scopes) ? data.scopes.map(String) : [],
    errorMessage: error?.message ? String(error.message).slice(0, 500) : null,
  }
}

function requireId(payload: Record<string, unknown>, what: string) {
  const id = typeof payload.id === 'string' ? payload.id : ''
  if (!id) throw new InstagramApiError(`Meta gaf geen ${what} terug`, 200, null, false)
  return id
}

/** Step 1 of publishing: Meta fetches the public image URL and returns a container id. */
export async function createImageContainer(
  input: { instagramId: string, accessToken: string, imageUrl: string, caption: string, altText?: string | null },
  fetchImpl: FetchLike = fetch,
) {
  const params: Record<string, string> = {
    image_url: input.imageUrl,
    caption: input.caption,
    access_token: input.accessToken,
  }
  if (input.altText?.trim()) params.alt_text = input.altText.trim()
  return requireId(await post(`/${input.instagramId}/media`, params, fetchImpl), 'container')
}

export type ContainerStatus = 'EXPIRED' | 'ERROR' | 'FINISHED' | 'IN_PROGRESS' | 'PUBLISHED'

const CONTAINER_STATUSES: readonly string[] = ['EXPIRED', 'ERROR', 'FINISHED', 'IN_PROGRESS', 'PUBLISHED']

export async function getContainerStatus(
  input: { containerId: string, accessToken: string },
  fetchImpl: FetchLike = fetch,
): Promise<{ status: ContainerStatus, detail: string | null }> {
  const payload = await get(`/${input.containerId}`, { fields: 'status_code,status', access_token: input.accessToken }, fetchImpl)
  const code = String(payload.status_code ?? '')
  if (!CONTAINER_STATUSES.includes(code)) {
    throw new InstagramApiError('Meta gaf een onbekende containerstatus terug', 200, null, false)
  }
  return { status: code as ContainerStatus, detail: typeof payload.status === 'string' ? payload.status.slice(0, 500) : null }
}

/** Step 2: publish a finished container. Never call this twice for one container. */
export async function publishContainer(
  input: { instagramId: string, accessToken: string, containerId: string },
  fetchImpl: FetchLike = fetch,
) {
  return requireId(await post(`/${input.instagramId}/media_publish`, {
    creation_id: input.containerId,
    access_token: input.accessToken,
  }, fetchImpl), 'media-id')
}

export async function getPermalink(
  input: { mediaId: string, accessToken: string },
  fetchImpl: FetchLike = fetch,
) {
  const payload = await get(`/${input.mediaId}`, { fields: 'permalink', access_token: input.accessToken }, fetchImpl)
  return typeof payload.permalink === 'string' ? payload.permalink : null
}

/** Facebook Page photo post. One call, no container: the Page token is the credential. */
export async function publishPagePhoto(
  input: { pageId: string, accessToken: string, imageUrl: string, caption: string, altText?: string | null },
  fetchImpl: FetchLike = fetch,
) {
  const params: Record<string, string> = {
    url: input.imageUrl,
    published: 'true',
    access_token: input.accessToken,
  }
  if (input.caption) params.message = input.caption
  if (input.altText?.trim()) params.alt_text_custom = input.altText.trim()
  const payload = await post(`/${input.pageId}/photos`, params, fetchImpl)
  const postId = typeof payload.post_id === 'string' ? payload.post_id : ''
  const photoId = typeof payload.id === 'string' ? payload.id : ''
  if (!postId && !photoId) throw new InstagramApiError('Meta gaf geen post-id terug', 200, null, false)
  return { photoId: photoId || null, postId: postId || photoId }
}

export async function getPostPermalink(
  input: { postId: string, accessToken: string },
  fetchImpl: FetchLike = fetch,
) {
  const payload = await get(`/${input.postId}`, { fields: 'permalink_url', access_token: input.accessToken }, fetchImpl)
  const link = typeof payload.permalink_url === 'string' ? payload.permalink_url : null
  // Meta returns a path for Page posts.
  return link && link.startsWith('/') ? `https://www.facebook.com${link}` : link
}
