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
