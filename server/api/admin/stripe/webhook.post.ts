import { z } from 'zod'
import { encryptSecret } from '../../../../shared/secret-box'
import { requireStaff } from '../../../utils/require-staff'
import { STRIPE_WEBHOOK_EVENTS, getStripeClient, loadStripeCredentials } from '../../../utils/stripe'
import { saveStripeSettings, stripeStatus, stripeWebhookUrl } from '../../../utils/stripe-settings'

const schema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('auto') }),
  z.object({
    mode: z.literal('manual'),
    webhookSecret: z.string().trim().regex(/^whsec_[A-Za-z0-9]{10,}$/, 'Plak het signing secret dat begint met whsec_'),
  }),
])

export default defineEventHandler(async (event) => {
  await requireStaff(event, ['owner'])
  const parsed = schema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 422, statusMessage: parsed.error.issues[0]?.message || 'Ongeldig verzoek' })
  const password = String(useRuntimeConfig().session.password || '')

  if (parsed.data.mode === 'manual') {
    await saveStripeSettings({ webhookSecretEncrypted: encryptSecret(parsed.data.webhookSecret, password), webhookEndpointId: null })
    return { status: await stripeStatus() }
  }

  if (!(await stripeStatus()).webhookPublic) {
    throw createError({ statusCode: 422, statusMessage: 'Automatisch instellen vereist een publieke HTTPS-URL voor de site (NUXT_PUBLIC_SITE_URL). Gebruik in plaats daarvan de handmatige stappen.' })
  }
  const stripe = await getStripeClient()
  const { row } = await loadStripeCredentials()
  if (row?.webhookEndpointId) await stripe.webhookEndpoints.del(row.webhookEndpointId).catch(() => undefined)

  let endpoint
  try {
    endpoint = await stripe.webhookEndpoints.create({
      url: stripeWebhookUrl(),
      enabled_events: [...STRIPE_WEBHOOK_EVENTS],
      description: 'DJ NightLight invoice payments',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Stripe weigerde het endpoint aan te maken.'
    throw createError({ statusCode: 422, statusMessage: `${message} Mogelijk mist de sleutel schrijfrechten voor Webhook Endpoints; gebruik in plaats daarvan de handmatige stappen.` })
  }
  if (!endpoint.secret) throw createError({ statusCode: 502, statusMessage: 'Stripe gaf geen signing secret terug' })
  await saveStripeSettings({ webhookSecretEncrypted: encryptSecret(endpoint.secret, password), webhookEndpointId: endpoint.id })
  return { status: await stripeStatus() }
})
