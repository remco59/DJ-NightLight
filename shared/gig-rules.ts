export const gigStatuses = ['lead', 'booked', 'declined', 'cancelled'] as const
export type GigStatus = typeof gigStatuses[number]

export function canPermanentlyDeleteGig(status: GigStatus) {
  return status === 'declined'
}

export function isPastGig(startsAt: Date | string | null, now = new Date()) {
  if (!startsAt) return false
  return new Date(startsAt).getTime() < now.getTime()
}
