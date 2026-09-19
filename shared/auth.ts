export const staffRoles = ['owner', 'dj', 'manager', 'content_editor'] as const
export type StaffRole = typeof staffRoles[number]

export function roleAllowed(role: StaffRole, allowed?: readonly StaffRole[]) {
  return !allowed?.length || allowed.includes(role)
}
