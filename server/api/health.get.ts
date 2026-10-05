import { sql } from '../utils/db'

export default defineEventHandler(async () => {
  try {
    // Ping the database
    await sql`SELECT 1`
    return {
      status: 'healthy',
      database: 'connected',
      timestamp: new Date().toISOString()
    }
  } catch (error) {
    throw createError({
      statusCode: 503,
      statusMessage: 'Dienst niet beschikbaar',
      data: {
        status: 'unhealthy',
        database: 'disconnected',
        error: error instanceof Error ? error.message : 'Unknown database error',
        timestamp: new Date().toISOString()
      }
    })
  }
})
