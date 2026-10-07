import { hasFacebookPublishScope, instagramHealth } from '../../../../shared/instagram'
import { loadActiveAccount } from '../../../utils/social-publish'
import { requireStaff } from '../../../utils/require-staff'
import { loadInstagramIntegration } from '../../../utils/integration-settings'
import { isPubliclyReachable } from '../../../utils/social-publish-core'

/** What the publish drawer needs, without the Meta app settings that only the owner may see. */
export default defineEventHandler(async (event) => {
  await requireStaff(event, ['owner', 'manager', 'content_editor'])
  const { account, status } = await loadInstagramIntegration()
  const siteUrl = String(useRuntimeConfig().public.siteUrl || '')

  if (!account) {
    return { facebook: { connected: false, canPublish: false, name: null, message: null }, connected: false, canPublish: false, username: null, accountType: null, message: 'Er is nog geen Instagram-account gekoppeld. Vraag de eigenaar om dat te doen onder Instellingen → Integraties.' }
  }

  const health = instagramHealth({
    appConfigured: status.configured,
    account: { status: account.status, tokenExpiresAt: account.tokenExpiresAt, scopes: account.scopes, lastError: account.lastError },
    // Only the access matters for publishing now; the worker health is shown in Systeemstatus.
    workerLastRunAt: new Date(),
  })
  const blocked = health.level === 'error' || health.level === 'inactive'
  const unreachable = !isPubliclyReachable(siteUrl)

  const page = await loadActiveAccount('facebook')
  const facebook = !page
    ? { connected: false, canPublish: false, name: null, message: null }
    : hasFacebookPublishScope(page.scopes)
        ? { connected: true, canPublish: true, name: page.username, message: null }
        : { connected: true, canPublish: false, name: page.username, message: 'Verbind het account opnieuw om ook op de Facebook-pagina te kunnen posten (toestemming pages_manage_posts).' }

  return {
    facebook,
    connected: true,
    canPublish: !blocked && !unreachable,
    username: account.username,
    accountType: account.accountType,
    message: blocked ? health.detail : unreachable ? 'NUXT_PUBLIC_SITE_URL wijst naar een lokaal adres, dus Meta kan de afbeelding niet ophalen.' : null,
  }
})
