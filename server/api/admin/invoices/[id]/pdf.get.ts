import { createHash } from 'node:crypto'
import { getInvoiceDetail } from '../../../../utils/invoice-data'
import { buildInvoicePdf } from '../../../../utils/invoice-pdf'
import { requireStaff } from '../../../../utils/require-staff'
import { getStripeBankTransferInstructions } from '../../../../utils/stripe-customer'

export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Invoice id is required' })
  const detail = await getInvoiceDetail(id)
  if (!detail) throw createError({ statusCode: 404, statusMessage: 'Invoice not found' })
  if (!detail.invoice.documentSnapshot || !detail.invoice.invoiceNumber) throw createError({ statusCode: 409, statusMessage: 'Finalize the invoice before generating its PDF' })

  let bankTransfer = null
  if (detail.invoice.clientId) {
    try {
      bankTransfer = await getStripeBankTransferInstructions({
        id: detail.invoice.clientId,
        stripeCustomerId: detail.invoice.clientStripeCustomerId,
        firstName: detail.invoice.clientFirstName,
        lastName: detail.invoice.clientLastName,
        companyName: detail.invoice.clientCompanyName,
        email: detail.invoice.clientEmail,
      }, detail.invoice.invoiceNumber, detail.invoice.currency)
    } catch {
      // PDF generation should remain available when Stripe is temporarily unavailable.
      // The renderer falls back to the business IBAN already stored in the immutable snapshot.
    }
  }

  const pdf = buildInvoicePdf(detail.invoice.documentSnapshot, bankTransfer)
  setHeader(event, 'content-type', 'application/pdf')
  setHeader(event, 'content-disposition', `inline; filename="${detail.invoice.invoiceNumber}.pdf"`)
  setHeader(event, 'etag', `"${createHash('sha256').update(pdf).digest('hex')}"`)
  return pdf
})
