import { z } from 'zod'
import { INSTAGRAM_STATE_COOKIE, OAUTH_STATE_MAX_AGE_MS } from '../../../../../shared/instagram'
import { recordAudit } from '../../../../utils/audit'
import { InstagramApiError } from '../../../../utils/instagram'
import { INSTAGRAM_PENDING_COOKIE, sealPendingToken } from '../../../../utils/instagram-pending'
import { verifyOAuthState } from '../../../../utils/instagram-state'
import { loadInstagramIntegration } from '../../../../utils/integration-settings'
import { requireStaff } from '../../../../utils/require-staff'
import { beginInstagramConnection } from '../../../../utils/social-accounts'
import { structuredLog } from '../../../../utils/structured-log'

const querySchema = z.object({
  code: z.string().min(1).max(2000).optional(),
  state: z.string().min(1).max(500).optional(),
  error: z.string().max(200).optional(),
  error_description: z.string().max(500).optional(),
})

function back(event: Parameters<typeof sendRedirect>[0], outcome: string, detail?: string) {
  const extra = detail ? `&detail=${encodeURIComponent(detail.slice(0, 300))}` : ''
  return sendRedirect(event, `/admin/settings?instagram=${outcome}${extra}#integrations`, 302)
}

export default defineEventHandler(async (event) => {
  const user = await requireStaff(event, ['owner'])
  const cookieNonce = getCookie(event, INSTAGRAM_STATE_COOKIE)
  deleteCookie(event, INSTAGRAM_STATE_COOKIE, { path: '/api/admin/social/instagram' })

  const parsed = querySchema.safeParse(getQuery(event))
  if (!parsed.success) return back(event, 'error')
  const { code, state, error } = parsed.data

  if (error) return back(event, 'denied', parsed.data.error_description)
  if (!code || !state) return back(event, 'error')

  const config = useRuntimeConfig()
  const password = String(config.session.password || '')
  const valid = verifyOAuthState({ state, cookieNonce, userId: user.id, password })
  if (!valid) return back(event, 'state')

  try {
    const { loginType } = await loadInstagramIntegration()
    const outcome = await beginInstagramConnection({ code, userId: user.id, loginType })

    if (outcome.kind === 'choose') {
      // Several Instagram accounts were granted: park the user token briefly while the owner picks one.
      const sessionCookie = config.session.cookie
      setCookie(event, INSTAGRAM_PENDING_COOKIE, sealPendingToken({ userToken: outcome.userToken, userId: user.id, password }), {
        httpOnly: true,
        sameSite: 'lax',
        secure: typeof sessionCookie === 'object' ? Boolean(sessionCookie.secure) : false,
        path: '/api/admin/social/instagram',
        maxAge: Math.floor(OAUTH_STATE_MAX_AGE_MS / 1000),
      })
      return back(event, 'choose')
    }

    const account = outcome.account
    await recordAudit({
      userId: user.id,
      entityType: 'social_account',
      entityId: account.id,
      action: 'instagram.connected',
      metadata: { username: account.username, loginType: account.loginType },
    })
    return back(event, 'connected')
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause)
    structuredLog('error', 'instagram_connect_failed', {
      message,
      code: cause instanceof InstagramApiError ? cause.code : null,
    })
    // Meta's error text holds no secrets and is what the owner needs to fix the app setup.
    return back(event, 'error', message)
  }
})
