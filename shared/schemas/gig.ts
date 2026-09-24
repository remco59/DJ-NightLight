import { z } from 'zod'
import { gigStatuses } from '../gig-rules'

const optionalText = (max: number) => z.string().trim().max(max).optional().transform(value => value || null)
const optionalId = z.union([z.uuid(), z.literal(''), z.null()]).optional().transform(value => value || null)
const optionalDate = z.union([z.string(), z.null()]).optional().transform((value, ctx) => {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    ctx.addIssue({ code: 'custom', message: 'Invalid date or time' })
    return z.NEVER
  }
  return date
})
const optionalEmail = z.string().trim().max(320).optional().transform((value, ctx) => {
  if (!value) return null
  const parsed = z.email().safeParse(value)
  if (!parsed.success) {
    ctx.addIssue({ code: 'custom', message: 'Invalid email address' })
    return z.NEVER
  }
  return parsed.data.toLowerCase()
})

export const gigContactInputSchema = z.object({
  name: z.string().trim().min(1).max(200),
  role: optionalText(160),
  email: optionalEmail,
  phone: optionalText(64),
  notes: optionalText(2000),
})

export const gigTimelineInputSchema = z.object({
  time: optionalText(16),
  title: z.string().trim().min(1).max(240),
  description: optionalText(2000),
})

export const gigInputSchema = z.object({
  title: optionalText(240),
  eventType: optionalText(120),
  clientId: optionalId,
  venueId: optionalId,
  assignedUserId: optionalId,
  status: z.enum(gigStatuses),
  startsAt: optionalDate,
  endsAt: optionalDate,
  loadInAt: optionalDate,
  fee: z.union([
    z.string().trim().regex(/^\d+(?:\.\d{1,2})?$/),
    z.literal(''),
    z.null(),
  ]).optional().transform(value => value || null),
  currency: z.string().trim().length(3).transform(value => value.toUpperCase()),
  publicVisibility: z.boolean(),
  publicTitle: optionalText(240),
  publicDescription: optionalText(5000),
  internalNotes: optionalText(10000),
  source: optionalText(160),
  contacts: z.array(gigContactInputSchema).max(50).default([]),
  timeline: z.array(gigTimelineInputSchema).max(100).default([]),
}).superRefine((value, ctx) => {
  if (value.startsAt && value.endsAt && value.endsAt < value.startsAt) {
    ctx.addIssue({ code: 'custom', path: ['endsAt'], message: 'End time must be after start time' })
  }
})

export type GigInput = z.infer<typeof gigInputSchema>
