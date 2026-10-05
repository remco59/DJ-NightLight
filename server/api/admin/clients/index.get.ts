import { and, asc, count, eq, ilike, isNull, or } from 'drizzle-orm'
import { clients, gigs } from '../../../../db/schema'
import { db } from '../../../utils/db'
import { requireStaff } from '../../../utils/require-staff'

export default defineEventHandler(async (event) => {
  await requireStaff(event)

  const query = getQuery(event)
  const search = typeof query.search === 'string' ? query.search.trim() : ''

  const conditions = []
  if (search) {
    conditions.push(or(
      ilike(clients.firstName, `%${search}%`),
      ilike(clients.lastName, `%${search}%`),
      ilike(clients.companyName, `%${search}%`),
      ilike(clients.email, `%${search}%`),
    )!)
  }
  if (query.type === 'person' || query.type === 'company') conditions.push(eq(clients.type, query.type))

  const rows = await db
    .select()
    .from(clients)
    .where(and(...conditions))
    .orderBy(asc(clients.companyName), asc(clients.lastName), asc(clients.firstName))

  const gigCounts = await db
    .select({ clientId: gigs.clientId, value: count() })
    .from(gigs)
    .where(isNull(gigs.deletedAt))
    .groupBy(gigs.clientId)

  const countMap = new Map(gigCounts.map(row => [row.clientId, row.value]))

  let list = rows.map(client => ({ ...client, gigCount: countMap.get(client.id) ?? 0 }))
  if (query.hasGigs === 'true') list = list.filter(client => client.gigCount > 0)
  if (query.hasGigs === 'false') list = list.filter(client => client.gigCount === 0)
  if (query.hasEmail === 'true') list = list.filter(client => client.email)
  if (query.hasEmail === 'false') list = list.filter(client => !client.email)
  // The query already sorts A-Z; these re-sorts are stable so ties keep that order.
  if (query.sort === 'name_desc') list.reverse()
  if (query.sort === 'gigs_desc') list.sort((a, b) => b.gigCount - a.gigCount)

  return { clients: list }
})
