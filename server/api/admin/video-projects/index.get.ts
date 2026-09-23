import { desc } from 'drizzle-orm'
import { videoProjects } from '../../../../db/schema'
import { projectDurationFrames } from '../../../../shared/video-project'
import { db } from '../../../utils/db'
import { requireStaff } from '../../../utils/require-staff'
import { VIDEO_EDITOR_ROLES } from '../../../utils/video-projects'

export default defineEventHandler(async (event) => {
  await requireStaff(event, VIDEO_EDITOR_ROLES)
  const rows = await db.select().from(videoProjects).orderBy(desc(videoProjects.updatedAt)).limit(200)
  return {
    projects: rows.map(row => ({
      id: row.id,
      name: row.name,
      aspect: row.project.aspect,
      width: row.project.width,
      height: row.project.height,
      durationSeconds: Math.round(projectDurationFrames(row.project) / row.project.fps * 10) / 10,
      itemCount: row.project.tracks.reduce((count, track) => count + track.items.length, 0),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    })),
  }
})
