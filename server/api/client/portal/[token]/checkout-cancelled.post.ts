import { and, desc, eq } from 'drizzle-orm'
import { invoices, payments } from '../../../../../db/schema'
import { db } from '../../../../utils/db'
import { resolvePortalAccess } from '../../../../utils/portal-access'
import { assertRateLimit } from '../../../../utils/rate-limit'
import { hashPortalToken } from '../../../../utils/portal-token'
import { getStripeClient } from '../../../../utils/stripe'

// Called when the customer returns from Stripe via cancel_url. Frees an invoice that is stuck on 'pending'
// but only if Stripe confirms the session is still open, so a bank transfer that is really in flight stays pending.
export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, 'token') || ''
  const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  assertRateLimit(event, 'portal', `${hashPortalToken(ip).slice(0, 16)}:${hashPortalToken(token).slice(0, 16)}:checkout-cancelled`)
  const access = await resolvePortalAccess(token)
  if (!access) throw createError({ statusCode: 404, statusMessage: 'Deze portaallink is ongeldig of verlopen' })

  const [invoice] = await db.select({ id: invoices.id, paymentStatus: invoices.paymentStatus }).from(invoices).where(and(
    eq(invoices.gigId, access.gigId), eq(invoices.status, 'finalized'),
  )).orderBy(desc(invoices.finalizedAt)).limit(1)
  if (!invoice || invoice.paymentStatus !== 'pending') return { reset: false }

  const [payment] = await db.select({ providerSessionId: payments.providerSessionId }).from(payments).where(eq(payments.invoiceId, invoice.id)).limit(1)
  if (!payment?.providerSessionId) return { reset: false }

  const session = await (await getStripeClient()).checkout.sessions.retrieve(payment.providerSessionId)
  if (session.status !== 'open') return { reset: false }

  await db.update(invoices).set({ paymentStatus: 'unpaid', updatedAt: new Date() }).where(and(eq(invoices.id, invoice.id), eq(invoices.paymentStatus, 'pending')))
  return { reset: true }
})
