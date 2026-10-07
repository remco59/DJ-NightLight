import { randomBytes } from 'node:crypto'
import { buildInstagramAuthorizeUrl, instagramRedirectUri, INSTAGRAM_STATE_COOKIE, OAUTH_STATE_MAX_AGE_MS } from '../../../../../shared/instagram'
import { signOAuthState } from '../../../../utils/instagram-state'
import { loadInstagramIntegration } from '../../../../utils/integration-settings'
import { requireStaff } from '../../../../utils/require-staff'

export default defineEventHandler(async (event) => {
  const user = await requireStaff(event, ['owner'])
  const { credentials } = await loadInstagramIntegration()
  if (!credentials.appId || !credentials.appSecret) {
    return sendRedirect(event, '/admin/settings?instagram=missing#integrations', 302)
  }

  const config = useRuntimeConfig()
  const sessionCookie = config.session.cookie
  const nonce = randomBytes(16).toString('base64url')
  setCookie(event, INSTAGRAM_STATE_COOKIE, nonce, {
    httpOnly: true,
    sameSite: 'lax',
    secure: typeof sessionCookie === 'object' ? Boolean(sessionCookie.secure) : false,
    path: '/api/admin/social/instagram',
    maxAge: Math.floor(OAUTH_STATE_MAX_AGE_MS / 1000),
  })

  const state = signOAuthState({ nonce, userId: user.id, password: String(config.session.password || '') })
  return sendRedirect(event, buildInstagramAuthorizeUrl({
    appId: credentials.appId,
    redirectUri: instagramRedirectUri(String(config.public.siteUrl || '')),
    state,
  }), 302)
})
