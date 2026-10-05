import { eq } from 'drizzle-orm'
import { gigReviews } from '../../../../../db/schema'
import { db } from '../../../../utils/db'
import { requireStaff } from '../../../../utils/require-staff'

export default defineEventHandler(async (event) => {
  await requireStaff(event, ['owner', 'manager'])
  const gigId = getRouterParam(event, 'id')
  if (!gigId) throw createError({ statusCode: 400, statusMessage: 'Gig-ID is verplicht' })
  const [review] = await db.select({
    rating: gigReviews.rating,
    comment: gigReviews.comment,
    authorName: gigReviews.authorName,
    createdAt: gigReviews.createdAt,
  }).from(gigReviews).where(eq(gigReviews.gigId, gigId)).limit(1)
  return { review: review || null }
})
