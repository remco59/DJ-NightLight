import { clientPortalImageInputSchema } from '../../../../shared/client-portal'
import { recordAudit } from '../../../utils/audit'
import { sql } from '../../../utils/db'
import { requireStaff } from '../../../utils/require-staff'

export default defineEventHandler(async (event) => {
  const user = await requireStaff(event, ['owner'])
  const parsed = clientPortalImageInputSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 422, statusMessage: parsed.error.issues[0]?.message || 'Ongeldige afbeelding' })
  }

  const rows = await sql`
    UPDATE business_settings
    SET client_portal_default_image_url = ${parsed.data.imageUrl}, updated_at = now()
    WHERE key = 'default'
    RETURNING client_portal_default_image_url AS "imageUrl"
  ` as Array<{ imageUrl: string | null }>

  if (!rows[0]) throw createError({ statusCode: 500, statusMessage: 'Standaardafbeelding opslaan is niet gelukt' })

  await recordAudit({
    userId: user.id,
    entityType: 'business_settings',
    entityId: 'default',
    action: 'client_portal_default_image_updated',
    metadata: { imageUrl: rows[0].imageUrl },
  })

  return { imageUrl: rows[0].imageUrl }
})
