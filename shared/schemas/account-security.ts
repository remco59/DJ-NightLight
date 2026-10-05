import { z } from 'zod'

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(8).max(200),
  newPassword: z.string().min(12, 'Het nieuwe wachtwoord moet minstens 12 tekens hebben.').max(200),
  confirmPassword: z.string().min(1).max(200),
}).superRefine((value, ctx) => {
  if (value.newPassword !== value.confirmPassword) {
    ctx.addIssue({
      code: 'custom',
      path: ['confirmPassword'],
      message: 'De nieuwe wachtwoorden komen niet overeen.',
    })
  }

  if (value.newPassword === value.currentPassword) {
    ctx.addIssue({
      code: 'custom',
      path: ['newPassword'],
      message: 'Kies een wachtwoord dat anders is dan je huidige wachtwoord.',
    })
  }
})
