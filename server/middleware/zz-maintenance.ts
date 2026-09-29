// Named so it runs after the other middleware (Nitro orders them by file name):
// maintenance responses still get the security headers and request logging.
import { MAINTENANCE_HEADER, bypassesMaintenance } from '../../shared/system-update'
import { maintenancePageHtml } from '../utils/maintenance-page'
import { maintenanceState } from '../utils/updater'

export default defineEventHandler(async (event) => {
  const pathname = getRequestURL(event).pathname
  if (bypassesMaintenance(pathname)) return

  const { maintenance, step } = await maintenanceState()
  if (!maintenance) return

  setResponseStatus(event, 503, 'Onderhoud')
  setHeader(event, MAINTENANCE_HEADER, '1')
  setHeader(event, 'retry-after', '30')
  setHeader(event, 'cache-control', 'no-store')

  if (pathname.startsWith('/api/')) {
    setHeader(event, 'content-type', 'application/json; charset=utf-8')
    return JSON.stringify({
      statusCode: 503,
      statusMessage: 'DJ NightLight wordt bijgewerkt. Probeer het over een paar minuten opnieuw.',
      maintenance: true,
    })
  }

  setHeader(event, 'content-type', 'text/html; charset=utf-8')
  return maintenancePageHtml(step)
})
