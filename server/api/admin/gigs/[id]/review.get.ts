import { eq } from 'drizzle-orm'
import { gigReviews } from '../../../../../db/schema'
import { db } from '../../../../utils/db'
import { requireStaff } from '../../../../utils/require-staff'
import { requireUuidParam } from '../../../../utils/route-params'

export default defineEventHandler(async (event) => {
  await requireStaff(event, ['owner', 'manager'])
  const gigId = requireUuidParam(event, 'id')
  const [review] = await db.select({
    rating: gigReviews.rating,
    comment: gigReviews.comment,
    authorName: gigReviews.authorName,
    createdAt: gigReviews.createdAt,
  }).from(gigReviews).where(eq(gigReviews.gigId, gigId)).limit(1)
  return { review: review || null }
})
