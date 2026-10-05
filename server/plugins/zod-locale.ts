import { z } from 'zod'

// Validation messages reach the back office and the client portal, both in
// Dutch, so Zod's built-in messages are Dutch too. Custom messages in the
// shared schemas are written in Dutch directly.
export default defineNitroPlugin(() => {
  z.config(z.locales.nl())
})
