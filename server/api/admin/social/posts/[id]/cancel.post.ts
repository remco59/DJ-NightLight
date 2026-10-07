import { SocialPublishError } from '../../../../../utils/social-publish'
import { cancelSocialPost } from '../../../../../utils/social-queue'
import { requireStaff } from '../../../../../utils/require-staff'
import { requireUuidParam } from '../../../../../utils/route-params'

/** Cancels a concept, planned or failed post. The export itself is kept. */
export default defineEventHandler(async (event) => {
  const user = await requireStaff(event, ['owner', 'manager', 'content_editor'])
  try {
    return { post: await cancelSocialPost(requireUuidParam(event, 'id'), user.id) }
  } catch (error) {
    if (error instanceof SocialPublishError) throw createError({ statusCode: error.statusCode, statusMessage: error.message })
    throw error
  }
})
