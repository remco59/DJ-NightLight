import { and, desc, eq } from 'drizzle-orm'
import { auditLogs, quotes } from '../../../../../db/schema'
import { quoteDeclineSchema } from '../../../../../shared/quote'
import { db } from '../../../../utils/db'
import { queueOwnerNotification } from '../../../../utils/owner-notifications'
import { resolvePortalAccess } from '../../../../utils/portal-access'
import { hashPortalToken } from '../../../../utils/portal-token'
import { assertRateLimit } from '../../../../utils/rate-limit'

/** The client turns the open quote down, optionally with a reason. */
export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, 'token') || ''
  const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  assertRateLimit(event, 'portal', `${hashPortalToken(ip).slice(0, 16)}:${hashPortalToken(token).slice(0, 16)}:quote`)
  const access = await resolvePortalAccess(token)
  if (!access) throw createError({ statusCode: 404, statusMessage: 'Deze portaallink is ongeldig of verlopen' })
  const parsed = quoteDeclineSchema.safeParse((await readBody(event).catch(() => ({}))) ?? {})
  if (!parsed.success) throw createError({ statusCode: 422, statusMessage: 'Controleer je gegevens' })

  const [open] = await db.select().from(quotes)
    .where(and(eq(quotes.gigId, access.gigId), eq(quotes.status, 'sent')))
    .orderBy(desc(quotes.sentAt)).limit(1)
  if (!open) throw createError({ statusCode: 409, statusMessage: 'Er staat geen offerte klaar om af te wijzen' })

  const now = new Date()
  const [declined] = await db.update(quotes).set({ status: 'declined', declinedAt: now, declineReason: parsed.data.reason || null, updatedAt: now })
    .where(and(eq(quotes.id, open.id), eq(quotes.status, 'sent'))).returning()
  if (!declined) throw createError({ statusCode: 409, statusMessage: 'Deze offerte is al beantwoord' })

  await db.insert(auditLogs).values({
    userId: null, entityType: 'gig', entityId: access.gigId, action: 'quote_declined',
    metadata: { quoteId: open.id, quoteNumber: open.quoteNumber, hasReason: Boolean(parsed.data.reason) },
  })
  await queueOwnerNotification('quote_response', open.id, {
    outcome: 'declined', gigId: access.gigId, gigTitle: access.title, quoteNumber: open.quoteNumber,
    totalCents: open.totalCents, currency: open.currency, reason: parsed.data.reason,
  }, `${open.id}:declined`)
  return { ok: true }
})
