import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { gigs } from '../../../../../../db/schema'
import { questionnaireFieldsSchema } from '../../../../../../shared/questionnaire'
import { recordAudit } from '../../../../../utils/audit'
import { db } from '../../../../../utils/db'
import { getGigForm, saveGigForm } from '../../../../../utils/gig-booking-form'
import { requireStaff } from '../../../../../utils/require-staff'
import { requireUuidParam } from '../../../../../utils/route-params'

/** Saves the questions of this gig's own booking form. Other gigs and the templates are not touched. */
export default defineEventHandler(async (event) => {
  const user = await requireStaff(event, ['owner', 'manager'])
  const gigId = requireUuidParam(event, 'id')
  const parsed = z.object({ fields: questionnaireFieldsSchema }).safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 422, statusMessage: parsed.error.issues[0]?.message || 'Ongeldige vragen' })
  const [gig] = await db.select({ id: gigs.id }).from(gigs).where(eq(gigs.id, gigId)).limit(1)
  if (!gig) throw createError({ statusCode: 404, statusMessage: 'Gig niet gevonden' })

  const existing = await getGigForm(gigId)
  const saved = await saveGigForm(gigId, existing?.templateKey ?? 'aangepast', parsed.data.fields)
  await recordAudit({ userId: user.id, entityType: 'gig', entityId: gigId, action: 'booking_form_updated', metadata: { fieldCount: saved.fields.length } })
  return { fields: saved.fields }
})
