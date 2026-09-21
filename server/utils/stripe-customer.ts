import { eq } from 'drizzle-orm'
import { clients } from '../../db/schema'
import { db } from './db'
import { getStripeClient } from './stripe'

export type StripeCustomerSource = {
  id: string
  stripeCustomerId: string | null
  firstName: string | null
  lastName: string | null
  companyName: string | null
  email: string | null
}

function clientName(client: StripeCustomerSource) {
  return client.companyName || [client.firstName, client.lastName].filter(Boolean).join(' ') || 'NightLight client'
}

export async function ensureStripeCustomer(client: StripeCustomerSource) {
  const stripe = await getStripeClient()
  if (client.stripeCustomerId) return { stripe, customerId: client.stripeCustomerId }

  const customer = await stripe.customers.create({
    email: client.email || undefined,
    name: clientName(client),
    metadata: { nightlightClientId: client.id },
  }, { idempotencyKey: `nightlight-client-${client.id}` })

  await db.update(clients).set({
    stripeCustomerId: customer.id,
    updatedAt: new Date(),
  }).where(eq(clients.id, client.id))

  return { stripe, customerId: customer.id }
}
