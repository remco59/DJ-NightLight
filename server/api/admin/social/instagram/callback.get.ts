import { z } from 'zod'
import { INSTAGRAM_STATE_COOKIE } from '../../../../../shared/instagram'
import { recordAudit } from '../../../../utils/audit'
import { InstagramApiError } from '../../../../utils/instagram'
import { verifyOAuthState } from '../../../../utils/instagram-state'
import { requireStaff } from '../../../../utils/require-staff'
import { connectInstagramAccount } from '../../../../utils/social-accounts'
import { structuredLog } from '../../../../utils/structured-log'

const querySchema = z.object({
  code: z.string().min(1).max(2000).optional(),
  state: z.string().min(1).max(500).optional(),
  error: z.string().max(200).optional(),
})

function back(event: Parameters<typeof sendRedirect>[0], outcome: string) {
  return sendRedirect(event, `/admin/settings?instagram=${outcome}#integrations`, 302)
}

export default defineEventHandler(async (event) => {
  const user = await requireStaff(event, ['owner'])
  const cookieNonce = getCookie(event, INSTAGRAM_STATE_COOKIE)
  deleteCookie(event, INSTAGRAM_STATE_COOKIE, { path: '/api/admin/social/instagram' })

  const parsed = querySchema.safeParse(getQuery(event))
  if (!parsed.success) return back(event, 'error')
  const { code, state, error } = parsed.data

  if (error) return back(event, 'denied')
  if (!code || !state) return back(event, 'error')

  const valid = verifyOAuthState({
    state,
    cookieNonce,
    userId: user.id,
    password: String(useRuntimeConfig().session.password || ''),
  })
  if (!valid) return back(event, 'state')

  try {
    const account = await connectInstagramAccount({ code, userId: user.id })
    await recordAudit({
      userId: user.id,
      entityType: 'social_account',
      entityId: account.id,
      action: 'instagram.connected',
      metadata: { username: account.username },
    })
    return back(event, 'connected')
  } catch (cause) {
    structuredLog('error', 'instagram_connect_failed', {
      message: cause instanceof Error ? cause.message : String(cause),
      code: cause instanceof InstagramApiError ? cause.code : null,
    })
    return back(event, 'error')
  }
})
