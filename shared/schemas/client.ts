import { z } from 'zod'

const optionalText = (max: number) => z.string().trim().max(max).optional().transform(value => value || null)
const optionalEmail = z.string().trim().max(320).optional().transform((value, ctx) => {
  if (!value) return null
  const parsed = z.email().safeParse(value)
  if (!parsed.success) {
    ctx.addIssue({ code: 'custom', message: 'Ongeldig e-mailadres' })
    return z.NEVER
  }
  return parsed.data.toLowerCase()
})

export const clientInputSchema = z.object({
  type: z.enum(['person', 'company']),
  firstName: optionalText(120),
  lastName: optionalText(120),
  companyName: optionalText(200),
  email: optionalEmail,
  phone: optionalText(64),
  billingAddress: optionalText(1000),
  notes: optionalText(5000),
  // Template keys that are not sent automatically to this client. Omitted = unchanged.
  emailAutomationDisabled: z.array(z.string().trim().min(1).max(80)).max(100)
    .transform(keys => [...new Set(keys)]).optional(),
}).superRefine((value, ctx) => {
  if (value.type === 'company' && !value.companyName) {
    ctx.addIssue({ code: 'custom', path: ['companyName'], message: 'Bedrijfsnaam is verplicht' })
  }
  if (value.type === 'person' && !value.firstName && !value.lastName) {
    ctx.addIssue({ code: 'custom', path: ['firstName'], message: 'Vul een voor- of achternaam in' })
  }
})

export type ClientInput = z.infer<typeof clientInputSchema>
