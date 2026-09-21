import { z } from 'zod'

export const managedUserRoles = ['dj', 'manager', 'content_editor'] as const

const normalizedEmail = z.email().trim().toLowerCase()

export const createManagedUserSchema = z.object({
  email: normalizedEmail,
  name: z.string().trim().min(2).max(200),
  role: z.enum(managedUserRoles),
  password: z.string().min(12).max(200),
})

export const updateManagedUserSchema = z.object({
  email: normalizedEmail.optional(),
  name: z.string().trim().min(2).max(200).optional(),
  role: z.enum(managedUserRoles).optional(),
  active: z.boolean().optional(),
})

export const resetManagedUserPasswordSchema = z.object({
  password: z.string().min(12).max(200),
})
