export type UpdatePhase = 'idle' | 'preparing' | 'updating' | 'succeeded' | 'failed'

export type UpdateCommit = {
  sha: string
  shortSha: string
  subject: string
  author: string
  date: string
}

export type UpdateRunState = {
  phase: UpdatePhase
  step: string | null
  message: string | null
  startedAt: string | null
  finishedAt: string | null
  fromSha: string | null
  toSha: string | null
  log: string[]
}

export type UpdateCheck = {
  checkedAt: string
  current: UpdateCommit | null
  latest: UpdateCommit | null
  behind: number
  commits: UpdateCommit[]
  updateAvailable: boolean
}

export type SystemUpdateStatus = {
  /** False when this deployment has no updater sidecar (e.g. local development). */
  available: boolean
  configured: boolean
  configError: string | null
  branch: string | null
  current: UpdateCommit | null
  state: UpdateRunState | null
  lastCheck: UpdateCheck | null
}

export const UPDATE_BUSY_PHASES: readonly UpdatePhase[] = ['preparing', 'updating']

/** Response header that marks a 503 as "site is being updated" rather than an outage. */
export const MAINTENANCE_HEADER = 'x-nightlight-maintenance'

/**
 * Requests that keep working while the site is in maintenance mode: health
 * checks (the updater waits on them), the maintenance status poll, payment
 * webhooks (Stripe would otherwise retry for days) and static assets used by
 * the maintenance page.
 */
export function bypassesMaintenance(pathname: string) {
  return pathname === '/api/health'
    || pathname === '/api/ready'
    || pathname === '/api/maintenance'
    || pathname.startsWith('/api/webhooks/')
    || pathname.startsWith('/fonts/')
    || pathname === '/favicon.ico'
}
