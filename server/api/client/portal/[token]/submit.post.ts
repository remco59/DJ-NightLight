import { eq } from 'drizzle-orm'
import { auditLogs, contractSubmissions, musicWishes } from '../../../../../db/schema'
import { gigHasStarted } from '../../../../../shared/gig-phase'
import { musicWishSchema, timedListRowSchema, validateQuestionnaireAnswers, visibleFields } from '../../../../../shared/questionnaire'
import { db } from '../../../../utils/db'
import { resolvePortalAccess } from '../../../../utils/portal-access'
import { getPortalForm } from '../../../../utils/portal-form'
import { queueOwnerNotification } from '../../../../utils/owner-notifications'
import { assertRateLimit } from '../../../../utils/rate-limit'
import { hashPortalToken } from '../../../../utils/portal-token'
import { z } from 'zod'

const submissionSchema = z.object({
  answers: z.record(z.string(), z.union([z.string().max(10000), z.number(), z.boolean(), z.array(z.string().max(500)).max(50), z.array(timedListRowSchema).max(50)])),
  acceptedName: z.string().trim().min(2).max(200),
  wishes: z.array(musicWishSchema).max(200),
})

export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, 'token') || ''
  const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  assertRateLimit(event, 'portal', `${hashPortalToken(ip).slice(0, 16)}:${hashPortalToken(token).slice(0, 16)}:submit`)
  const access = await resolvePortalAccess(token)
  if (!access) throw createError({ statusCode: 404, statusMessage: 'Deze portaallink is ongeldig of verlopen' })
  if (gigHasStarted(access)) throw createError({ statusCode: 409, statusMessage: 'Het event is begonnen; gegevens en muziekwensen kunnen niet meer worden aangepast' })
  const parsed = submissionSchema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 422, statusMessage: parsed.error.issues[0]?.message || 'Controleer je antwoorden en probeer het opnieuw' })

  const form = await getPortalForm(access.gigId)
  if (!form.enabled) throw createError({ statusCode: 409, statusMessage: 'Voor deze boeking is geen formulier nodig' })
  // The client can send the form again (and change it) until the party begins.
  const answerErrors = validateQuestionnaireAnswers(form.fields, parsed.data.answers)
  if (Object.keys(answerErrors).length) throw createError({ statusCode: 422, statusMessage: 'Vul alle verplichte velden in', data: { fieldErrors: answerErrors } })
  // Answers to questions that are hidden by a condition are not kept.
  const versionedAnswers = Object.fromEntries(visibleFields(form.fields, parsed.data.answers).map(field => [field.id, parsed.data.answers[field.id]]))
  const now = new Date()

  const submission = await db.transaction(async (tx) => {
    const values = {
      templateVersionId: form.templateVersionId,
      gigFormId: form.gigForm?.id ?? null,
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
      metadata: { submissionId: saved.id, templateVersion: form.templateVersion, gigFormId: form.gigForm?.id ?? null, wishCount: parsed.data.wishes.length },
    })
    return saved
  })
  await queueOwnerNotification('portal_submitted', access.gigId, {
    gigId: access.gigId,
    gigTitle: access.title,
    acceptedName: parsed.data.acceptedName,
    wishCount: parsed.data.wishes.length,
  }, `${submission.id}:${now.getTime()}`)
  return { ok: true, submittedAt: submission.submittedAt }
})
