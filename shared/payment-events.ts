export type PaymentOutcome = 'succeeded' | 'failed' | 'expired' | 'pending' | 'ignore'

export function checkoutPaymentOutcome(eventType: string, paymentStatus?: string | null): PaymentOutcome {
  if (eventType === 'checkout.session.async_payment_succeeded') return 'succeeded'
  if (eventType === 'checkout.session.async_payment_failed') return 'failed'
  if (eventType === 'checkout.session.expired') return 'expired'
  if (eventType === 'checkout.session.completed') return paymentStatus === 'paid' || paymentStatus === 'no_payment_required' ? 'succeeded' : 'pending'
  if (eventType === 'payment_intent.payment_failed') return 'failed'
  return 'ignore'
}

export function checkoutAmountMatches(expectedCents: number, expectedCurrency: string, actualCents: number | null, actualCurrency: string | null) {
  return expectedCents === actualCents && expectedCurrency.toLowerCase() === actualCurrency?.toLowerCase()
}
