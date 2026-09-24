import { clients, gigs } from '../../../db/schema'
import { inquiryInputSchema } from '../../../shared/schemas/inquiry'
import { recordAudit } from '../../utils/audit'
import { db } from '../../utils/db'
import { queueGigEmail } from '../../utils/email-automation'
import { assertPublicRateLimit } from '../../utils/public-rate-limit'

export default defineEventHandler(async (event) => {
  const forwarded = event.node.req.headers['x-forwarded-for']
  const ip = (Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0])
    || event.node.req.socket.remoteAddress
    || 'unknown'

  assertPublicRateLimit(`inquiry:${ip}`)
  const input = await readValidatedBody(event, inquiryInputSchema.parse)

  if (input.website) {
    return { ok: true }
  }

  const startsAt = input.eventDate
    ? new Date(`${input.eventDate}T12:00:00.000Z`)
    : null

  const notes = [
    input.location ? `Requested location: ${input.location}` : null,
    input.message ? `Message: ${input.message}` : null,
  ].filter(Boolean).join('\n\n') || null

  const result = await db.transaction(async (tx) => {
    const [client] = await tx.insert(clients).values({
      type: input.company ? 'company' : 'person',
      firstName: input.name,
      companyName: input.company,
      email: input.email,
      phone: input.phone,
    }).returning()

    if (!client) throw createError({ statusCode: 500, statusMessage: 'Aanvraag versturen is niet gelukt' })

    const [gig] = await tx.insert(gigs).values({
      title: `${input.eventType || 'Booking request'} — ${input.name}`,
      eventType: input.eventType,
      clientId: client.id,
      status: 'lead',
      startsAt,
      currency: 'EUR',
      publicVisibility: false,
      internalNotes: notes,
      source: 'website',
    }).returning()

    if (!gig) throw createError({ statusCode: 500, statusMessage: 'Aanvraag versturen is niet gelukt' })
    return { client, gig }
  })

  await recordAudit({
    userId: null,
    entityType: 'gig',
    entityId: result.gig.id,
    action: 'website_inquiry',
    metadata: { clientId: result.client.id },
  })

  await queueGigEmail('lead_acknowledgement', result.gig.id, `lead-acknowledgement:${result.gig.id}`)

  event.node.res.statusCode = 201
  return { ok: true }
})
