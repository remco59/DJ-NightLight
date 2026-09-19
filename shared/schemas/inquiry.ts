import { z } from 'zod'

export const inquiryInputSchema = z.object({
  name: z.string().trim().min(2).max(200),
  company: z.string().trim().max(200).optional().transform(value => value || null),
  email: z.email().trim().toLowerCase(),
  phone: z.string().trim().max(64).optional().transform(value => value || null),
  eventType: z.string().trim().max(120).optional().transform(value => value || null),
  eventDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')).transform(value => value || null),
  location: z.string().trim().max(300).optional().transform(value => value || null),
  message: z.string().trim().max(5000).optional().transform(value => value || null),
  website: z.string().max(200).optional().default(''),
})
