import { describe, expect, it } from 'vitest'
import {
  buildFinanceCsv,
  buildFinanceReport,
  costInputSchema,
  csvMoney,
  csvText,
  expenseExclVatCents,
  expenseInputSchema,
  gigResultCents,
  mileageAmountCents,
  mileageInputSchema,
  parseEuroToCents,
} from '../shared/finance'

describe('parse euro amounts', () => {
  it('reads Dutch and plain notations', () => {
    expect(parseEuroToCents('12,50')).toBe(1250)
    expect(parseEuroToCents('12.5')).toBe(1250)
    expect(parseEuroToCents('€ 1.250,00')).toBe(125000)
    expect(parseEuroToCents('7')).toBe(700)
    expect(parseEuroToCents('0,05')).toBe(5)
  })

  it('rejects anything that is not an amount', () => {
    for (const bad of ['', '  ', 'abc', '12,345', '-5', '1,2,3', '12e3']) expect(parseEuroToCents(bad), bad).toBeNull()
  })
})

describe('mileage', () => {
  it('multiplies kilometres by the rate and rounds to the cent', () => {
    expect(mileageAmountCents(42, 23)).toBe(966)
    expect(mileageAmountCents(42.5, 23)).toBe(978)
    expect(mileageAmountCents(10.04, 23)).toBe(230)
  })

  it('has no VAT to take off', () => {
    expect(expenseExclVatCents({ amountCents: 966, vatCents: 0 })).toBe(966)
    expect(expenseExclVatCents({ amountCents: 12100, vatCents: 2100 })).toBe(10000)
  })
})

describe('expense input', () => {
  const cost = { kind: 'cost', spentOn: '2026-10-01', description: 'Lichtset', category: 'huur', amountCents: 12100, vatCents: 2100 }
  const trip = { kind: 'mileage', spentOn: '2026-10-01', kilometers: 42, kmRateCents: 23 }

  it('accepts a cost and a trip', () => {
    expect(expenseInputSchema.safeParse(cost).success).toBe(true)
    expect(expenseInputSchema.parse(trip)).toMatchObject({ kind: 'mileage', description: '', gigId: null })
  })

  it('does not allow more VAT than the total', () => {
    expect(costInputSchema.safeParse({ ...cost, vatCents: 13000 }).success).toBe(false)
  })

  it('needs a description for a cost and kilometres for a trip', () => {
    expect(costInputSchema.safeParse({ ...cost, description: ' ' }).success).toBe(false)
    expect(mileageInputSchema.safeParse({ ...trip, kilometers: 0 }).success).toBe(false)
    expect(mileageInputSchema.safeParse({ ...trip, kilometers: 6000 }).success).toBe(false)
  })

  it('refuses an unknown category and a bad date', () => {
    expect(costInputSchema.safeParse({ ...cost, category: 'sigaretten' }).success).toBe(false)
    expect(costInputSchema.safeParse({ ...cost, spentOn: '1 oktober' }).success).toBe(false)
  })
})

const invoices = [
  { issueDate: '2026-01-15', subtotalCents: 100000, vatAmountCents: 21000, totalCents: 121000, paymentStatus: 'paid' },
  { issueDate: '2026-01-28', subtotalCents: 50000, vatAmountCents: 10500, totalCents: 60500, paymentStatus: 'unpaid' },
  { issueDate: '2026-03-02', subtotalCents: 80000, vatAmountCents: 16800, totalCents: 96800, paymentStatus: 'pending' },
  { issueDate: '2025-12-31', subtotalCents: 99999, vatAmountCents: 0, totalCents: 99999, paymentStatus: 'paid' },
]
const expenses = [
  { kind: 'cost', spentOn: '2026-01-10', category: 'huur', amountCents: 12100, vatCents: 2100, kilometers: null },
  { kind: 'cost', spentOn: '2026-03-05', category: 'materiaal', amountCents: 3000, vatCents: 0, kilometers: null },
  { kind: 'mileage', spentOn: '2026-03-06', category: 'kilometers', amountCents: 966, vatCents: 0, kilometers: '42.0' },
  { kind: 'mileage', spentOn: '2026-03-20', category: 'kilometers', amountCents: 230, vatCents: 0, kilometers: 10 },
  { kind: 'cost', spentOn: '2027-01-01', category: 'overig', amountCents: 9999, vatCents: 0, kilometers: null },
]

describe('finance report', () => {
  const report = buildFinanceReport(2026, invoices, expenses)

  it('has twelve months', () => {
    expect(report.months).toHaveLength(12)
    expect(report.months[0]!.month).toBe('2026-01')
  })

  it('books revenue by invoice month, excl. VAT, and splits paid from open incl. VAT', () => {
    expect(report.months[0]).toMatchObject({ revenueCents: 150000, vatOnRevenueCents: 31500, paidCents: 121000, openCents: 60500 })
    expect(report.months[2]).toMatchObject({ revenueCents: 80000, openCents: 96800 })
  })

  it('books costs excl. VAT and keeps mileage apart', () => {
    expect(report.months[0]).toMatchObject({ costCents: 10000, mileageCents: 0 })
    expect(report.months[2]).toMatchObject({ costCents: 3000, mileageCents: 1196, kilometers: 52 })
  })

  it('works out the result per month and in total', () => {
    expect(report.months[0]!.resultCents).toBe(140000)
    expect(report.months[2]!.resultCents).toBe(80000 - 3000 - 1196)
    expect(report.totals).toMatchObject({ revenueCents: 230000, costCents: 13000, mileageCents: 1196, kilometers: 52, resultCents: 230000 - 13000 - 1196, paidCents: 121000, openCents: 157300 })
  })

  it('leaves out other years', () => {
    expect(report.totals.revenueCents).toBe(230000)
    expect(report.totals.costCents).toBe(13000)
  })

  it('lists categories largest first, with mileage as its own', () => {
    expect(report.categories).toEqual([
      { category: 'huur', cents: 10000 },
      { category: 'materiaal', cents: 3000 },
      { category: 'kilometers', cents: 1196 },
    ].sort((a, b) => b.cents - a.cents))
  })

  it('is all zeros for an empty year', () => {
    const empty = buildFinanceReport(2030, [], [])
    expect(empty.totals).toMatchObject({ revenueCents: 0, resultCents: 0, kilometers: 0 })
    expect(empty.categories).toEqual([])
  })
})

describe('gig result', () => {
  it('subtracts the costs of the gig from its revenue, both excl. VAT', () => {
    expect(gigResultCents([{ subtotalCents: 100000 }, { subtotalCents: 20000 }], [{ amountCents: 12100, vatCents: 2100 }, { amountCents: 966, vatCents: 0 }]))
      .toEqual({ revenueCents: 120000, costCents: 10966, resultCents: 109034 })
  })

  it('can be negative', () => {
    expect(gigResultCents([], [{ amountCents: 5000, vatCents: 0 }]).resultCents).toBe(-5000)
  })
})

describe('csv', () => {
  it('formats money with a decimal comma', () => {
    expect(csvMoney(12345)).toBe('123,45')
    expect(csvMoney(5)).toBe('0,05')
    expect(csvMoney(0)).toBe('0,00')
    expect(csvMoney(-250)).toBe('-2,50')
  })

  it('quotes cells with separators and escapes quotes', () => {
    expect(csvText('a;b')).toBe('"a;b"')
    expect(csvText('zeg "hoi"')).toBe('"zeg ""hoi"""')
    expect(csvText('twee\nregels')).toBe('twee regels')
  })

  it('neutralises spreadsheet formulas', () => {
    for (const evil of ['=HYPERLINK("http://x")', '+1+1', '-2+3', '@SUM(A1)']) expect(csvText(evil).replace(/^"/, '').startsWith("'"), evil).toBe(true)
  })

  const csv = buildFinanceCsv(
    [{ ...invoices[0]!, invoiceNumber: 'NL-2026-0001', gigTitle: 'Bruiloft', clientName: '=cmd|"/c calc"', status: 'finalized' }],
    [
      { ...expenses[0]!, id: 'e1', description: 'Huur lichtset; 2 dagen', gigTitle: 'Bruiloft', kmRateCents: null },
      { ...expenses[2]!, id: 'e2', description: 'Kilometers', gigTitle: null, kmRateCents: 23 },
    ],
  )

  it('starts with a byte order mark and uses semicolons and CRLF', () => {
    expect(csv.startsWith('﻿Soort;Datum;Nummer')).toBe(true)
    expect(csv.split('\r\n')).toHaveLength(5)
  })

  it('has one line per invoice or cost, sorted by date', () => {
    const lines = csv.split('\r\n').slice(1, 4)
    expect(lines[0]).toContain('Kosten;2026-01-10')
    expect(lines[1]).toContain('Omzet;2026-01-15;NL-2026-0001')
    expect(lines[2]).toContain('Kilometers;2026-03-06')
  })

  it('writes excl. VAT, VAT and incl. VAT per line', () => {
    expect(csv).toContain(';1000,00;210,00;1210,00;Betaald')
    expect(csv).toContain(';100,00;21,00;121,00;')
  })

  it('describes a trip with its kilometres and rate, and is safe against formulas', () => {
    expect(csv).toContain('Kilometers · 42.0 km à 0,23'.replace('42.0', '42,0'))
    expect(csv).toContain("'=cmd")
    expect(csv).toContain('"Huur lichtset; 2 dagen"')
  })
})
