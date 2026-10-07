import { recordSocialWorkerRun, checkDueInstagramConnections } from '../utils/social-accounts'

let running = false

async function tick() {
  if (running) return
  running = true
  try {
    await recordSocialWorkerRun()
    await checkDueInstagramConnections()
  } catch (error) {
    console.error(JSON.stringify({
      level: 'error',
      event: 'social_worker_failed',
      message: error instanceof Error ? error.message : String(error),
    }))
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
