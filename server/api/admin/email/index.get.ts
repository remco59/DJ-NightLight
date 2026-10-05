import { desc, eq } from 'drizzle-orm'
import {
  emailDeliveryAttempts,
  emailJobs,
  emailTemplates,
  gigEmailSuppressions,
  gigs,
} from '../../../../db/schema'
import { db, sql } from '../../../utils/db'
import { emailProviderConfigured } from '../../../utils/email-provider'
import { requireStaff } from '../../../utils/require-staff'
import { gigTitleSql } from '../../../utils/gig-title'

export default defineEventHandler(async (event) => {
  await requireStaff(event)

  const templates = await db.select().from(emailTemplates).orderBy(emailTemplates.name)
  const templateBrandingRows = await sql`
    SELECT key, hero_image_url AS "heroImageUrl"
    FROM email_templates
  ` as Array<{ key: string, heroImageUrl: string | null }>
  const heroByTemplate = new Map(templateBrandingRows.map(row => [row.key, row.heroImageUrl]))
  const brandingRows = await sql`
    SELECT email_default_hero_image_url AS "defaultHeroImageUrl"
    FROM business_settings
    WHERE key = 'default'
    LIMIT 1
  ` as Array<{ defaultHeroImageUrl: string | null }>

  const jobs = await db.select({
    id: emailJobs.id,
    templateKey: emailJobs.templateKey,
    gigId: emailJobs.gigId,
    invoiceId: emailJobs.invoiceId,
    recipient: emailJobs.recipient,
    runAt: emailJobs.runAt,
    status: emailJobs.status,
    attemptCount: emailJobs.attemptCount,
    lastError: emailJobs.lastError,
    sentAt: emailJobs.sentAt,
    createdAt: emailJobs.createdAt,
    gigTitle: gigTitleSql(),
  }).from(emailJobs)
    .leftJoin(gigs, eq(emailJobs.gigId, gigs.id))
    .orderBy(desc(emailJobs.createdAt))
    .limit(100)

  const attempts = await db.select().from(emailDeliveryAttempts)
    .orderBy(desc(emailDeliveryAttempts.attemptedAt))
    .limit(100)

  const suppressions = await db.select({
    id: gigEmailSuppressions.id,
    gigId: gigEmailSuppressions.gigId,
    templateKey: gigEmailSuppressions.templateKey,
    gigTitle: gigTitleSql(),
  }).from(gigEmailSuppressions)
    .innerJoin(gigs, eq(gigEmailSuppressions.gigId, gigs.id))
    .orderBy(desc(gigEmailSuppressions.createdAt))

  const gigOptions = await db.select({ id: gigs.id, title: gigTitleSql(), startsAt: gigs.startsAt, status: gigs.status })
    .from(gigs).orderBy(desc(gigs.startsAt)).limit(150)

  return {
    providerConfigured: await emailProviderConfigured(),
    branding: {
      defaultHeroImageUrl: brandingRows[0]?.defaultHeroImageUrl || null,
    },
    templates: templates.map(template => ({
      ...template,
      heroImageUrl: heroByTemplate.get(template.key) || null,
    })),
    jobs,
    attempts,
    suppressions,
    gigOptions,
  }
})
