import { sql } from '../utils/db'

export default defineEventHandler(async (event) => {
  try {
    await sql`select 1`
    return {
      status: 'ready',
      database: 'ready',
      timestamp: new Date().toISOString(),
    }
  } catch {
    event.node.res.statusCode = 503
    return {
      status: 'not-ready',
      database: 'unavailable',
      timestamp: new Date().toISOString(),
    }
  }
})
