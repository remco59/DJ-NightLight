import { getInvoiceDetail } from '../../../../utils/invoice-data'
import { invoiceEmailPlan, invoiceFinalizeBlockers, loadBusinessSettings } from '../../../../utils/invoice-finalize'
import { requireStaff } from '../../../../utils/require-staff'

/** What finalizing this draft would do: what blocks it and who gets the invoice email. */
export default defineEventHandler(async (event) => {
  await requireStaff(event, ['owner', 'manager'])
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Factuur-ID is verplicht' })
  const detail = await getInvoiceDetail(id)
  if (!detail) throw createError({ statusCode: 404, statusMessage: 'Factuur niet gevonden' })
  return {
    blockers: invoiceFinalizeBlockers(detail, await loadBusinessSettings()),
    email: await invoiceEmailPlan(detail),
  }
})
