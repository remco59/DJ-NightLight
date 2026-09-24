// A gig title is optional: a regular night at a venue (say, a Friday at the
// usual club) has nothing to call it besides the place. Without a title a gig
// is shown under its venue name, then its event type.

type TitledGig = {
  title?: string | null
  venueName?: string | null
  eventType?: string | null
}

export const UNTITLED_GIG = 'Gig'

/** Name used for a gig in the back office, calendar, invoices and emails. */
export function gigDisplayTitle(gig: TitledGig) {
  return gig.title?.trim() || gig.venueName?.trim() || gig.eventType?.trim() || UNTITLED_GIG
}

/**
 * Name used for a gig on the public site. The internal title may name a
 * client ("Wedding Jansen"), so only the public title or the venue is shown.
 */
export function publicGigTitle(gig: { publicTitle?: string | null, venueName?: string | null }) {
  return gig.publicTitle?.trim() || gig.venueName?.trim() || 'DJ NightLight'
}
