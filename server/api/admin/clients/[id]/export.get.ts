import { todayInAmsterdam } from '../../../../../shared/dates'
import { clientExportFileName } from '../../../../../shared/client-privacy'
import { recordAudit } from '../../../../utils/audit'
import { exportClientData } from '../../../../utils/client-privacy'
import { requireStaff } from '../../../../utils/require-staff'
import { requireUuidParam } from '../../../../utils/route-params'

/** Downloads everything held about one client as JSON, for a data access or portability request. */
export default defineEventHandler(async (event) => {
  const user = await requireStaff(event, ['owner', 'manager'])
  const id = requireUuidParam(event, 'id')
  const data = await exportClientData(id)
  if (!data) throw createError({ statusCode: 404, statusMessage: 'Klant niet gevonden' })
  await recordAudit({ userId: user.id, entityType: 'client', entityId: id, action: 'exported' })
  setHeader(event, 'content-type', 'application/json; charset=utf-8')
  setHeader(event, 'content-disposition', `attachment; filename="${clientExportFileName(data.client, todayInAmsterdam())}"`)
  setHeader(event, 'cache-control', 'private, no-store')
  return JSON.stringify(data, null, 2)
})
