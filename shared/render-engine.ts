import { z } from 'zod'

// Engines the render worker can actually encode with, and the setting that
// chooses between them. 'auto' picks the best engine the worker detected.
export const RENDER_ENGINES = ['cpu', 'intel'] as const
export type RenderEngine = typeof RENDER_ENGINES[number]

export const RENDER_ENGINE_SETTINGS = ['auto', ...RENDER_ENGINES] as const
export type RenderEngineSetting = typeof RENDER_ENGINE_SETTINGS[number]

export const renderEngineSettingSchema = z.enum(RENDER_ENGINE_SETTINGS)
export const renderSettingsInputSchema = z.object({ engine: renderEngineSettingSchema })

export const RENDER_ENGINE_LABELS: Record<RenderEngineSetting, string> = {
  auto: 'Automatisch',
  cpu: 'CPU (software)',
  intel: 'Intel GPU (VAAPI)',
}

export type RenderEngineCapability = {
  id: RenderEngine
  available: boolean
  detail: string
}

/** A worker that has not reported within this window is shown as offline. */
export const RENDER_WORKER_OFFLINE_AFTER_MS = 3 * 60_000

/** Intel first: automatic mode prefers hardware encoding when it works. */
const AUTO_PREFERENCE: readonly RenderEngine[] = ['intel', 'cpu']

export function isEngineAvailable(engine: RenderEngine, capabilities: readonly RenderEngineCapability[]) {
  if (engine === 'cpu') return true
  return capabilities.some(capability => capability.id === engine && capability.available)
}

/**
 * Turns the saved setting into the engine a job renders with. An explicitly
 * chosen engine that is unavailable throws instead of silently using the CPU.
 */
export function resolveRenderEngine(setting: RenderEngineSetting, capabilities: readonly RenderEngineCapability[]): RenderEngine {
  if (setting === 'auto') return AUTO_PREFERENCE.find(engine => isEngineAvailable(engine, capabilities)) ?? 'cpu'
  if (isEngineAvailable(setting, capabilities)) return setting
  const detail = capabilities.find(capability => capability.id === setting)?.detail
  throw new Error(`${RENDER_ENGINE_LABELS[setting]} is niet beschikbaar${detail ? `: ${detail}` : ''}`)
}

export function parseRenderEngineSetting(value: unknown): RenderEngineSetting {
  const parsed = renderEngineSettingSchema.safeParse(value)
  return parsed.success ? parsed.data : 'auto'
}
