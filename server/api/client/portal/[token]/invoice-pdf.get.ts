import { and, desc, eq } from 'drizzle-orm'
import { invoices } from '../../../../../db/schema'
import { db } from '../../../../utils/db'
import { getInvoiceDetail } from '../../../../utils/invoice-data'
import { buildInvoicePdf } from '../../../../utils/invoice-pdf'
import { resolvePortalAccess } from '../../../../utils/portal-access'
import { assertRateLimit } from '../../../../utils/rate-limit'
import { hashPortalToken } from '../../../../utils/portal-token'

export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, 'token') || ''
  const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  assertRateLimit(event, 'portal', `${hashPortalToken(ip).slice(0, 16)}:${hashPortalToken(token).slice(0, 16)}:pdf`)
  const access = await resolvePortalAccess(token)
  if (!access) throw createError({ statusCode: 404, statusMessage: 'Deze portaallink is ongeldig of verlopen' })

  const [row] = await db.select({ id: invoices.id }).from(invoices)
    .where(and(eq(invoices.gigId, access.gigId), eq(invoices.status, 'finalized')))
    .orderBy(desc(invoices.finalizedAt)).limit(1)
  const detail = row ? await getInvoiceDetail(row.id) : null
  if (!detail?.invoice.documentSnapshot || !detail.invoice.invoiceNumber) throw createError({ statusCode: 404, statusMessage: 'Er is geen factuur beschikbaar' })

  setHeader(event, 'content-type', 'application/pdf')
  setHeader(event, 'content-disposition', `attachment; filename="${detail.invoice.invoiceNumber}.pdf"`)
  setHeader(event, 'cache-control', 'private, no-store')
  return buildInvoicePdf(detail.invoice.documentSnapshot)
})
