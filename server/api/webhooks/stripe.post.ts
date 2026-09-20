import { and, eq, ne } from 'drizzle-orm'
import type Stripe from 'stripe'
import { auditLogs, invoices, outboxEvents, payments, stripeWebhookEvents } from '../../../db/schema'
import { checkoutAmountMatches, checkoutPaymentOutcome } from '../../../shared/payment-events'
import { db } from '../../utils/db'
import { getStripeClient, getStripeWebhookSecret } from '../../utils/stripe'

function objectId(value: string | { id: string } | null) {
  if (!value) return null
  return typeof value === 'string' ? value : value.id
}

export default defineEventHandler(async (event) => {
  const signature = getHeader(event, 'stripe-signature')
  const rawBody = await readRawBody(event)
  if (!signature || rawBody === undefined) throw createError({ statusCode: 400, statusMessage: 'Invalid webhook request' })

  let stripeEvent: Stripe.Event
  try {
    stripeEvent = getStripeClient().webhooks.constructEvent(rawBody, signature, getStripeWebhookSecret())
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Invalid Stripe signature' })
  }

  const outcome = checkoutPaymentOutcome(
    stripeEvent.type,
    stripeEvent.type.startsWith('checkout.session.') ? (stripeEvent.data.object as Stripe.Checkout.Session).payment_status : null,
  )

  await db.transaction(async (tx) => {
    const [claimed] = await tx.insert(stripeWebhookEvents).values({
      eventId: stripeEvent.id, eventType: stripeEvent.type, livemode: stripeEvent.livemode,
    }).onConflictDoNothing({ target: stripeWebhookEvents.eventId }).returning({ eventId: stripeWebhookEvents.eventId })
    if (!claimed || outcome === 'ignore') return

    const isSession = stripeEvent.type.startsWith('checkout.session.')
    const stripeObject = stripeEvent.data.object as Stripe.Checkout.Session | Stripe.PaymentIntent
    const invoiceId = stripeObject.metadata?.invoiceId
    if (!invoiceId) return
    const [invoice] = await tx.select().from(invoices).where(eq(invoices.id, invoiceId)).limit(1)
    if (!invoice || invoice.status === 'void') return

    const amount = isSession ? (stripeObject as Stripe.Checkout.Session).amount_total : (stripeObject as Stripe.PaymentIntent).amount
    const currency = stripeObject.currency
    if (!checkoutAmountMatches(invoice.totalCents, invoice.currency, amount, currency)) {
      await tx.insert(auditLogs).values({
        userId: null, entityType: 'invoice', entityId: invoice.id, action: 'payment_amount_mismatch',
        metadata: { stripeEventId: stripeEvent.id, expectedCents: invoice.totalCents, actualCents: amount, expectedCurrency: invoice.currency, actualCurrency: currency },
      })
      return
    }

    const session = isSession ? stripeObject as Stripe.Checkout.Session : null
    const intent = isSession ? objectId(session!.payment_intent) : stripeObject.id
    const [existing] = await tx.select().from(payments).where(eq(payments.invoiceId, invoice.id)).limit(1)
    if (existing?.status === 'succeeded' && outcome !== 'succeeded') return
    const status = outcome === 'pending' ? 'pending' : outcome === 'succeeded' ? 'succeeded' : outcome === 'expired' ? 'expired' : 'failed'
    const paymentValues = {
      providerSessionId: session?.id || existing?.providerSessionId || null,
      providerPaymentIntentId: intent,
      amountCents: invoice.totalCents,
      currency: invoice.currency,
      status,
      paidAt: outcome === 'succeeded' ? new Date() : existing?.paidAt || null,
      failureCode: outcome === 'failed' ? stripeEvent.type : null,
      metadata: { lastStripeEventId: stripeEvent.id, lastStripeEventType: stripeEvent.type },
      updatedAt: new Date(),
    } as const
    if (existing) await tx.update(payments).set(paymentValues).where(eq(payments.id, existing.id))
    else await tx.insert(payments).values({ invoiceId: invoice.id, attemptCount: 1, ...paymentValues })

    const invoicePaymentStatus = outcome === 'succeeded' ? 'paid' : outcome === 'failed' ? 'failed' : outcome === 'pending' ? 'pending' : 'unpaid'
    await tx.update(invoices).set({ paymentStatus: invoicePaymentStatus, updatedAt: new Date() }).where(and(eq(invoices.id, invoice.id), ne(invoices.status, 'void')))
    await tx.insert(auditLogs).values({
      userId: null, entityType: 'invoice', entityId: invoice.id,
      action: outcome === 'succeeded' ? 'payment_received' : outcome === 'failed' ? 'payment_failed' : outcome === 'expired' ? 'payment_expired' : 'payment_pending',
      metadata: { stripeEventId: stripeEvent.id, paymentIntentId: intent, amountCents: invoice.totalCents },
    })
    if (outcome === 'succeeded') {
      await tx.insert(outboxEvents).values({
        type: 'payment_received_email', aggregateType: 'invoice', aggregateId: invoice.id,
        dedupeKey: `payment-received:${invoice.id}`,
        payload: { invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber, amountCents: invoice.totalCents, currency: invoice.currency },
      }).onConflictDoNothing({ target: outboxEvents.dedupeKey })
    }
  })
  return { received: true }
})
