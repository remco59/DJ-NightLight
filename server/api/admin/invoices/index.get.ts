import { desc, eq } from 'drizzle-orm'
import { clients, gigs, invoices } from '../../../../db/schema'
import { db } from '../../../utils/db'
import { requireStaff } from '../../../utils/require-staff'
import { gigTitleSql } from '../../../utils/gig-title'

export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const items = await db.select({
    id: invoices.id, invoiceNumber: invoices.invoiceNumber, status: invoices.status, paymentStatus: invoices.paymentStatus,
    issueDate: invoices.issueDate, dueDate: invoices.dueDate, totalCents: invoices.totalCents, currency: invoices.currency,
    gigId: gigs.id, gigTitle: gigTitleSql(), clientFirstName: clients.firstName, clientLastName: clients.lastName, clientCompanyName: clients.companyName,
  }).from(invoices).innerJoin(gigs, eq(invoices.gigId, gigs.id)).leftJoin(clients, eq(invoices.clientId, clients.id)).orderBy(desc(invoices.createdAt))
  return { invoices: items }
})
