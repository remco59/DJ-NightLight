import { describe, expect, it } from 'vitest'
import { createManagedUserSchema, updateManagedUserSchema } from '../shared/schemas/user'

describe('managed user validation', () => {
  it('accepts DJ, manager and content editor accounts', () => {
    for (const role of ['dj', 'manager', 'content_editor'] as const) {
      expect(createManagedUserSchema.safeParse({
        email: `${role}@example.com`,
        name: 'NightLight Staff',
        role,
        password: 'a-secure-password-123',
      }).success).toBe(true)
    }
  })

  it('does not allow creating another owner through staff management', () => {
    expect(createManagedUserSchema.safeParse({
      email: 'owner2@example.com',
      name: 'Second Owner',
      role: 'owner',
      password: 'a-secure-password-123',
    }).success).toBe(false)
  })

  it('allows active state changes without requiring unrelated fields', () => {
    expect(updateManagedUserSchema.safeParse({ active: false }).success).toBe(true)
  })
})
