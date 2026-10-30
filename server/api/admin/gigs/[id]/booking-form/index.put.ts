import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { gigs } from '../../../../../../db/schema'
import { bookingFormTemplateKeys, suggestBookingFormTemplate } from '../../../../../../shared/booking-form-templates'
import { recordAudit } from '../../../../../utils/audit'
import { db } from '../../../../../utils/db'
import { getGigForm, saveGigForm, templateFieldsFor } from '../../../../../utils/gig-booking-form'
import { requireStaff } from '../../../../../utils/require-staff'
import { requireUuidParam } from '../../../../../utils/route-params'

const bodySchema = z.object({
  enabled: z.boolean().optional(),
  /** Copy the questions of this template to the gig, replacing the gig's own questions. */
  template: z.enum(bookingFormTemplateKeys).optional(),
})

/** Switches the booking form on or off for a gig, and starts it from a template. Turning it off keeps the questions and answers. */
export default defineEventHandler(async (event) => {
  const user = await requireStaff(event, ['owner', 'manager'])
  const gigId = requireUuidParam(event, 'id')
  const parsed = bodySchema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 422, statusMessage: 'Ongeldig verzoek' })
  const [gig] = await db.select({ eventType: gigs.eventType, enabled: gigs.bookingFormEnabled }).from(gigs).where(eq(gigs.id, gigId)).limit(1)
  if (!gig) throw createError({ statusCode: 404, statusMessage: 'Gig niet gevonden' })

  const existing = await getGigForm(gigId)
  const template = parsed.data.template ?? (parsed.data.enabled && !existing ? suggestBookingFormTemplate(gig.eventType) : undefined)
  if (template) await saveGigForm(gigId, template, await templateFieldsFor(template))

  const enabled = parsed.data.enabled ?? gig.enabled
  if (enabled !== gig.enabled) await db.update(gigs).set({ bookingFormEnabled: enabled, updatedAt: new Date() }).where(eq(gigs.id, gigId))
  await recordAudit({ userId: user.id, entityType: 'gig', entityId: gigId, action: template ? 'booking_form_template_applied' : enabled ? 'booking_form_enabled' : 'booking_form_disabled', metadata: { template: template ?? null } })
  return { enabled, templateKey: template ?? existing?.templateKey ?? null }
})
