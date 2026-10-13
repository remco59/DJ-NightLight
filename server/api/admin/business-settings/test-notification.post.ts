import { z } from 'zod'
import { ownerNotificationKinds, ownerNotificationSample } from '../../../../shared/owner-notifications'
import { sendEmail } from '../../../utils/email-provider'
import { buildOwnerNotificationEmail, loadOwnerNotificationSettings } from '../../../utils/owner-notifications'
import { requireStaff } from '../../../utils/require-staff'

const bodySchema = z.object({ kind: z.enum(ownerNotificationKinds).default('new_inquiry') })

/** Sends an example notification to the saved address, so the owner can check that it arrives. */
export default defineEventHandler(async (event) => {
  await requireStaff(event, ['owner'])
  const { kind } = await readValidatedBody(event, bodySchema.parse)
  const settings = await loadOwnerNotificationSettings()
  if (!settings.email) throw createError({ statusCode: 409, statusMessage: 'Vul eerst een e-mailadres voor meldingen in en sla het op.' })

  const email = await buildOwnerNotificationEmail(kind, ownerNotificationSample(kind))
  try {
    await sendEmail({ to: settings.email, idempotencyKey: `owner-test:${Date.now()}`, ...email, subject: `[Test] ${email.subject}` })
  }
  catch (error) {
    throw createError({ statusCode: 502, statusMessage: error instanceof Error ? error.message : 'Testmelding versturen mislukt' })
  }
  return { ok: true, recipient: settings.email }
})
