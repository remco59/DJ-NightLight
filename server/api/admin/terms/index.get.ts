import { desc } from 'drizzle-orm'
import { termsVersions } from '../../../../db/schema'
import { db } from '../../../utils/db'
import { requireStaff } from '../../../utils/require-staff'

/** All versions, newest first. The draft (if any) is the one the owner is editing. */
export default defineEventHandler(async (event) => {
  await requireStaff(event, ['owner', 'manager'])
  const versions = await db.select().from(termsVersions).orderBy(desc(termsVersions.version))
  return { versions }
})
