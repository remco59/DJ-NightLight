import { db, sql } from '../server/utils/db'
import { clients, gigs, venues } from '../db/schema'

if (process.env.NODE_ENV === 'production') {
  throw new Error('Refusing to seed a production database')
}

try {
  const [client] = await db.insert(clients).values({
    type: 'person',
    firstName: 'Demo',
    lastName: 'Client',
    email: 'demo@example.test',
  }).returning()

  const [venue] = await db.insert(venues).values({
    name: 'Demo Venue',
    city: 'Groningen',
  }).returning()

  await db.insert(gigs).values({
    title: 'Demo NightLight gig',
    eventType: 'club',
    status: 'lead',
    clientId: client.id,
    venueId: venue.id,
    currency: 'EUR',
  })

  console.log('Development seed data created.')
} finally {
  await sql.end()
}
