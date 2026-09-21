import { describe, expect, it } from 'vitest'
import {
  emailHtmlFromText,
  emailRetryDelayMs,
  formatMoney,
  normalizeEmailText,
  renderBrandedEmailHtml,
  renderEmailTemplate,
} from '../shared/email-automation'

describe('email automation helpers', () => {
  it('renders known template variables and clears missing values', () => {
    expect(renderEmailTemplate('Hoi {{ clientName }} — {{missing}}', { clientName: 'Sam' }))
      .toBe('Hoi Sam — ')
  })

  it('normalizes escaped line breaks from seeded templates', () => {
    expect(normalizeEmailText('Hoi Sam,\\n\\nLeuk nieuws')).toBe('Hoi Sam,\n\nLeuk nieuws')
  })

  it('escapes generated HTML while preserving line breaks', () => {
    expect(emailHtmlFromText('<script>\nHello & goodbye'))
      .toBe('&lt;script&gt;<br>Hello &amp; goodbye')
  })

  it('renders the NightLight layout, details and template CTA', () => {
    const html = renderBrandedEmailHtml(
      'client_portal_invitation',
      'Hoi Sam,\n\nJe portaal staat klaar.\n\nhttps://example.com/client',
      {
        clientName: 'Sam',
        gigTitle: 'Bruiloft Sam & Noor',
        portalUrl: 'https://example.com/client',
      },
    )

    expect(html).toContain('NIGHTLIGHT')
    expect(html).toContain('Je NightLight-portaal staat klaar')
    expect(html).toContain('Bruiloft Sam &amp; Noor')
    expect(html).toContain('Open je portaal')
    expect(html).toContain('href="https://example.com/client"')
    expect(html.match(/https:\/\/example\.com\/client/g)?.length).toBe(1)
  })

  it('does not create unsafe CTA links', () => {
    const html = renderBrandedEmailHtml('review_request', 'Hoi Sam', {
      reviewUrl: 'javascript:alert(1)',
    })
    expect(html).not.toContain('href="javascript:')
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
