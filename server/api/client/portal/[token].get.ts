import { eq } from 'drizzle-orm'
import { portalLinks } from '../../../../db/schema'
import { recordAudit } from '../../../utils/audit'
import { db } from '../../../utils/db'
import { resolvePortalAccess } from '../../../utils/portal-access'
import { getPortalForm } from '../../../utils/portal-form'
import { assertPortalRateLimit } from '../../../utils/portal-rate-limit'
import { hashPortalToken } from '../../../utils/portal-token'

export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, 'token') || ''
  const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  assertPortalRateLimit(`${hashPortalToken(ip).slice(0, 16)}:${hashPortalToken(token).slice(0, 16)}`)

  const access = await resolvePortalAccess(token)
  if (!access) throw createError({ statusCode: 404, statusMessage: 'This portal link is invalid or expired' })

  await db.update(portalLinks).set({ lastUsedAt: new Date() }).where(eq(portalLinks.id, access.linkId))
  await recordAudit({
    userId: null,
    entityType: 'gig',
    entityId: access.gigId,
    action: 'portal_accessed',
    metadata: { linkId: access.linkId, requestFingerprint: hashPortalToken(ip).slice(0, 16) },
  })
  const form = await getPortalForm(access.gigId)

  return {
    gig: {
      id: access.gigId,
      title: access.title,
      eventType: access.eventType,
      status: access.status,
      startsAt: access.startsAt,
      endsAt: access.endsAt,
      venue: access.venueName ? { name: access.venueName, city: access.venueCity } : null,
    },
    client: {
      name: access.clientCompanyName || [access.clientFirstName, access.clientLastName].filter(Boolean).join(' ') || null,
    },
    expiresAt: access.expiresAt,
    questionnaire: {
      version: form.version.version,
      fields: form.version.fields,
      answers: form.submission?.answers || {},
      status: form.submission?.status || 'not_started',
      acceptedName: form.submission?.acceptedName || null,
      submittedAt: form.submission?.submittedAt || null,
    },
    wishes: form.wishes.map(wish => ({
      category: wish.category,
      artist: wish.artist,
      title: wish.title,
      spotifyUrl: wish.spotifyUrl,
      note: wish.note,
      ordering: wish.ordering,
    })),
  }
})
