import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { videoProjects } from '../../../../db/schema'
import { db } from '../../../utils/db'
import { requireStaff } from '../../../utils/require-staff'
import { VIDEO_EDITOR_ROLES, getProjectOr404, validateProject } from '../../../utils/video-projects'

const schema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  project: z.unknown().optional(),
  /** Revision the client edited; stale saves are rejected instead of overwriting. */
  revision: z.number().int().min(1),
})

export default defineEventHandler(async (event) => {
  await requireStaff(event, VIDEO_EDITOR_ROLES)
  const existing = await getProjectOr404(getRouterParam(event, 'id'))
  const input = await readValidatedBody(event, schema.parse)
  const project = input.project === undefined ? existing.project : validateProject(input.project)

  const [row] = await db.update(videoProjects).set({
    name: input.name ?? existing.name,
    project,
    revision: existing.revision + 1,
    updatedAt: new Date(),
  }).where(and(eq(videoProjects.id, existing.id), eq(videoProjects.revision, input.revision))).returning()

  if (!row) {
    throw createError({ statusCode: 409, statusMessage: 'Dit project is ergens anders gewijzigd. Laad de pagina opnieuw voor de nieuwste versie.' })
  }
  return { project: row }
})
