import { eq } from 'drizzle-orm'
import { socialAccounts } from '../../../../../db/schema'
import { recordAudit } from '../../../../utils/audit'
import { db } from '../../../../utils/db'
import { loadInstagramIntegration } from '../../../../utils/integration-settings'
import { requireStaff } from '../../../../utils/require-staff'

export default defineEventHandler(async (event) => {
  const user = await requireStaff(event, ['owner'])
  const { account } = await loadInstagramIntegration()
  if (!account) return { instagram: (await loadInstagramIntegration()).status }

  await db.delete(socialAccounts).where(eq(socialAccounts.id, account.id))
  await recordAudit({
    userId: user.id,
    entityType: 'social_account',
    entityId: account.id,
    action: 'instagram.disconnected',
    metadata: { username: account.username },
  })
  return { instagram: (await loadInstagramIntegration()).status }
})
