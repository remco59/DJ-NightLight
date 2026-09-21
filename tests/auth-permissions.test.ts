import { describe, expect, it } from 'vitest'
import { permissionAllowed } from '../shared/auth'

describe('admin role permissions', () => {
  it('gives owner every administrative capability', () => {
    expect(permissionAllowed('owner', 'users:manage')).toBe(true)
    expect(permissionAllowed('owner', 'system:manage')).toBe(true)
    expect(permissionAllowed('owner', 'content:manage')).toBe(true)
    expect(permissionAllowed('owner', 'operations:manage')).toBe(true)
  })

  it('limits managers to operational work', () => {
    expect(permissionAllowed('manager', 'gigs:manage')).toBe(true)
    expect(permissionAllowed('manager', 'operations:manage')).toBe(true)
    expect(permissionAllowed('manager', 'users:manage')).toBe(false)
    expect(permissionAllowed('manager', 'content:manage')).toBe(false)
  })

  it('keeps DJs read-only on gigs', () => {
    expect(permissionAllowed('dj', 'gigs:read')).toBe(true)
    expect(permissionAllowed('dj', 'gigs:manage')).toBe(false)
    expect(permissionAllowed('dj', 'operations:manage')).toBe(false)
  })

  it('limits content editors to content tools', () => {
    expect(permissionAllowed('content_editor', 'content:manage')).toBe(true)
    expect(permissionAllowed('content_editor', 'gigs:read')).toBe(false)
    expect(permissionAllowed('content_editor', 'system:manage')).toBe(false)
  })
})
