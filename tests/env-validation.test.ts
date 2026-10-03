import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { validateEnv } from '../server/utils/env-validation'

describe('env-validation', () => {
  const originalEnv = process.env

  beforeEach(() => {
    // Reset to minimal valid state for each test
    process.env = {
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
      NUXT_SESSION_PASSWORD: 'a'.repeat(32),
      NUXT_PUBLIC_SITE_URL: 'http://localhost:3000',
      OWNER_BOOTSTRAP_TOKEN: 'bootstrap-token',
    }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('passes with valid required environment variables', () => {
    const result = validateEnv()
    expect(result.DATABASE_URL).toBe('postgresql://user:pass@localhost:5432/db')
  })

  it('fails when DATABASE_URL is missing', () => {
    delete process.env.DATABASE_URL

    expect(() => validateEnv()).toThrow('DATABASE_URL: Invalid input')
  })

  it('fails when NUXT_SESSION_PASSWORD is too short', () => {
    process.env.NUXT_SESSION_PASSWORD = 'short'

    expect(() => validateEnv()).toThrow('NUXT_SESSION_PASSWORD must be at least 32 characters')
  })

  it('fails when NUXT_PUBLIC_SITE_URL is not a valid URL', () => {
    process.env.NUXT_PUBLIC_SITE_URL = 'not-a-url'

    expect(() => validateEnv()).toThrow('NUXT_PUBLIC_SITE_URL must be a valid URL')
  })

  it('accepts optional integration variables when empty', () => {
    process.env.STRIPE_RESTRICTED_KEY = ''
    process.env.GOOGLE_CALENDAR_CLIENT_ID = ''

    const result = validateEnv()
    expect(result.STRIPE_RESTRICTED_KEY).toBe('')
    expect(result.GOOGLE_CALENDAR_CLIENT_ID).toBe('')
  })
})