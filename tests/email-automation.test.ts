import { describe, expect, it } from 'vitest'
import {
  emailHtmlFromText,
  emailRetryDelayMs,
  formatMoney,
  renderEmailTemplate,
} from '../shared/email-automation'

describe('email automation helpers', () => {
  it('renders known template variables and clears missing values', () => {
    expect(renderEmailTemplate('Hoi {{ clientName }} — {{missing}}', { clientName: 'Sam' }))
      .toBe('Hoi Sam — ')
  })

  it('escapes generated HTML while preserving line breaks', () => {
    expect(emailHtmlFromText('<script>\nHello & goodbye'))
      .toBe('&lt;script&gt;<br>Hello &amp; goodbye')
  })

  it('backs off retries with a six hour ceiling', () => {
    expect(emailRetryDelayMs(1)).toBe(5 * 60_000)
    expect(emailRetryDelayMs(2)).toBe(10 * 60_000)
    expect(emailRetryDelayMs(99)).toBeLessThanOrEqual(6 * 60 * 60 * 1000)
  })

  it('formats integer cents without floating point invoice math', () => {
    expect(formatMoney(95000, 'EUR')).toContain('950')
  })
})
