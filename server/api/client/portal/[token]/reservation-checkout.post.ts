import { createHash } from 'node:crypto'
import { and, desc, eq, sql } from 'drizzle-orm'
import type Stripe from 'stripe'
import { clients, quotes, reservationPayments } from '../../../../../db/schema'
import { db } from '../../../../utils/db'
import { resolvePortalAccess } from '../../../../utils/portal-access'
import { assertRateLimit } from '../../../../utils/rate-limit'
import { hashPortalToken } from '../../../../utils/portal-token'
import { ensureStripeCustomer } from '../../../../utils/stripe-customer'

const CHECKOUT_EXPIRY_SECONDS = 60 * 60

/** Starts the Stripe payment of the reservation costs of the quote the client accepted. */
export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, 'token') || ''
  const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  assertRateLimit(event, 'portal', `${hashPortalToken(ip).slice(0, 16)}:${hashPortalToken(token).slice(0, 16)}:reservation`)
  const access = await resolvePortalAccess(token)
  if (!access) throw createError({ statusCode: 404, statusMessage: 'Deze portaallink is ongeldig of verlopen' })

  const [quote] = await db.select().from(quotes)
    .where(and(eq(quotes.gigId, access.gigId), eq(quotes.status, 'accepted')))
    .orderBy(desc(quotes.acceptedAt)).limit(1)
  if (!quote || quote.reservationCents <= 0) throw createError({ statusCode: 404, statusMessage: 'Er zijn geen reserveringskosten om te betalen' })
  if (quote.reservationPaidAt) throw createError({ statusCode: 409, statusMessage: 'De reserveringskosten zijn al betaald' })

  const [reserved] = await db.insert(reservationPayments).values({
    quoteId: quote.id, amountCents: quote.reservationCents, currency: quote.currency, status: 'pending',
  }).onConflictDoNothing({ target: reservationPayments.quoteId }).returning()
  const payment = reserved || (await db.select().from(reservationPayments).where(eq(reservationPayments.quoteId, quote.id)).limit(1))[0]
  if (!payment) throw createError({ statusCode: 500, statusMessage: 'Betaling reserveren is niet gelukt' })
  if (payment.status === 'succeeded') throw createError({ statusCode: 409, statusMessage: 'De reserveringskosten zijn al betaald' })

  if (!quote.clientId) throw createError({ statusCode: 422, statusMessage: 'Deze offerte heeft geen klant' })
  const [client] = await db.select().from(clients).where(eq(clients.id, quote.clientId)).limit(1)
  if (!client) throw createError({ statusCode: 422, statusMessage: 'Deze offerte heeft geen klant' })
  const { stripe, customerId } = await ensureStripeCustomer({
    id: client.id, stripeCustomerId: client.stripeCustomerId, firstName: client.firstName, lastName: client.lastName,
    companyName: client.companyName, email: client.invoiceEmail || client.email,
  })
  if (payment.providerSessionId && payment.checkoutExpiresAt && payment.checkoutExpiresAt > new Date() && payment.status === 'pending') {
    const existing = await stripe.checkout.sessions.retrieve(payment.providerSessionId)
    if (existing.status === 'open' && existing.url) return { url: existing.url }
  }

  const baseUrl = String(useRuntimeConfig().public.siteUrl).replace(/\/$/, '')
  const metadata = { kind: 'reservation', quoteId: quote.id, reservationPaymentId: payment.id, gigId: access.gigId }
  const attempt = payment.attemptCount + 1
  const params: Stripe.Checkout.SessionCreateParams = {
    ui_mode: 'hosted_page',
    mode: 'payment',
    billing_address_collection: 'auto',
    phone_number_collection: { enabled: false },
    automatic_tax: { enabled: false },
    allow_promotion_codes: false,
    submit_type: 'auto',
    origin_context: 'web',
    line_items: [{
      price_data: { currency: quote.currency.toLowerCase(), unit_amount: quote.reservationCents, product_data: { name: `Reservation ${quote.quoteNumber ?? ''}`.trim() } },
      quantity: 1,
    }],
    expires_at: Math.ceil(Date.now() / 1000 / 300) * 300 + CHECKOUT_EXPIRY_SECONDS,
    client_reference_id: quote.id,
    customer: customerId,
    metadata,
    payment_intent_data: { metadata },
    success_url: `${baseUrl}/client/${encodeURIComponent(token)}?payment=reservation-success`,
    cancel_url: `${baseUrl}/client/${encodeURIComponent(token)}?payment=reservation-cancelled`,
    ...(quote.currency.toUpperCase() === 'EUR' ? { payment_method_types: ['card', 'ideal'] as Stripe.Checkout.SessionCreateParams.PaymentMethodType[] } : {}),
  }

  let session: Stripe.Checkout.Session
  try {
    session = await stripe.checkout.sessions.create(params, { idempotencyKey: `nightlight-reservation-${payment.id}-${attempt}-${createHash('sha256').update(JSON.stringify(params)).digest('hex').slice(0, 12)}` })
  }
  catch (error) {
    console.error('[reservation-checkout] Stripe checkout session failed:', error)
    const code = (error as { code?: string, type?: string })?.code || (error as { type?: string })?.type || 'unknown'
    throw createError({ statusCode: 502, statusMessage: `De betaalpagina kon niet worden aangemaakt. Probeer het later opnieuw. (${code})` })
  }
  if (!session.url) throw createError({ statusCode: 502, statusMessage: 'Stripe gaf geen checkout-URL terug' })

  await db.update(reservationPayments).set({
    providerSessionId: session.id, attemptCount: sql`${reservationPayments.attemptCount} + 1`,
    checkoutExpiresAt: new Date(session.expires_at * 1000), status: 'pending', failureCode: null, updatedAt: new Date(),
  }).where(eq(reservationPayments.id, payment.id))
  return { url: session.url }
})
