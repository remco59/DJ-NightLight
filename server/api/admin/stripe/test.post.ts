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
    checks.push({ label: 'API-sleutel', ok: true, detail: 'Stripe heeft de sleutel geaccepteerd en die kan Checkout Sessions lezen.' })
  } catch (error) {
    checks.push({ label: 'API-sleutel', ok: false, detail: error instanceof Error ? error.message : 'Stripe heeft de sleutel geweigerd.' })
  }

  const { row, webhookSecret } = await loadStripeCredentials()
  if (!webhookSecret) {
    checks.push({ label: 'Webhook', ok: false, detail: 'Er is nog geen signing secret voor de webhook opgeslagen.' })
  } else if (row?.webhookEndpointId) {
    try {
      const endpoint = await stripe.webhookEndpoints.retrieve(row.webhookEndpointId)
      const missing = missingEvents(endpoint.enabled_events)
      checks.push(endpoint.status === 'enabled' && !missing.length
        ? { label: 'Webhook', ok: true, detail: 'Het endpoint is ingeschakeld en luistert naar alle benodigde events.' }
        : { label: 'Webhook', ok: false, detail: missing.length ? `Het endpoint mist: ${missing.join(', ')}` : 'Het endpoint is uitgeschakeld in Stripe.' })
    } catch {
      checks.push({ label: 'Webhook', ok: false, detail: 'Het endpoint kon niet uit Stripe worden gelezen. Misschien is het verwijderd.' })
    }
  } else {
    checks.push({ label: 'Webhook', ok: true, detail: 'Signing secret opgeslagen. Stuur een testevent vanuit het Stripe Dashboard om de levering te controleren.' })
  }

  if (row && checks.every(check => check.ok)) await saveStripeSettings({ verifiedAt: new Date() })
  return { checks, status: await stripeStatus() }
})
