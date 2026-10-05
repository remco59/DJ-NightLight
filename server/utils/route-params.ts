type ParamEvent = Parameters<typeof getRouterParam>[0]

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value)
}

/**
 * Reads a route parameter that must be a UUID. A value that is not a UUID can never match a
 * row, and passing it to Postgres would fail with an `invalid input syntax for type uuid`
 * error (a 500), so it is answered as "not found" instead.
 */
export function requireUuidParam(event: ParamEvent, name = 'id') {
  const value = getRouterParam(event, name)
  if (!isUuid(value)) throw createError({ statusCode: 404, statusMessage: 'Niet gevonden' })
  return value
}
