import {
  consumeEmailOutbox,
  materializeScheduledEmailJobs,
  processDueEmailJobs,
  recoverStuckEmailJobs,
} from '../utils/email-automation'
import { recordOperationalEvent, structuredLog } from '../utils/ops-log'

let running = false

async function tick() {
  if (running) return
  running = true
  try {
    await recoverStuckEmailJobs()
    await consumeEmailOutbox()
    await materializeScheduledEmailJobs()
    await processDueEmailJobs(10)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    structuredLog('error', 'email_worker_failed', { message })
    void recordOperationalEvent({ kind: 'email_worker', status: 'failed', message }).catch(() => {})
  } finally {
    running = false
  }
}

export default defineNitroPlugin(() => {
  const startup = setTimeout(() => void tick(), 7_000)
  startup.unref?.()
  const timer = setInterval(() => void tick(), 60_000)
  timer.unref?.()
})
