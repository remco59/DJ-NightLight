/** A gig counts as finished once its end (or, without an end, its start) has passed. */
export function gigIsFinished(gig: { startsAt: Date | string | null, endsAt: Date | string | null }, now = new Date()) {
  const moment = gig.endsAt || gig.startsAt
  if (!moment) return false
  return new Date(moment).getTime() <= now.getTime()
}
