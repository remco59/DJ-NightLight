import { z } from 'zod'
import { encryptSecret } from '../../../../shared/secret-box'
import { requireStaff } from '../../../utils/require-staff'
import { createStripeClient } from '../../../utils/stripe'
import { saveStripeSettings, stripeStatus } from '../../../utils/stripe-settings'

const schema = z.object({
  secretKey: z.string().trim().regex(/^(rk|sk)_(test|live)_[A-Za-z0-9]{10,}$/, 'Paste a Stripe key that starts with rk_test_, rk_live_, sk_test_ or sk_live_'),
})

export default defineEventHandler(async (event) => {
  await requireStaff(event, ['owner'])
  const parsed = schema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 422, statusMessage: parsed.error.issues[0]?.message || 'Invalid key' })
  const { secretKey } = parsed.data
  const stripe = createStripeClient(secretKey)

  try {
    await stripe.checkout.sessions.list({ limit: 1 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Stripe rejected this key'
    throw createError({ statusCode: 422, statusMessage: `Stripe rejected this key: ${message}` })
  }

  let accountId: string | null = null
  let accountName: string | null = null
  try {
    const account = await stripe.accounts.retrieveCurrent()
    accountId = account.id
    accountName = account.settings?.dashboard?.display_name || account.business_profile?.name || account.email || null
  } catch {
    // Restricted keys may not be allowed to read the account; the key still works for checkout.
  }

  const password = String(useRuntimeConfig().session.password || '')
  await saveStripeSettings({
    secretKeyEncrypted: encryptSecret(secretKey, password),
    livemode: secretKey.includes('_live_'),
    accountId,
    accountName,
    verifiedAt: new Date(),
    webhookSecretEncrypted: null,
    webhookEndpointId: null,
  })
  return { status: await stripeStatus() }
})
