import { describe, expect, it } from 'vitest'
import { changePasswordSchema } from '../shared/schemas/account-security'

describe('password change validation', () => {
  it('accepts a distinct password of at least 12 characters', () => {
    expect(changePasswordSchema.safeParse({
      currentPassword: 'old-password-123',
      newPassword: 'new-password-456',
      confirmPassword: 'new-password-456',
    }).success).toBe(true)
  })

  it('rejects short passwords', () => {
    expect(changePasswordSchema.safeParse({
      currentPassword: 'old-password-123',
      newPassword: 'short',
      confirmPassword: 'short',
    }).success).toBe(false)
  })

  it('rejects mismatched confirmation', () => {
    expect(changePasswordSchema.safeParse({
      currentPassword: 'old-password-123',
      newPassword: 'new-password-456',
      confirmPassword: 'different-password-789',
    }).success).toBe(false)
  })

  it('rejects reusing the current password', () => {
    expect(changePasswordSchema.safeParse({
      currentPassword: 'same-password-123',
      newPassword: 'same-password-123',
      confirmPassword: 'same-password-123',
    }).success).toBe(false)
  })
})
