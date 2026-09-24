import { eq } from 'drizzle-orm'
import { auditLogs, contractSubmissions, musicWishes } from '../../../../../db/schema'
import { musicWishSchema, validateQuestionnaireAnswers } from '../../../../../shared/questionnaire'
import { db } from '../../../../utils/db'
import { resolvePortalAccess } from '../../../../utils/portal-access'
import { getPortalForm } from '../../../../utils/portal-form'
import { assertPortalRateLimit } from '../../../../utils/portal-rate-limit'
import { hashPortalToken } from '../../../../utils/portal-token'
import { z } from 'zod'

const submissionSchema = z.object({
  answers: z.record(z.string(), z.union([z.string().max(10000), z.number(), z.boolean(), z.array(z.string().max(500)).max(50)])),
  acceptedName: z.string().trim().min(2).max(200),
  wishes: z.array(musicWishSchema).max(200),
})

export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, 'token') || ''
  const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  assertPortalRateLimit(`${hashPortalToken(ip).slice(0, 16)}:${hashPortalToken(token).slice(0, 16)}:submit`)
  const access = await resolvePortalAccess(token)
  if (!access) throw createError({ statusCode: 404, statusMessage: 'Deze portaallink is ongeldig of verlopen' })
  const parsed = submissionSchema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 422, statusMessage: parsed.error.issues[0]?.message || 'Invalid submission' })

  const form = await getPortalForm(access.gigId)
  if (form.submission?.status === 'submitted') throw createError({ statusCode: 409, statusMessage: 'Dit formulier is al ingediend' })
  const answerErrors = validateQuestionnaireAnswers(form.version.fields, parsed.data.answers)
  if (Object.keys(answerErrors).length) throw createError({ statusCode: 422, statusMessage: 'Vul alle verplichte velden in', data: { fieldErrors: answerErrors } })
  const versionedAnswers = Object.fromEntries(form.version.fields.map(field => [field.id, parsed.data.answers[field.id]]))
  const now = new Date()

  const submission = await db.transaction(async (tx) => {
    const values = {
      templateVersionId: form.version.id,
      portalLinkId: access.linkId,
      status: 'submitted' as const,
      answers: versionedAnswers,
      acceptedName: parsed.data.acceptedName,
      acceptedAt: now,
      submittedAt: now,
      updatedAt: now,
    }
    const [saved] = form.submission
      ? await tx.update(contractSubmissions).set(values).where(eq(contractSubmissions.id, form.submission.id)).returning()
      : await tx.insert(contractSubmissions).values({ gigId: access.gigId, ...values }).returning()
    if (!saved) throw createError({ statusCode: 500, statusMessage: 'Inzending opslaan is niet gelukt' })
    await tx.delete(musicWishes).where(eq(musicWishes.gigId, access.gigId))
    if (parsed.data.wishes.length) {
      await tx.insert(musicWishes).values(parsed.data.wishes.map(wish => ({
        gigId: access.gigId,
        category: wish.category,
        artist: wish.artist || null,
        title: wish.title || null,
        spotifyUrl: wish.spotifyUrl || null,
        note: wish.note || null,
        ordering: wish.ordering,
      })))
    }
    await tx.insert(auditLogs).values({
      userId: null,
      entityType: 'gig',
      entityId: access.gigId,
      action: 'portal_submission_completed',
      metadata: { submissionId: saved.id, templateVersion: form.version.version, wishCount: parsed.data.wishes.length },
    })
    return saved
  })
  return { ok: true, submittedAt: submission.submittedAt }
})
