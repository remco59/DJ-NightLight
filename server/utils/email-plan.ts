import { eq } from 'drizzle-orm'
import { emailTemplates } from '../../db/schema'
import { emailTemplateLabels } from '../../shared/labels'
import { db } from './db'
import { clientTurnedOffAutomation, isSuppressed } from './email-automation'
import { emailProviderConfigured } from './email-provider'

export type ClientEmailPlan = {
  templateKey: string
  templateName: string
  recipient: string | null
  willSend: boolean
  skipReason: string | null
  delayMinutes: number
  providerConfigured: boolean
}

/**
 * Whether an automatic client email would be queued for this gig, to whom,
 * and if not, why. Shown before any action that sends to a client.
 */
export async function clientEmailPlan(input: { templateKey: string, gigId: string | null, recipient: string | null | undefined }): Promise<ClientEmailPlan> {
  const recipient = input.recipient || null
  const [template] = await db.select({ enabled: emailTemplates.enabled, offsetMinutes: emailTemplates.offsetMinutes, name: emailTemplates.name })
    .from(emailTemplates).where(eq(emailTemplates.key, input.templateKey)).limit(1)
  const templateName = emailTemplateLabels[input.templateKey] || template?.name || input.templateKey
  let skipReason: string | null = null
  if (!recipient) skipReason = 'De klant heeft geen e-mailadres.'
  else if (!template?.enabled) skipReason = `De e-mail "${templateName}" staat uit.`
  else if (await isSuppressed(input.gigId, input.templateKey)) skipReason = 'Deze e-mail is voor deze gig uitgezet.'
  else if (await clientTurnedOffAutomation(input.gigId, input.templateKey)) skipReason = 'Deze automatische e-mail staat uit voor deze klant.'
  return {
    templateKey: input.templateKey,
    templateName,
    recipient,
    willSend: !skipReason,
    skipReason,
    delayMinutes: template?.offsetMinutes ?? 0,
    providerConfigured: await emailProviderConfigured(),
  }
}
