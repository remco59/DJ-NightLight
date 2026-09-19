export function apiErrorMessage(error: unknown, fallback: string) {
  if (typeof error === 'object' && error !== null && 'data' in error) {
    const data = (error as { data?: { statusMessage?: unknown } }).data
    if (typeof data?.statusMessage === 'string') {
      return data.statusMessage
    }
  }

  return fallback
}
