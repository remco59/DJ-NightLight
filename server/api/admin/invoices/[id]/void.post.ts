import { and, asc, eq } from 'drizzle-orm'
import { auditLogs, invoiceLineItems, invoices } from '../../../../../db/schema'
import { db } from '../../../../utils/db'
import { requireStaff } from '../../../../utils/require-staff'
import { z } from 'zod'

const schema = z.object({ createReplacement: z.boolean().default(true) })

export default defineEventHandler(async (event) => {
  const user = await requireStaff(event, ['owner', 'manager'])
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Invoice id is required' })
  const parsed = schema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 422, statusMessage: 'Invalid correction request' })
  const [current] = await db.select().from(invoices).where(and(eq(invoices.id, id), eq(invoices.status, 'finalized'))).limit(1)
  if (!current) throw createError({ statusCode: 409, statusMessage: 'Only finalized invoices can be voided' })
  const lines = await db.select().from(invoiceLineItems).where(eq(invoiceLineItems.invoiceId, id)).orderBy(asc(invoiceLineItems.ordering))

  const result = await db.transaction(async (tx) => {
    const [voided] = await tx.update(invoices).set({ status: 'void', voidedAt: new Date(), updatedAt: new Date() }).where(and(eq(invoices.id, id), eq(invoices.status, 'finalized'))).returning()
    if (!voided) throw createError({ statusCode: 409, statusMessage: 'Invoice was already changed' })
    let replacement = null
    if (parsed.data.createReplacement) {
      const [created] = await tx.insert(invoices).values({
        gigId: current.gigId, clientId: current.clientId, issueDate: current.issueDate, dueDate: current.dueDate,
        currency: current.currency, vatMode: current.vatMode, vatRateBasisPoints: current.vatRateBasisPoints,
        subtotalCents: current.subtotalCents, vatAmountCents: current.vatAmountCents, totalCents: current.totalCents,
        paymentTerms: current.paymentTerms, legalText: current.legalText, notes: current.notes,
        replacementForInvoiceId: current.id,
      }).returning()
      if (!created) throw createError({ statusCode: 500, statusMessage: 'Could not create replacement' })
      replacement = created
      if (lines.length) await tx.insert(invoiceLineItems).values(lines.map(line => ({ invoiceId: created.id, description: line.description, quantity: line.quantity, unitPriceCents: line.unitPriceCents, ordering: line.ordering })))
    }
    await tx.insert(auditLogs).values({ userId: user.id, entityType: 'invoice', entityId: id, action: 'invoice_voided', metadata: { replacementId: replacement?.id || null } })
    return { voided, replacement }
  })
  return result
})
