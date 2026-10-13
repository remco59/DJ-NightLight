import { z } from 'zod'
import { anonymizeClient } from '../../../../utils/client-privacy'
import { requireStaff } from '../../../../utils/require-staff'
import { requireUuidParam } from '../../../../utils/route-params'

const bodySchema = z.object({ confirm: z.literal(true, { error: 'Bevestig dat je de persoonsgegevens wilt verwijderen' }) })

/** Erases a client's personal data (owner only). Invoices stay, as the law requires. Cannot be undone. */
export default defineEventHandler(async (event) => {
  const user = await requireStaff(event, ['owner'])
  const id = requireUuidParam(event, 'id')
  await readValidatedBody(event, bodySchema.parse)
  const result = await anonymizeClient(id, user.id)
  if (!result) throw createError({ statusCode: 404, statusMessage: 'Klant niet gevonden' })
  if ('blocked' in result) throw createError({ statusCode: 409, statusMessage: result.blocked })
  return result.summary
})
