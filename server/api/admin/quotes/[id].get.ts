import { getQuoteDetail } from '../../../utils/quote-data'
import { requireStaff } from '../../../utils/require-staff'
import { requireUuidParam } from '../../../utils/route-params'

export default defineEventHandler(async (event) => {
  await requireStaff(event, ['owner', 'manager'])
  const detail = await getQuoteDetail(requireUuidParam(event, 'id'))
  if (!detail) throw createError({ statusCode: 404, statusMessage: 'Offerte niet gevonden' })
  return detail
})
