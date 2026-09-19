import { asc } from 'drizzle-orm'
import { landingPages } from '../../../../db/schema'
import { db } from '../../../utils/db'
import { requireStaff } from '../../../utils/require-staff'

export default defineEventHandler(async (event) => {
  await requireStaff(event, ['owner'])

  const pages = await db
    .select()
    .from(landingPages)
    .orderBy(asc(landingPages.ordering), asc(landingPages.navLabel))

  return { pages }
})
