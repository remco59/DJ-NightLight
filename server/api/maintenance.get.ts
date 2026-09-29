import { maintenanceState } from '../utils/updater'

export default defineEventHandler(async (event) => {
  setHeader(event, 'cache-control', 'no-store')
  return await maintenanceState()
})
