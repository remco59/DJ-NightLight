import { loadRenderSettings } from '../../utils/render-settings'
import { requireStaff } from '../../utils/require-staff'

export default defineEventHandler(async (event) => {
  await requireStaff(event, ['owner', 'manager'])
  return await loadRenderSettings()
})
