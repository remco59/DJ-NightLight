import { validateEnv } from '../utils/env-validation'

export default defineNitroPlugin(() => {
  // Validate environment variables at server startup
  // This ensures we fail fast if required configuration is missing
  validateEnv()
})
