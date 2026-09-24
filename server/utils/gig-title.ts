import { sql } from 'drizzle-orm'
import { gigs, venues } from '../../db/schema'
import { UNTITLED_GIG } from '../../shared/gig-title'

/**
 * `gigDisplayTitle` as a select field: the title, else the venue name, else
 * the event type. The venue comes from a subquery so it works in any query
 * that selects from `gigs`, with or without a venue join.
 */
export function gigTitleSql() {
  return sql<string>`coalesce(
    nullif(trim(${gigs.title}), ''),
    (select nullif(trim(${venues.name}), '') from ${venues} where ${venues.id} = ${gigs.venueId}),
    nullif(trim(${gigs.eventType}), ''),
    ${UNTITLED_GIG}
  )`
}
