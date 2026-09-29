import type { SystemUpdateStatus } from '../../../../../shared/system-update'
import { requireStaff } from '../../../../utils/require-staff'
import { type UpdaterStatus, updaterAvailable, updaterRequest } from '../../../../utils/updater'

export default defineEventHandler(async (event): Promise<SystemUpdateStatus> => {
  await requireStaff(event, ['owner'])

  if (!updaterAvailable()) {
    return { available: false, configured: false, configError: null, branch: null, current: null, state: null, lastCheck: null }
  }

  try {
    const status = await updaterRequest<UpdaterStatus>('/status')
    return { available: true, ...status }
  } catch (error: unknown) {
    const statusMessage = (error as { statusMessage?: string }).statusMessage || 'De updater is niet bereikbaar'
    return { available: true, configured: false, configError: statusMessage, branch: null, current: null, state: null, lastCheck: null }
  }
})
