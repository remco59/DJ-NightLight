import { z } from 'zod'

export const vatModes = ['exclusive', 'inclusive', 'exempt'] as const
export type VatMode = typeof vatModes[number]
export type InvoiceLineInput = { description: string, quantity: string, unitPriceCents: number }
export type InvoiceTotals = { subtotalCents: number, vatAmountCents: number, totalCents: number }
export type InvoiceSnapshot = {
  invoiceNumber: string
  issueDate: string
  dueDate: string
  serviceDate?: string
  currency: string
  vatMode: VatMode
  vatRateBasisPoints: number
  business: { companyName: string, address: string, postalCode: string, city: string, country: string, email: string, phone: string, registrationNumber: string, vatNumber: string, iban: string }
  client: { name: string, email: string, billingAddress: string }
  lines: Array<InvoiceLineInput & { totalCents: number }>
  totals: InvoiceTotals
  paymentTerms: string
  legalText: string
  notes: string
}

const quantityPattern = /^\d{1,9}(?:\.\d{1,3})?$/
export function quantityThousandths(quantity: string) {
  if (!quantityPattern.test(quantity)) throw new Error('Quantity must be a positive number with at most three decimals')
  const [whole = '0', fraction = ''] = quantity.split('.')
  const result = Number(whole) * 1000 + Number(fraction.padEnd(3, '0'))
  if (!Number.isSafeInteger(result) || result <= 0) throw new Error('Quantity must be greater than zero')
  return result
}

export function calculateLineTotalCents(line: InvoiceLineInput) {
  if (!Number.isSafeInteger(line.unitPriceCents) || line.unitPriceCents < 0) throw new Error('Unit price must be a non-negative cent amount')
  return Math.round(line.unitPriceCents * quantityThousandths(line.quantity) / 1000)
}

export function calculateInvoiceTotals(lines: InvoiceLineInput[], vatMode: VatMode, vatRateBasisPoints: number): InvoiceTotals {
  if (!Number.isInteger(vatRateBasisPoints) || vatRateBasisPoints < 0 || vatRateBasisPoints > 10000) throw new Error('VAT rate must be between 0 and 100%')
  const lineTotal = lines.reduce((sum, line) => sum + calculateLineTotalCents(line), 0)
  if (!Number.isSafeInteger(lineTotal)) throw new Error('Invoice total is too large')
  if (vatMode === 'exempt' || vatRateBasisPoints === 0) return { subtotalCents: lineTotal, vatAmountCents: 0, totalCents: lineTotal }
  if (vatMode === 'inclusive') {
    const subtotalCents = Math.round(lineTotal * 10000 / (10000 + vatRateBasisPoints))
    return { subtotalCents, vatAmountCents: lineTotal - subtotalCents, totalCents: lineTotal }
  }
  const vatAmountCents = Math.round(lineTotal * vatRateBasisPoints / 10000)
  return { subtotalCents: lineTotal, vatAmountCents, totalCents: lineTotal + vatAmountCents }
}

export function formatInvoiceNumber(prefix: string, year: number, sequence: number) {
  const safePrefix = prefix.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 16) || 'INV'
  return `${safePrefix}-${year}-${String(sequence).padStart(4, '0')}`
}

export const invoiceLineInputSchema = z.object({
  description: z.string().trim().min(1).max(500),
  quantity: z.string().trim().regex(quantityPattern),
  unitPriceCents: z.number().int().min(0).max(100_000_000),
})

export const invoiceDraftInputSchema = z.object({
  issueDate: z.iso.date(),
  dueDate: z.iso.date(),
  currency: z.string().trim().length(3).transform(value => value.toUpperCase()),
  vatMode: z.enum(vatModes),
  vatRateBasisPoints: z.number().int().min(0).max(10000),
  paymentTerms: z.string().trim().max(5000),
  legalText: z.string().trim().max(5000),
  notes: z.string().trim().max(5000),
  lines: z.array(invoiceLineInputSchema).min(1).max(100),
}).refine(value => value.dueDate >= value.issueDate, { path: ['dueDate'], message: 'Due date cannot be before issue date' })

export const businessSettingsInputSchema = z.object({
  companyName: z.string().trim().min(1).max(240),
  address: z.string().trim().max(500),
  postalCode: z.string().trim().max(32),
  city: z.string().trim().max(160),
  country: z.string().trim().max(120),
  email: z.union([z.literal(''), z.email()]),
  phone: z.string().trim().max(64),
  registrationNumber: z.string().trim().max(80),
  vatNumber: z.string().trim().max(80),
  iban: z.string().trim().max(64),
  invoicePrefix: z.string().trim().min(1).max(16),
  defaultVatMode: z.enum(vatModes),
  defaultVatRateBasisPoints: z.number().int().min(0).max(10000),
  defaultPaymentTermDays: z.number().int().min(0).max(365),
  paymentTerms: z.string().trim().max(5000),
  legalText: z.string().trim().max(5000),
})
