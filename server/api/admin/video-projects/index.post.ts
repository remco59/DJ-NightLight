import { z } from 'zod'
import { videoProjects } from '../../../../db/schema'
import { applyGigDefaults } from '../../../../shared/template-gigs'
import { VIDEO_ASPECT_KEYS, createVideoProject, type VideoAspect } from '../../../../shared/video-project'
import { db } from '../../../utils/db'
import { requireStaff } from '../../../utils/require-staff'
import { VIDEO_EDITOR_ROLES, listTemplateGigs } from '../../../utils/video-projects'

const schema = z.object({
  name: z.string().trim().max(160).default(''),
  aspect: z.enum(VIDEO_ASPECT_KEYS as [VideoAspect, ...VideoAspect[]]).default('9:16'),
})

export default defineEventHandler(async (event) => {
  const user = await requireStaff(event, VIDEO_EDITOR_ROLES)
  const input = await readValidatedBody(event, body => schema.parse(body ?? {}))
  const project = createVideoProject(input.aspect)
  // The starter announcement shows the next public gig, or neutral fallback
  // text. The agenda is a nice-to-have here: it never blocks creating a project.
  const gigs = await listTemplateGigs(user.role).catch(() => [])
  for (const item of project.tracks.flatMap(track => track.items)) {
    if (item.type === 'graphic') applyGigDefaults(item, gigs)
  }
  const [row] = await db.insert(videoProjects).values({
    name: input.name || 'Untitled video',
    project,
    createdByUserId: user.id,
  }).returning()
  if (!row) throw createError({ statusCode: 500, statusMessage: 'Video project could not be created' })
  event.node.res.statusCode = 201
  return { project: row }
})
