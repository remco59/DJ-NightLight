// h3's readValidatedBody rejects with this generic status; the Zod issues are
// serialized as JSON in the error message.
const VALIDATION_ERROR = 'Validation Error'

function firstIssueMessage(message: unknown) {
  if (typeof message !== 'string') return null
  try {
    const issues: unknown = JSON.parse(message)
    const first = Array.isArray(issues) ? issues[0] as { message?: unknown } | undefined : undefined
    return typeof first?.message === 'string' ? first.message : null
  } catch {
    return null
  }
}

export function apiErrorMessage(error: unknown, fallback: string) {
  if (typeof error === 'object' && error !== null && 'data' in error) {
    const data = (error as { data?: { statusMessage?: unknown, message?: unknown } }).data
    if (data?.statusMessage === VALIDATION_ERROR) {
      return firstIssueMessage(data.message) || 'Controleer de ingevulde gegevens.'
    }
    if (typeof data?.statusMessage === 'string') {
      return data.statusMessage
    }
  }

  return fallback
}
