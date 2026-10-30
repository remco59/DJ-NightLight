/** A gig counts as finished once its end (or, without an end, its start) has passed. */
export function gigIsFinished(gig: { startsAt: Date | string | null, endsAt: Date | string | null }, now = new Date()) {
  const moment = gig.endsAt || gig.startsAt
  if (!moment) return false
  return new Date(moment).getTime() <= now.getTime()
}

/** The party has begun (or, without a start, is over). The booking form can be changed until then. */
export function gigHasStarted(gig: { startsAt: Date | string | null, endsAt: Date | string | null }, now = new Date()) {
  if (!gig.startsAt) return gigIsFinished(gig, now)
  return new Date(gig.startsAt).getTime() <= now.getTime()
}
