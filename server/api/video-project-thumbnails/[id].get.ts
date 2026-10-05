import { eq } from 'drizzle-orm'
import { videoProjects } from '../../../db/schema'
import { db } from '../../utils/db'
import { getGeneratedStorage } from '../../utils/media-storage'
import { requireStaff } from '../../utils/require-staff'
import { VIDEO_EDITOR_ROLES } from '../../utils/video-projects'

export default defineEventHandler(async (event) => {
  await requireStaff(event, VIDEO_EDITOR_ROLES)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Videoproject-ID is verplicht' })

  const [project] = await db
    .select({
      thumbnailKey: videoProjects.thumbnailKey,
      thumbnailRevision: videoProjects.thumbnailRevision,
    })
    .from(videoProjects)
    .where(eq(videoProjects.id, id))
    .limit(1)

  if (!project?.thumbnailKey) {
    throw createError({ statusCode: 404, statusMessage: 'Thumbnail is nog niet beschikbaar' })
  }

  try {
    const data = await getGeneratedStorage().read(project.thumbnailKey)
    setHeader(event, 'content-type', 'image/jpeg')
    setHeader(event, 'cache-control', 'private, max-age=31536000, immutable')
    setHeader(event, 'content-length', data.length)
    setHeader(event, 'x-thumbnail-revision', String(project.thumbnailRevision))
    return data
  } catch {
    throw createError({ statusCode: 404, statusMessage: 'Thumbnailbestand niet gevonden' })
  }
})
