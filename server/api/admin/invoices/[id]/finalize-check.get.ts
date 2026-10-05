import { getInvoiceDetail } from '../../../../utils/invoice-data'
import { invoiceEmailPlan, invoiceFinalizeBlockers, loadBusinessSettings } from '../../../../utils/invoice-finalize'
import { requireStaff } from '../../../../utils/require-staff'
import { requireUuidParam } from '../../../../utils/route-params'

/** What finalizing this draft would do: what blocks it and who gets the invoice email. */
export default defineEventHandler(async (event) => {
  await requireStaff(event, ['owner', 'manager'])
  const id = requireUuidParam(event, 'id')
  const detail = await getInvoiceDetail(id)
  if (!detail) throw createError({ statusCode: 404, statusMessage: 'Factuur niet gevonden' })
  return {
    blockers: invoiceFinalizeBlockers(detail, await loadBusinessSettings()),
    email: await invoiceEmailPlan(detail),
  }
})
