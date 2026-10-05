import type { AdminPermission } from '../../shared/auth'
import { permissionAllowed } from '../../shared/auth'
import { requireStaff } from '../utils/require-staff'

function requiredPermission(pathname: string, method: string): AdminPermission {
  if (
    pathname === '/api/admin/me'
    || pathname.startsWith('/api/admin/account/')
    || pathname.startsWith('/api/admin/session/')
  ) return 'account:manage'

  if (pathname === '/api/admin/dashboard') return 'dashboard:view'
  if (pathname.startsWith('/api/admin/users')) return 'users:manage'

  if (
    pathname.startsWith('/api/admin/system')
    || pathname.startsWith('/api/admin/business-settings')
    || pathname.startsWith('/api/admin/integrations')
    || pathname.startsWith('/api/admin/stripe')
  ) return 'system:manage'

  if (
    pathname.startsWith('/api/admin/content')
    || pathname.startsWith('/api/admin/landing-pages')
    || pathname.startsWith('/api/admin/media')
    || pathname.startsWith('/api/admin/post-generator')
  ) return 'content:manage'

  if (pathname === '/api/admin/calendar/events' && method === 'GET') return 'gigs:read'

  if (pathname.startsWith('/api/admin/gigs')) {
    const isSimpleGigRoute = /^\/api\/admin\/gigs(?:\/[^/]+)?$/.test(pathname)
    return method === 'GET' && isSimpleGigRoute ? 'gigs:read' : 'gigs:manage'
  }

  if (
    pathname.startsWith('/api/admin/clients')
    || pathname.startsWith('/api/admin/venues')
    || pathname.startsWith('/api/admin/invoices')
    || pathname.startsWith('/api/admin/calendar')
    || pathname.startsWith('/api/admin/email')
    || pathname.startsWith('/api/admin/questionnaire')
  ) return 'operations:manage'

  return 'system:manage'
}

export default defineEventHandler(async (event) => {
  const pathname = getRequestURL(event).pathname
  if (!pathname.startsWith('/api/admin/')) return

  const user = await requireStaff(event)
  const permission = requiredPermission(pathname, event.method)

  if (!permissionAllowed(user.role, permission)) {
    throw createError({ statusCode: 403, statusMessage: 'Onvoldoende rechten' })
  }
})
