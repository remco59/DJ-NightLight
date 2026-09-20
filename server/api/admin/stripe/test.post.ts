import { requireStaff } from '../../../utils/require-staff'
import { STRIPE_WEBHOOK_EVENTS, getStripeClient, loadStripeCredentials } from '../../../utils/stripe'
import { saveStripeSettings, stripeStatus } from '../../../utils/stripe-settings'

function missingEvents(enabled: string[]) {
  if (enabled.includes('*')) return []
  return STRIPE_WEBHOOK_EVENTS.filter(type => !enabled.includes(type))
}

export default defineEventHandler(async (event) => {
  await requireStaff(event, ['owner'])
  const stripe = await getStripeClient()
  const checks: { label: string, ok: boolean, detail: string }[] = []

  try {
    await stripe.checkout.sessions.list({ limit: 1 })
    checks.push({ label: 'API key', ok: true, detail: 'Stripe accepted the key and it can read Checkout Sessions.' })
  } catch (error) {
    checks.push({ label: 'API key', ok: false, detail: error instanceof Error ? error.message : 'Stripe rejected the key.' })
  }

  const { row, webhookSecret } = await loadStripeCredentials()
  if (!webhookSecret) {
    checks.push({ label: 'Webhook', ok: false, detail: 'No webhook signing secret is saved yet.' })
  } else if (row?.webhookEndpointId) {
    try {
      const endpoint = await stripe.webhookEndpoints.retrieve(row.webhookEndpointId)
      const missing = missingEvents(endpoint.enabled_events)
      checks.push(endpoint.status === 'enabled' && !missing.length
        ? { label: 'Webhook', ok: true, detail: 'Endpoint is enabled and listens to every required event.' }
        : { label: 'Webhook', ok: false, detail: missing.length ? `Endpoint is missing: ${missing.join(', ')}` : 'Endpoint is disabled in Stripe.' })
    } catch {
      checks.push({ label: 'Webhook', ok: false, detail: 'Could not read the endpoint from Stripe. It may have been deleted.' })
    }
  } else {
    checks.push({ label: 'Webhook', ok: true, detail: 'Signing secret saved. Send a test event from the Stripe Dashboard to confirm delivery.' })
  }

  if (row && checks.every(check => check.ok)) await saveStripeSettings({ verifiedAt: new Date() })
  return { checks, status: await stripeStatus() }
})
