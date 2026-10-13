import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderBrandedEmailHtml } from '../shared/email-automation'
import {
  isOwnerNotificationKind,
  ownerNotificationKinds,
  ownerNotificationMessage,
  ownerNotificationSample,
  ownerNotificationSettingsSchema,
} from '../shared/owner-notifications'
import { businessSettingsInputSchema } from '../shared/invoice'

const siteUrl = 'https://djnightlight.nl'

describe('owner notification messages', () => {
  it('describes a new inquiry with a link to the gig', () => {
    const message = ownerNotificationMessage('new_inquiry', { gigId: 'abc', name: 'Sanne', company: 'Bakkerij', eventDate: '2027-06-12', eventType: 'Bruiloft', email: 's@example.com', phone: '0612' }, siteUrl)
    expect(message.subject).toBe('Nieuwe aanvraag van Sanne')
    expect(message.text).toContain('Sanne (Bakkerij)')
    expect(message.text).toContain('12 juni 2027')
    expect(message.variables).toMatchObject({ contact: 's@example.com · 0612', adminUrl: 'https://djnightlight.nl/admin/gigs/abc' })
  })

  it('reports a paid invoice with the amount', () => {
    const message = ownerNotificationMessage('invoice_paid', { invoiceId: 'inv1', invoiceNumber: 'NL-1', amountCents: 125000, currency: 'EUR' }, siteUrl)
    expect(message.subject).toContain('NL-1')
    expect(message.subject).toMatch(/1\.250,00/)
    expect(message.variables.adminUrl).toBe('https://djnightlight.nl/admin/invoices/inv1')
  })

  it('reports a submitted portal with the number of wishes', () => {
    const message = ownerNotificationMessage('portal_submitted', { gigId: 'g1', gigTitle: 'Bruiloft Jansen', acceptedName: 'Piet', wishCount: 1 }, siteUrl)
    expect(message.subject).toBe('Klantportaal ingevuld: Bruiloft Jansen')
    expect(message.text).toContain('1 muziekwens')
    expect(ownerNotificationMessage('portal_submitted', { gigId: 'g1', wishCount: 3 }, siteUrl).text).toContain('3 muziekwensen')
  })

  it('keeps visitor input on one line in the subject', () => {
    const message = ownerNotificationMessage('new_inquiry', { gigId: 'x', name: 'Eva\r\nBcc: boos@example.com' }, siteUrl)
    expect(message.subject).not.toMatch(/[\r\n]/)
  })

  it('renders every kind as a branded email with its button', () => {
    for (const kind of ownerNotificationKinds) {
      const message = ownerNotificationMessage(kind, ownerNotificationSample(kind), siteUrl)
      const html = renderBrandedEmailHtml(message.templateKey, message.text, message.variables, { siteUrl })
      expect(html).toContain('href="https://djnightlight.nl/admin/')
      expect(html).not.toContain('Een bericht van NightLight')
    }
  })

  it('escapes visitor input in the html', () => {
    const message = ownerNotificationMessage('new_inquiry', { gigId: 'x', name: '<script>alert(1)</script>' }, siteUrl)
    expect(renderBrandedEmailHtml(message.templateKey, message.text, message.variables, { siteUrl })).not.toContain('<script>alert(1)')
  })
})

describe('owner notification settings', () => {
  it('knows the kinds', () => {
    expect(isOwnerNotificationKind('new_inquiry')).toBe(true)
    expect(isOwnerNotificationKind('nope')).toBe(false)
  })

  it('accepts an empty address and rejects an invalid one', () => {
    expect(ownerNotificationSettingsSchema.safeParse({ ownerNotificationEmail: '', ownerNotificationKinds: [] }).success).toBe(true)
    expect(ownerNotificationSettingsSchema.safeParse({ ownerNotificationEmail: 'geen-mail', ownerNotificationKinds: [] }).success).toBe(false)
    expect(ownerNotificationSettingsSchema.safeParse({ ownerNotificationEmail: 'a@b.nl', ownerNotificationKinds: ['onbekend'] }).success).toBe(false)
  })

  it('stays optional in the business settings so older clients keep working', () => {
    const base = {
      companyName: 'NightLight', address: '', postalCode: '', city: '', country: 'Nederland', email: '', phone: '', registrationNumber: '', vatNumber: '', iban: '',
      invoicePrefix: 'NL', defaultVatMode: 'exclusive', defaultVatRateBasisPoints: 2100, defaultPaymentTermDays: 30, paymentTerms: '', legalText: '',
    }
    const parsed = businessSettingsInputSchema.parse(base)
    expect(parsed).not.toHaveProperty('ownerNotificationEmail')
    expect(businessSettingsInputSchema.parse({ ...base, ownerNotificationEmail: 'a@b.nl', ownerNotificationKinds: ['new_inquiry'] })).toMatchObject({ ownerNotificationEmail: 'a@b.nl' })
  })
})

// --- delivery ----------------------------------------------------------------------------

type Row = { id: string, type: string, dedupeKey: string, occurredAt: Date, processedAt: Date | null, payload: Record<string, unknown> }
let rows: Row[] = []
let settingsRow: { email: string, kinds: string[] } | undefined
const sent: Array<Record<string, unknown>> = []
let sendFails = false

vi.mock('../server/utils/db', () => {
  const select = (fields?: unknown) => ({
    from: () => ({
      where: () => {
        if (fields && 'email' in (fields as object)) return { limit: async () => (settingsRow ? [settingsRow] : []) }
        return { orderBy: () => ({ limit: async () => rows.filter(row => !row.processedAt) }) }
      },
    }),
  })
  const update = () => ({
    set: (values: Partial<Row>) => ({
      where: async () => {
        // The tests only ever have one pending row per update, matched by being unprocessed and not yet updated.
        const target = rows.find(row => !row.processedAt && row.payload !== values.payload)
        if (target) Object.assign(target, values)
      },
    }),
  })
  return { db: { select, update, insert: () => ({ values: () => ({ onConflictDoNothing: async () => undefined }) }) }, sql: vi.fn() }
})
vi.mock('../server/utils/email-branding', () => ({ loadEmailBranding: async () => ({ siteUrl }) }))
vi.mock('../server/utils/email-provider', () => ({
  sendEmail: async (input: Record<string, unknown>) => {
    if (sendFails) throw new Error('provider down')
    sent.push(input)
    return { id: 'x' }
  },
}))

const { consumeOwnerNotifications } = await import('../server/utils/owner-notifications')

function event(overrides: Partial<Row['payload']> = {}): Row {
  return { id: 'e1', type: 'owner_notification', dedupeKey: 'owner:new_inquiry:g1', occurredAt: new Date(), processedAt: null, payload: { kind: 'new_inquiry', gigId: 'g1', name: 'Sanne', ...overrides } }
}

describe('owner notification delivery', () => {
  beforeEach(() => {
    sent.length = 0
    sendFails = false
    settingsRow = { email: 'owner@example.com', kinds: ['new_inquiry', 'invoice_paid', 'portal_submitted'] }
    rows = [event()]
  })

  it('sends the mail once and marks the event processed', async () => {
    expect(await consumeOwnerNotifications()).toBe(1)
    expect(sent).toHaveLength(1)
    expect(sent[0]).toMatchObject({ to: 'owner@example.com', subject: 'Nieuwe aanvraag van Sanne', idempotencyKey: 'owner:new_inquiry:g1' })
    expect(rows[0]!.processedAt).toBeInstanceOf(Date)
    expect(await consumeOwnerNotifications()).toBe(0)
    expect(sent).toHaveLength(1)
  })

  it('skips quietly when no address is set', async () => {
    settingsRow = { email: '', kinds: ['new_inquiry'] }
    await consumeOwnerNotifications()
    expect(sent).toHaveLength(0)
    expect(rows[0]).toMatchObject({ payload: { skipped: true } })
    expect(rows[0]!.processedAt).toBeInstanceOf(Date)
  })

  it('skips a kind that is switched off', async () => {
    settingsRow = { email: 'owner@example.com', kinds: ['invoice_paid'] }
    await consumeOwnerNotifications()
    expect(sent).toHaveLength(0)
    expect(rows[0]!.processedAt).toBeInstanceOf(Date)
  })

  it('keeps a failed event for a retry', async () => {
    sendFails = true
    await consumeOwnerNotifications()
    expect(rows[0]!.processedAt).toBeNull()
    expect(rows[0]!.payload).toMatchObject({ attempts: 1, lastError: 'provider down' })
    expect(Number(rows[0]!.payload.retryAt)).toBeGreaterThan(Date.now())
  })

  it('waits until the retry time', async () => {
    sendFails = true
    rows = [event({ attempts: 1, retryAt: Date.now() + 60_000 })]
    await consumeOwnerNotifications()
    expect(rows[0]!.payload.attempts).toBe(1)
  })

  it('gives up after the last attempt and records why', async () => {
    sendFails = true
    rows = [event({ attempts: 4 })]
    await consumeOwnerNotifications()
    expect(rows[0]!.processedAt).toBeInstanceOf(Date)
    expect(rows[0]!.payload).toMatchObject({ failed: true, attempts: 5, lastError: 'provider down' })
  })
})
