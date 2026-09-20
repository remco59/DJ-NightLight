import { requireStaff } from '../../../utils/require-staff'
import { stripeStatus } from '../../../utils/stripe-settings'

export default defineEventHandler(async (event) => {
  await requireStaff(event, ['owner'])
  return { status: await stripeStatus() }
})
