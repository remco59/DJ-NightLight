import { describe, expect, it } from 'vitest'
import { buildVatReturn, buildVatReturns, daysUntil, defaultVatPeriod, vatPeriodLabel, vatRubriekFor, wholeEuroCents } from '../shared/vat-return'

const invoice = (issueDate: string, subtotalCents: number, vatAmountCents: number, vatRateBasisPoints = 2100, vatMode = 'exclusive') =>
  ({ issueDate, subtotalCents, vatAmountCents, vatMode, vatRateBasisPoints })

const invoices = [
  invoice('2026-01-15', 100000, 21000),
  invoice('2026-03-31', 50000, 10500),
  invoice('2026-04-01', 80000, 16800),
  invoice('2026-05-10', 20000, 1800, 900),
  invoice('2026-08-20', 30000, 0, 0),
  invoice('2026-09-01', 40000, 0, 2100, 'exempt'),
  invoice('2026-10-02', 60000, 2000, 330),
  invoice('2025-12-31', 99999, 21000),
]
const expenses = [
  { spentOn: '2026-01-10', vatCents: 2100 },
  { spentOn: '2026-03-31', vatCents: 500 },
  { spentOn: '2026-04-01', vatCents: 1000 },
  { spentOn: '2026-02-01', vatCents: 0 },
  { spentOn: '2027-01-01', vatCents: 9999 },
]

describe('rubriek per invoice', () => {
  it('maps the VAT rate to the form rubriek', () => {
    expect(vatRubriekFor({ vatMode: 'exclusive', vatRateBasisPoints: 2100 })).toBe('1a')
    expect(vatRubriekFor({ vatMode: 'inclusive', vatRateBasisPoints: 2100 })).toBe('1a')
    expect(vatRubriekFor({ vatMode: 'exclusive', vatRateBasisPoints: 900 })).toBe('1b')
    expect(vatRubriekFor({ vatMode: 'exclusive', vatRateBasisPoints: 330 })).toBe('1c')
  })

  it('puts 0% and VAT-exempt invoices in 1e, whatever rate is stored', () => {
    expect(vatRubriekFor({ vatMode: 'exclusive', vatRateBasisPoints: 0 })).toBe('1e')
    expect(vatRubriekFor({ vatMode: 'exempt', vatRateBasisPoints: 2100 })).toBe('1e')
  })
})

describe('vat return for one quarter', () => {
  const q1 = buildVatReturn('q1', 2026, invoices, expenses)

  it('sums turnover and VAT per rubriek, including both period edges', () => {
    expect(q1.rubrieken['1a']).toEqual({ turnoverCents: 150000, vatCents: 31500 })
    expect(q1.rubrieken['1b']).toEqual({ turnoverCents: 0, vatCents: 0 })
    expect(q1.invoiceCount).toBe(2)
  })

  it('deducts the VAT on costs and ignores costs without VAT', () => {
    expect(q1.inputVatCents).toBe(2600)
    expect(q1.expenseCount).toBe(2)
    expect(q1.dueVatCents).toBe(31500)
    expect(q1.balanceCents).toBe(28900)
  })

  it('is negative when more VAT was paid than charged', () => {
    const quiet = buildVatReturn('q3', 2026, [], [{ spentOn: '2026-07-04', vatCents: 4200 }])
    expect(quiet.dueVatCents).toBe(0)
    expect(quiet.balanceCents).toBe(-4200)
  })

  it('does not count VAT on the 0% and exempt invoices as owed', () => {
    const q3 = buildVatReturn('q3', 2026, invoices, expenses)
    expect(q3.rubrieken['1e']).toEqual({ turnoverCents: 70000, vatCents: 0 })
    expect(q3.dueVatCents).toBe(0)
    expect(q3.invoiceCount).toBe(2)
  })

  it('splits other rates over 1b and 1c', () => {
    const q2 = buildVatReturn('q2', 2026, invoices, expenses)
    expect(q2.rubrieken['1a']).toEqual({ turnoverCents: 80000, vatCents: 16800 })
    expect(q2.rubrieken['1b']).toEqual({ turnoverCents: 20000, vatCents: 1800 })
    expect(q2.dueVatCents).toBe(18600)
    const q4 = buildVatReturn('q4', 2026, invoices, expenses)
    expect(q4.rubrieken['1c']).toEqual({ turnoverCents: 60000, vatCents: 2000 })
  })

  it('is all zeros for an empty period', () => {
    const empty = buildVatReturn('q2', 2030, [], [])
    expect(empty).toMatchObject({ dueVatCents: 0, inputVatCents: 0, balanceCents: 0, invoiceCount: 0, expenseCount: 0 })
  })
})

describe('vat returns for a year', () => {
  const { quarters, year } = buildVatReturns(2026, invoices, expenses)

  it('has four quarters in order, plus the whole year', () => {
    expect(quarters.map(quarter => quarter.period)).toEqual(['q1', 'q2', 'q3', 'q4'])
    expect(year.period).toBe('year')
  })

  it('adds up to the whole year, and leaves out other years', () => {
    expect(year.dueVatCents).toBe(quarters.reduce((sum, quarter) => sum + quarter.dueVatCents, 0))
    expect(year.inputVatCents).toBe(quarters.reduce((sum, quarter) => sum + quarter.inputVatCents, 0))
    expect(year.invoiceCount).toBe(7)
    expect(year.inputVatCents).toBe(3600)
  })

  it('knows the period dates and the last day to file', () => {
    expect(quarters.map(quarter => quarter.from)).toEqual(['2026-01-01', '2026-04-01', '2026-07-01', '2026-10-01'])
    expect(quarters.map(quarter => quarter.to)).toEqual(['2026-03-31', '2026-06-30', '2026-09-30', '2026-12-31'])
    expect(quarters.map(quarter => quarter.dueDate)).toEqual(['2026-04-30', '2026-07-31', '2026-10-31', '2027-01-31'])
    expect(year.dueDate).toBe('2027-01-31')
  })

  it('labels the periods in Dutch', () => {
    expect(vatPeriodLabel('q1', 2026)).toBe('1e kwartaal 2026')
    expect(vatPeriodLabel('q4', 2026)).toBe('4e kwartaal 2026')
    expect(vatPeriodLabel('year', 2026)).toBe('Heel jaar 2026')
  })
})

describe('whole euros', () => {
  it('rounds turnover down to whole euros', () => {
    expect(wholeEuroCents(150099)).toBe(150000)
    expect(wholeEuroCents(99)).toBe(0)
    expect(wholeEuroCents(100)).toBe(100)
  })
})

describe('default period', () => {
  it('opens on the last finished quarter of the current year', () => {
    expect(defaultVatPeriod(2026, '2026-10-14')).toBe('q3')
    expect(defaultVatPeriod(2026, '2026-07-01')).toBe('q2')
    expect(defaultVatPeriod(2026, '2026-12-31')).toBe('q3')
  })

  it('opens on the first quarter before any quarter has finished', () => {
    expect(defaultVatPeriod(2026, '2026-02-10')).toBe('q1')
    expect(defaultVatPeriod(2026, '2026-03-31')).toBe('q1')
  })

  it('opens on the whole year for a past year and the first quarter for a future one', () => {
    expect(defaultVatPeriod(2025, '2026-10-14')).toBe('year')
    expect(defaultVatPeriod(2027, '2026-10-14')).toBe('q1')
  })
})

describe('days until the deadline', () => {
  it('counts whole days, negative once passed', () => {
    expect(daysUntil('2026-10-31', '2026-10-14')).toBe(17)
    expect(daysUntil('2026-10-31', '2026-10-31')).toBe(0)
    expect(daysUntil('2026-10-31', '2026-11-02')).toBe(-2)
    expect(daysUntil('2027-01-31', '2026-12-31')).toBe(31)
  })
})
