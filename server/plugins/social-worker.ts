import { recordSocialWorkerRun, checkDueInstagramConnections } from '../utils/social-accounts'
import { processDueSocialPosts } from '../utils/social-publish'

let running = false

async function tick() {
  if (running) return
  running = true
  try {
    await recordSocialWorkerRun()
    // Independent steps: a failing connection check must not hold back scheduled posts.
    for (const step of [checkDueInstagramConnections, () => processDueSocialPosts(5)]) {
      try {
        await step()
      } catch (error) {
        console.error(JSON.stringify({
          level: 'error',
          event: 'social_worker_failed',
          message: error instanceof Error ? error.message : String(error),
        }))
      }
    }
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
