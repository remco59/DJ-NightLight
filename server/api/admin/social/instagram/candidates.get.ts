import { INSTAGRAM_PENDING_COOKIE, openPendingToken } from '../../../../utils/instagram-pending'
import { requireStaff } from '../../../../utils/require-staff'
import { listInstagramChoices } from '../../../../utils/social-accounts'

/** The Instagram accounts waiting for the owner's choice after a Facebook login that granted several. */
export default defineEventHandler(async (event) => {
  const user = await requireStaff(event, ['owner'])
  const userToken = openPendingToken({
    value: getCookie(event, INSTAGRAM_PENDING_COOKIE),
    userId: user.id,
    password: String(useRuntimeConfig().session.password || ''),
  })
  if (!userToken) {
    throw createError({ statusCode: 410, statusMessage: 'De keuze is verlopen. Verbind Instagram opnieuw.' })
  }

  try {
    return { accounts: await listInstagramChoices(userToken) }
  } catch {
    throw createError({ statusCode: 502, statusMessage: 'Instagram-accounts ophalen is niet gelukt. Verbind opnieuw.' })
  }
})
