import { describe, expect, it } from 'vitest'
import { gigDisplayTitle, publicGigTitle } from '../shared/gig-title'
import { gigInputSchema } from '../shared/schemas/gig'

describe('gig titles', () => {
  it('uses the title when there is one', () => {
    expect(gigDisplayTitle({ title: 'Bruiloft Jansen', venueName: 'Het Portiertje', eventType: 'Wedding' })).toBe('Bruiloft Jansen')
  })

  it('falls back to the venue, then the event type', () => {
    expect(gigDisplayTitle({ title: null, venueName: 'Het Portiertje', eventType: 'Club night' })).toBe('Het Portiertje')
    expect(gigDisplayTitle({ title: '  ', venueName: null, eventType: 'Club night' })).toBe('Club night')
    expect(gigDisplayTitle({ title: null, venueName: null, eventType: null })).toBe('Gig')
  })

  it('prefers the public title on the public site, then the display title', () => {
    expect(publicGigTitle({ publicTitle: 'Kerstborrel', title: 'Bedrijfsfeest', venueName: 'Het Portiertje' })).toBe('Kerstborrel')
    expect(publicGigTitle({ publicTitle: null, title: 'Bedrijfsfeest', venueName: 'Het Portiertje' })).toBe('Bedrijfsfeest')
    expect(publicGigTitle({ publicTitle: ' ', title: null, venueName: 'Het Portiertje' })).toBe('Het Portiertje')
    expect(publicGigTitle({ publicTitle: null, title: null, venueName: null, eventType: 'Club night' })).toBe('Club night')
  })

  it('accepts a gig without a title', () => {
    const input = gigInputSchema.parse({ title: '', status: 'booked', currency: 'eur', publicVisibility: false })
    expect(input.title).toBeNull()
  })
})
