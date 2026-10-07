import { z } from 'zod'
import { INSTAGRAM_ALT_TEXT_MAX } from '../../../../../shared/social'
import { SocialPublishError } from '../../../../utils/social-publish'
import { updateSocialPost } from '../../../../utils/social-queue'
import { requireStaff } from '../../../../utils/require-staff'
import { requireUuidParam } from '../../../../utils/route-params'

const bodySchema = z.object({
  caption: z.string().max(10_000).optional(),
  altText: z.string().max(INSTAGRAM_ALT_TEXT_MAX * 2).nullish().transform(value => value ?? undefined),
  scheduledAt: z.string().datetime({ offset: true }).nullable().optional(),
  action: z.enum(['schedule', 'draft']).optional(),
})

/** Edits a concept or planned post, plans a concept (`action: schedule`) or turns a planned post back into a concept. */
export default defineEventHandler(async (event) => {
  const user = await requireStaff(event, ['owner', 'manager', 'content_editor'])
  const id = requireUuidParam(event, 'id')
  const body = bodySchema.parse(await readBody(event))

  try {
    const post = await updateSocialPost(id, body, { userId: user.id, siteUrl: String(useRuntimeConfig().public.siteUrl || '') })
    return { post }
  } catch (error) {
    if (error instanceof SocialPublishError) throw createError({ statusCode: error.statusCode, statusMessage: error.message })
    throw error
  }
})
