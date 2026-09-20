import { processDueCalendarSyncs } from '../utils/calendar-sync'
import { recordOperationalEvent, structuredLog } from '../utils/ops-log'

let running = false

async function tick() {
  if (running) return
  running = true
  try {
    await processDueCalendarSyncs(10)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    structuredLog('error', 'calendar_worker_failed', { message })
    void recordOperationalEvent({ kind: 'calendar_worker', status: 'failed', message }).catch(() => {})
  } finally {
    running = false
  }
}

export default defineNitroPlugin(() => {
  const startup = setTimeout(() => void tick(), 5_000)
  startup.unref?.()
  const timer = setInterval(() => void tick(), 60_000)
  timer.unref?.()
})
