import { z } from 'zod'
import { INSTAGRAM_ALT_TEXT_MAX } from '../../../../../shared/social'
import { publishGeneratedImageNow, SocialPublishError } from '../../../../utils/social-publish'
import { requireStaff } from '../../../../utils/require-staff'

const bodySchema = z.object({
  generatedPostId: z.string().uuid(),
  // Length is checked in characters (not UTF-16 units) by the publish step.
  caption: z.string().max(10_000).default(''),
  platforms: z.array(z.enum(['instagram', 'facebook'])).min(1).max(2).default(['instagram']),
  altText: z.string().max(INSTAGRAM_ALT_TEXT_MAX * 2).nullish().transform(value => value || null),
})

/** Publishes an exported image to Instagram (and optionally the Facebook Page) right away. Scheduling arrives in a later phase. */
export default defineEventHandler(async (event) => {
  const user = await requireStaff(event, ['owner', 'manager', 'content_editor'])
  const body = bodySchema.parse(await readBody(event))

  try {
    const posts = await publishGeneratedImageNow({
      generatedPostId: body.generatedPostId,
      caption: body.caption,
      altText: body.altText,
      platforms: body.platforms,
      userId: user.id,
      siteUrl: String(useRuntimeConfig().public.siteUrl || ''),
    })
    event.node.res.statusCode = 201
    return { posts }
  } catch (error) {
    if (error instanceof SocialPublishError) {
      throw createError({ statusCode: error.statusCode, statusMessage: error.message })
    }
    throw error
  }
})
