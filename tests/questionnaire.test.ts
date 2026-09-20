import { describe, expect, it } from 'vitest'
import { isValidSpotifyUrl, questionnaireTemplateInputSchema, validateQuestionnaireAnswers } from '../shared/questionnaire'

describe('questionnaire validation', () => {
  const fields = [
    { id: 'email', type: 'email' as const, label: 'Email', required: true },
    { id: 'guests', type: 'number' as const, label: 'Guests', required: false },
    { id: 'style', type: 'select' as const, label: 'Style', required: true, options: ['Club', 'Wedding'] },
    { id: 'terms', type: 'acknowledgement' as const, label: 'Terms', required: true },
  ]

  it('accepts a complete answer set', () => {
    expect(validateQuestionnaireAnswers(fields, { email: 'client@example.com', guests: 120, style: 'Club', terms: true })).toEqual({})
  })

  it('reports required and type-specific errors', () => {
    const errors = validateQuestionnaireAnswers(fields, { email: 'wrong', guests: 'many', style: 'Other', terms: false })
    expect(errors).toMatchObject({ email: expect.any(String), guests: expect.any(String), style: expect.any(String), terms: expect.any(String) })
  })

  it('requires unique stable field ids and options for selects', () => {
    const result = questionnaireTemplateInputSchema.safeParse({ name: 'Template', fields: [
      { id: 'choice', type: 'select', label: 'Choice', required: false, options: [] },
      { id: 'choice', type: 'short_text', label: 'Duplicate', required: false },
    ] })
    expect(result.success).toBe(false)
  })
})

describe('Spotify URL validation', () => {
  it('accepts Spotify tracks and playlists', () => {
    expect(isValidSpotifyUrl('https://open.spotify.com/track/123')).toBe(true)
    expect(isValidSpotifyUrl('https://open.spotify.com/playlist/abc?si=123')).toBe(true)
  })

  it('rejects other hosts and unsupported Spotify pages', () => {
    expect(isValidSpotifyUrl('https://example.com/track/123')).toBe(false)
    expect(isValidSpotifyUrl('https://open.spotify.com/artist/123')).toBe(false)
  })
})
