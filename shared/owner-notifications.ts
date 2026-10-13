import { z } from 'zod'
import { formatMoney, type EmailVariables } from './email-automation'
import { absoluteUrl } from './seo'

export const ownerNotificationKinds = ['new_inquiry', 'invoice_paid', 'portal_submitted', 'lead_followup'] as const
export type OwnerNotificationKind = typeof ownerNotificationKinds[number]

export const ownerNotificationLabels: Record<OwnerNotificationKind, { label: string, description: string }> = {
  new_inquiry: { label: 'Nieuwe aanvraag', description: 'Iemand stuurt een aanvraag via de website.' },
  invoice_paid: { label: 'Factuur betaald', description: 'Een klant betaalt een factuur via Stripe.' },
  portal_submitted: { label: 'Klantportaal ingevuld', description: 'Een klant dient de gegevens en muziekwensen in.' },
  lead_followup: { label: 'Lead opvolgen', description: 'Een aanvraag wacht op een reactie of moet worden opgevolgd.' },
}

export function isOwnerNotificationKind(value: unknown): value is OwnerNotificationKind {
  return typeof value === 'string' && (ownerNotificationKinds as readonly string[]).includes(value)
}

/** Delivery gives up after this many failed attempts. */
export const OWNER_NOTIFICATION_MAX_ATTEMPTS = 5
export const OWNER_NOTIFICATION_RETRY_MS = 5 * 60_000

export const ownerNotificationSettingsSchema = z.object({
  ownerNotificationEmail: z.union([z.literal(''), z.email()]),
  ownerNotificationKinds: z.array(z.enum(ownerNotificationKinds)).max(ownerNotificationKinds.length),
})

export type OwnerNotificationPayload = Record<string, string | number | null | undefined>

export type OwnerNotificationMessage = {
  /** Key into the branded email presentations, so the mail looks like the other NightLight mails. */
  templateKey: string
  subject: string
  text: string
  variables: EmailVariables
}

/** One line of plain text: no line breaks, so user input can never add header-like lines to a subject. */
function oneLine(value: unknown, max = 120) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max)
}

function dutchDate(value: unknown) {
  const text = oneLine(value, 40)
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(text)
  if (!match) return text
  return new Intl.DateTimeFormat('nl-NL', { dateStyle: 'long', timeZone: 'Europe/Amsterdam' })
    .format(new Date(`${match[1]}-${match[2]}-${match[3]}T12:00:00.000Z`))
}

export function ownerNotificationMessage(kind: OwnerNotificationKind, payload: OwnerNotificationPayload, siteUrl: string): OwnerNotificationMessage {
  if (kind === 'new_inquiry') {
    const name = oneLine(payload.name) || 'Iemand'
    const company = oneLine(payload.company)
    const date = dutchDate(payload.eventDate)
    return {
      templateKey: 'owner_new_inquiry',
      subject: `Nieuwe aanvraag van ${name}`,
      text: `${name}${company ? ` (${company})` : ''} heeft een aanvraag gedaan${date ? ` voor ${date}` : ''}. Bekijk de aanvraag en stuur een reactie.`,
      variables: {
        clientName: name,
        eventType: oneLine(payload.eventType),
        eventDate: date,
        location: oneLine(payload.location),
        contact: [oneLine(payload.email), oneLine(payload.phone)].filter(Boolean).join(' · '),
        adminUrl: absoluteUrl(siteUrl, `/admin/gigs/${oneLine(payload.gigId, 60)}`),
      },
    }
  }

  if (kind === 'invoice_paid') {
    const number = oneLine(payload.invoiceNumber) || 'Factuur'
    const amount = typeof payload.amountCents === 'number' ? formatMoney(payload.amountCents, oneLine(payload.currency, 3) || 'EUR') : ''
    return {
      templateKey: 'owner_invoice_paid',
      subject: `Betaling ontvangen${amount ? `: ${amount}` : ''} (${number})`,
      text: `${number} is betaald${amount ? ` (${amount})` : ''}. Het geld staat bij Stripe klaar voor uitbetaling.`,
      variables: {
        invoiceNumber: number,
        amount,
        adminUrl: absoluteUrl(siteUrl, `/admin/invoices/${oneLine(payload.invoiceId, 60)}`),
      },
    }
  }

  if (kind === 'lead_followup') {
    const title = oneLine(payload.gigTitle) || 'een aanvraag'
    const received = dutchDate(payload.receivedOn)
    const respond = payload.state === 'respond'
    return {
      templateKey: 'owner_lead_followup',
      subject: respond ? `Nog niet gereageerd: ${title}` : `Lead opvolgen: ${title}`,
      text: respond
        ? `De aanvraag ${title}${received ? ` van ${received}` : ''} heeft nog geen reactie gekregen.`
        : `Je wilde ${title} opvolgen. Er is nog geen boeking.`,
      variables: {
        gigTitle: title,
        eventDate: dutchDate(payload.eventDate),
        receivedOn: received,
        adminUrl: absoluteUrl(siteUrl, `/admin/gigs/${oneLine(payload.gigId, 60)}`),
      },
    }
  }

  const title = oneLine(payload.gigTitle) || 'een boeking'
  const wishes = Number(payload.wishCount) || 0
  return {
    templateKey: 'owner_portal_submitted',
    subject: `Klantportaal ingevuld: ${title}`,
    text: `${oneLine(payload.acceptedName) || 'De klant'} heeft de gegevens voor ${title} ingediend${wishes ? ` en ${wishes} ${wishes === 1 ? 'muziekwens' : 'muziekwensen'} toegevoegd` : ''}.`,
    variables: {
      gigTitle: title,
      acceptedName: oneLine(payload.acceptedName),
      wishCount: wishes,
      adminUrl: absoluteUrl(siteUrl, `/admin/gigs/${oneLine(payload.gigId, 60)}`),
    },
  }
}

/** Example data for the "testmelding" button. */
export function ownerNotificationSample(kind: OwnerNotificationKind): OwnerNotificationPayload {
  if (kind === 'new_inquiry') return { gigId: 'voorbeeld', name: 'Voorbeeld Klant', eventType: 'Bruiloft', eventDate: '2027-06-12', location: 'Groningen', email: 'klant@example.com', phone: '06 12345678' }
  if (kind === 'lead_followup') return { gigId: 'voorbeeld', gigTitle: 'Bruiloft — Voorbeeld Klant', state: 'respond', receivedOn: '2027-01-08', eventDate: '2027-06-12' }
  if (kind === 'invoice_paid') return { invoiceId: 'voorbeeld', invoiceNumber: 'NL-2027-001', amountCents: 125000, currency: 'EUR' }
  return { gigId: 'voorbeeld', gigTitle: 'Bruiloft Voorbeeld', acceptedName: 'Voorbeeld Klant', wishCount: 12 }
}
