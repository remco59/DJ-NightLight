import os from 'node:os'
import { pickServerAddress, type ServerMetrics } from '../../shared/system-status'
import { sql } from './db'

/** Runs a trivial query a few times and reports the median, so one slow sample doesn't colour the result. */
async function pingDatabase(samples = 3): Promise<ServerMetrics['database']> {
  const timings: number[] = []
  try {
    for (let i = 0; i < samples; i++) {
      const started = performance.now()
      await sql`SELECT 1`
      timings.push(performance.now() - started)
    }
  } catch {
    return { ok: false, latencyMs: null }
  }
  timings.sort((a, b) => a - b)
  return { ok: true, latencyMs: Math.round(timings[Math.floor(timings.length / 2)]! * 10) / 10 }
}

export async function collectServerMetrics(clientIp: string | null): Promise<ServerMetrics> {
  const database = await pingDatabase()
  const cpuCount = Math.max(os.cpus().length, 1)
  const totalBytes = os.totalmem()
  const appUptimeSeconds = process.uptime()

  return {
    appVersion: String(useRuntimeConfig().appVersion || 'development'),
    nodeVersion: process.version,
    hostname: os.hostname(),
    platform: `${os.type()} ${os.arch()}`,
    appUptimeSeconds,
    hostUptimeSeconds: os.uptime(),
    startedAt: new Date(Date.now() - appUptimeSeconds * 1000).toISOString(),
    serverIp: pickServerAddress(os.networkInterfaces()),
    clientIp,
    cpuCount,
    cpuLoadPercent: Math.round((os.loadavg()[0]! / cpuCount) * 100),
    memory: {
      totalBytes,
      usedBytes: totalBytes - os.freemem(),
      appBytes: process.memoryUsage().rss,
    },
    database,
  }
}
