import { z } from 'zod'
import { queuePortalEmails } from '../../../../../utils/email-automation'
import { issuePortalLink } from '../../../../../utils/issue-portal-link'
import { requireStaff } from '../../../../../utils/require-staff'

const schema = z.object({
  expiresInDays: z.coerce.number().int().min(1).max(365).default(30),
  revokeExisting: z.boolean().default(false),
})

export default defineEventHandler(async (event) => {
  const user = await requireStaff(event, ['owner', 'manager'])
  const gigId = getRouterParam(event, 'id')
  if (!gigId) throw createError({ statusCode: 400, statusMessage: 'Gig-ID is verplicht' })
  const parsed = schema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 422, statusMessage: 'Ongeldige instellingen voor de portaallink' })

  const { link, token } = await issuePortalLink({
    gigId,
    userId: user.id,
    expiresInDays: parsed.data.expiresInDays,
    revokeExisting: parsed.data.revokeExisting,
    action: 'portal_link_created',
  })
  const config = useRuntimeConfig()
  const baseUrl = String(config.public.siteUrl).replace(/\/$/, '')
  const url = `${baseUrl}/client/${token}`
  await queuePortalEmails(gigId, url, link.id)
  return { id: link.id, expiresAt: link.expiresAt, url }
})
