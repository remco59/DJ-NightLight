import { describe, expect, it } from 'vitest'
import { sanitizeOperationalMetadata } from '../server/utils/ops-log'

describe('operational metadata redaction', () => {
  it('redacts common secret fields recursively', () => {
    expect(sanitizeOperationalMetadata({
      email: 'test@example.com',
      accessToken: 'abc',
      nested: {
        password: 'secret',
        api_key: 'key',
        harmless: 'visible',
      },
    })).toEqual({
      email: 'test@example.com',
      accessToken: '[REDACTED]',
      nested: {
        password: '[REDACTED]',
        api_key: '[REDACTED]',
        harmless: 'visible',
      },
    })
  })

  it('preserves non-sensitive arrays and scalar values', () => {
    expect(sanitizeOperationalMetadata({ values: [1, 'two', true] }))
      .toEqual({ values: [1, 'two', true] })
  })
})
