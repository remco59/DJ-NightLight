import { and, desc, eq, ne, sql } from 'drizzle-orm'
import type Stripe from 'stripe'
import { clients, invoices, payments } from '../../../../../db/schema'
import { db } from '../../../../utils/db'
import { resolvePortalAccess } from '../../../../utils/portal-access'
import { assertPortalRateLimit } from '../../../../utils/portal-rate-limit'
import { hashPortalToken } from '../../../../utils/portal-token'
import { stripeIntegrationIdentifier } from '../../../../utils/stripe'
import { ensureStripeCustomer } from '../../../../utils/stripe-customer'

export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, 'token') || ''
  const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  assertPortalRateLimit(`${hashPortalToken(ip).slice(0, 16)}:${hashPortalToken(token).slice(0, 16)}:checkout`)
  const access = await resolvePortalAccess(token)
  if (!access) throw createError({ statusCode: 404, statusMessage: 'Deze portaallink is ongeldig of verlopen' })

  const [invoice] = await db.select({
    id: invoices.id, invoiceNumber: invoices.invoiceNumber, totalCents: invoices.totalCents, currency: invoices.currency,
    paymentStatus: invoices.paymentStatus,
    clientId: clients.id,
    clientStripeCustomerId: clients.stripeCustomerId,
    clientFirstName: clients.firstName,
    clientLastName: clients.lastName,
    clientCompanyName: clients.companyName,
    clientEmail: clients.email,
  }).from(invoices).leftJoin(clients, eq(invoices.clientId, clients.id)).where(and(
    eq(invoices.gigId, access.gigId), eq(invoices.status, 'finalized'), ne(invoices.paymentStatus, 'paid'),
  )).orderBy(desc(invoices.finalizedAt)).limit(1)
  if (!invoice || !invoice.invoiceNumber) throw createError({ statusCode: 404, statusMessage: 'Er is geen factuur om te betalen' })
  if (invoice.totalCents <= 0) throw createError({ statusCode: 422, statusMessage: 'Op deze factuur staat geen bedrag meer open' })

  const [reserved] = await db.insert(payments).values({
    invoiceId: invoice.id, amountCents: invoice.totalCents, currency: invoice.currency, status: 'pending',
  }).onConflictDoNothing({ target: payments.invoiceId }).returning()
  const payment = reserved || (await db.select().from(payments).where(eq(payments.invoiceId, invoice.id)).limit(1))[0]
  if (!payment) throw createError({ statusCode: 500, statusMessage: 'Betaling reserveren is niet gelukt' })
  if (payment.status === 'succeeded') throw createError({ statusCode: 409, statusMessage: 'Deze factuur is al betaald' })

  if (!invoice.clientId) throw createError({ statusCode: 422, statusMessage: 'Deze factuur heeft geen klant' })
  const { stripe, customerId } = await ensureStripeCustomer({
    id: invoice.clientId,
    stripeCustomerId: invoice.clientStripeCustomerId,
    firstName: invoice.clientFirstName,
    lastName: invoice.clientLastName,
    companyName: invoice.clientCompanyName,
    email: invoice.clientEmail,
  })
  if (payment.providerSessionId && payment.checkoutExpiresAt && payment.checkoutExpiresAt > new Date() && payment.status === 'pending') {
    const existing = await stripe.checkout.sessions.retrieve(payment.providerSessionId)
    if (existing.status === 'open' && existing.url) return { url: existing.url }
  }

  const config = useRuntimeConfig()
  const baseUrl = String(config.public.siteUrl).replace(/\/$/, '')
  const metadata = { invoiceId: invoice.id, paymentId: payment.id, gigId: access.gigId }
  const attempt = payment.attemptCount + 1
  const params: Stripe.Checkout.SessionCreateParams = {
    mode: 'payment',
    integration_identifier: stripeIntegrationIdentifier(),
    line_items: [{
      price_data: { currency: invoice.currency.toLowerCase(), unit_amount: invoice.totalCents, product_data: { name: `Invoice ${invoice.invoiceNumber}` } },
      quantity: 1,
    }],
    client_reference_id: invoice.id,
    customer: customerId,
    metadata,
    payment_intent_data: { metadata },
    success_url: `${baseUrl}/client/${encodeURIComponent(token)}?payment=success`,
    cancel_url: `${baseUrl}/client/${encodeURIComponent(token)}?payment=cancelled`,
  }

  if (invoice.currency.toUpperCase() === 'EUR') {
    params.payment_method_types = ['card', 'ideal', 'customer_balance']
    params.payment_method_options = {
      customer_balance: {
        funding_type: 'bank_transfer',
        bank_transfer: { type: 'eu_bank_transfer' },
      },
    }
  }

  const session = await stripe.checkout.sessions.create(params, { idempotencyKey: `nightlight-${payment.id}-${attempt}` })
  if (!session.url) throw createError({ statusCode: 502, statusMessage: 'Stripe gaf geen checkout-URL terug' })

  await db.update(payments).set({
    providerSessionId: session.id, attemptCount: sql`${payments.attemptCount} + 1`,
    checkoutExpiresAt: new Date(session.expires_at * 1000), status: 'pending', failureCode: null, updatedAt: new Date(),
  }).where(eq(payments.id, payment.id))
  await db.update(invoices).set({ paymentStatus: 'pending', updatedAt: new Date() }).where(and(eq(invoices.id, invoice.id), ne(invoices.paymentStatus, 'paid')))
  return { url: session.url }
})
