import { recordAudit } from '../../../../utils/audit'
import { loadInstagramIntegration } from '../../../../utils/integration-settings'
import { disconnectSocialAccounts } from '../../../../utils/social-accounts'
import { requireStaff } from '../../../../utils/require-staff'

export default defineEventHandler(async (event) => {
  const user = await requireStaff(event, ['owner'])
  const { account } = await loadInstagramIntegration()
  if (!account) return { instagram: (await loadInstagramIntegration()).status }

  await disconnectSocialAccounts()
  await recordAudit({
    userId: user.id,
    entityType: 'social_account',
    entityId: account.id,
    action: 'instagram.disconnected',
    metadata: { username: account.username },
  })
  return { instagram: (await loadInstagramIntegration()).status }
})
