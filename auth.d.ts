import type { StaffRole } from './shared/auth'

declare module '#auth-utils' {
  interface User {
    id: string
    email: string
    name: string
    role: StaffRole
    sessionVersion: number
  }
}

export {}
