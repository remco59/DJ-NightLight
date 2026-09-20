import { describe, expect, it } from 'vitest'
import { decryptSecret, encryptSecret, maskSecret } from '../shared/secret-box'

const password = 'a-session-password-that-is-at-least-32-chars'

describe('secret box', () => {
  it('round-trips a secret', () => {
    const stored = encryptSecret('rk_test_abcdefghij123456', password)
    expect(stored).not.toContain('rk_test')
    expect(decryptSecret(stored, password)).toBe('rk_test_abcdefghij123456')
  })

  it('rejects the wrong password and tampering', () => {
    const stored = encryptSecret('whsec_abcdefghij123456', password)
    expect(() => decryptSecret(stored, 'another-session-password-that-is-32-chars!')).toThrow()
    expect(() => decryptSecret(`${stored.slice(0, -2)}AA`, password)).toThrow()
  })

  it('refuses short passwords', () => {
    expect(() => encryptSecret('x', 'short')).toThrow()
  })

  it('masks all but a prefix and suffix', () => {
    expect(maskSecret('rk_test_abcdefghij123456')).toBe('rk_test…3456')
  })
})
