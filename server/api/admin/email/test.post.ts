import { z } from 'zod'
import { processEmailJob, queueTestEmail } from '../../../utils/email-automation'
import { requireStaff } from '../../../utils/require-staff'

const schema = z.object({
  templateKey: z.string().min(1).max(80),
  recipient: z.string().email(),
  variables: z.record(z.string(), z.union([z.string(), z.number(), z.null()])).default({}),
})

export default defineEventHandler(async (event) => {
  await requireStaff(event, ['owner', 'manager'])
  const input = await readValidatedBody(event, schema.parse)
  const job = await queueTestEmail(input.templateKey, input.recipient, input.variables)
  if (!job) throw createError({ statusCode: 409, statusMessage: 'Het template is uitgeschakeld' })
  try {
    const result = await processEmailJob(job.id)
    return { jobId: job.id, result }
  } catch (error) {
    throw createError({
      statusCode: 502,
      statusMessage: error instanceof Error ? error.message : 'Testmail versturen mislukt',
    })
  }
})
