import { describe, expect, it } from 'vitest'
import {
  attachmentExtension,
  clientAllowsAutomaticEmail,
  emailHtmlFromText,
  emailScheduleLabel,
  isAutomaticEmailTemplate,
  sanitizeAttachmentFilename,
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

  it('sends automatic emails unless the client switched the template off', () => {
    expect(clientAllowsAutomaticEmail([], 'booking_accepted')).toBe(true)
    expect(clientAllowsAutomaticEmail(null, 'booking_accepted')).toBe(true)
    expect(clientAllowsAutomaticEmail(['thank_you'], 'booking_accepted')).toBe(true)
    expect(clientAllowsAutomaticEmail(['thank_you'], 'thank_you')).toBe(false)
  })

  it('keeps the custom message template out of automation', () => {
    expect(isAutomaticEmailTemplate('custom_message')).toBe(false)
    expect(isAutomaticEmailTemplate('invoice_sent')).toBe(true)
  })

  it('cleans attachment filenames and reads their extension', () => {
    expect(sanitizeAttachmentFilename('C:\\docs\\Contract "final".PDF')).toBe('Contract final.PDF')
    expect(sanitizeAttachmentFilename('../../etc/passwd')).toBe('passwd')
    expect(sanitizeAttachmentFilename('\u0000')).toBe('bijlage')
    expect(attachmentExtension('Contract final.PDF')).toBe('pdf')
    expect(attachmentExtension('no-extension')).toBe('')
  })

  it('describes when a template is sent', () => {
    expect(emailScheduleLabel('event', 0)).toBe('Direct wanneer het gebeurt')
    expect(emailScheduleLabel('gig_start', -10080)).toBe('7 dagen voor de start van de gig')
    expect(emailScheduleLabel('gig_end', 1440)).toBe('1 dag na het einde van de gig')
    expect(emailScheduleLabel('invoice_due', -120)).toBe('2 uur voor de vervaldatum van de factuur')
  })
})
