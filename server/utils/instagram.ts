// Thin client for the Instagram API with Facebook Login (Graph API). Pure functions
// with an injectable fetch so response handling can be unit tested without Nuxt.
import { INSTAGRAM_LOGIN_SCOPES, META_GRAPH_VERSION, type InstagramLoginType } from '../../shared/instagram'

const GRAPH = `https://graph.facebook.com/${META_GRAPH_VERSION}`
/** Instagram Login talks to Instagram's own Graph host; the publishing calls are otherwise identical. */
const INSTAGRAM_GRAPH = `https://graph.instagram.com/${META_GRAPH_VERSION}`
const INSTAGRAM_UNVERSIONED = 'https://graph.instagram.com'
const INSTAGRAM_OAUTH = 'https://api.instagram.com/oauth/access_token'

/** Base URL of the Graph API for an account's login type. */
export function graphBase(loginType: InstagramLoginType | undefined) {
  return loginType === 'instagram' ? INSTAGRAM_GRAPH : GRAPH
}

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

async function get(path: string, params: Record<string, string>, fetchImpl: FetchLike, base = GRAPH) {
  const response = await fetchImpl(`${base}${path}?${new URLSearchParams(params)}`)
  const payload = await readJson(response)
  if (!response.ok) throw metaError(response.status, payload)
  return payload as Record<string, unknown>
}

async function post(path: string, params: Record<string, string>, fetchImpl: FetchLike, base = GRAPH) {
  const response = await fetchImpl(`${base}${path}`, {
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

/**
 * Which linked Instagram account to use. A reconnect keeps the account that is already connected;
 * otherwise a single candidate is taken. With several new candidates there is no safe default:
 * `null` means the owner has to choose.
 */
export function selectInstagramPage(pages: readonly InstagramPage[], options: { preferredInstagramId?: string | null } = {}) {
  const preferred = options.preferredInstagramId
    ? pages.find(page => page.instagramId === options.preferredInstagramId)
    : undefined
  if (preferred) return preferred
  return pages.length === 1 ? pages[0]! : null
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

/** Instagram Login: the code in the redirect can end with `#_`, which is not part of it. */
function cleanCode(code: string) {
  return code.replace(/#_$/, '')
}

export type InstagramLoginSession = { accessToken: string, userId: string, permissions: string[] }

/** Instagram Login, step 1: code → short-lived token (about an hour). */
export async function exchangeInstagramCode(
  input: { appId: string, appSecret: string, redirectUri: string, code: string },
  fetchImpl: FetchLike = fetch,
): Promise<InstagramLoginSession> {
  const response = await fetchImpl(INSTAGRAM_OAUTH, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: input.appId,
      client_secret: input.appSecret,
      grant_type: 'authorization_code',
      redirect_uri: input.redirectUri,
      code: cleanCode(input.code),
    }),
  })
  const payload = await readJson(response) as Record<string, unknown>
  if (!response.ok) {
    // This endpoint reports errors as { error_type, code, error_message } instead of { error: {...} }.
    const message = typeof payload.error_message === 'string' ? payload.error_message : undefined
    const code = typeof payload.code === 'number' ? payload.code : null
    throw new InstagramApiError((message || (payload.error as { message?: string } | undefined)?.message || `Instagram antwoordde met status ${response.status}`).slice(0, 500), response.status, code, response.status === 401)
  }
  // Newer responses wrap the result in `data: [ ... ]`.
  const entry = (Array.isArray(payload.data) ? payload.data[0] : payload) as Record<string, unknown> | undefined
  const accessToken = typeof entry?.access_token === 'string' ? entry.access_token : ''
  if (!accessToken) throw new InstagramApiError('Instagram gaf geen toegangstoken terug', 200, null, false)
  const permissions = typeof entry?.permissions === 'string'
    ? entry.permissions.split(',').map(value => value.trim()).filter(Boolean)
    : Array.isArray(entry?.permissions) ? entry.permissions.map(String) : [...INSTAGRAM_LOGIN_SCOPES]
  return { accessToken, userId: String(entry?.user_id ?? ''), permissions }
}

/** Instagram Login, step 2: short-lived token → long-lived token (60 days). */
export async function exchangeInstagramLongLivedToken(
  input: { appSecret: string, accessToken: string },
  fetchImpl: FetchLike = fetch,
) {
  return userToken(await get('/access_token', {
    grant_type: 'ig_exchange_token',
    client_secret: input.appSecret,
    access_token: input.accessToken,
  }, fetchImpl, INSTAGRAM_UNVERSIONED))
}

/** Renews a long-lived token for another 60 days. Meta only allows it once the token is a day old and still valid. */
export async function refreshInstagramToken(accessToken: string, fetchImpl: FetchLike = fetch) {
  return userToken(await get('/refresh_access_token', {
    grant_type: 'ig_refresh_token',
    access_token: accessToken,
  }, fetchImpl, INSTAGRAM_UNVERSIONED))
}

export type InstagramProfile = { instagramId: string, username: string, accountType: string | null }

/** The professional account behind a token. Also the validity check: Instagram has no `debug_token`. */
export async function getInstagramProfile(accessToken: string, fetchImpl: FetchLike = fetch): Promise<InstagramProfile> {
  const payload = await get('/me', { fields: 'user_id,username,account_type', access_token: accessToken }, fetchImpl, INSTAGRAM_GRAPH)
  // `user_id` is the id used in /{id}/media; `id` is the app-scoped id.
  const instagramId = String(payload.user_id ?? payload.id ?? '')
  if (!instagramId) throw new InstagramApiError('Instagram gaf geen account-id terug', 200, null, false)
  return {
    instagramId,
    username: typeof payload.username === 'string' ? payload.username : '',
    accountType: typeof payload.account_type === 'string' ? payload.account_type : null,
  }
}

function requireId(payload: Record<string, unknown>, what: string) {
  const id = typeof payload.id === 'string' ? payload.id : ''
  if (!id) throw new InstagramApiError(`Meta gaf geen ${what} terug`, 200, null, false)
  return id
}

/** Step 1 of publishing: Meta fetches the public image URL and returns a container id. */
export async function createImageContainer(
  input: { instagramId: string, accessToken: string, imageUrl: string, caption: string, altText?: string | null, loginType?: InstagramLoginType },
  fetchImpl: FetchLike = fetch,
) {
  const params: Record<string, string> = {
    image_url: input.imageUrl,
    caption: input.caption,
    access_token: input.accessToken,
  }
  if (input.altText?.trim()) params.alt_text = input.altText.trim()
  return requireId(await post(`/${input.instagramId}/media`, params, fetchImpl, graphBase(input.loginType)), 'container')
}

export type StoryOrReelType = 'REELS' | 'STORIES'

/** Reel or story from a public MP4 URL. Stories ignore captions; reels are also shown in the feed. */
export async function createVideoContainer(
  input: { instagramId: string, accessToken: string, videoUrl: string, mediaType: StoryOrReelType, caption?: string, loginType?: InstagramLoginType },
  fetchImpl: FetchLike = fetch,
) {
  const params: Record<string, string> = {
    media_type: input.mediaType,
    video_url: input.videoUrl,
    access_token: input.accessToken,
  }
  if (input.mediaType === 'REELS') {
    params.share_to_feed = 'true'
    if (input.caption) params.caption = input.caption
  }
  return requireId(await post(`/${input.instagramId}/media`, params, fetchImpl, graphBase(input.loginType)), 'container')
}

/** Story from a public JPEG URL. */
export async function createStoryImageContainer(
  input: { instagramId: string, accessToken: string, imageUrl: string, loginType?: InstagramLoginType },
  fetchImpl: FetchLike = fetch,
) {
  return requireId(await post(`/${input.instagramId}/media`, {
    media_type: 'STORIES',
    image_url: input.imageUrl,
    access_token: input.accessToken,
  }, fetchImpl, graphBase(input.loginType)), 'container')
}

/** One slide of a carousel. It is never published by itself; the carousel container references it. */
export async function createCarouselItemContainer(
  input: { instagramId: string, accessToken: string, imageUrl: string, altText?: string | null, loginType?: InstagramLoginType },
  fetchImpl: FetchLike = fetch,
) {
  const params: Record<string, string> = {
    is_carousel_item: 'true',
    image_url: input.imageUrl,
    access_token: input.accessToken,
  }
  if (input.altText?.trim()) params.alt_text = input.altText.trim()
  return requireId(await post(`/${input.instagramId}/media`, params, fetchImpl, graphBase(input.loginType)), 'container')
}

export async function createCarouselContainer(
  input: { instagramId: string, accessToken: string, children: readonly string[], caption: string, loginType?: InstagramLoginType },
  fetchImpl: FetchLike = fetch,
) {
  const params: Record<string, string> = {
    media_type: 'CAROUSEL',
    children: input.children.join(','),
    access_token: input.accessToken,
  }
  if (input.caption) params.caption = input.caption
  return requireId(await post(`/${input.instagramId}/media`, params, fetchImpl, graphBase(input.loginType)), 'container')
}

export type ContainerStatus = 'EXPIRED' | 'ERROR' | 'FINISHED' | 'IN_PROGRESS' | 'PUBLISHED'

const CONTAINER_STATUSES: readonly string[] = ['EXPIRED', 'ERROR', 'FINISHED', 'IN_PROGRESS', 'PUBLISHED']

export async function getContainerStatus(
  input: { containerId: string, accessToken: string, loginType?: InstagramLoginType },
  fetchImpl: FetchLike = fetch,
): Promise<{ status: ContainerStatus, detail: string | null }> {
  const payload = await get(`/${input.containerId}`, { fields: 'status_code,status', access_token: input.accessToken }, fetchImpl, graphBase(input.loginType))
  const code = String(payload.status_code ?? '')
  if (!CONTAINER_STATUSES.includes(code)) {
    throw new InstagramApiError('Meta gaf een onbekende containerstatus terug', 200, null, false)
  }
  return { status: code as ContainerStatus, detail: typeof payload.status === 'string' ? payload.status.slice(0, 500) : null }
}

/** Step 2: publish a finished container. Never call this twice for one container. */
export async function publishContainer(
  input: { instagramId: string, accessToken: string, containerId: string, loginType?: InstagramLoginType },
  fetchImpl: FetchLike = fetch,
) {
  return requireId(await post(`/${input.instagramId}/media_publish`, {
    creation_id: input.containerId,
    access_token: input.accessToken,
  }, fetchImpl, graphBase(input.loginType)), 'media-id')
}

export async function getPermalink(
  input: { mediaId: string, accessToken: string, loginType?: InstagramLoginType },
  fetchImpl: FetchLike = fetch,
) {
  const payload = await get(`/${input.mediaId}`, { fields: 'permalink', access_token: input.accessToken }, fetchImpl, graphBase(input.loginType))
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
