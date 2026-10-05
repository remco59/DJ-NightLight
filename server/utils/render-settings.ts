import { eq } from 'drizzle-orm'
import { renderSettings, renderWorkerStatus } from '../../db/schema'
import {
  RENDER_WORKER_OFFLINE_AFTER_MS,
  parseRenderEngineSetting,
  resolveRenderEngine,
  type RenderEngine,
  type RenderEngineCapability,
} from '../../shared/render-engine'
import { db } from './db'

export async function loadRenderSettings() {
  const [[settings], [status]] = await Promise.all([
    db.select().from(renderSettings).where(eq(renderSettings.key, 'default')).limit(1),
    db.select().from(renderWorkerStatus).where(eq(renderWorkerStatus.key, 'default')).limit(1),
  ])
  const engine = parseRenderEngineSetting(settings?.engine)
  const capabilities: RenderEngineCapability[] = status?.capabilities ?? []
  const workerOnline = Boolean(status && Date.now() - status.heartbeatAt.getTime() < RENDER_WORKER_OFFLINE_AFTER_MS)

  let activeEngine: RenderEngine | null = null
  if (status) {
    try {
      activeEngine = resolveRenderEngine(engine, capabilities)
    } catch {
      activeEngine = null
    }
  }

  return {
    engine,
    activeEngine,
    capabilities,
    detectedAt: status?.detectedAt.toISOString() ?? null,
    heartbeatAt: status?.heartbeatAt.toISOString() ?? null,
    workerOnline,
  }
}
