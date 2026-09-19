import { asc, count, ilike, isNull, or } from 'drizzle-orm'
import { clients, gigs } from '../../../../db/schema'
import { db } from '../../../utils/db'
import { requireStaff } from '../../../utils/require-staff'

export default defineEventHandler(async (event) => {
  await requireStaff(event)

  const query = getQuery(event)
  const search = typeof query.search === 'string' ? query.search.trim() : ''

  const rows = await db
    .select()
    .from(clients)
    .where(search
      ? or(
          ilike(clients.firstName, `%${search}%`),
          ilike(clients.lastName, `%${search}%`),
          ilike(clients.companyName, `%${search}%`),
          ilike(clients.email, `%${search}%`),
        )
      : undefined)
    .orderBy(asc(clients.companyName), asc(clients.lastName), asc(clients.firstName))

  const gigCounts = await db
    .select({ clientId: gigs.clientId, value: count() })
    .from(gigs)
    .where(isNull(gigs.deletedAt))
    .groupBy(gigs.clientId)

  const countMap = new Map(gigCounts.map(row => [row.clientId, row.value]))

  return {
    clients: rows.map(client => ({
      ...client,
      gigCount: countMap.get(client.id) ?? 0,
    })),
  }
})
