import { recordAudit } from '../../../../utils/audit'
import { loadInstagramIntegration } from '../../../../utils/integration-settings'
import { requireStaff } from '../../../../utils/require-staff'
import { refreshInstagramToken } from '../../../../utils/social-accounts'

export default defineEventHandler(async (event) => {
  const user = await requireStaff(event, ['owner'])
  const { account } = await loadInstagramIntegration()
  if (!account) throw createError({ statusCode: 404, statusMessage: 'Er is geen Instagram-account gekoppeld' })

  const result = await refreshInstagramToken(account.id)
  await recordAudit({
    userId: user.id,
    entityType: 'social_account',
    entityId: account.id,
    action: result.ok ? 'instagram.token_refreshed' : 'instagram.token_refresh_failed',
  })
  if (!result.ok) {
    throw createError({
      statusCode: 502,
      statusMessage: result.permanent
        ? 'Instagram weigert het token. Verbind het account opnieuw.'
        : `Token vernieuwen mislukt: ${result.message}`,
    })
  }

  return { instagram: (await loadInstagramIntegration()).status }
})
