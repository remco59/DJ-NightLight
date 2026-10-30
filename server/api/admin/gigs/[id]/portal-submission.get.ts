import { getPortalForm } from '../../../../utils/portal-form'
import { requireStaff } from '../../../../utils/require-staff'
import { requireUuidParam } from '../../../../utils/route-params'

export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const gigId = requireUuidParam(event, 'id')
  const form = await getPortalForm(gigId)
  return {
    status: form.submission?.status || 'not_started',
    submission: form.submission,
    enabled: form.enabled,
    fields: form.fields,
    templateVersion: form.templateVersion,
    gigFormId: form.gigForm?.id ?? null,
    wishes: form.wishes,
  }
})
