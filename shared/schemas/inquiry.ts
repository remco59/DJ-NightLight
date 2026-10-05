import { z } from 'zod'
import { todayInAmsterdam } from '../dates'

export const inquiryInputSchema = z.object({
  name: z.string().trim()
    .min(2, 'Vul je naam in.')
    .max(200, 'Je naam mag maximaal 200 tekens zijn.'),
  company: z.string().trim().max(200, 'De bedrijfsnaam mag maximaal 200 tekens zijn.').optional().transform(value => value || null),
  email: z.email('Vul een geldig e-mailadres in, bijvoorbeeld naam@voorbeeld.nl.').trim().toLowerCase(),
  phone: z.string().trim().max(64, 'Het telefoonnummer is te lang.').optional().transform(value => value || null),
  eventType: z.string().trim().max(120, 'Houd het soort feest kort (maximaal 120 tekens).').optional().transform(value => value || null),
  eventDate: z.string().trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Kies een geldige datum.')
    .refine(value => value >= todayInAmsterdam(), 'Kies een datum vanaf vandaag.')
    .optional().or(z.literal('')).transform(value => value || null),
  location: z.string().trim().max(300, 'De locatie mag maximaal 300 tekens zijn.').optional().transform(value => value || null),
  message: z.string().trim().max(5000, 'Je bericht mag maximaal 5000 tekens zijn.').optional().transform(value => value || null),
  website: z.string().max(200).optional().default(''),
})

export type InquiryField = keyof z.input<typeof inquiryInputSchema>
