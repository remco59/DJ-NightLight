import { and, asc, desc, eq } from 'drizzle-orm'
import { auditLogs, clients, gigContacts, gigs, gigTimelineItems, invoices, payments, users, venues } from '../../../../db/schema'
import { db } from '../../../utils/db'
import { requireStaff } from '../../../utils/require-staff'

export default defineEventHandler(async (event) => {
  const user = await requireStaff(event, ['owner', 'manager', 'dj'])
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Gig id is required' })

  const accessCondition = user.role === 'dj'
    ? and(eq(gigs.id, id), eq(gigs.assignedUserId, user.id))
    : eq(gigs.id, id)

  const [gig] = await db
    .select({
      id: gigs.id,
      title: gigs.title,
      eventType: gigs.eventType,
      clientId: gigs.clientId,
      venueId: gigs.venueId,
      assignedUserId: gigs.assignedUserId,
      status: gigs.status,
      startsAt: gigs.startsAt,
      endsAt: gigs.endsAt,
      loadInAt: gigs.loadInAt,
      fee: gigs.fee,
      currency: gigs.currency,
      publicVisibility: gigs.publicVisibility,
      publicTitle: gigs.publicTitle,
      publicDescription: gigs.publicDescription,
      internalNotes: gigs.internalNotes,
      source: gigs.source,
      createdAt: gigs.createdAt,
      updatedAt: gigs.updatedAt,
      clientFirstName: clients.firstName,
      clientLastName: clients.lastName,
      clientCompanyName: clients.companyName,
      venueName: venues.name,
    })
    .from(gigs)
    .leftJoin(clients, eq(gigs.clientId, clients.id))
    .leftJoin(venues, eq(gigs.venueId, venues.id))
    .where(accessCondition)
    .limit(1)

  if (!gig) throw createError({ statusCode: 404, statusMessage: 'Gig not found' })

  const contacts = await db.select().from(gigContacts).where(eq(gigContacts.gigId, id)).orderBy(asc(gigContacts.createdAt))
  const timeline = await db.select().from(gigTimelineItems).where(eq(gigTimelineItems.gigId, id)).orderBy(asc(gigTimelineItems.ordering))
  const activity = await db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      metadata: auditLogs.metadata,
      createdAt: auditLogs.createdAt,
      actorName: users.name,
      actorEmail: users.email,
    })
    .from(auditLogs)
    .leftJoin(users, eq(auditLogs.userId, users.id))
    .where(and(eq(auditLogs.entityType, 'gig'), eq(auditLogs.entityId, id)))
    .orderBy(desc(auditLogs.createdAt))
    .limit(25)

  const canManage = user.role === 'owner' || user.role === 'manager'
  const clientOptions = canManage
    ? await db.select({ id: clients.id, type: clients.type, firstName: clients.firstName, lastName: clients.lastName, companyName: clients.companyName }).from(clients).orderBy(asc(clients.companyName), asc(clients.lastName), asc(clients.firstName))
    : []
  const venueOptions = canManage
    ? await db.select({ id: venues.id, name: venues.name, city: venues.city }).from(venues).orderBy(asc(venues.name))
    : []
  const djOptions = canManage
    ? await db.select({ id: users.id, name: users.name, email: users.email }).from(users).where(and(eq(users.role, 'dj'), eq(users.active, true))).orderBy(asc(users.name))
    : [{ id: user.id, name: user.name, email: user.email }]

  const invoiceRows = canManage
    ? await db.select({
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        status: invoices.status,
        paymentStatus: invoices.paymentStatus,
        issueDate: invoices.issueDate,
        dueDate: invoices.dueDate,
        currency: invoices.currency,
        totalCents: invoices.totalCents,
        finalizedAt: invoices.finalizedAt,
        paymentProvider: payments.provider,
        stripeSessionId: payments.providerSessionId,
        stripePaymentIntentId: payments.providerPaymentIntentId,
        stripeStatus: payments.status,
        paidAt: payments.paidAt,
        paymentFailureCode: payments.failureCode,
      }).from(invoices)
        .leftJoin(payments, eq(payments.invoiceId, invoices.id))
        .where(eq(invoices.gigId, id))
        .orderBy(desc(invoices.createdAt))
    : []

  return { gig, contacts, timeline, activity, invoices: invoiceRows, options: { clients: clientOptions, venues: venueOptions, djs: djOptions } }
})
