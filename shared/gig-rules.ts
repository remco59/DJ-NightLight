export const gigStatuses = ['lead', 'booked', 'declined', 'cancelled'] as const
export type GigStatus = typeof gigStatuses[number]
export type GigRemovalMode = 'delete' | 'archive'

export function gigRemovalMode(status: GigStatus, hasFinancialHistory: boolean): GigRemovalMode | null {
  if (status !== 'declined') return null
  return hasFinancialHistory ? 'archive' : 'delete'
}

export function canPermanentlyDeleteGig(status: GigStatus, hasFinancialHistory = false) {
  return gigRemovalMode(status, hasFinancialHistory) === 'delete'
}

export function isPastGig(startsAt: Date | string | null, now = new Date()) {
  if (!startsAt) return false
  return new Date(startsAt).getTime() < now.getTime()
}
