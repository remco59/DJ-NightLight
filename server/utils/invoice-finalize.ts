import { eq } from 'drizzle-orm'
import { businessSettings, emailTemplates } from '../../db/schema'
import { calculateInvoiceTotals, calculateLineTotalCents, type InvoiceSnapshot } from '../../shared/invoice'
import { db } from './db'
import { clientTurnedOffAutomation, isSuppressed } from './email-automation'
import { invoiceClientName, type getInvoiceDetail } from './invoice-data'

type InvoiceDetail = NonNullable<Awaited<ReturnType<typeof getInvoiceDetail>>>
type BusinessSettings = typeof businessSettings.$inferSelect

export const INVOICE_SENT_TEMPLATE = 'invoice_sent'

export function invoiceLineInputs(detail: InvoiceDetail) {
  return detail.lines.map(line => ({ description: line.description, quantity: line.quantity, unitPriceCents: line.unitPriceCents }))
}

export function buildInvoiceSnapshot(detail: InvoiceDetail, settings: BusinessSettings, invoiceNumber: string): InvoiceSnapshot {
  const lineInputs = invoiceLineInputs(detail)
  const totals = calculateInvoiceTotals(lineInputs, detail.invoice.vatMode, detail.invoice.vatRateBasisPoints)
  return {
    invoiceNumber, issueDate: detail.invoice.issueDate, dueDate: detail.invoice.dueDate,
    serviceDate: detail.invoice.gigStartsAt ? new Date(detail.invoice.gigStartsAt).toISOString().slice(0, 10) : undefined,
    currency: detail.invoice.currency,
    vatMode: detail.invoice.vatMode, vatRateBasisPoints: detail.invoice.vatRateBasisPoints,
    business: {
      companyName: settings.companyName, address: settings.address, postalCode: settings.postalCode, city: settings.city,
      country: settings.country, email: settings.email, phone: settings.phone, registrationNumber: settings.registrationNumber,
      vatNumber: settings.vatNumber, iban: settings.iban,
    },
    client: { name: invoiceClientName(detail.invoice), email: detail.invoice.clientEmail || '', billingAddress: detail.invoice.clientBillingAddress || '' },
    lines: lineInputs.map(line => ({ ...line, totalCents: calculateLineTotalCents(line) })), totals,
    paymentTerms: detail.invoice.paymentTerms, legalText: detail.invoice.legalText, notes: detail.invoice.notes,
  }
}

export async function loadBusinessSettings() {
  const [settings] = await db.select().from(businessSettings).where(eq(businessSettings.key, 'default')).limit(1)
  return settings ?? null
}

/** Problems that make a finalized invoice wrong or unpayable. Finalizing is irreversible, so these block it. */
export function invoiceFinalizeBlockers(detail: InvoiceDetail, settings: BusinessSettings | null) {
  const blockers: string[] = []
  const lines = invoiceLineInputs(detail)
  if (!lines.length) blockers.push('De factuur heeft nog geen regels.')
  if (lines.some(line => !line.description.trim())) blockers.push('Niet elke factuurregel heeft een omschrijving.')
  let totalCents = 0
  try {
    totalCents = calculateInvoiceTotals(lines, detail.invoice.vatMode, detail.invoice.vatRateBasisPoints).totalCents
  } catch {
    blockers.push('De bedragen op de factuur kloppen niet.')
  }
  if (lines.length && totalCents <= 0) blockers.push('Het totaalbedrag is € 0,00.')
  if (!settings) {
    blockers.push('De bedrijfsgegevens zijn nog niet ingesteld.')
  } else {
    if (!settings.companyName.trim()) blockers.push('Je bedrijfsnaam ontbreekt in de instellingen.')
    if (!settings.iban.trim()) blockers.push('Je IBAN ontbreekt in de instellingen.')
    if (!settings.registrationNumber.trim()) blockers.push('Je KvK-nummer ontbreekt in de instellingen.')
  }
  return blockers
}

/** Whether finalizing will email the invoice to the client, and if not, why. */
export async function invoiceEmailPlan(detail: InvoiceDetail) {
  const recipient = detail.invoice.clientEmail || null
  const [template] = await db.select({ enabled: emailTemplates.enabled, offsetMinutes: emailTemplates.offsetMinutes })
    .from(emailTemplates).where(eq(emailTemplates.key, INVOICE_SENT_TEMPLATE)).limit(1)
  let skipReason: string | null = null
  if (!recipient) skipReason = 'De klant heeft geen e-mailadres.'
  else if (!template?.enabled) skipReason = 'De e-mail "Factuur verstuurd" staat uit.'
  else if (await isSuppressed(detail.invoice.gigId, INVOICE_SENT_TEMPLATE)) skipReason = 'Deze e-mail is voor deze gig uitgezet.'
  else if (await clientTurnedOffAutomation(detail.invoice.gigId, INVOICE_SENT_TEMPLATE)) skipReason = 'Automatische facturen staan uit voor deze klant.'
  const config = useRuntimeConfig()
  return {
    recipient,
    willSend: !skipReason,
    skipReason,
    delayMinutes: template?.offsetMinutes ?? 0,
    providerConfigured: Boolean(config.email.apiKey && config.email.from),
  }
}
