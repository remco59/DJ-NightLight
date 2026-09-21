export const staffRoles = ['owner', 'dj', 'manager', 'content_editor'] as const
export type StaffRole = typeof staffRoles[number]

export const adminPermissions = [
  'account:manage',
  'dashboard:view',
  'gigs:read',
  'gigs:manage',
  'operations:manage',
  'content:manage',
  'system:manage',
  'users:manage',
] as const
export type AdminPermission = typeof adminPermissions[number]

const rolePermissions: Record<StaffRole, readonly AdminPermission[]> = {
  owner: adminPermissions,
  manager: ['account:manage', 'dashboard:view', 'gigs:read', 'gigs:manage', 'operations:manage'],
  dj: ['account:manage', 'dashboard:view', 'gigs:read'],
  content_editor: ['account:manage', 'dashboard:view', 'content:manage'],
}

export function roleAllowed(role: StaffRole, allowed?: readonly StaffRole[]) {
  return !allowed?.length || allowed.includes(role)
}

export function permissionAllowed(role: StaffRole, permission: AdminPermission) {
  return rolePermissions[role].includes(permission)
}
