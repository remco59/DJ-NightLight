import { z } from 'zod'
import { INSTAGRAM_ALT_TEXT_MAX } from '../../../../../shared/social'
import { publishGeneratedImageNow, SocialPublishError } from '../../../../utils/social-publish'
import { requireStaff } from '../../../../utils/require-staff'

const bodySchema = z.object({
  generatedPostId: z.string().uuid(),
  // Length is checked in characters (not UTF-16 units) by the publish step.
  caption: z.string().max(10_000).default(''),
  altText: z.string().max(INSTAGRAM_ALT_TEXT_MAX * 2).nullish().transform(value => value || null),
})

/** Publishes an exported image to Instagram right away. Scheduling arrives in a later phase. */
export default defineEventHandler(async (event) => {
  const user = await requireStaff(event, ['owner', 'manager', 'content_editor'])
  const body = bodySchema.parse(await readBody(event))

  try {
    const post = await publishGeneratedImageNow({
      generatedPostId: body.generatedPostId,
      caption: body.caption,
      altText: body.altText,
      userId: user.id,
      siteUrl: String(useRuntimeConfig().public.siteUrl || ''),
    })
    event.node.res.statusCode = 201
    return { post }
  } catch (error) {
    if (error instanceof SocialPublishError) {
      throw createError({ statusCode: error.statusCode, statusMessage: error.message })
    }
    throw error
  }
})
