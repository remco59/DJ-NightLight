import { and, eq } from 'drizzle-orm'
import { vatFilings } from '../../../../db/schema'
import { buildVatReturn, vatFilingInputSchema, type VatFiling } from '../../../../shared/vat-return'
import { recordAudit } from '../../../utils/audit'
import { db } from '../../../utils/db'
import { loadFinanceYear } from '../../../utils/finance-data'
import { requireStaff } from '../../../utils/require-staff'

/**
 * Records that the VAT return of a quarter was filed and, later, paid. The amount at the moment of
 * filing is worked out here, not taken from the browser. Clearing both dates removes the record.
 */
export default defineEventHandler(async (event) => {
  const user = await requireStaff(event, ['owner', 'manager'])
  const parsed = vatFilingInputSchema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 422, statusMessage: parsed.error.issues[0]?.message || 'Ongeldige invoer' })
  const { year, period, submittedOn, paidOn } = parsed.data
  const where = and(eq(vatFilings.year, year), eq(vatFilings.period, period))

  if (submittedOn === null) {
    await db.delete(vatFilings).where(where)
    await recordAudit({ userId: user.id, entityType: 'vat_filing', entityId: `${year}-${period}`, action: 'cleared' })
    return { filing: null }
  }

  // Keep the amount from the first time it was marked as filed; only a new filing takes the current one.
  const [existing] = await db.select({ submittedOn: vatFilings.submittedOn, filedBalanceCents: vatFilings.filedBalanceCents }).from(vatFilings).where(where).limit(1)
  let filedBalanceCents = existing?.submittedOn ? existing.filedBalanceCents : null
  if (filedBalanceCents === null) {
    const { invoices, expenses } = await loadFinanceYear(year)
    filedBalanceCents = buildVatReturn(period, year, invoices, expenses).balanceCents
  }

  const values = { year, period, submittedOn, filedBalanceCents, paidOn, updatedByUserId: user.id, updatedAt: new Date() }
  const [saved] = await db.insert(vatFilings).values(values).onConflictDoUpdate({ target: [vatFilings.year, vatFilings.period], set: values }).returning()
  if (!saved) throw createError({ statusCode: 500, statusMessage: 'Opslaan is niet gelukt' })
  await recordAudit({ userId: user.id, entityType: 'vat_filing', entityId: `${year}-${period}`, action: existing ? 'updated' : 'created', metadata: { submittedOn, paidOn, filedBalanceCents } })
  const filing: VatFiling = { year: saved.year, period: saved.period, submittedOn: saved.submittedOn, filedBalanceCents: saved.filedBalanceCents, paidOn: saved.paidOn }
  return { filing }
})
