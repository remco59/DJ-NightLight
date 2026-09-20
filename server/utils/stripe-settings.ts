import { eq } from 'drizzle-orm'
import { stripeSettings } from '../../db/schema'
import { maskSecret } from '../../shared/secret-box'
import { db } from './db'
import { loadStripeCredentials } from './stripe'

export function stripeWebhookUrl() {
  return `${String(useRuntimeConfig().public.siteUrl).replace(/\/$/, '')}/api/webhooks/stripe`
}

export async function stripeStatus() {
  const { row, secretKey, webhookSecret, source } = await loadStripeCredentials()
  const url = stripeWebhookUrl()
  return {
    source,
    keyConfigured: Boolean(secretKey),
    keyPreview: secretKey ? maskSecret(secretKey) : null,
    livemode: row?.livemode ?? (secretKey ? secretKey.includes('_live_') : null),
    accountId: row?.accountId ?? null,
    accountName: row?.accountName ?? null,
    verifiedAt: row?.verifiedAt ?? null,
    webhookConfigured: Boolean(webhookSecret),
    webhookEndpointId: row?.webhookEndpointId ?? null,
    webhookUrl: url,
    webhookPublic: url.startsWith('https://') && !/^https:\/\/(localhost|127\.|\[::1\])/.test(url),
  }
}

export async function saveStripeSettings(values: Partial<typeof stripeSettings.$inferInsert>) {
  await db.insert(stripeSettings).values({ key: 'default', ...values })
    .onConflictDoUpdate({ target: stripeSettings.key, set: { ...values, updatedAt: new Date() } })
}

export async function clearStripeSettings() {
  await db.delete(stripeSettings).where(eq(stripeSettings.key, 'default'))
}
