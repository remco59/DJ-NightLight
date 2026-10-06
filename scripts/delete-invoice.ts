import { createInterface } from 'node:readline/promises'
import { eq } from 'drizzle-orm'
import { db, sql } from '../server/utils/db'
import { auditLogs, invoices, payments } from '../db/schema'

// Removes an invoice (and its payment record) for good, e.g. test invoices created while Stripe was in test mode.
// Usage: npm run invoice:delete -- <invoice number or id> [--yes] [--force]
const args = process.argv.slice(2)
const flags = new Set(args.filter(arg => arg.startsWith('--')))
const target = args.find(arg => !arg.startsWith('--'))

function fail(message: string): never {
  console.error(`✗ ${message}`)
  process.exit(1)
}

if (!target) fail('Gebruik: npm run invoice:delete -- <factuurnummer of id> [--yes] [--force]')

const isId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(target)

try {
  const [invoice] = await db.select().from(invoices).where(isId ? eq(invoices.id, target) : eq(invoices.invoiceNumber, target)).limit(1)
  if (!invoice) fail(`Factuur "${target}" niet gevonden.`)
  const [payment] = await db.select().from(payments).where(eq(payments.invoiceId, invoice.id)).limit(1)

  const euro = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: invoice.currency }).format(invoice.totalCents / 100)
  console.log(`Factuur:  ${invoice.invoiceNumber ?? '(concept, geen nummer)'} · ${invoice.status} · ${euro}`)
  console.log(`Betaling: ${payment ? `${payment.provider} · ${payment.status}${payment.paidAt ? ` · betaald ${payment.paidAt.toISOString().slice(0, 10)}` : ''} · ${payment.providerSessionId ?? 'geen sessie'}` : 'geen'}`)

  // Real money is bookkeeping: never removable from here, not even with --force.
  if (payment?.providerSessionId?.startsWith('cs_live_')) fail('Dit is een echte (live) Stripe-betaling en wordt nooit verwijderd.')
  const isStripeTest = payment?.provider === 'stripe' && payment.providerSessionId?.startsWith('cs_test_')
  if (invoice.status === 'finalized' && !flags.has('--force')) fail('Een definitieve factuur moet eerst vervallen, of gebruik --force.')
  if (payment && payment.provider === 'stripe' && payment.paidAt && !isStripeTest && !flags.has('--force')) {
    fail('Deze Stripe-betaling is niet als testbetaling te herkennen (geen cs_test_-sessie). Gebruik --force als je het zeker weet.')
  }
  if (payment?.provider === 'manual' && payment.paidAt) console.warn('! Let op: dit is een handmatig als betaald gemarkeerde factuur.')

  if (!flags.has('--yes')) {
    const rl = createInterface({ input: process.stdin, output: process.stdout })
    const answer = await rl.question('Definitief verwijderen? Typ "ja" om door te gaan: ')
    rl.close()
    if (answer.trim().toLowerCase() !== 'ja') fail('Afgebroken, er is niets verwijderd.')
  }

  await db.transaction(async (tx) => {
    // payments.invoice_id is ON DELETE RESTRICT; line items cascade, email jobs and replacement links are set null.
    if (payment) await tx.delete(payments).where(eq(payments.id, payment.id))
    await tx.delete(invoices).where(eq(invoices.id, invoice.id))
    await tx.insert(auditLogs).values({
      userId: null,
      entityType: 'invoice',
      entityId: invoice.id,
      action: 'invoice_deleted_cli',
      metadata: { invoiceNumber: invoice.invoiceNumber, status: invoice.status, totalCents: invoice.totalCents, gigId: invoice.gigId, paymentProvider: payment?.provider ?? null },
    })
  })
  console.log(`✓ ${invoice.invoiceNumber ?? 'Concept'} is verwijderd.`)
} finally {
  await sql.end()
}
