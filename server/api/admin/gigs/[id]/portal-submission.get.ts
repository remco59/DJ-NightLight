import { getPortalForm } from '../../../../utils/portal-form'
import { requireStaff } from '../../../../utils/require-staff'

export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const gigId = getRouterParam(event, 'id')
  if (!gigId) throw createError({ statusCode: 400, statusMessage: 'Gig-ID is verplicht' })
  const form = await getPortalForm(gigId)
  return {
    status: form.submission?.status || 'not_started',
    submission: form.submission,
    fields: form.version.fields,
    templateVersion: form.version.version,
    wishes: form.wishes,
  }
})
