import type { UpdateCheck } from '../../../../../shared/system-update'
import { requireStaff } from '../../../../utils/require-staff'
import { updaterRequest } from '../../../../utils/updater'

export default defineEventHandler(async (event) => {
  await requireStaff(event, ['owner'])
  // Fetching from GitHub can take a while on a slow connection.
  return await updaterRequest<UpdateCheck>('/check', 'POST', 60_000)
})
