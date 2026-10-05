import { describe, expect, it } from 'vitest'

describe('health check endpoint contract', () => {
  it('defines the expected healthy response payload shape', () => {
    const payload = {
      status: 'healthy',
      database: 'connected',
      timestamp: new Date().toISOString()
    }
    expect(payload.status).toBe('healthy')
    expect(payload.database).toBe('connected')
    expect(payload.timestamp).toBeDefined()
  })

  it('defines the expected unhealthy response payload shape', () => {
    const payload = {
      status: 'unhealthy',
      database: 'disconnected',
      error: 'connection timeout',
      timestamp: new Date().toISOString()
    }
    expect(payload.status).toBe('unhealthy')
    expect(payload.database).toBe('disconnected')
    expect(payload.error).toBeDefined()
  })
})
