import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ownerNotificationMessage } from '../shared/owner-notifications'

type Lead = { id: string, title: string, createdAt: Date, startsAt: Date | null, lastContactedAt: Date | null, followUpAt: Date | null }
const now = new Date('2026-11-10T12:00:00.000Z')
const hoursAgo = (hours: number) => new Date(now.getTime() - hours * 3600_000)

let leads: Lead[] = []
let settings: { email: string, kinds: string[] } | undefined
const inserted: Array<{ dedupeKey: string, payload: Record<string, unknown> }> = []

vi.mock('../server/utils/db', () => ({
  db: {
    select: (fields?: object) => ({
      from: () => ({
        where: (..._args: unknown[]) => fields && 'email' in fields
          ? { limit: async () => (settings ? [settings] : []) }
          // The immediate delivery attempt reads pending outbox rows; there are none in this test.
          : { limit: async () => leads, orderBy: () => ({ limit: async () => [] }) },
      }),
    }),
    insert: () => ({
      values: (row: { dedupeKey: string, payload: Record<string, unknown> }) => ({
        onConflictDoNothing: () => ({
          returning: async () => {
            if (inserted.some(item => item.dedupeKey === row.dedupeKey)) return []
            inserted.push(row)
            return [{ id: row.dedupeKey }]
          },
        }),
      }),
    }),
  },
  sql: vi.fn(),
}))
vi.mock('../server/utils/email-branding', () => ({ loadEmailBranding: async () => ({ siteUrl: 'https://djnightlight.nl' }) }))
vi.mock('../server/utils/email-provider', () => ({ sendEmail: async () => ({ id: 'x' }) }))
// Delivery is covered elsewhere; here only the queueing matters.
vi.mock('../server/utils/gig-title', () => ({ gigTitleSql: () => 'title' }))

const { queueDueLeadReminders } = await import('../server/utils/owner-notifications')

const lead = (overrides: Partial<Lead> = {}): Lead => ({ id: 'g1', title: 'Bruiloft — Sanne', createdAt: hoursAgo(30), startsAt: null, lastContactedAt: null, followUpAt: null, ...overrides })

describe('lead reminders', () => {
  beforeEach(() => {
    inserted.length = 0
    settings = { email: 'owner@example.com', kinds: ['lead_followup'] }
    leads = [lead()]
  })

  it('reminds about a lead that has not been answered after a day', async () => {
    expect(await queueDueLeadReminders(now)).toBe(1)
    expect(inserted[0]!.payload).toMatchObject({ kind: 'lead_followup', gigId: 'g1', state: 'respond' })
  })

  it('reminds only once per lead and moment', async () => {
    await queueDueLeadReminders(now)
    await queueDueLeadReminders(new Date(now.getTime() + 3600_000))
    expect(inserted).toHaveLength(1)
  })

  it('reminds again when a planned follow-up has come', async () => {
    leads = [lead({ lastContactedAt: hoursAgo(80), followUpAt: hoursAgo(1) })]
    await queueDueLeadReminders(now)
    expect(inserted[0]!.payload).toMatchObject({ state: 'follow_up' })
  })

  it('leaves new leads, waiting leads and leads of past events alone', async () => {
    leads = [
      lead({ id: 'new', createdAt: hoursAgo(2) }),
      lead({ id: 'waiting', lastContactedAt: hoursAgo(10), followUpAt: new Date(now.getTime() + 86_400_000) }),
      lead({ id: 'past', startsAt: hoursAgo(5) }),
    ]
    expect(await queueDueLeadReminders(now)).toBe(0)
  })

  it('does not mail about old requests when this is rolled out', async () => {
    leads = [lead({ createdAt: new Date(now.getTime() - 40 * 86_400_000) })]
    expect(await queueDueLeadReminders(now)).toBe(0)
  })

  it('does nothing without an address or with the kind switched off', async () => {
    settings = { email: '', kinds: ['lead_followup'] }
    expect(await queueDueLeadReminders(now)).toBe(0)
    settings = { email: 'owner@example.com', kinds: ['new_inquiry'] }
    expect(await queueDueLeadReminders(now)).toBe(0)
    expect(inserted).toHaveLength(0)
  })
})

describe('lead reminder message', () => {
  it('asks for a reaction or a follow-up, depending on the state', () => {
    const respond = ownerNotificationMessage('lead_followup', { gigId: 'g1', gigTitle: 'Bruiloft — Sanne', state: 'respond', receivedOn: '2026-11-09' }, 'https://djnightlight.nl')
    expect(respond.subject).toBe('Nog niet gereageerd: Bruiloft — Sanne')
    expect(respond.text).toContain('9 november 2026')
    const followUp = ownerNotificationMessage('lead_followup', { gigId: 'g1', gigTitle: 'Bruiloft — Sanne', state: 'follow_up' }, 'https://djnightlight.nl')
    expect(followUp.subject).toBe('Lead opvolgen: Bruiloft — Sanne')
    expect(followUp.variables.adminUrl).toBe('https://djnightlight.nl/admin/gigs/g1')
  })
})
