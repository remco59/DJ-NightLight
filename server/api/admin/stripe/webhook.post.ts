import { z } from 'zod'
import { encryptSecret } from '../../../../shared/secret-box'
import { requireStaff } from '../../../utils/require-staff'
import { STRIPE_WEBHOOK_EVENTS, getStripeClient, loadStripeCredentials } from '../../../utils/stripe'
import { saveStripeSettings, stripeStatus, stripeWebhookUrl } from '../../../utils/stripe-settings'

const schema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('auto') }),
  z.object({
    mode: z.literal('manual'),
    webhookSecret: z.string().trim().regex(/^whsec_[A-Za-z0-9]{10,}$/, 'Paste the signing secret that starts with whsec_'),
  }),
])

export default defineEventHandler(async (event) => {
  await requireStaff(event, ['owner'])
  const parsed = schema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 422, statusMessage: parsed.error.issues[0]?.message || 'Invalid request' })
  const password = String(useRuntimeConfig().session.password || '')

  if (parsed.data.mode === 'manual') {
    await saveStripeSettings({ webhookSecretEncrypted: encryptSecret(parsed.data.webhookSecret, password), webhookEndpointId: null })
    return { status: await stripeStatus() }
  }

  if (!(await stripeStatus()).webhookPublic) {
    throw createError({ statusCode: 422, statusMessage: 'Automatic setup needs a public HTTPS site URL (NUXT_PUBLIC_SITE_URL). Use the manual steps instead.' })
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
    const message = error instanceof Error ? error.message : 'Stripe refused to create the endpoint.'
    throw createError({ statusCode: 422, statusMessage: `${message} The key may lack Webhook Endpoints write permission; use the manual steps instead.` })
  }
  if (!endpoint.secret) throw createError({ statusCode: 502, statusMessage: 'Stripe did not return a signing secret' })
  await saveStripeSettings({ webhookSecretEncrypted: encryptSecret(endpoint.secret, password), webhookEndpointId: endpoint.id })
  return { status: await stripeStatus() }
})
