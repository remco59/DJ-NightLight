import { z } from 'zod'

const optionalText = (max: number) => z.string().trim().max(max).optional().transform(value => value || null)

export const venueInputSchema = z.object({
  name: z.string().trim().min(1).max(240),
  address: optionalText(1000),
  city: optionalText(160),
  contactName: optionalText(200),
  contactEmail: z.string().trim().max(320).optional().transform((value, ctx) => {
    if (!value) return null
    const parsed = z.email().safeParse(value)
    if (!parsed.success) {
      ctx.addIssue({ code: 'custom', message: 'Invalid email address' })
      return z.NEVER
    }
    return parsed.data.toLowerCase()
  }),
  contactPhone: optionalText(64),
  website: z.string().trim().max(1000).optional().transform((value, ctx) => {
    if (!value) return null
    const parsed = z.url().safeParse(value)
    if (!parsed.success) {
      ctx.addIssue({ code: 'custom', message: 'Invalid website URL' })
      return z.NEVER
    }
    return parsed.data
  }),
  parkingNotes: optionalText(3000),
  technicalNotes: optionalText(5000),
  notes: optionalText(5000),
})

export type VenueInput = z.infer<typeof venueInputSchema>
