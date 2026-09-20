import { randomBytes } from 'node:crypto'
import { eq } from 'drizzle-orm'
import Stripe from 'stripe'
import { stripeSettings } from '../../db/schema'
import { decryptSecret } from '../../shared/secret-box'
import { db } from './db'

export const STRIPE_WEBHOOK_EVENTS = [
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded',
  'checkout.session.async_payment_failed',
  'checkout.session.expired',
  'payment_intent.payment_failed',
] as const

export function createStripeClient(apiKey: string) {
  return new Stripe(apiKey, { apiVersion: '2026-07-29.dahlia' })
}

export async function loadStripeCredentials() {
  const config = useRuntimeConfig()
  const password = String(config.session.password || '')
  const [row] = await db.select().from(stripeSettings).where(eq(stripeSettings.key, 'default')).limit(1)
  const secretKey = row?.secretKeyEncrypted ? decryptSecret(row.secretKeyEncrypted, password) : String(config.stripeSecretKey || '')
  const webhookSecret = row?.webhookSecretEncrypted ? decryptSecret(row.webhookSecretEncrypted, password) : String(config.stripeWebhookSecret || '')
  return { row, secretKey, webhookSecret, source: row?.secretKeyEncrypted ? 'settings' as const : secretKey ? 'environment' as const : 'none' as const }
}

export async function getStripeClient() {
  const { secretKey } = await loadStripeCredentials()
  if (!secretKey) throw createError({ statusCode: 503, statusMessage: 'Stripe is not configured' })
  return createStripeClient(secretKey)
}

export async function getStripeWebhookSecret() {
  const { webhookSecret } = await loadStripeCredentials()
  if (!webhookSecret) throw createError({ statusCode: 503, statusMessage: 'Stripe webhooks are not configured' })
  return webhookSecret
}

export function stripeIntegrationIdentifier() {
  const letters = 'abcdefghijklmnopqrstuvwxyz'
  const random = randomBytes(8)
  return `nightlight_${Array.from(random, byte => letters[byte % letters.length]).join('')}`
}
