import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { emailJobs } from '../../../../db/schema'
import { db } from '../../../utils/db'
import { processEmailJob } from '../../../utils/email-automation'
import { requireStaff } from '../../../utils/require-staff'

const schema = z.object({ jobId: z.string().uuid() })

export default defineEventHandler(async (event) => {
  await requireStaff(event, ['owner', 'manager'])
  const { jobId } = await readValidatedBody(event, schema.parse)
  const [job] = await db.update(emailJobs).set({
    status: 'pending',
    runAt: new Date(),
    lastError: null,
    updatedAt: new Date(),
  }).where(eq(emailJobs.id, jobId)).returning()
  if (!job) throw createError({ statusCode: 404, statusMessage: 'Email job not found' })
  try {
    return { result: await processEmailJob(job.id) }
  } catch (error) {
    throw createError({ statusCode: 502, statusMessage: error instanceof Error ? error.message : 'Retry failed' })
  }
})
