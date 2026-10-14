/**
 * Omzetbelastingaangifte (btw-aangifte): the figures per period, ordered by the rubrieken of the
 * Belastingdienst form. Revenue follows the invoice date (finalized invoices only) and input VAT
 * follows the date a cost was made, the same way the rest of the finance overview does.
 */

export const vatPeriods = ['q1', 'q2', 'q3', 'q4', 'year'] as const
export type VatPeriod = typeof vatPeriods[number]

export type VatReturnInvoice = { issueDate: string, subtotalCents: number, vatAmountCents: number, vatMode: string, vatRateBasisPoints: number }
export type VatReturnExpense = { spentOn: string, vatCents: number }

/** The rubrieken that follow from invoices. 1d (private use), 2 to 4 (reverse charge, abroad) do not occur here. */
export type VatRubriek = '1a' | '1b' | '1c' | '1e'

export type VatReturn = {
  period: VatPeriod
  label: string
  /** First and last day of the period, `YYYY-MM-DD`. */
  from: string
  to: string
  /** The last day to file and pay. */
  dueDate: string
  /** Turnover excl. VAT per rubriek; 1e (0% or not taxed) has no VAT amount. */
  rubrieken: Record<VatRubriek, { turnoverCents: number, vatCents: number }>
  /** Rubriek 5a: VAT owed on the revenue. */
  dueVatCents: number
  /** Rubriek 5b: VAT paid on costs that can be deducted. */
  inputVatCents: number
  /** Rubriek 5c and 5g: 5a − 5b. Negative means the Belastingdienst pays it back. */
  balanceCents: number
  invoiceCount: number
  /** Costs that carry VAT. */
  expenseCount: number
}

export const vatRubriekLabels: Record<VatRubriek, string> = {
  '1a': 'Leveringen en diensten, hoog tarief (21%)',
  '1b': 'Leveringen en diensten, laag tarief (9%)',
  '1c': 'Leveringen en diensten, overige tarieven (niet 0%)',
  '1e': 'Leveringen en diensten belast met 0% of niet bij u belast',
}

const periodRanges: Record<VatPeriod, { from: string, to: string, due: (year: number) => string }> = {
  q1: { from: '01-01', to: '03-31', due: year => `${year}-04-30` },
  q2: { from: '04-01', to: '06-30', due: year => `${year}-07-31` },
  q3: { from: '07-01', to: '09-30', due: year => `${year}-10-31` },
  q4: { from: '10-01', to: '12-31', due: year => `${year + 1}-01-31` },
  year: { from: '01-01', to: '12-31', due: year => `${year + 1}-01-31` },
}

export function vatPeriodLabel(period: VatPeriod, year: number) {
  return period === 'year' ? `Heel jaar ${year}` : `${period.slice(1)}e kwartaal ${year}`
}

/** Which rubriek an invoice belongs in, from how its VAT was charged. */
export function vatRubriekFor(invoice: Pick<VatReturnInvoice, 'vatMode' | 'vatRateBasisPoints'>): VatRubriek {
  if (invoice.vatMode === 'exempt' || invoice.vatRateBasisPoints === 0) return '1e'
  if (invoice.vatRateBasisPoints === 2100) return '1a'
  if (invoice.vatRateBasisPoints === 900) return '1b'
  return '1c'
}

/** The form asks turnover in whole euros. Rounded down, as the Belastingdienst instructs. */
export function wholeEuroCents(cents: number) {
  return Math.floor(cents / 100) * 100
}

export function buildVatReturn(period: VatPeriod, year: number, invoices: VatReturnInvoice[], expenses: VatReturnExpense[]): VatReturn {
  const range = periodRanges[period]
  const from = `${year}-${range.from}`
  const to = `${year}-${range.to}`
  const rubrieken: VatReturn['rubrieken'] = {
    '1a': { turnoverCents: 0, vatCents: 0 },
    '1b': { turnoverCents: 0, vatCents: 0 },
    '1c': { turnoverCents: 0, vatCents: 0 },
    '1e': { turnoverCents: 0, vatCents: 0 },
  }
  let invoiceCount = 0
  let expenseCount = 0
  let inputVatCents = 0

  for (const invoice of invoices) {
    if (invoice.issueDate < from || invoice.issueDate > to) continue
    const rubriek = rubrieken[vatRubriekFor(invoice)]
    rubriek.turnoverCents += invoice.subtotalCents
    rubriek.vatCents += invoice.vatAmountCents
    invoiceCount += 1
  }
  for (const expense of expenses) {
    if (expense.spentOn < from || expense.spentOn > to || expense.vatCents <= 0) continue
    inputVatCents += expense.vatCents
    expenseCount += 1
  }

  const dueVatCents = rubrieken['1a'].vatCents + rubrieken['1b'].vatCents + rubrieken['1c'].vatCents
  return {
    period,
    label: vatPeriodLabel(period, year),
    from,
    to,
    dueDate: range.due(year),
    rubrieken,
    dueVatCents,
    inputVatCents,
    balanceCents: dueVatCents - inputVatCents,
    invoiceCount,
    expenseCount,
  }
}

export type VatReturns = { quarters: VatReturn[], year: VatReturn }

export function buildVatReturns(year: number, invoices: VatReturnInvoice[], expenses: VatReturnExpense[]): VatReturns {
  return {
    quarters: (['q1', 'q2', 'q3', 'q4'] as const).map(period => buildVatReturn(period, year, invoices, expenses)),
    year: buildVatReturn('year', year, invoices, expenses),
  }
}

/**
 * The period that most likely needs filing now: the last finished quarter of the current year.
 * Before the first quarter ends that is the first one; past years open on the whole year.
 */
export function defaultVatPeriod(year: number, today: string): VatPeriod {
  const currentYear = Number(today.slice(0, 4))
  if (year < currentYear) return 'year'
  if (year > currentYear) return 'q1'
  const finished = (['q1', 'q2', 'q3', 'q4'] as const).filter(period => `${year}-${periodRanges[period].to}` < today)
  return finished.at(-1) ?? 'q1'
}

/** Whole days from `today` until `dueDate`; negative once it has passed. */
export function daysUntil(dueDate: string, today: string) {
  const day = (value: string) => Date.UTC(Number(value.slice(0, 4)), Number(value.slice(5, 7)) - 1, Number(value.slice(8, 10)))
  return Math.round((day(dueDate) - day(today)) / 86_400_000)
}
