import { describe, expect, it } from 'vitest'
import { inquiryInputSchema, todayInAmsterdam } from '../shared/schemas/inquiry'
import { apiFieldErrors } from '../app/utils/api-error'

const valid = { name: 'Remco', email: 'remco@example.test', eventDate: '', website: '' }

describe('booking inquiry validation', () => {
  it('explains problems per field in Dutch', () => {
    const result = inquiryInputSchema.safeParse({ ...valid, name: 'R', email: 'remco@' })
    expect(result.success).toBe(false)
    const messages = Object.fromEntries(result.error!.issues.map(issue => [issue.path[0], issue.message]))
    expect(messages).toEqual({
      name: 'Vul je naam in.',
      email: 'Vul een geldig e-mailadres in, bijvoorbeeld naam@voorbeeld.nl.',
    })
  })

  it('rejects event dates in the past but accepts today', () => {
    const past = inquiryInputSchema.safeParse({ ...valid, eventDate: '2020-01-01' })
    expect(past.success).toBe(false)
    expect(past.error!.issues[0]?.message).toBe('Kies een datum vanaf vandaag.')
    expect(inquiryInputSchema.safeParse({ ...valid, eventDate: todayInAmsterdam() }).success).toBe(true)
  })

  it('uses the Dutch calendar day for "today"', () => {
    // 23:30 UTC on 31 December is already 1 January in Amsterdam.
    expect(todayInAmsterdam(new Date('2026-12-31T23:30:00Z'))).toBe('2027-01-01')
  })
})

describe('apiFieldErrors', () => {
  it('maps a rejected readValidatedBody to the first message per field', () => {
    const error = { data: { statusMessage: 'Validation Error', message: JSON.stringify([
      { path: ['email'], message: 'Ongeldig e-mailadres' },
      { path: ['email'], message: 'Tweede melding' },
      { path: ['name'], message: 'Vul je naam in.' },
    ]) } }
    expect(apiFieldErrors(error)).toEqual({ email: 'Ongeldig e-mailadres', name: 'Vul je naam in.' })
  })

  it('returns nothing for other errors', () => {
    expect(apiFieldErrors({ data: { statusMessage: 'Te veel aanvragen' } })).toEqual({})
    expect(apiFieldErrors(new Error('offline'))).toEqual({})
  })
})
