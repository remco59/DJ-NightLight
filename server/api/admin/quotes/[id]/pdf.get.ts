import { loadBusinessSettings } from '../../../../utils/invoice-finalize'
import { buildInvoicePdf } from '../../../../utils/invoice-pdf'
import { buildQuoteSnapshot, getQuoteDetail } from '../../../../utils/quote-data'
import { requireStaff } from '../../../../utils/require-staff'
import { requireUuidParam } from '../../../../utils/route-params'

export default defineEventHandler(async (event) => {
  await requireStaff(event, ['owner', 'manager'])
  const detail = await getQuoteDetail(requireUuidParam(event, 'id'))
  if (!detail) throw createError({ statusCode: 404, statusMessage: 'Offerte niet gevonden' })

  // A draft can be previewed before sending; it carries "CONCEPT" instead of a number.
  if (detail.quote.status === 'draft') {
    const settings = await loadBusinessSettings()
    if (!settings) throw createError({ statusCode: 409, statusMessage: 'Stel eerst je bedrijfsgegevens in' })
    setHeader(event, 'content-type', 'application/pdf')
    setHeader(event, 'content-disposition', 'inline; filename="concept-offerte.pdf"')
    setHeader(event, 'cache-control', 'no-store')
    return buildInvoicePdf(buildQuoteSnapshot(detail, settings, 'CONCEPT'))
  }
  if (!detail.quote.documentSnapshot || !detail.quote.quoteNumber) throw createError({ statusCode: 409, statusMessage: 'Deze offerte heeft geen document' })
  setHeader(event, 'content-type', 'application/pdf')
  setHeader(event, 'content-disposition', `inline; filename="${detail.quote.quoteNumber}.pdf"`)
  setHeader(event, 'etag', `"${detail.quote.documentHash}"`)
  return buildInvoicePdf(detail.quote.documentSnapshot)
})
