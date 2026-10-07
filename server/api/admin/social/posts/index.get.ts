import { z } from 'zod'
import { socialTabs } from '../../../../../shared/social'
import { listSocialPosts, socialOverview } from '../../../../utils/social-queue'
import { loadActiveAccount } from '../../../../utils/social-publish'
import { requireStaff } from '../../../../utils/require-staff'

const querySchema = z.object({
  tab: z.enum(socialTabs).optional(),
  // Agenda: only posts with a moment inside this period.
  start: z.string().datetime({ offset: true }).optional(),
  end: z.string().datetime({ offset: true }).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
}).refine(query => Boolean(query.start) === Boolean(query.end), { message: 'Geef zowel start als einde van de periode op' })

/** Social posts for the Social page (by tab) or the Agenda (by period), plus counts and stat cards. */
export default defineEventHandler(async (event) => {
  await requireStaff(event, ['owner', 'manager', 'content_editor'])
  const query = querySchema.parse(getQuery(event))

  const [posts, overview, instagram] = await Promise.all([
    listSocialPosts({
      tab: query.tab,
      start: query.start ? new Date(query.start) : undefined,
      end: query.end ? new Date(query.end) : undefined,
      limit: query.limit,
    }),
    socialOverview(),
    loadActiveAccount('instagram'),
  ])

  return {
    posts,
    ...overview,
    account: instagram ? { username: instagram.username, accountType: instagram.accountType } : null,
  }
})
