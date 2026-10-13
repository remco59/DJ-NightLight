import { z } from 'zod'
import { gigStatuses } from '../gig-rules'

// A change made while offline and sent later. `changeId` is generated on the
// device so a retry after a lost response is recognised and applied only once.
const base = {
  changeId: z.string().uuid(),
  // When the change was made on the device; the server clamps it to "now" at most.
  createdAt: z.string().datetime(),
}

export const offlineChangeSchema = z.discriminatedUnion('kind', [
  z.object({ ...base, kind: z.literal('note'), text: z.string().trim().min(1).max(2000) }),
  z.object({ ...base, kind: z.literal('status'), status: z.enum(gigStatuses), expectedStatus: z.enum(gigStatuses) }),
])

export type OfflineChange = z.infer<typeof offlineChangeSchema>
