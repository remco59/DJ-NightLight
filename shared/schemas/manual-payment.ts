import { z } from 'zod'

export const manualPaymentMethods = ['bank_transfer', 'cash', 'other'] as const

export const manualPaymentMethodLabels: Record<(typeof manualPaymentMethods)[number], string> = {
  bank_transfer: 'Overschrijving',
  cash: 'Contant',
  other: 'Anders',
}

export const manualPaymentSchema = z.object({
  paidOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Kies de datum van de betaling.'),
  method: z.enum(manualPaymentMethods, 'Kies hoe er is betaald.'),
  note: z.string().trim().max(500, 'De notitie mag maximaal 500 tekens zijn.').optional().default(''),
  sendConfirmation: z.boolean().default(false),
})
