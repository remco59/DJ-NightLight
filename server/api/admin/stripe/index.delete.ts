import { requireStaff } from '../../../utils/require-staff'
import { clearStripeSettings, stripeStatus } from '../../../utils/stripe-settings'

export default defineEventHandler(async (event) => {
  await requireStaff(event, ['owner'])
  await clearStripeSettings()
  return { status: await stripeStatus() }
})
