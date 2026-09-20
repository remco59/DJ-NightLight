import { describe, expect, it } from 'vitest'
import { checkoutAmountMatches, checkoutPaymentOutcome } from '../shared/payment-events'

describe('Stripe payment event handling', () => {
  it('marks only paid completed sessions as succeeded', () => {
    expect(checkoutPaymentOutcome('checkout.session.completed', 'paid')).toBe('succeeded')
    expect(checkoutPaymentOutcome('checkout.session.completed', 'unpaid')).toBe('pending')
    expect(checkoutPaymentOutcome('checkout.session.async_payment_succeeded')).toBe('succeeded')
  })

  it('keeps failures and expirations distinct from payment success', () => {
    expect(checkoutPaymentOutcome('checkout.session.async_payment_failed')).toBe('failed')
    expect(checkoutPaymentOutcome('payment_intent.payment_failed')).toBe('failed')
    expect(checkoutPaymentOutcome('checkout.session.expired')).toBe('expired')
    expect(checkoutPaymentOutcome('customer.created')).toBe('ignore')
  })

  it('requires the exact server-side invoice amount and currency', () => {
    expect(checkoutAmountMatches(12500, 'EUR', 12500, 'eur')).toBe(true)
    expect(checkoutAmountMatches(12500, 'EUR', 12499, 'eur')).toBe(false)
    expect(checkoutAmountMatches(12500, 'EUR', 12500, 'usd')).toBe(false)
  })
})
