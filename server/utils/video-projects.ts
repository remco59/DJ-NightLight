import { and, asc, desc, eq, gte, inArray, isNull, or } from 'drizzle-orm'
import { gigs, mediaAssets, venues, videoProjects, videoRenderJobs } from '../../db/schema'
import { permissionAllowed, type StaffRole } from '../../shared/auth'
import { publicGigTitle } from '../../shared/gig-title'
import type { TemplateGig } from '../../shared/template-gigs'
import { collectProjectAssetIds, parseVideoProject, type VideoProject } from '../../shared/video-project'
import { db } from './db'
import { gigTitleSql } from './gig-title'

export const VIDEO_EDITOR_ROLES = ['owner', 'content_editor'] as const

/**
 * Booked gigs that have not ended yet, soonest first, for the announce
 * templates. Editors without access to the gig admin only get the gigs that
 * are already public on the agenda.
 */
export async function listTemplateGigs(role: StaffRole, limit = 50): Promise<TemplateGig[]> {
  const now = new Date()
  const canReadGigs = permissionAllowed(role, 'gigs:read')
  const conditions = [
    eq(gigs.status, 'booked'),
    isNull(gigs.deletedAt),
    or(gte(gigs.endsAt, now), and(isNull(gigs.endsAt), gte(gigs.startsAt, now))),
  ]
  if (!canReadGigs) conditions.push(eq(gigs.publicVisibility, true))
  const rows = await db
    .select({
      id: gigs.id,
      title: gigTitleSql(),
      publicTitle: gigs.publicTitle,
      startsAt: gigs.startsAt,
      endsAt: gigs.endsAt,
      publicVisibility: gigs.publicVisibility,
      venueName: venues.name,
      venueCity: venues.city,
    })
    .from(gigs)
    .leftJoin(venues, eq(gigs.venueId, venues.id))
    .where(and(...conditions))
    .orderBy(asc(gigs.startsAt))
    .limit(limit)
  return rows.flatMap(row => row.startsAt
    ? [{
        id: row.id,
        title: publicGigTitle(row),
        startsAt: row.startsAt,
        endsAt: row.endsAt,
        venueName: row.venueName,
        venueCity: row.venueCity,
        publicVisibility: row.publicVisibility,
      }]
    : [])
}

export function validateProject(value: unknown): VideoProject {
  try {
    return parseVideoProject(value)
  } catch (error) {
    const issue = (error as { issues?: Array<{ message: string, path: PropertyKey[] }> }).issues?.[0]
    throw createError({
      statusCode: 422,
      statusMessage: issue ? `Invalid video project: ${issue.message} (${issue.path.join('.')})` : 'Invalid video project',
    })
  }
}

/** Rejects projects that reference media assets which do not exist (anymore). */
export async function assertProjectAssetsExist(project: VideoProject) {
  const ids = collectProjectAssetIds(project)
  if (!ids.length) return
  const rows = await db.select({ id: mediaAssets.id }).from(mediaAssets).where(inArray(mediaAssets.id, ids))
  if (rows.length !== ids.length) {
    throw createError({ statusCode: 422, statusMessage: 'The project uses media that is no longer in the media library' })
  }
}

export async function getProjectOr404(id: string | undefined) {
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Video project id is required' })
  const [row] = await db.select().from(videoProjects).where(eq(videoProjects.id, id)).limit(1)
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Video project not found' })
  return row
}

export async function listProjectRenders(projectId: string) {
  const jobs = await db.select({
    id: videoRenderJobs.id,
    status: videoRenderJobs.status,
    progress: videoRenderJobs.progress,
    error: videoRenderJobs.error,
    renderEngine: videoRenderJobs.renderEngine,
    width: videoRenderJobs.width,
    height: videoRenderJobs.height,
    fps: videoRenderJobs.fps,
    durationSeconds: videoRenderJobs.durationSeconds,
    outputKey: videoRenderJobs.outputKey,
    createdAt: videoRenderJobs.createdAt,
    finishedAt: videoRenderJobs.finishedAt,
  }).from(videoRenderJobs)
    .where(eq(videoRenderJobs.projectId, projectId))
    .orderBy(desc(videoRenderJobs.createdAt))
    .limit(50)
  return jobs.map(({ outputKey, ...job }) => ({
    ...job,
    videoUrl: job.status === 'completed' && outputKey ? `/api/generated-videos/${job.id}` : null,
  }))
}
