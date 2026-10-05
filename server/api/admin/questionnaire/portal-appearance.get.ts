import { sql } from '../../../utils/db'
import { requireStaff } from '../../../utils/require-staff'

export default defineEventHandler(async (event) => {
  await requireStaff(event, ['owner'])

  const settingsRows = await sql`
    SELECT client_portal_default_image_url AS "defaultImageUrl"
    FROM business_settings
    WHERE key = 'default'
    LIMIT 1
  ` as Array<{ defaultImageUrl: string | null }>

  const gigRows = await sql`
    SELECT
      g.id,
      coalesce(nullif(trim(g.title), ''), nullif(trim(g.event_type), ''), nullif(trim(v.name), ''), 'Gig zonder titel') AS title,
      g.starts_at AS "startsAt",
      g.client_portal_image_url AS "imageUrl",
      v.name AS "venueName"
    FROM gigs g
    LEFT JOIN venues v ON v.id = g.venue_id
    WHERE g.deleted_at IS NULL
    ORDER BY g.starts_at DESC NULLS LAST, g.created_at DESC
    LIMIT 250
  ` as Array<{ id: string, title: string, startsAt: Date | null, imageUrl: string | null, venueName: string | null }>

  return {
    defaultImageUrl: settingsRows[0]?.defaultImageUrl || null,
    gigs: gigRows,
  }
})
