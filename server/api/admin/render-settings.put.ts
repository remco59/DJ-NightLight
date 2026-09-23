import { renderSettings } from '../../../db/schema'
import { isEngineAvailable, renderSettingsInputSchema } from '../../../shared/render-engine'
import { db } from '../../utils/db'
import { loadRenderSettings } from '../../utils/render-settings'
import { requireStaff } from '../../utils/require-staff'

export default defineEventHandler(async (event) => {
  await requireStaff(event, ['owner'])
  const parsed = renderSettingsInputSchema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 422, statusMessage: 'Choose automatic, CPU or Intel GPU rendering' })

  const { engine } = parsed.data
  if (engine !== 'auto') {
    const current = await loadRenderSettings()
    if (!isEngineAvailable(engine, current.capabilities)) {
      throw createError({ statusCode: 422, statusMessage: 'The render worker has not detected this engine as available' })
    }
  }

  await db.insert(renderSettings)
    .values({ key: 'default', engine, updatedAt: new Date() })
    .onConflictDoUpdate({ target: renderSettings.key, set: { engine, updatedAt: new Date() } })
  return await loadRenderSettings()
})
