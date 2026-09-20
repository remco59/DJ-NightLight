import { z } from 'zod'

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(8).max(200),
  newPassword: z.string().min(12, 'New password must be at least 12 characters.').max(200),
  confirmPassword: z.string().min(1).max(200),
}).superRefine((value, ctx) => {
  if (value.newPassword !== value.confirmPassword) {
    ctx.addIssue({
      code: 'custom',
      path: ['confirmPassword'],
      message: 'New passwords do not match.',
    })
  }

  if (value.newPassword === value.currentPassword) {
    ctx.addIssue({
      code: 'custom',
      path: ['newPassword'],
      message: 'Choose a password that is different from your current password.',
    })
  }
})
