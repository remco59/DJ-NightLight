import { clientPortalImageInputSchema } from '../../../../../shared/client-portal'
import { recordAudit } from '../../../../utils/audit'
import { sql } from '../../../../utils/db'
import { requireStaff } from '../../../../utils/require-staff'
import { requireUuidParam } from '../../../../utils/route-params'

export default defineEventHandler(async (event) => {
  const user = await requireStaff(event, ['owner', 'manager'])
  const gigId = requireUuidParam(event, 'id')

  const parsed = clientPortalImageInputSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 422, statusMessage: parsed.error.issues[0]?.message || 'Ongeldige afbeelding' })
  }

  const rows = await sql`
    UPDATE gigs
    SET client_portal_image_url = ${parsed.data.imageUrl}, updated_at = now()
    WHERE id = ${gigId} AND deleted_at IS NULL
    RETURNING client_portal_image_url AS "imageUrl"
  ` as Array<{ imageUrl: string | null }>

  if (!rows[0]) throw createError({ statusCode: 404, statusMessage: 'Gig niet gevonden' })

  await recordAudit({
    userId: user.id,
    entityType: 'gig',
    entityId: gigId,
    action: 'client_portal_image_updated',
    metadata: { imageUrl: rows[0].imageUrl },
  })

  return { imageUrl: rows[0].imageUrl }
})
