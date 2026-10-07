import { z } from 'zod'
import { INSTAGRAM_ALT_TEXT_MAX, INSTAGRAM_CAROUSEL_MAX, socialPostKinds } from '../../../../../shared/social'
import { publishSocialPost, SocialPublishError } from '../../../../utils/social-publish'
import { requireStaff } from '../../../../utils/require-staff'

const bodySchema = z.object({
  kind: z.enum(socialPostKinds).default('image'),
  // One export for an image or story, 2 to 10 for a carousel.
  generatedPostIds: z.array(z.string().uuid()).max(INSTAGRAM_CAROUSEL_MAX).default([]),
  // A completed render, for a reel or a video story.
  videoRenderJobId: z.string().uuid().nullish().transform(value => value || null),
  /** Shorthand for a single export (images and image stories). */
  generatedPostId: z.string().uuid().nullish().transform(value => value || null),
  // Length is checked in characters (not UTF-16 units) by the publish step.
  caption: z.string().max(10_000).default(''),
  platforms: z.array(z.enum(['instagram', 'facebook'])).min(1).max(2).default(['instagram']),
  altText: z.string().max(INSTAGRAM_ALT_TEXT_MAX * 2).nullish().transform(value => value || null),
  mode: z.enum(['now', 'schedule', 'draft']).default('now'),
  scheduledAt: z.string().datetime({ offset: true }).nullish().transform(value => value || null),
}).refine(body => body.generatedPostIds.length > 0 || body.generatedPostId || body.videoRenderJobId, { message: 'Kies een export of een video' })

/** Publishes an image, carousel, story or reel to Instagram (a single image also to the Facebook Page) right away, schedules it, or saves a concept. */
export default defineEventHandler(async (event) => {
  const user = await requireStaff(event, ['owner', 'manager', 'content_editor'])
  const body = bodySchema.parse(await readBody(event))

  try {
    const posts = await publishSocialPost({
      kind: body.kind,
      generatedPostIds: body.generatedPostId ? [body.generatedPostId, ...body.generatedPostIds] : body.generatedPostIds,
      videoRenderJobId: body.videoRenderJobId,
      caption: body.caption,
      altText: body.altText,
      platforms: body.platforms,
      mode: body.mode,
      scheduledAt: body.scheduledAt,
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
