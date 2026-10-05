import { desc, eq } from 'drizzle-orm'
import { gigReviews, gigs } from '../../../../db/schema'
import { db } from '../../../utils/db'
import { gigTitleSql } from '../../../utils/gig-title'
import { requireStaff } from '../../../utils/require-staff'

export default defineEventHandler(async (event) => {
  await requireStaff(event, ['owner', 'manager'])
  const reviews = await db.select({
    id: gigReviews.id,
    gigId: gigReviews.gigId,
    gigTitle: gigTitleSql(),
    startsAt: gigs.startsAt,
    rating: gigReviews.rating,
    comment: gigReviews.comment,
    authorName: gigReviews.authorName,
    createdAt: gigReviews.createdAt,
  }).from(gigReviews).innerJoin(gigs, eq(gigReviews.gigId, gigs.id)).orderBy(desc(gigReviews.createdAt)).limit(500)

  const average = reviews.length ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length : null
  return { reviews, average }
})
