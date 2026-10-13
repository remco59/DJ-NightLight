import { z } from 'zod'

export const expenseCategories = ['reis', 'materiaal', 'huur', 'muziek', 'marketing', 'verzekering', 'overig'] as const
export type ExpenseCategory = typeof expenseCategories[number]
export const MILEAGE_CATEGORY = 'kilometers'
export const DEFAULT_KM_RATE_CENTS = 23

export const expenseCategoryLabels: Record<ExpenseCategory | typeof MILEAGE_CATEGORY, string> = {
  reis: 'Reiskosten',
  materiaal: 'Materiaal',
  huur: 'Huur apparatuur of zaal',
  muziek: 'Muziek en licenties',
  marketing: 'Marketing',
  verzekering: 'Verzekering',
  overig: 'Overig',
  kilometers: 'Kilometers',
}

const optionalGigId = z.union([z.uuid(), z.literal(''), z.null()]).optional().transform(value => value || null)
const date = z.iso.date()

export const costInputSchema = z.object({
  kind: z.literal('cost'),
  gigId: optionalGigId,
  spentOn: date,
  description: z.string().trim().min(1, 'Vul een omschrijving in').max(300),
  category: z.enum(expenseCategories),
  amountCents: z.number().int().min(0).max(100_000_000),
  vatCents: z.number().int().min(0).max(100_000_000).default(0),
}).refine(value => value.vatCents <= value.amountCents, { path: ['vatCents'], message: 'Het btw-bedrag kan niet hoger zijn dan het totaal' })

export const mileageInputSchema = z.object({
  kind: z.literal('mileage'),
  gigId: optionalGigId,
  spentOn: date,
  description: z.string().trim().max(300).default(''),
  kilometers: z.number().min(0.1, 'Vul het aantal kilometers in').max(5000),
  kmRateCents: z.number().int().min(0).max(500),
})

export const expenseInputSchema = z.discriminatedUnion('kind', [costInputSchema, mileageInputSchema])
export type ExpenseInput = z.infer<typeof expenseInputSchema>

/** `12,50`, `12.5` or `€ 1.250,00` typed by a person → cents, or null when it is not a usable amount. */
export function parseEuroToCents(input: string) {
  const cleaned = input.replace(/[€\s]/g, '')
  if (!cleaned) return null
  // "1.250,00" uses . for thousands and , for decimals; "12.5" uses . for decimals.
  const normalized = cleaned.includes(',') ? cleaned.replace(/\./g, '').replace(',', '.') : cleaned
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null
  return Math.round(Number(normalized) * 100)
}

/** Reimbursement for a trip, in cents, rounded to the cent. Kilometres are kept to one decimal. */
export function mileageAmountCents(kilometers: number, rateCents: number) {
  return Math.round(Math.round(kilometers * 10) / 10 * rateCents)
}

/** What the row costs without VAT. Mileage has no VAT. */
export function expenseExclVatCents(expense: { amountCents: number, vatCents: number }) {
  return expense.amountCents - expense.vatCents
}

export type ReportInvoice = { issueDate: string, subtotalCents: number, vatAmountCents: number, totalCents: number, paymentStatus: string }
export type ReportExpense = { kind: string, spentOn: string, category: string, amountCents: number, vatCents: number, kilometers: string | number | null }

export type MonthReport = {
  /** `YYYY-MM` */
  month: string
  revenueCents: number
  vatOnRevenueCents: number
  paidCents: number
  openCents: number
  costCents: number
  mileageCents: number
  kilometers: number
  resultCents: number
}

export type FinanceReport = {
  months: MonthReport[]
  totals: Omit<MonthReport, 'month'>
  categories: Array<{ category: string, cents: number }>
}

const blank = (month: string): MonthReport => ({ month, revenueCents: 0, vatOnRevenueCents: 0, paidCents: 0, openCents: 0, costCents: 0, mileageCents: 0, kilometers: 0, resultCents: 0 })

/**
 * Year overview. Revenue follows the invoice date (finalized invoices only, excl. VAT); costs follow
 * the date they were made, excl. VAT. `paid` and `open` are the invoiced amounts incl. VAT by payment state.
 * Result = revenue − costs − mileage, all excl. VAT.
 */
export function buildFinanceReport(year: number, invoices: ReportInvoice[], expenses: ReportExpense[]): FinanceReport {
  const months = Array.from({ length: 12 }, (_, index) => blank(`${year}-${String(index + 1).padStart(2, '0')}`))
  const byMonth = new Map(months.map(month => [month.month, month]))
  const categories = new Map<string, number>()

  for (const invoice of invoices) {
    const month = byMonth.get(invoice.issueDate.slice(0, 7))
    if (!month) continue
    month.revenueCents += invoice.subtotalCents
    month.vatOnRevenueCents += invoice.vatAmountCents
    if (invoice.paymentStatus === 'paid') month.paidCents += invoice.totalCents
    else month.openCents += invoice.totalCents
  }

  for (const expense of expenses) {
    const month = byMonth.get(expense.spentOn.slice(0, 7))
    if (!month) continue
    const exclVat = expenseExclVatCents(expense)
    if (expense.kind === 'mileage') {
      month.mileageCents += exclVat
      month.kilometers += Number(expense.kilometers) || 0
      categories.set(MILEAGE_CATEGORY, (categories.get(MILEAGE_CATEGORY) ?? 0) + exclVat)
    }
    else {
      month.costCents += exclVat
      categories.set(expense.category, (categories.get(expense.category) ?? 0) + exclVat)
    }
  }

  for (const month of months) month.resultCents = month.revenueCents - month.costCents - month.mileageCents
  const { month: _first, ...totals } = months.reduce((sum, month) => ({
    month: sum.month,
    revenueCents: sum.revenueCents + month.revenueCents,
    vatOnRevenueCents: sum.vatOnRevenueCents + month.vatOnRevenueCents,
    paidCents: sum.paidCents + month.paidCents,
    openCents: sum.openCents + month.openCents,
    costCents: sum.costCents + month.costCents,
    mileageCents: sum.mileageCents + month.mileageCents,
    kilometers: Math.round((sum.kilometers + month.kilometers) * 10) / 10,
    resultCents: sum.resultCents + month.resultCents,
  }), blank(''))

  return {
    months,
    totals,
    categories: [...categories].map(([category, cents]) => ({ category, cents })).sort((a, b) => b.cents - a.cents),
  }
}

/** Result of a single gig: its invoiced revenue minus its costs and mileage, all excl. VAT. */
export function gigResultCents(invoices: Array<{ subtotalCents: number }>, expenses: Array<{ amountCents: number, vatCents: number }>) {
  const revenue = invoices.reduce((sum, invoice) => sum + invoice.subtotalCents, 0)
  const costs = expenses.reduce((sum, expense) => sum + expenseExclVatCents(expense), 0)
  return { revenueCents: revenue, costCents: costs, resultCents: revenue - costs }
}

// --- CSV for the accountant -----------------------------------------------------------------

export type CsvInvoice = ReportInvoice & { invoiceNumber: string | null, gigTitle: string, clientName: string, status: string }
export type CsvExpense = ReportExpense & { id: string, description: string, gigTitle: string | null, kmRateCents: number | null }

/** A text cell: quotes escaped, and a leading =, +, - or @ neutralised so a spreadsheet never runs it as a formula. */
export function csvText(value: string | null | undefined) {
  let text = String(value ?? '').replace(/\r?\n/g, ' ').trim()
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
  return /[";]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/** `12345` → `123,45`, the way Dutch Excel reads numbers. */
export function csvMoney(cents: number) {
  const sign = cents < 0 ? '-' : ''
  const abs = Math.abs(cents)
  return `${sign}${Math.floor(abs / 100)},${String(abs % 100).padStart(2, '0')}`
}

const invoiceStatusText = (paymentStatus: string) => paymentStatus === 'paid' ? 'Betaald' : 'Openstaand'

export function buildFinanceCsv(invoices: CsvInvoice[], expenses: CsvExpense[]) {
  const header = ['Soort', 'Datum', 'Nummer', 'Omschrijving', 'Categorie', 'Gig', 'Klant', 'Excl. btw', 'Btw', 'Incl. btw', 'Status']
  const rows: Array<{ date: string, cells: string[] }> = []

  for (const invoice of invoices) {
    rows.push({
      date: invoice.issueDate,
      cells: [
        'Omzet', invoice.issueDate, csvText(invoice.invoiceNumber), 'Factuur', '', csvText(invoice.gigTitle), csvText(invoice.clientName),
        csvMoney(invoice.subtotalCents), csvMoney(invoice.vatAmountCents), csvMoney(invoice.totalCents), invoiceStatusText(invoice.paymentStatus),
      ],
    })
  }
  for (const expense of expenses) {
    const mileage = expense.kind === 'mileage'
    const detail = mileage ? `${String(expense.kilometers).replace('.', ',')} km${expense.kmRateCents !== null ? ` à ${csvMoney(expense.kmRateCents)}` : ''}` : ''
    const description = [expense.description, detail].filter(Boolean).join(' · ')
    rows.push({
      date: expense.spentOn,
      cells: [
        mileage ? 'Kilometers' : 'Kosten', expense.spentOn, '', csvText(description), expenseCategoryLabels[(mileage ? MILEAGE_CATEGORY : expense.category) as keyof typeof expenseCategoryLabels] ?? csvText(expense.category),
        csvText(expense.gigTitle), '', csvMoney(expenseExclVatCents(expense)), csvMoney(expense.vatCents), csvMoney(expense.amountCents), '',
      ],
    })
  }
  rows.sort((a, b) => a.date.localeCompare(b.date))
  // UTF-8 BOM so Excel shows é and € correctly; ; as separator because Dutch Excel expects it.
  return `\uFEFF${[header, ...rows.map(row => row.cells)].map(cells => cells.join(';')).join('\r\n')}\r\n`
}
