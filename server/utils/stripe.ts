import { randomBytes } from 'node:crypto'
import Stripe from 'stripe'

export function getStripeClient() {
  const config = useRuntimeConfig()
  const apiKey = String(config.stripeSecretKey || '')
  if (!apiKey) throw createError({ statusCode: 503, statusMessage: 'Stripe is not configured' })
  return new Stripe(apiKey, { apiVersion: '2026-07-29.dahlia' })
}

export function getStripeWebhookSecret() {
  const secret = String(useRuntimeConfig().stripeWebhookSecret || '')
  if (!secret) throw createError({ statusCode: 503, statusMessage: 'Stripe webhooks are not configured' })
  return secret
}

export function stripeIntegrationIdentifier() {
  const letters = 'abcdefghijklmnopqrstuvwxyz'
  const random = randomBytes(8)
  return `nightlight_${Array.from(random, byte => letters[byte % letters.length]).join('')}`
}
