export type CalendarCancellationBehavior = 'delete' | 'mark_cancelled' | 'keep'

export function googleEventIdForGig(gigId: string) {
  const compact = gigId.toLowerCase().replace(/[^0-9a-f]/g, '')
  if (compact.length < 5) throw new Error('Invalid gig id')
  return `nl${compact}`
}

export function shouldHaveCalendarEvent(status: string, startsAt: Date | string | null | undefined) {
  return status === 'booked' && Boolean(startsAt)
}

export function calendarRetryDelayMs(retryCount: number) {
  const attempt = Math.max(0, Math.min(retryCount, 8))
  return Math.min(6 * 60 * 60 * 1000, 60_000 * (2 ** attempt))
}

export function cancellationSummary(title: string) {
  return title.startsWith('[Cancelled]') ? title : `[Cancelled] ${title}`
}

/** Gig fields shown in the agenda hover panel (calendar page and dashboard mini calendar). */
export type PopoverGig = {
  id: string
  title: string
  status: string
  eventType?: string | null
  startsAt: string | Date | null
  endsAt?: string | Date | null
  venueName?: string | null
  venueCity?: string | null
  assignedUserName?: string | null
}
