import { getInvoiceDetail } from '../../../utils/invoice-data'
import { requireStaff } from '../../../utils/require-staff'
import { requireUuidParam } from '../../../utils/route-params'

export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const id = requireUuidParam(event, 'id')
  const detail = await getInvoiceDetail(id)
  if (!detail) throw createError({ statusCode: 404, statusMessage: 'Factuur niet gevonden' })
  return detail
})
