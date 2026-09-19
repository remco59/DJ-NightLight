import { z } from 'zod'

const optionalText = (max: number) => z.string().trim().max(max).optional().transform(value => value || null)
const optionalEmail = z.string().trim().max(320).optional().transform((value, ctx) => {
  if (!value) return null
  const parsed = z.email().safeParse(value)
  if (!parsed.success) {
    ctx.addIssue({ code: 'custom', message: 'Invalid email address' })
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
}).superRefine((value, ctx) => {
  if (value.type === 'company' && !value.companyName) {
    ctx.addIssue({ code: 'custom', path: ['companyName'], message: 'Company name is required' })
  }
  if (value.type === 'person' && !value.firstName && !value.lastName) {
    ctx.addIssue({ code: 'custom', path: ['firstName'], message: 'Enter a first or last name' })
  }
})

export type ClientInput = z.infer<typeof clientInputSchema>
