import { z } from 'zod'

/**
 * Runtime environment variable validation schema.
 *
 * Variables marked `.min(1)` are required and must be non-empty.
 * Variables with `.default('')` are optional and can be empty or missing.
 */
const envSchema = z.object({
  // Core application
  DATABASE_URL: z.string({ required_error: 'DATABASE_URL is required' }).min(1, 'DATABASE_URL cannot be empty'),
  NUXT_SESSION_PASSWORD: z.string({ required_error: 'NUXT_SESSION_PASSWORD is required' }).min(32, 'NUXT_SESSION_PASSWORD must be at least 32 characters'),
  NUXT_PUBLIC_SITE_URL: z.string({ required_error: 'NUXT_PUBLIC_SITE_URL is required' }).url('NUXT_PUBLIC_SITE_URL must be a valid URL'),

  // Authentication & bootstrap
  OWNER_BOOTSTRAP_TOKEN: z.string({ required_error: 'OWNER_BOOTSTRAP_TOKEN is required for initial setup' }).min(1, 'OWNER_BOOTSTRAP_TOKEN cannot be empty'),

  // Session security
  NUXT_SESSION_COOKIE_SECURE: z.string().optional(),

  // Optional integrations (can be configured later via admin UI)
  STRIPE_RESTRICTED_KEY: z.string().default(''),
  STRIPE_WEBHOOK_SECRET: z.string().default(''),
  GOOGLE_CALENDAR_CLIENT_ID: z.string().default(''),
  GOOGLE_CALENDAR_CLIENT_SECRET: z.string().default(''),
  GOOGLE_CALENDAR_REFRESH_TOKEN: z.string().default(''),
  RESEND_API_KEY: z.string().default(''),
  EMAIL_FROM: z.string().default(''),
  REVIEW_URL: z.string().default(''),

  // Storage paths (have defaults)
  NUXT_STORAGE_UPLOADS: z.string().optional(),
  NUXT_STORAGE_GENERATED: z.string().optional(),
  NUXT_STORAGE_BACKUPS: z.string().optional(),

  // Version/environment
  NUXT_APP_VERSION: z.string().default('development'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
})

/**
 * Validates environment variables at startup.
 * Throws a clear error if any required variable is missing or invalid.
 */
export function validateEnv() {
  const result = envSchema.safeParse(process.env)

  if (!result.success) {
    const errors = result.error.issues.map(err => {
      return `  ❌ ${err.path.join('.')}: ${err.message}`
    }).join('\n')

    throw new Error(
      `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `Environment variable validation failed:\n\n${errors}\n\n` +
      `Check your .env file and ensure all required variables are set.\n` +
      `See .env.example for reference.\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`
    )
  }

  return result.data
}
