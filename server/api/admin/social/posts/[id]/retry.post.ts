import { SocialPublishError } from '../../../../../utils/social-publish'
import { retrySocialPost } from '../../../../../utils/social-queue'
import { requireStaff } from '../../../../../utils/require-staff'
import { requireUuidParam } from '../../../../../utils/route-params'

/** Queues a failed post again. The worker publishes it within a minute. */
export default defineEventHandler(async (event) => {
  const user = await requireStaff(event, ['owner', 'manager', 'content_editor'])
  try {
    return { post: await retrySocialPost(requireUuidParam(event, 'id'), user.id) }
  } catch (error) {
    if (error instanceof SocialPublishError) throw createError({ statusCode: error.statusCode, statusMessage: error.message })
    throw error
  }
})
