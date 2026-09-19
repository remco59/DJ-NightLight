import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '../../db/schema'

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('DATABASE_URL is required')
}

const globalForDb = globalThis as unknown as {
  nightlightSql?: ReturnType<typeof postgres>
}

const sql = globalForDb.nightlightSql ?? postgres(connectionString, {
  max: 10,
  prepare: false,
})

if (process.env.NODE_ENV !== 'production') {
  globalForDb.nightlightSql = sql
}

export const db = drizzle(sql, { schema })
export { sql }
