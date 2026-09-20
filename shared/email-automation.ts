export type EmailVariables = Record<string, string | number | null | undefined>

export function renderEmailTemplate(template: string, variables: EmailVariables) {
  return template.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_match, key: string) => {
    const value = variables[key]
    return value === null || value === undefined ? '' : String(value)
  })
}

export function emailRetryDelayMs(attemptCount: number) {
  const exponent = Math.max(0, Math.min(attemptCount - 1, 7))
  return Math.min(6 * 60 * 60 * 1000, 5 * 60_000 * (2 ** exponent))
}

export function emailHtmlFromText(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/\r?\n/g, '<br>')
}

export function formatMoney(cents: number, currency = 'EUR') {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency }).format(cents / 100)
}
