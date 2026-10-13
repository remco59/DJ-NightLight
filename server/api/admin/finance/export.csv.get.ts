import { todayInAmsterdam } from '../../../../shared/dates'
import { buildFinanceCsv } from '../../../../shared/finance'
import { loadFinanceYear, parseYear } from '../../../utils/finance-data'
import { requireStaff } from '../../../utils/require-staff'

/** One line per invoice or cost of a year, for the accountant. */
export default defineEventHandler(async (event) => {
  await requireStaff(event, ['owner', 'manager'])
  const year = parseYear(getQuery(event).year, Number(todayInAmsterdam().slice(0, 4)))
  const { invoices, expenses } = await loadFinanceYear(year)
  setHeader(event, 'content-type', 'text/csv; charset=utf-8')
  setHeader(event, 'content-disposition', `attachment; filename="nightlight-administratie-${year}.csv"`)
  setHeader(event, 'cache-control', 'private, no-store')
  return buildFinanceCsv(invoices, expenses)
})
