import type { UpdateRunState } from '../../../../../shared/system-update'
import { requireStaff } from '../../../../utils/require-staff'
import { structuredLog } from '../../../../utils/structured-log'
import { resetMaintenanceCache, updaterRequest } from '../../../../utils/updater'

export default defineEventHandler(async (event) => {
  const user = await requireStaff(event, ['owner'])
  const result = await updaterRequest<{ state: UpdateRunState }>('/update', 'POST')
  resetMaintenanceCache()
  structuredLog('info', 'system_update_started', { userId: user.id })
  return result
})
