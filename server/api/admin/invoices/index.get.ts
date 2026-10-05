import { and, asc, desc, eq, gte, ilike, inArray, lt, lte, or, sql } from 'drizzle-orm'
import { clients, gigs, invoices, payments } from '../../../../db/schema'
import { db } from '../../../utils/db'
import { requireStaff } from '../../../utils/require-staff'
import { gigTitleSql } from '../../../utils/gig-title'

const invoiceStatuses = ['draft', 'finalized', 'void'] as const
const paymentStatuses = ['unpaid', 'pending', 'paid', 'failed'] as const
const isDate = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)

export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const query = getQuery(event)
  const conditions = []

  const search = typeof query.search === 'string' ? query.search.trim() : ''
  if (search) {
    conditions.push(or(
      ilike(invoices.invoiceNumber, `%${search}%`),
      ilike(gigs.title, `%${search}%`),
      ilike(clients.firstName, `%${search}%`),
      ilike(clients.lastName, `%${search}%`),
      ilike(clients.companyName, `%${search}%`),
    )!)
  }

  const status = invoiceStatuses.find(value => value === query.status)
  if (status) conditions.push(eq(invoices.status, status))

  // "overdue" is derived: a finalized invoice that is past its due date and not yet paid.
  if (query.payment === 'overdue') {
    conditions.push(eq(invoices.status, 'finalized'), inArray(invoices.paymentStatus, ['unpaid', 'pending']), lt(invoices.dueDate, sql`current_date`))
  } else {
    const payment = paymentStatuses.find(value => value === query.payment)
    if (payment) conditions.push(eq(invoices.status, 'finalized'), eq(invoices.paymentStatus, payment))
  }

  if (typeof query.clientId === 'string' && query.clientId) conditions.push(eq(invoices.clientId, query.clientId))
  if (isDate(query.startDate)) conditions.push(gte(invoices.issueDate, query.startDate))
  if (isDate(query.endDate)) conditions.push(lte(invoices.issueDate, query.endDate))

  const sortOrder = {
    date_asc: asc(invoices.issueDate),
    amount_desc: desc(invoices.totalCents),
    amount_asc: asc(invoices.totalCents),
  }[query.sort as string] ?? desc(invoices.issueDate)

  const items = await db.select({
    id: invoices.id, invoiceNumber: invoices.invoiceNumber, status: invoices.status, paymentStatus: invoices.paymentStatus, paymentProvider: payments.provider,
    issueDate: invoices.issueDate, dueDate: invoices.dueDate, totalCents: invoices.totalCents, currency: invoices.currency,
    gigId: gigs.id, gigTitle: gigTitleSql(), clientFirstName: clients.firstName, clientLastName: clients.lastName, clientCompanyName: clients.companyName,
  }).from(invoices).innerJoin(gigs, eq(invoices.gigId, gigs.id)).leftJoin(clients, eq(invoices.clientId, clients.id)).leftJoin(payments, eq(payments.invoiceId, invoices.id))
    .where(and(...conditions)).orderBy(sortOrder, desc(invoices.createdAt))

  const clientOptions = await db.selectDistinct({ id: clients.id, type: clients.type, firstName: clients.firstName, lastName: clients.lastName, companyName: clients.companyName })
    .from(invoices).innerJoin(clients, eq(invoices.clientId, clients.id))
    .orderBy(asc(clients.companyName), asc(clients.lastName), asc(clients.firstName))

  return { invoices: items, options: { clients: clientOptions } }
})
