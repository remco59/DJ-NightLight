import { requireStaff } from '../../utils/require-staff'

export default defineEventHandler(async (event) => {
  const user = await requireStaff(event)
  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
  }
})
