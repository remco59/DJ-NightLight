import { todayInAmsterdam } from '../../../../../shared/dates'
import { clientEmailPlan } from '../../../../utils/email-plan'
import { loadBusinessSettings } from '../../../../utils/invoice-finalize'
import { getQuoteDetail, quoteSendBlockers } from '../../../../utils/quote-data'
import { requireStaff } from '../../../../utils/require-staff'
import { requireUuidParam } from '../../../../utils/route-params'

/** What stops the quote from being sent, and whether the client gets an email about it. */
export default defineEventHandler(async (event) => {
  await requireStaff(event, ['owner', 'manager'])
  const detail = await getQuoteDetail(requireUuidParam(event, 'id'))
  if (!detail) throw createError({ statusCode: 404, statusMessage: 'Offerte niet gevonden' })
  return {
    blockers: quoteSendBlockers(detail, await loadBusinessSettings(), todayInAmsterdam()),
    email: await clientEmailPlan({ templateKey: 'quote_sent', gigId: detail.quote.gigId, recipient: detail.quote.clientEmail }),
  }
})
