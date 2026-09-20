type LogLevel = 'info' | 'warn' | 'error'

export function structuredLog(level: LogLevel, event: string, fields: Record<string, unknown> = {}) {
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    event,
    service: 'dj-nightlight',
    ...fields,
  }

  const message = JSON.stringify(payload)
  if (level === 'error') console.error(message)
  else if (level === 'warn') console.warn(message)
  else console.log(message)
}
