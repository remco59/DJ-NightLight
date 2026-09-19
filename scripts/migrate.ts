import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { db, sql } from '../server/utils/db'

try {
  await migrate(db, { migrationsFolder: './db/migrations' })
  console.log('Database migrations completed.')
} finally {
  await sql.end()
}
