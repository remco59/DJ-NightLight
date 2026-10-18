// Helpers shared by the status endpoint and the Systeemstatus page.

export type StatusTone = 'ok' | 'warn' | 'bad'

export type ServerMetrics = {
  appVersion: string
  nodeVersion: string
  hostname: string
  platform: string
  /** Seconds the web process has been running (resets on every deploy or restart). */
  appUptimeSeconds: number
  /** Seconds the machine underneath has been running. */
  hostUptimeSeconds: number
  startedAt: string
  /** First non-loopback IPv4 address of the server, or null when none is found. */
  serverIp: string | null
  /** Address the current request came from, i.e. the viewer. */
  clientIp: string | null
  cpuCount: number
  /** 1-minute load average divided by the number of cores, as a percentage (can exceed 100). */
  cpuLoadPercent: number
  memory: { totalBytes: number, usedBytes: number, appBytes: number }
  database: { ok: boolean, latencyMs: number | null }
}

type NetworkInterfaces = Record<string, ReadonlyArray<{ address: string, family: string | number, internal: boolean }> | undefined>

/** Picks the address people would use to reach this server: the first external IPv4 one. */
export function pickServerAddress(interfaces: NetworkInterfaces): string | null {
  for (const addresses of Object.values(interfaces)) {
    for (const entry of addresses ?? []) {
      const isV4 = entry.family === 'IPv4' || entry.family === 4
      if (isV4 && !entry.internal) return entry.address
    }
  }
  return null
}

/** "3 d 4 u", "2 u 15 m", "45 m", "30 s": the two largest units, in Dutch. */
export function formatUptime(totalSeconds: number | null | undefined): string {
  if (totalSeconds == null || !Number.isFinite(totalSeconds) || totalSeconds < 0) return '—'
  const seconds = Math.floor(totalSeconds)
  const days = Math.floor(seconds / 86_400)
  const hours = Math.floor((seconds % 86_400) / 3_600)
  const minutes = Math.floor((seconds % 3_600) / 60)
  if (days > 0) return `${days} d ${hours} u`
  if (hours > 0) return `${hours} u ${minutes} m`
  if (minutes > 0) return `${minutes} m`
  return `${seconds} s`
}

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return '—'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  const digits = unit === 0 || value >= 100 ? 0 : 1
  return `${value.toFixed(digits).replace('.', ',')} ${units[unit]}`
}

export function formatLatency(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms)) return '—'
  return ms < 10 ? `${ms.toFixed(1).replace('.', ',')} ms` : `${Math.round(ms)} ms`
}

/** Database queries should take a few milliseconds; a round trip from the browser includes the network. */
export function latencyTone(ms: number | null | undefined, kind: 'database' | 'roundtrip'): StatusTone {
  if (ms == null) return 'bad'
  const [warnAt, badAt] = kind === 'database' ? [100, 400] : [400, 1200]
  if (ms >= badAt) return 'bad'
  return ms >= warnAt ? 'warn' : 'ok'
}

/** Resource meters: green until 70%, amber until 90%, red above. */
export function loadTone(percent: number): StatusTone {
  if (percent >= 90) return 'bad'
  return percent >= 70 ? 'warn' : 'ok'
}

/** Points for an SVG polyline in a width x height box; a single sample is drawn flat. */
export function sparklinePoints(values: readonly number[], width: number, height: number, pad = 3): string {
  if (!values.length) return ''
  const max = Math.max(...values)
  const min = Math.min(...values)
  const span = max - min || 1
  const step = values.length > 1 ? width / (values.length - 1) : 0
  return values
    .map((value, index) => {
      const x = values.length > 1 ? index * step : width / 2
      const y = max === min ? height / 2 : height - pad - ((value - min) / span) * (height - pad * 2)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}
