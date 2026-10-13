import { and, desc, eq, isNotNull } from 'drizzle-orm'
import { gigReviews } from '../../../db/schema'
import { publicReviewAuthor } from '../../../shared/reviews'
import { db } from '../../utils/db'

/** Reviews the owner chose to show, for clients who allowed it. Only first name, text, rating and month. */
export default defineEventHandler(async () => {
  const rows = await db
    .select({
      rating: gigReviews.rating,
      comment: gigReviews.comment,
      authorName: gigReviews.authorName,
      createdAt: gigReviews.createdAt,
    })
    .from(gigReviews)
    .where(and(eq(gigReviews.published, true), eq(gigReviews.publicConsent, true), isNotNull(gigReviews.comment)))
    .orderBy(desc(gigReviews.createdAt))
    .limit(6)

  return {
    reviews: rows.map(row => ({
      rating: row.rating,
      comment: row.comment,
      author: publicReviewAuthor(row.authorName),
      createdAt: row.createdAt,
    })),
  }
})
