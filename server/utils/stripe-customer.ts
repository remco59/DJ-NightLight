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

export type BankTransferInstructions = {
  iban: string
  bic: string
  country: string
  accountHolderName: string
  reference: string
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

export async function getStripeBankTransferInstructions(client: StripeCustomerSource, reference: string, currency = 'EUR'): Promise<BankTransferInstructions | null> {
  if (currency.toUpperCase() !== 'EUR') return null

  const { stripe, customerId } = await ensureStripeCustomer(client)
  const instructions = await stripe.customers.createFundingInstructions(customerId, {
    funding_type: 'bank_transfer',
    currency: 'eur',
    bank_transfer: { type: 'eu_bank_transfer' },
  })
  const address = instructions.bank_transfer?.financial_addresses?.find(item => item.type === 'iban')
  const iban = address?.iban
  if (!iban?.iban) return null

  return {
    iban: iban.iban,
    bic: iban.bic || '',
    country: iban.country || '',
    accountHolderName: iban.account_holder_name || '',
    reference,
  }
}
