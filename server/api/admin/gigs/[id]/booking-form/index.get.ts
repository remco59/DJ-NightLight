import { eq } from 'drizzle-orm'
import { gigs } from '../../../../../../db/schema'
import { bookingFormTemplateKeys, bookingFormTemplateLabels, suggestBookingFormTemplate } from '../../../../../../shared/booking-form-templates'
import { db } from '../../../../../utils/db'
import { getGigForm } from '../../../../../utils/gig-booking-form'
import { requireStaff } from '../../../../../utils/require-staff'
import { requireUuidParam } from '../../../../../utils/route-params'

/** Whether the booking form is on for this gig, its own questions, and the templates to start from. */
export default defineEventHandler(async (event) => {
  await requireStaff(event, ['owner', 'manager'])
  const gigId = requireUuidParam(event, 'id')
  const [gig] = await db.select({ enabled: gigs.bookingFormEnabled, eventType: gigs.eventType }).from(gigs).where(eq(gigs.id, gigId)).limit(1)
  if (!gig) throw createError({ statusCode: 404, statusMessage: 'Gig niet gevonden' })
  const form = await getGigForm(gigId)
  return {
    enabled: gig.enabled,
    templateKey: form?.templateKey ?? null,
    fields: form?.fields ?? [],
    suggested: suggestBookingFormTemplate(gig.eventType),
    templates: bookingFormTemplateKeys.map(key => ({ key, ...bookingFormTemplateLabels[key] })),
  }
})
