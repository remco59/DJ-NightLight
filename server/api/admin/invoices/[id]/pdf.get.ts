import { getInvoiceDetail } from '../../../../utils/invoice-data'
import { buildInvoicePdf } from '../../../../utils/invoice-pdf'
import { requireStaff } from '../../../../utils/require-staff'

export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Factuur-ID is verplicht' })
  const detail = await getInvoiceDetail(id)
  if (!detail) throw createError({ statusCode: 404, statusMessage: 'Factuur niet gevonden' })
  if (!detail.invoice.documentSnapshot || !detail.invoice.invoiceNumber) throw createError({ statusCode: 409, statusMessage: 'Maak de factuur eerst definitief voordat je de PDF maakt' })

  const pdf = buildInvoicePdf(detail.invoice.documentSnapshot)
  setHeader(event, 'content-type', 'application/pdf')
  setHeader(event, 'content-disposition', `inline; filename="${detail.invoice.invoiceNumber}.pdf"`)
  setHeader(event, 'etag', `"${detail.invoice.documentHash}"`)
  return pdf
})
