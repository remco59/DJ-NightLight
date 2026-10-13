import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { gigReviews } from '../../../../db/schema'
import { canPublishReview } from '../../../../shared/reviews'
import { recordAudit } from '../../../utils/audit'
import { db } from '../../../utils/db'
import { requireStaff } from '../../../utils/require-staff'
import { requireUuidParam } from '../../../utils/route-params'

const bodySchema = z.object({ published: z.boolean() })

/** Shows a review on the website or hides it again. Only reviews with the client's consent and some text can be shown. */
export default defineEventHandler(async (event) => {
  const user = await requireStaff(event, ['owner', 'manager'])
  const id = requireUuidParam(event, 'id')
  const { published } = await readValidatedBody(event, bodySchema.parse)

  const [review] = await db.select({ comment: gigReviews.comment, publicConsent: gigReviews.publicConsent, gigId: gigReviews.gigId })
    .from(gigReviews).where(eq(gigReviews.id, id)).limit(1)
  if (!review) throw createError({ statusCode: 404, statusMessage: 'Review niet gevonden' })
  if (published && !review.publicConsent) throw createError({ statusCode: 409, statusMessage: 'Deze klant heeft geen toestemming gegeven om de review te tonen.' })
  if (published && !canPublishReview(review)) throw createError({ statusCode: 409, statusMessage: 'Een review zonder tekst kun je niet op de website tonen.' })

  const [updated] = await db.update(gigReviews).set({ published }).where(eq(gigReviews.id, id)).returning({ id: gigReviews.id, published: gigReviews.published })
  await recordAudit({
    userId: user.id,
    entityType: 'gig',
    entityId: review.gigId,
    action: published ? 'review_published' : 'review_unpublished',
    metadata: { reviewId: id },
  })
  return { review: updated }
})
