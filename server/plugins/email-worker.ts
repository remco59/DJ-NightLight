import {
  consumeEmailOutbox,
  materializeScheduledEmailJobs,
  processDueEmailJobs,
} from '../utils/email-automation'

let running = false

async function tick() {
  if (running) return
  running = true
  try {
    await consumeEmailOutbox()
    await materializeScheduledEmailJobs()
    await processDueEmailJobs(10)
  } catch (error) {
    console.error(JSON.stringify({
      level: 'error',
      event: 'email_worker_failed',
      message: error instanceof Error ? error.message : String(error),
    }))
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
