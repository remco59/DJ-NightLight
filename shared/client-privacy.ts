import type { InvoiceSnapshot } from './invoice'

export const CLIENT_EXPORT_VERSION = 1
export const ANONYMIZED_CLIENT_NAME = 'Verwijderde klant'
/** What replaces an email address on mail that was sent to a client who has been erased. */
export const REMOVED_RECIPIENT = '[verwijderd]'

type NamedClient = { firstName?: string | null, lastName?: string | null, companyName?: string | null }

export function clientDisplayName(client: NamedClient) {
  return client.companyName?.trim() || [client.firstName, client.lastName].filter(Boolean).join(' ').trim() || 'klant'
}

/** `klantgegevens-sanne-de-vries-2026-10-13.json`: lower case ASCII, no characters that break a download name. */
export function clientExportFileName(client: NamedClient, today: string) {
  const slug = clientDisplayName(client)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
  return `klantgegevens-${slug || 'klant'}-${today}.json`
}

/** The client record after erasure. Invoices keep pointing at it, so the row stays but holds no personal data. */
export function anonymizedClientValues() {
  return {
    type: 'person' as const,
    firstName: ANONYMIZED_CLIENT_NAME,
    lastName: null,
    companyName: null,
    email: null,
    invoiceEmail: null,
    phone: null,
    billingAddress: null,
    notes: null,
    stripeCustomerId: null,
  }
}

/** A quote's frozen document without the client's name, address, email or personal portal link. */
export function scrubQuoteSnapshot(snapshot: InvoiceSnapshot): InvoiceSnapshot {
  const { portalUrl: _portalUrl, ...rest } = snapshot
  return { ...rest, client: { name: ANONYMIZED_CLIENT_NAME, email: '', billingAddress: '' }, notes: '' }
}

/** Why erasing is not possible yet, or null. A booked gig still to come needs the client's details. */
export function anonymizeBlocker(upcomingBookedGigs: number) {
  if (upcomingBookedGigs <= 0) return null
  return `Deze klant heeft nog ${upcomingBookedGigs} geboekte ${upcomingBookedGigs === 1 ? 'gig' : 'gigs'} in de toekomst. Annuleer of verplaats die eerst, of wacht tot ze voorbij zijn.`
}

export type AnonymizeSummary = {
  gigs: number
  contactsRemoved: number
  invoicesKept: number
  emailsScrubbed: number
  portalLinksRevoked: number
}
