import {
  consumeEmailOutbox,
  materializeScheduledEmailJobs,
  processDueEmailJobs,
} from '../../../utils/email-automation'
import { requireStaff } from '../../../utils/require-staff'

export default defineEventHandler(async (event) => {
  await requireStaff(event, ['owner', 'manager'])
  const outbox = await consumeEmailOutbox()
  await materializeScheduledEmailJobs()
  const jobs = await processDueEmailJobs(25)
  return { outbox, ...jobs }
})
