import { describe, expect, it } from 'vitest'
import { roleAllowed } from '../shared/auth'

describe('role authorization', () => {
  it('allows any staff role when no restriction is supplied', () => {
    expect(roleAllowed('content_editor')).toBe(true)
  })

  it('allows explicitly permitted roles', () => {
    expect(roleAllowed('manager', ['owner', 'manager'])).toBe(true)
  })

  it('rejects roles that are not permitted', () => {
    expect(roleAllowed('content_editor', ['owner', 'manager'])).toBe(false)
  })
})
