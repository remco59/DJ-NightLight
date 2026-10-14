import { eq, sql } from 'drizzle-orm'
import { businessSettings, expenses, invoices, vatFilings } from '../../../../db/schema'
import { todayInAmsterdam } from '../../../../shared/dates'
import { buildFinanceReport } from '../../../../shared/finance'
import { buildVatReturns, type VatFiling } from '../../../../shared/vat-return'
import { db } from '../../../utils/db'
import { loadFinanceYear, parseYear } from '../../../utils/finance-data'
import { requireStaff } from '../../../utils/require-staff'

/** Year overview for the finance page: revenue, costs, result per month, the VAT return per quarter and whether it was filed and paid, and the costs of that year. */
export default defineEventHandler(async (event) => {
  await requireStaff(event, ['owner', 'manager'])
  const currentYear = Number(todayInAmsterdam().slice(0, 4))
  const year = parseYear(getQuery(event).year, currentYear)
  const { invoices: yearInvoices, expenses: yearExpenses } = await loadFinanceYear(year)

  const [settings] = await db.select({ kmRateCents: businessSettings.kmRateCents, vatNumber: businessSettings.vatNumber }).from(businessSettings).where(eq(businessSettings.key, 'default')).limit(1)
  // Years with any data, so the picker only offers years that show something (plus the current one).
  const yearRows = await db.execute<{ year: number }>(sql`
    select distinct extract(year from d)::int as year from (
      select ${invoices.issueDate}::date as d from ${invoices} where ${invoices.status} = 'finalized'
      union all select ${expenses.spentOn}::date as d from ${expenses}
    ) as dates order by year desc`)
  const years = [...new Set([currentYear, year, ...yearRows.map(row => Number(row.year))])].sort((a, b) => b - a)

  const filingRows = await db.select({ year: vatFilings.year, period: vatFilings.period, submittedOn: vatFilings.submittedOn, filedBalanceCents: vatFilings.filedBalanceCents, paidOn: vatFilings.paidOn })
    .from(vatFilings).where(eq(vatFilings.year, year))
  const filings: VatFiling[] = filingRows

  return {
    year,
    years,
    kmRateCents: settings?.kmRateCents ?? 23,
    report: buildFinanceReport(year, yearInvoices, yearExpenses),
    vatNumber: settings?.vatNumber ?? '',
    vat: buildVatReturns(year, yearInvoices, yearExpenses),
    vatFilings: filings,
    invoiceCount: yearInvoices.length,
    expenses: yearExpenses.map(({ gigTitle, ...row }) => ({ ...row, gigTitle })),
  }
})
