import { z } from 'zod'
import { auditLogs, gigReviews } from '../../../../../db/schema'
import { gigIsFinished } from '../../../../../shared/gig-phase'
import { db } from '../../../../utils/db'
import { resolvePortalAccess } from '../../../../utils/portal-access'
import { assertPortalRateLimit } from '../../../../utils/portal-rate-limit'
import { hashPortalToken } from '../../../../utils/portal-token'

const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(2000).optional().default(''),
  authorName: z.string().trim().max(200).optional().default(''),
})

export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, 'token') || ''
  const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  assertPortalRateLimit(`${hashPortalToken(ip).slice(0, 16)}:${hashPortalToken(token).slice(0, 16)}:review`)
  const access = await resolvePortalAccess(token)
  if (!access) throw createError({ statusCode: 404, statusMessage: 'Deze portaallink is ongeldig of verlopen' })
  if (access.status !== 'booked' || !gigIsFinished(access)) {
    throw createError({ statusCode: 409, statusMessage: 'Je kunt pas een review achterlaten nadat de gig is afgelopen' })
  }
  const parsed = reviewSchema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 422, statusMessage: 'Kies een beoordeling van 1 tot 5 sterren' })

  const [review] = await db.insert(gigReviews).values({
    gigId: access.gigId,
    portalLinkId: access.linkId,
    rating: parsed.data.rating,
    comment: parsed.data.comment || null,
    authorName: parsed.data.authorName || null,
  }).onConflictDoNothing().returning({ id: gigReviews.id })
  if (!review) throw createError({ statusCode: 409, statusMessage: 'Er is al een review voor deze gig ingestuurd' })

  await db.insert(auditLogs).values({
    userId: null,
    entityType: 'gig',
    entityId: access.gigId,
    action: 'review_submitted',
    metadata: { linkId: access.linkId, rating: parsed.data.rating },
  })
  return { ok: true }
})
