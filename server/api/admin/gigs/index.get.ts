import { and, asc, desc, eq, gte, ilike, isNull, lt, lte, or } from 'drizzle-orm'
import { clients, gigs, users, venues } from '../../../../db/schema'
import { gigStatuses } from '../../../../shared/gig-rules'
import { db } from '../../../utils/db'
import { requireStaff } from '../../../utils/require-staff'
import { gigTitleSql } from '../../../utils/gig-title'

export default defineEventHandler(async (event) => {
  const user = await requireStaff(event, ['owner', 'manager', 'dj'])
  const query = getQuery(event)
  const conditions = [isNull(gigs.deletedAt)]

  if (user.role === 'dj') conditions.push(eq(gigs.assignedUserId, user.id))

  const search = typeof query.search === 'string' ? query.search.trim() : ''
  if (search) {
    conditions.push(or(
      ilike(gigs.title, `%${search}%`),
      ilike(gigs.eventType, `%${search}%`),
      ilike(clients.firstName, `%${search}%`),
      ilike(clients.lastName, `%${search}%`),
      ilike(clients.companyName, `%${search}%`),
      ilike(venues.name, `%${search}%`),
    )!)
  }

  const status = typeof query.status === 'string' && gigStatuses.includes(query.status as (typeof gigStatuses)[number])
    ? query.status as (typeof gigStatuses)[number]
    : null
  if (status) conditions.push(eq(gigs.status, status))

  if (typeof query.eventType === 'string' && query.eventType) conditions.push(eq(gigs.eventType, query.eventType))
  if (typeof query.clientId === 'string' && query.clientId) conditions.push(eq(gigs.clientId, query.clientId))
  if (typeof query.venueId === 'string' && query.venueId) conditions.push(eq(gigs.venueId, query.venueId))
  if (user.role !== 'dj' && typeof query.assignedUserId === 'string' && query.assignedUserId) {
    conditions.push(eq(gigs.assignedUserId, query.assignedUserId))
  }

  if (query.public === 'true') conditions.push(eq(gigs.publicVisibility, true))
  if (query.public === 'false') conditions.push(eq(gigs.publicVisibility, false))

  const now = new Date()
  if (query.timing === 'upcoming') conditions.push(gte(gigs.startsAt, now))
  if (query.timing === 'past') conditions.push(lt(gigs.startsAt, now))

  if (typeof query.startDate === 'string' && query.startDate) {
    const start = new Date(`${query.startDate}T00:00:00`)
    if (!Number.isNaN(start.getTime())) conditions.push(gte(gigs.startsAt, start))
  }
  if (typeof query.endDate === 'string' && query.endDate) {
    const end = new Date(`${query.endDate}T23:59:59.999`)
    if (!Number.isNaN(end.getTime())) conditions.push(lte(gigs.startsAt, end))
  }

  const sortOrder = query.sort === 'date_asc' ? asc(gigs.startsAt) : desc(gigs.startsAt)

  const rows = await db
    .select({
      id: gigs.id,
      title: gigTitleSql(),
      eventType: gigs.eventType,
      status: gigs.status,
      startsAt: gigs.startsAt,
      endsAt: gigs.endsAt,
      fee: gigs.fee,
      currency: gigs.currency,
      publicVisibility: gigs.publicVisibility,
      clientId: gigs.clientId,
      venueId: gigs.venueId,
      assignedUserId: gigs.assignedUserId,
      clientFirstName: clients.firstName,
      clientLastName: clients.lastName,
      clientCompanyName: clients.companyName,
      venueName: venues.name,
      venueCity: venues.city,
    })
    .from(gigs)
    .leftJoin(clients, eq(gigs.clientId, clients.id))
    .leftJoin(venues, eq(gigs.venueId, venues.id))
    .where(and(...conditions))
    .orderBy(sortOrder, desc(gigs.createdAt))

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

  const eventTypes = [...new Set(rows.map(row => row.eventType).filter((value): value is string => Boolean(value)))].sort()

  return {
    gigs: rows,
    options: {
      clients: clientOptions,
      venues: venueOptions,
      djs: djOptions,
      eventTypes,
    },
  }
})
