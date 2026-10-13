import { and, desc, eq } from 'drizzle-orm'
import { auditLogs, quotes } from '../../../../../db/schema'
import { todayInAmsterdam } from '../../../../../shared/dates'
import { quoteAcceptSchema } from '../../../../../shared/quote'
import { db } from '../../../../utils/db'
import { queueOwnerNotification } from '../../../../utils/owner-notifications'
import { resolvePortalAccess } from '../../../../utils/portal-access'
import { hashPortalToken } from '../../../../utils/portal-token'
import { assertRateLimit } from '../../../../utils/rate-limit'

/** The client accepts the quote that is open for this gig: a typed name and an explicit tick, kept with the time. */
export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, 'token') || ''
  const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  assertRateLimit(event, 'portal', `${hashPortalToken(ip).slice(0, 16)}:${hashPortalToken(token).slice(0, 16)}:quote`)
  const access = await resolvePortalAccess(token)
  if (!access) throw createError({ statusCode: 404, statusMessage: 'Deze portaallink is ongeldig of verlopen' })
  if (access.status === 'declined' || access.status === 'cancelled') throw createError({ statusCode: 409, statusMessage: 'Deze aanvraag is niet meer actief' })
  const parsed = quoteAcceptSchema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 422, statusMessage: parsed.error.issues[0]?.message || 'Controleer je gegevens' })

  const [open] = await db.select().from(quotes)
    .where(and(eq(quotes.gigId, access.gigId), eq(quotes.status, 'sent')))
    .orderBy(desc(quotes.sentAt)).limit(1)
  if (!open) throw createError({ statusCode: 409, statusMessage: 'Er staat geen offerte klaar om te accepteren' })
  if (open.validUntil < todayInAmsterdam()) throw createError({ statusCode: 409, statusMessage: 'Deze offerte is verlopen. Neem contact op voor een nieuwe.' })

  const now = new Date()
  const [accepted] = await db.update(quotes).set({
    status: 'accepted', acceptedAt: now, acceptedName: parsed.data.acceptedName, acceptedIpHash: hashPortalToken(ip), updatedAt: now,
  }).where(and(eq(quotes.id, open.id), eq(quotes.status, 'sent'))).returning()
  if (!accepted) throw createError({ statusCode: 409, statusMessage: 'Deze offerte is al beantwoord' })

  await db.insert(auditLogs).values({
    userId: null, entityType: 'gig', entityId: access.gigId, action: 'quote_accepted',
    metadata: { quoteId: open.id, quoteNumber: open.quoteNumber, acceptedName: parsed.data.acceptedName, totalCents: open.totalCents },
  })
  await queueOwnerNotification('quote_response', open.id, {
    outcome: 'accepted', gigId: access.gigId, gigTitle: access.title, quoteNumber: open.quoteNumber,
    totalCents: open.totalCents, currency: open.currency, acceptedName: parsed.data.acceptedName,
  }, `${open.id}:accepted`)
  return { ok: true, acceptedAt: accepted.acceptedAt }
})
