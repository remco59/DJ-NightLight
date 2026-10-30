import { z } from 'zod'
import { invoiceLineInputSchema, vatModes } from './invoice'

export const quoteStatuses = ['draft', 'sent', 'accepted', 'declined', 'void'] as const
export type QuoteStatus = typeof quoteStatuses[number]
/** What the client and the owner see: a sent quote past its date counts as expired. */
export type QuoteDisplayStatus = QuoteStatus | 'expired'

export const QUOTE_DEFAULT_VALID_DAYS = 14
export const QUOTE_NUMBER_PREFIX = 'OFF'
export const DEFAULT_QUOTE_TERMS = 'Deze offerte is geldig tot de genoemde datum. Door akkoord te geven bevestig je dat je de offerte hebt gelezen en ermee instemt.'

export const quoteStatusLabels: Record<QuoteDisplayStatus, string> = {
  draft: 'Concept',
  sent: 'Verstuurd',
  accepted: 'Geaccepteerd',
  declined: 'Afgewezen',
  void: 'Vervallen',
  expired: 'Verlopen',
}

/** `today` and `validUntil` are `YYYY-MM-DD`; the quote is valid through the whole last day. */
export function quoteDisplayStatus(quote: { status: QuoteStatus, validUntil: string }, today: string): QuoteDisplayStatus {
  return quote.status === 'sent' && quote.validUntil < today ? 'expired' : quote.status
}

/** Whether the client can still accept or decline this quote. */
export function quoteIsOpenForResponse(quote: { status: QuoteStatus, validUntil: string }, today: string) {
  return quote.status === 'sent' && quote.validUntil >= today
}

export function addDaysToDate(date: string, days: number) {
  const result = new Date(`${date}T12:00:00.000Z`)
  result.setUTCDate(result.getUTCDate() + days)
  return result.toISOString().slice(0, 10)
}

export const quoteDraftInputSchema = z.object({
  issueDate: z.iso.date(),
  validUntil: z.iso.date(),
  currency: z.string().trim().length(3).transform(value => value.toUpperCase()),
  vatMode: z.enum(vatModes),
  vatRateBasisPoints: z.number().int().min(0).max(10000),
  terms: z.string().trim().max(5000),
  notes: z.string().trim().max(5000),
  lines: z.array(invoiceLineInputSchema).min(1).max(100),
}).refine(value => value.validUntil >= value.issueDate, { path: ['validUntil'], message: 'De geldigheidsdatum kan niet voor de offertedatum liggen' })

export const quoteAcceptSchema = z.object({
  acceptedName: z.string().trim().min(2, 'Vul je naam in om akkoord te geven').max(200),
  agree: z.literal(true, { error: 'Vink aan dat je akkoord gaat met de offerte en de voorwaarden' }),
  /** The terms version the client saw. Required once terms are published, so the acceptance is tied to that text. */
  termsVersion: z.number().int().positive().optional(),
})

export const quoteDeclineSchema = z.object({
  reason: z.string().trim().max(2000).optional().default(''),
})
