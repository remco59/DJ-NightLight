import { randomUUID } from 'node:crypto'
import { assertRateLimit, requestClientKey } from '../utils/rate-limit'
import { structuredLog } from '../utils/structured-log'

export default defineEventHandler((event) => {
  const requestId = getHeader(event, 'x-request-id')?.slice(0, 128) || randomUUID()
  const url = getRequestURL(event)
  const path = url.pathname
  const method = event.method || event.node.req.method || 'GET'
  const started = Date.now()

  setHeader(event, 'x-request-id', requestId)

  if (
    path.startsWith('/api/public/')
    || path.startsWith('/api/client/')
    || path.startsWith('/api/auth/')
  ) {
    assertRateLimit(event, 'baseline', `${requestClientKey(event)}:${path.split('/').slice(0, 4).join('/')}`)
  }

  event.node.res.once('finish', () => {
    structuredLog(
      event.node.res.statusCode >= 500 ? 'error' : event.node.res.statusCode >= 400 ? 'warn' : 'info',
      'http_request',
      {
        requestId,
        method,
        path,
        status: event.node.res.statusCode,
        durationMs: Date.now() - started,
      },
    )
  })
})
