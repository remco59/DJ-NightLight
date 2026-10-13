import { and, desc, eq, inArray } from 'drizzle-orm'
import { quotes } from '../../../../../db/schema'
import { db } from '../../../../utils/db'
import { buildInvoicePdf } from '../../../../utils/invoice-pdf'
import { resolvePortalAccess } from '../../../../utils/portal-access'
import { hashPortalToken } from '../../../../utils/portal-token'
import { assertRateLimit } from '../../../../utils/rate-limit'

export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, 'token') || ''
  const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  assertRateLimit(event, 'portal', `${hashPortalToken(ip).slice(0, 16)}:${hashPortalToken(token).slice(0, 16)}:pdf`)
  const access = await resolvePortalAccess(token)
  if (!access) throw createError({ statusCode: 404, statusMessage: 'Deze portaallink is ongeldig of verlopen' })

  const [quote] = await db.select({ snapshot: quotes.documentSnapshot, number: quotes.quoteNumber }).from(quotes)
    .where(and(eq(quotes.gigId, access.gigId), inArray(quotes.status, ['sent', 'accepted', 'declined'])))
    .orderBy(desc(quotes.sentAt)).limit(1)
  if (!quote?.snapshot || !quote.number) throw createError({ statusCode: 404, statusMessage: 'Er is geen offerte beschikbaar' })

  setHeader(event, 'content-type', 'application/pdf')
  setHeader(event, 'content-disposition', `attachment; filename="${quote.number}.pdf"`)
  setHeader(event, 'cache-control', 'private, no-store')
  return buildInvoicePdf(quote.snapshot)
})
