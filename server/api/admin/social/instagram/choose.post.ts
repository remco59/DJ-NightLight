import { z } from 'zod'
import { recordAudit } from '../../../../utils/audit'
import { INSTAGRAM_PENDING_COOKIE, openPendingToken } from '../../../../utils/instagram-pending'
import { loadInstagramIntegration } from '../../../../utils/integration-settings'
import { requireStaff } from '../../../../utils/require-staff'
import { completeInstagramChoice } from '../../../../utils/social-accounts'
import { structuredLog } from '../../../../utils/structured-log'

const bodySchema = z.object({ instagramId: z.string().trim().regex(/^\d{5,30}$/, 'Ongeldig Instagram-account') })

export default defineEventHandler(async (event) => {
  const user = await requireStaff(event, ['owner'])
  const parsed = bodySchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 422, statusMessage: parsed.error.issues[0]?.message || 'Ongeldige keuze' })
  }

  const userToken = openPendingToken({
    value: getCookie(event, INSTAGRAM_PENDING_COOKIE),
    userId: user.id,
    password: String(useRuntimeConfig().session.password || ''),
  })
  if (!userToken) {
    throw createError({ statusCode: 410, statusMessage: 'De keuze is verlopen. Verbind Instagram opnieuw.' })
  }

  try {
    const account = await completeInstagramChoice({ userToken, instagramId: parsed.data.instagramId, userId: user.id })
    deleteCookie(event, INSTAGRAM_PENDING_COOKIE, { path: '/api/admin/social/instagram' })
    await recordAudit({
      userId: user.id,
      entityType: 'social_account',
      entityId: account.id,
      action: 'instagram.connected',
      metadata: { username: account.username, chosen: true },
    })
    return { instagram: (await loadInstagramIntegration()).status }
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause)
    structuredLog('error', 'instagram_choose_failed', { message })
    throw createError({ statusCode: 502, statusMessage: message })
  }
})
