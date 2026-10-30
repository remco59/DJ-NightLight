import { and, eq, ne } from 'drizzle-orm'
import type Stripe from 'stripe'
import { auditLogs, invoices, outboxEvents, payments, quotes, reservationPayments, stripeWebhookEvents } from '../../../db/schema'
import { checkoutAmountMatches, checkoutPaymentOutcome } from '../../../shared/payment-events'
import { confirmBooking } from '../../utils/booking-confirmation'
import { db } from '../../utils/db'
import { getInvoiceAmountDue } from '../../utils/invoice-balance'
import { recordReservationPaid } from '../../utils/reservation-payment'
import { consumeOwnerNotifications, ownerNotificationOutboxValues } from '../../utils/owner-notifications'
import { getStripeClient, getStripeWebhookSecret } from '../../utils/stripe'

function objectId(value: string | { id: string } | null) {
  if (!value) return null
  return typeof value === 'string' ? value : value.id
}

export default defineEventHandler(async (event) => {
  const signature = getHeader(event, 'stripe-signature')
  const rawBody = await readRawBody(event)
  if (!signature || rawBody === undefined) throw createError({ statusCode: 400, statusMessage: 'Ongeldig webhookverzoek' })

  let stripeEvent: Stripe.Event
  try {
    stripeEvent = (await getStripeClient()).webhooks.constructEvent(rawBody, signature, await getStripeWebhookSecret())
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Ongeldige Stripe-handtekening' })
  }

  const outcome = checkoutPaymentOutcome(
    stripeEvent.type,
    stripeEvent.type.startsWith('checkout.session.') ? (stripeEvent.data.object as Stripe.Checkout.Session).payment_status : null,
  )

  let reservationPaidForQuote: string | null = null
  await db.transaction(async (tx) => {
    const [claimed] = await tx.insert(stripeWebhookEvents).values({
      eventId: stripeEvent.id, eventType: stripeEvent.type, livemode: stripeEvent.livemode,
    }).onConflictDoNothing({ target: stripeWebhookEvents.eventId }).returning({ eventId: stripeWebhookEvents.eventId })
    if (!claimed || outcome === 'ignore') return

    const isSession = stripeEvent.type.startsWith('checkout.session.')
    const stripeObject = stripeEvent.data.object as Stripe.Checkout.Session | Stripe.PaymentIntent
    if (stripeObject.metadata?.kind === 'reservation') {
      reservationPaidForQuote = await handleReservationEvent(tx, stripeEvent, stripeObject, outcome, isSession)
      return
    }
    const invoiceId = stripeObject.metadata?.invoiceId
    if (!invoiceId) return
    const [invoice] = await tx.select().from(invoices).where(eq(invoices.id, invoiceId)).limit(1)
    if (!invoice || invoice.status === 'void') return

    const amount = isSession ? (stripeObject as Stripe.Checkout.Session).amount_total : (stripeObject as Stripe.PaymentIntent).amount
    const currency = stripeObject.currency
    // What is expected is the amount still due: the total minus any reservation paid earlier.
    const { amountDueCents } = await getInvoiceAmountDue({ id: invoice.id, totalCents: invoice.totalCents }, tx)
    if (!checkoutAmountMatches(amountDueCents, invoice.currency, amount, currency)) {
      await tx.insert(auditLogs).values({
        userId: null, entityType: 'invoice', entityId: invoice.id, action: 'payment_amount_mismatch',
        metadata: { stripeEventId: stripeEvent.id, expectedCents: amountDueCents, actualCents: amount, expectedCurrency: invoice.currency, actualCurrency: currency },
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
      amountCents: amountDueCents,
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
      metadata: { stripeEventId: stripeEvent.id, paymentIntentId: intent, amountCents: amountDueCents },
    })
    if (outcome === 'succeeded') {
      await tx.insert(outboxEvents).values({
        type: 'payment_received_email', aggregateType: 'invoice', aggregateId: invoice.id,
        dedupeKey: `payment-received:${invoice.id}`,
        payload: { invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber, amountCents: invoice.totalCents, currency: invoice.currency },
      }).onConflictDoNothing({ target: outboxEvents.dedupeKey })
      // Tell the owner too, in the same transaction so a retried webhook cannot notify twice.
      await tx.insert(outboxEvents).values(ownerNotificationOutboxValues('invoice_paid', invoice.id, {
        invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber, amountCents: invoice.totalCents, currency: invoice.currency,
      })).onConflictDoNothing({ target: outboxEvents.dedupeKey })
    }
  })
  // The reservation settles the booking: it becomes definite and the client gets the confirmation.
  if (reservationPaidForQuote) await confirmBooking(reservationPaidForQuote, 'reservation_paid').catch(error => console.error('[webhook] booking confirmation failed:', error))
  // Deliver at once; the email worker retries anything that fails. Never fails the webhook.
  void consumeOwnerNotifications().catch(() => undefined)
  return { received: true }
})

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

/** A Stripe event about the reservation of a quote. Returns the quote id when the reservation just became paid. */
async function handleReservationEvent(tx: Tx, stripeEvent: Stripe.Event, stripeObject: Stripe.Checkout.Session | Stripe.PaymentIntent, outcome: ReturnType<typeof checkoutPaymentOutcome>, isSession: boolean) {
  const quoteId = stripeObject.metadata?.quoteId
  if (!quoteId) return null
  const [quote] = await tx.select().from(quotes).where(eq(quotes.id, quoteId)).limit(1)
  if (!quote || quote.status !== 'accepted' || quote.reservationCents <= 0) return null

  const amount = isSession ? (stripeObject as Stripe.Checkout.Session).amount_total : (stripeObject as Stripe.PaymentIntent).amount
  if (!checkoutAmountMatches(quote.reservationCents, quote.currency, amount, stripeObject.currency)) {
    await tx.insert(auditLogs).values({
      userId: null, entityType: 'gig', entityId: quote.gigId, action: 'payment_amount_mismatch',
      metadata: { stripeEventId: stripeEvent.id, quoteId, expectedCents: quote.reservationCents, actualCents: amount },
    })
    return null
  }

  const session = isSession ? stripeObject as Stripe.Checkout.Session : null
  const intent = isSession ? objectId(session!.payment_intent) : stripeObject.id
  const [existing] = await tx.select().from(reservationPayments).where(eq(reservationPayments.quoteId, quote.id)).limit(1)
  if (existing?.status === 'succeeded') return null

  if (outcome === 'succeeded') {
    await recordReservationPaid(tx, quote, {
      provider: 'stripe', paidAt: new Date(), providerSessionId: session?.id ?? existing?.providerSessionId, providerPaymentIntentId: intent,
      metadata: { lastStripeEventId: stripeEvent.id, lastStripeEventType: stripeEvent.type },
    })
    return quote.id
  }
  const status = outcome === 'pending' ? 'pending' : outcome === 'expired' ? 'expired' : 'failed'
  if (existing) {
    await tx.update(reservationPayments).set({
      status, providerPaymentIntentId: intent ?? existing.providerPaymentIntentId, failureCode: outcome === 'failed' ? stripeEvent.type : null,
      metadata: { lastStripeEventId: stripeEvent.id, lastStripeEventType: stripeEvent.type }, updatedAt: new Date(),
    }).where(eq(reservationPayments.id, existing.id))
  }
  await tx.insert(auditLogs).values({ userId: null, entityType: 'gig', entityId: quote.gigId, action: outcome === 'failed' ? 'reservation_payment_failed' : 'reservation_payment_pending', metadata: { stripeEventId: stripeEvent.id, quoteId } })
  return null
}
