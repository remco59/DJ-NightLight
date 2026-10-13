import { and, asc, eq, gte, lte } from 'drizzle-orm'
import { clients, expenses, gigs, invoices } from '../../db/schema'
import type { CsvExpense, CsvInvoice } from '../../shared/finance'
import { db } from './db'
import { gigTitleSql } from './gig-title'

/** The finalized invoices (by invoice date) and the costs of one calendar year. */
export async function loadFinanceYear(year: number) {
  const start = `${year}-01-01`
  const end = `${year}-12-31`

  const invoiceRows = await db.select({
    id: invoices.id,
    invoiceNumber: invoices.invoiceNumber,
    issueDate: invoices.issueDate,
    subtotalCents: invoices.subtotalCents,
    vatAmountCents: invoices.vatAmountCents,
    totalCents: invoices.totalCents,
    paymentStatus: invoices.paymentStatus,
    status: invoices.status,
    gigId: invoices.gigId,
    gigTitle: gigTitleSql(),
    companyName: clients.companyName,
    firstName: clients.firstName,
    lastName: clients.lastName,
  }).from(invoices)
    .innerJoin(gigs, eq(invoices.gigId, gigs.id))
    .leftJoin(clients, eq(invoices.clientId, clients.id))
    .where(and(eq(invoices.status, 'finalized'), gte(invoices.issueDate, start), lte(invoices.issueDate, end)))
    .orderBy(asc(invoices.issueDate))

  const expenseRows = await db.select({
    id: expenses.id,
    gigId: expenses.gigId,
    kind: expenses.kind,
    spentOn: expenses.spentOn,
    description: expenses.description,
    category: expenses.category,
    amountCents: expenses.amountCents,
    vatCents: expenses.vatCents,
    kilometers: expenses.kilometers,
    kmRateCents: expenses.kmRateCents,
    gigTitle: gigTitleSql(),
  }).from(expenses)
    .leftJoin(gigs, eq(expenses.gigId, gigs.id))
    .where(and(gte(expenses.spentOn, start), lte(expenses.spentOn, end)))
    .orderBy(asc(expenses.spentOn))

  const csvInvoices: CsvInvoice[] = invoiceRows.map(row => ({
    issueDate: row.issueDate,
    subtotalCents: row.subtotalCents,
    vatAmountCents: row.vatAmountCents,
    totalCents: row.totalCents,
    paymentStatus: row.paymentStatus,
    invoiceNumber: row.invoiceNumber,
    gigTitle: row.gigTitle,
    status: row.status,
    clientName: row.companyName || [row.firstName, row.lastName].filter(Boolean).join(' '),
  }))
  // The gig title subquery returns a placeholder title for rows without a gig, so blank it there.
  const csvExpenses: Array<CsvExpense & { gigId: string | null }> = expenseRows.map(row => ({
    id: row.id,
    gigId: row.gigId,
    kind: row.kind,
    spentOn: row.spentOn,
    description: row.description,
    category: row.category,
    amountCents: row.amountCents,
    vatCents: row.vatCents,
    kilometers: row.kilometers,
    kmRateCents: row.kmRateCents,
    gigTitle: row.gigId ? row.gigTitle : null,
  }))
  return { invoices: csvInvoices, expenses: csvExpenses }
}

export function parseYear(value: unknown, fallback: number) {
  const year = Number(value)
  return Number.isInteger(year) && year >= 2000 && year <= 2100 ? year : fallback
}
