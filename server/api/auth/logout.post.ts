export default defineEventHandler(async (event) => {
  const authEvent = event as unknown as Parameters<typeof clearUserSession>[0]
  await clearUserSession(authEvent)
  return { ok: true }
})
