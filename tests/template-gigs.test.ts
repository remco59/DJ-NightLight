import { describe, expect, it } from 'vitest'
import {
  applyGigDefaults,
  gigFieldKeys,
  gigListProps,
  gigPickerLabel,
  gigTemplateKind,
  gigTemplateProps,
  upcomingGigs,
  type TemplateGig,
} from '../shared/template-gigs'
import { createGraphicItem, timelineItemSchema } from '../shared/video-project'
import { MOTION_TEMPLATES } from '../shared/video-templates'

const now = new Date('2026-09-24T12:00:00Z')

function gig(overrides: Partial<TemplateGig> = {}): TemplateGig {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    title: 'Eredivisie Dames',
    // 22:00 – 03:30 in Amsterdam (CET, UTC+1).
    startsAt: '2026-12-05T21:00:00Z',
    endsAt: '2026-12-06T02:30:00Z',
    venueName: 'Club Nova',
    venueCity: 'Amsterdam',
    publicVisibility: true,
    ...overrides,
  }
}

describe('gig template data', () => {
  it('knows which templates announce gigs', () => {
    expect(gigTemplateKind('gig-announcement')).toBe('single')
    expect(gigTemplateKind('electric-gig-poster')).toBe('single')
    expect(gigTemplateKind('upcoming-gigs')).toBe('list')
    expect(gigTemplateKind('lower-third')).toBeNull()
  })

  it('fills the Gig Announcement in Dutch, in Amsterdam time', () => {
    expect(gigTemplateProps('gig-announcement', gig())).toEqual({
      venue: 'CLUB NOVA',
      date: 'ZAT 5 DEC',
      time: '22:00 - 03:30',
      location: 'Amsterdam',
    })
  })

  it('follows summer time', () => {
    const props = gigTemplateProps('gig-announcement', gig({ startsAt: '2026-07-04T20:00:00Z', endsAt: null }))
    expect(props.date).toBe('ZAT 4 JUL')
    expect(props.time).toBe('22:00')
  })

  it('fills the Electric Gig Poster without repeating the city', () => {
    expect(gigTemplateProps('electric-gig-poster', gig())).toEqual({
      day: '5',
      month: 'DEC',
      venue: 'CLUB NOVA · AMSTERDAM',
      time: '22:00 – 03:30',
    })
    expect(gigTemplateProps('electric-gig-poster', gig({ venueName: 'Paradiso Amsterdam' })).venue).toBe('PARADISO AMSTERDAM')
  })

  it('falls back to the gig title without a venue', () => {
    const props = gigTemplateProps('gig-announcement', gig({ venueName: null, venueCity: null }))
    expect(props.venue).toBe('EREDIVISIE DAMES')
    expect(props.location).toBe('')
  })

  it('keeps values within the field limits', () => {
    const props = gigTemplateProps('gig-announcement', gig({ venueName: 'X'.repeat(200) }))
    expect(String(props.venue).length).toBe(MOTION_TEMPLATES['gig-announcement'].fields.find(field => field.key === 'venue')!.maxLength)
  })

  it('only overwrites the gig fields', () => {
    const keys = gigFieldKeys('gig-announcement')
    expect(Object.keys(gigTemplateProps('gig-announcement', gig())).sort()).toEqual([...keys].sort())
    expect(keys).not.toContain('headline')
    expect(Object.keys(gigTemplateProps('electric-gig-poster', gig())).sort()).toEqual([...gigFieldKeys('electric-gig-poster')].sort())
  })

  it('builds Upcoming Gigs rows, at most as many as the template shows', () => {
    const gigs = Array.from({ length: 8 }, (_, index) => gig({ id: `g${index}` }))
    const rows = gigListProps(gigs).gigs as string[]
    expect(rows).toHaveLength(6)
    expect(rows[0]).toBe('05 DEC | Eredivisie Dames | Amsterdam')
  })

  it('labels gigs in the picker and marks private ones', () => {
    expect(gigPickerLabel(gig())).toBe('ZAT 05 DEC · Eredivisie Dames · Club Nova, Amsterdam')
    expect(gigPickerLabel(gig({ publicVisibility: false }))).toMatch(/\(not public\)$/)
  })

  it('skips gigs that have ended', () => {
    const past = gig({ id: 'past', startsAt: '2026-09-20T20:00:00Z', endsAt: '2026-09-21T01:00:00Z' })
    const tonight = gig({ id: 'tonight', startsAt: '2026-09-24T10:00:00Z', endsAt: '2026-09-24T23:00:00Z' })
    expect(upcomingGigs([past, tonight, gig()], now).map(entry => entry.id)).toEqual(['tonight', gig().id])
  })
})

describe('gig defaults for new templates', () => {
  it('links a new announcement to the next gig', () => {
    const next = gig()
    const later = gig({ id: '22222222-2222-4222-8222-222222222222', startsAt: '2026-12-20T21:00:00Z' })
    const item = applyGigDefaults(createGraphicItem('gig-announcement', 0, 30), [next, later], now)
    expect(item.gigId).toBe(next.id)
    expect(item.templateProps.date).toBe('ZAT 5 DEC')
    expect(item.templateProps.headline).toBe(MOTION_TEMPLATES['gig-announcement'].defaults.headline)
    expect(timelineItemSchema.parse(item)).toMatchObject({ gigId: next.id })
  })

  it('fills the Upcoming Gigs list without a link', () => {
    const item = applyGigDefaults(createGraphicItem('upcoming-gigs', 0, 30), [gig()], now)
    expect(item.gigId).toBeUndefined()
    expect(item.templateProps.gigs).toEqual(['05 DEC | Eredivisie Dames | Amsterdam'])
  })

  it('keeps the template defaults without upcoming gigs or for other templates', () => {
    const announcement = applyGigDefaults(createGraphicItem('gig-announcement', 0, 30), [], now)
    expect(announcement.gigId).toBeUndefined()
    expect(announcement.templateProps).toEqual(MOTION_TEMPLATES['gig-announcement'].defaults)
    const title = applyGigDefaults(createGraphicItem('lower-third', 0, 30), [gig()], now)
    expect(title.templateProps).toEqual(MOTION_TEMPLATES['lower-third'].defaults)
  })
})
