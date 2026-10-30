import { describe, expect, it } from 'vitest'
import { isValidSpotifyUrl, questionnaireTemplateInputSchema, validateQuestionnaireAnswers } from '../shared/questionnaire'

import { bookingFormTemplateFields, bookingFormTemplateKeys, isReadyMadeTemplate, suggestBookingFormTemplate } from '../shared/booking-form-templates'
import { fieldVisible, questionnaireFieldsSchema, visibleFields, type QuestionnaireField } from '../shared/questionnaire'

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

describe('conditional questions', () => {
  const fields: QuestionnaireField[] = [
    { id: 'sound', type: 'select', label: 'Geluid', required: true, options: ['DJ', 'Zelf'] },
    { id: 'brand', type: 'short_text', label: 'Merk', required: true, showIf: { fieldId: 'sound', equals: 'Zelf' } },
    { id: 'brand_note', type: 'short_text', label: 'Toelichting', required: true, showIf: { fieldId: 'brand', equals: 'x' } },
    { id: 'connections', type: 'multi_select', label: 'Aansluitingen', required: false, options: ['XLR', 'RCA'] },
    { id: 'xlr_note', type: 'short_text', label: 'XLR', required: true, showIf: { fieldId: 'connections', equals: 'XLR' } },
  ]

  it('shows a field when the answer matches, also inside a multi choice', () => {
    expect(fieldVisible(fields[1]!, { sound: 'Zelf' })).toBe(true)
    expect(fieldVisible(fields[1]!, { sound: 'DJ' })).toBe(false)
    expect(fieldVisible(fields[4]!, { connections: ['RCA', 'XLR'] })).toBe(true)
    expect(fieldVisible(fields[4]!, { connections: ['RCA'] })).toBe(false)
  })

  it('does not require hidden fields, nor fields that depend on a hidden field', () => {
    expect(validateQuestionnaireAnswers(fields, { sound: 'DJ' })).toEqual({})
    expect(visibleFields(fields, { sound: 'DJ', brand: 'x' }).map(field => field.id)).toEqual(['sound', 'connections'])
  })

  it('requires a field once its condition is met', () => {
    expect(validateQuestionnaireAnswers(fields, { sound: 'Zelf' })).toMatchObject({ brand: expect.any(String) })
    expect(validateQuestionnaireAnswers(fields, { sound: 'Zelf', brand: 'Yamaha' })).toEqual({})
  })

  it('only lets a condition look at an earlier question', () => {
    const later = [
      { id: 'a', type: 'short_text', label: 'A', required: false, showIf: { fieldId: 'b', equals: 'x' } },
      { id: 'b', type: 'short_text', label: 'B', required: false },
    ]
    expect(questionnaireFieldsSchema.safeParse(later).success).toBe(false)
    expect(questionnaireFieldsSchema.safeParse(fields).success).toBe(true)
  })
})

describe('timed list answers', () => {
  const field: QuestionnaireField = { id: 'announce', type: 'timed_list', label: 'Omroepen', required: false }

  it('accepts rows with a time and a text', () => {
    expect(validateQuestionnaireAnswers([field], { announce: [{ time: '21:30', text: 'Taart' }, { time: '', text: 'Bedankt' }] })).toEqual({})
  })

  it('rejects a malformed time or a row that is not a time and text', () => {
    expect(validateQuestionnaireAnswers([field], { announce: [{ time: '9.30', text: 'Taart' }] })).toMatchObject({ announce: expect.any(String) })
    expect(validateQuestionnaireAnswers([field], { announce: ['Taart'] })).toMatchObject({ announce: expect.any(String) })
  })

  it('counts a list of empty rows as unanswered when it is required', () => {
    expect(validateQuestionnaireAnswers([{ ...field, required: true }], { announce: [{ time: '', text: '' }] })).toMatchObject({ announce: expect.any(String) })
  })
})

describe('ready-made booking form templates', () => {
  it('are valid question lists with unique ids', () => {
    for (const key of bookingFormTemplateKeys.filter(isReadyMadeTemplate)) {
      expect(questionnaireFieldsSchema.safeParse(bookingFormTemplateFields(key)).success, key).toBe(true)
    }
  })

  it('give a copy, so changing one gig never changes a template', () => {
    const copy = bookingFormTemplateFields('bruiloft')
    copy[0]!.label = 'Aangepast'
    expect(bookingFormTemplateFields('bruiloft')[0]!.label).not.toBe('Aangepast')
  })

  it('ask for the location requirements from the terms as ticks', () => {
    const ids = bookingFormTemplateFields('verjaardag').map(field => field.id)
    expect(ids).toEqual(expect.arrayContaining(['dj_spot', 'power', 'sound_distance', 'light_provider']))
  })

  it('suggest a template from the event type', () => {
    expect(suggestBookingFormTemplate('Bruiloft')).toBe('bruiloft')
    expect(suggestBookingFormTemplate('Bedrijfsfeest')).toBe('bedrijfsfeest')
    expect(suggestBookingFormTemplate('Verjaardag')).toBe('verjaardag')
    expect(suggestBookingFormTemplate('Clubavond')).toBe('standaard')
    expect(suggestBookingFormTemplate(null)).toBe('standaard')
  })
})
