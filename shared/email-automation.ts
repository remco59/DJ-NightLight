export type EmailVariables = Record<string, string | number | null | undefined>

export type EmailAttachment =
  | { kind: 'file', storageKey: string, filename: string, mimeType: string, byteSize: number }
  | { kind: 'invoice', invoiceId: string, filename: string }

/** Templates that only exist for composing mail by hand and never run automatically. */
export const MANUAL_ONLY_EMAIL_TEMPLATES: readonly string[] = ['custom_message']

export const MAX_EMAIL_ATTACHMENTS = 5
export const MAX_EMAIL_ATTACHMENT_BYTES = 10 * 1024 * 1024
export const MAX_EMAIL_ATTACHMENTS_TOTAL_BYTES = 20 * 1024 * 1024
export const EMAIL_ATTACHMENT_EXTENSIONS: readonly string[] = [
  'pdf', 'jpg', 'jpeg', 'png', 'webp', 'gif', 'heic',
  'doc', 'docx', 'odt', 'rtf', 'txt', 'xls', 'xlsx', 'ods', 'csv',
  'ppt', 'pptx', 'ics', 'zip', 'mp3', 'wav', 'm4a',
]

export function isAutomaticEmailTemplate(templateKey: string) {
  return !MANUAL_ONLY_EMAIL_TEMPLATES.includes(templateKey)
}

export function clientAllowsAutomaticEmail(disabled: readonly string[] | null | undefined, templateKey: string) {
  return !(disabled || []).includes(templateKey)
}

export function sanitizeAttachmentFilename(name: string) {
  const base = name.split(/[\\/]/).pop() || ''
  const cleaned = Array.from(base)
    .filter(char => char.charCodeAt(0) >= 32 && !'"<>|:*?'.includes(char))
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
  return cleaned.slice(-180) || 'bijlage'
}

export function attachmentExtension(filename: string) {
  const match = /\.([a-z0-9]{1,8})$/i.exec(filename)
  return match ? match[1]!.toLowerCase() : ''
}

export function emailScheduleLabel(anchor: string, offsetMinutes: number) {
  if (anchor === 'event') return 'Direct wanneer het gebeurt'
  const days = Math.round(Math.abs(offsetMinutes) / 1440)
  const hours = Math.round(Math.abs(offsetMinutes) / 60)
  const amount = days >= 1 ? `${days} ${days === 1 ? 'dag' : 'dagen'}` : `${hours} uur`
  const reference = anchor === 'gig_start' ? 'de start van de gig' : anchor === 'gig_end' ? 'het einde van de gig' : 'de vervaldatum van de factuur'
  if (offsetMinutes === 0) return `Bij ${reference}`
  return `${amount} ${offsetMinutes < 0 ? 'voor' : 'na'} ${reference}`
}

type EmailDetail = {
  label: string
  variable: string
}

type EmailPresentation = {
  eyebrow: string
  title: string
  ctaVariable?: string
  ctaLabel?: string
  details?: EmailDetail[]
}

const EMAIL_PRESENTATIONS: Record<string, EmailPresentation> = {
  lead_acknowledgement: {
    eyebrow: 'Aanvraag ontvangen',
    title: 'Bedankt voor je aanvraag',
    details: [{ label: 'Boeking', variable: 'gigTitle' }],
  },
  booking_accepted: {
    eyebrow: 'Boeking bevestigd',
    title: 'Je boeking staat vast',
    details: [
      { label: 'Boeking', variable: 'gigTitle' },
      { label: 'Datum', variable: 'gigDate' },
    ],
  },
  client_portal_invitation: {
    eyebrow: 'Klantportaal',
    title: 'Je NightLight-portaal staat klaar',
    ctaVariable: 'portalUrl',
    ctaLabel: 'Open je portaal',
    details: [{ label: 'Boeking', variable: 'gigTitle' }],
  },
  portal_reminder: {
    eyebrow: 'Herinnering',
    title: 'Je portaal wacht nog op je',
    ctaVariable: 'portalUrl',
    ctaLabel: 'Open je portaal',
    details: [
      { label: 'Boeking', variable: 'gigTitle' },
      { label: 'Datum', variable: 'gigDate' },
    ],
  },
  invoice_sent: {
    eyebrow: 'Factuur',
    title: 'Je factuur staat klaar',
    ctaVariable: 'invoiceUrl',
    ctaLabel: 'Bekijk factuur',
    details: [
      { label: 'Factuur', variable: 'invoiceNumber' },
      { label: 'Bedrag', variable: 'invoiceTotal' },
      { label: 'Vervaldatum', variable: 'invoiceDueDate' },
    ],
  },
  payment_reminder: {
    eyebrow: 'Betaling',
    title: 'Een vriendelijke betaalherinnering',
    ctaVariable: 'invoiceUrl',
    ctaLabel: 'Bekijk factuur',
    details: [
      { label: 'Factuur', variable: 'invoiceNumber' },
      { label: 'Bedrag', variable: 'invoiceTotal' },
      { label: 'Vervaldatum', variable: 'invoiceDueDate' },
    ],
  },
  overdue_reminder: {
    eyebrow: 'Betaling',
    title: 'Deze factuur staat nog open',
    ctaVariable: 'invoiceUrl',
    ctaLabel: 'Bekijk factuur',
    details: [
      { label: 'Factuur', variable: 'invoiceNumber' },
      { label: 'Bedrag', variable: 'invoiceTotal' },
      { label: 'Vervaldatum', variable: 'invoiceDueDate' },
    ],
  },
  payment_received: {
    eyebrow: 'Betaling ontvangen',
    title: 'Bedankt, je betaling is binnen',
    details: [
      { label: 'Factuur', variable: 'invoiceNumber' },
      { label: 'Bedrag', variable: 'invoiceTotal' },
    ],
  },
  pre_gig_reminder: {
    eyebrow: 'Bijna tijd',
    title: 'Nog even tot {{gigTitle}}',
    details: [
      { label: 'Boeking', variable: 'gigTitle' },
      { label: 'Datum', variable: 'gigDate' },
    ],
  },
  thank_you: {
    eyebrow: 'Bedankt',
    title: 'Bedankt voor een mooie avond',
    details: [{ label: 'Boeking', variable: 'gigTitle' }],
  },
  custom_message: {
    eyebrow: 'NightLight',
    title: 'Een bericht over {{gigTitle}}',
    details: [
      { label: 'Boeking', variable: 'gigTitle' },
      { label: 'Datum', variable: 'gigDate' },
    ],
  },
  review_request: {
    eyebrow: 'Review',
    title: 'Hoe heb je NightLight ervaren?',
    ctaVariable: 'reviewUrl',
    ctaLabel: 'Schrijf een review',
    details: [{ label: 'Boeking', variable: 'gigTitle' }],
  },
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function safeHttpUrl(value: string | number | null | undefined) {
  if (!value) return ''
  const url = String(value).trim()
  return /^https?:\/\//i.test(url) ? url : ''
}

export function normalizeEmailText(text: string) {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\\r\\n|\\n|\\r/g, '\n')
}

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
  return escapeHtml(normalizeEmailText(text)).replace(/\n/g, '<br>')
}

function bodyHtml(text: string, ctaUrl: string) {
  const paragraphs = normalizeEmailText(text)
    .split(/\n{2,}/)
    .map(part => part.trim())
    .filter(Boolean)
    .filter(part => !ctaUrl || part !== ctaUrl)

  return paragraphs.map((paragraph) => {
    const html = escapeHtml(paragraph).replace(/\n/g, '<br>')
    return `<p style="margin:0 0 18px;color:#d8d3dd;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.65;">${html}</p>`
  }).join('')
}

function detailsHtml(presentation: EmailPresentation, variables: EmailVariables) {
  const details = (presentation.details || [])
    .map(detail => ({
      label: detail.label,
      value: variables[detail.variable],
    }))
    .filter(detail => detail.value !== null && detail.value !== undefined && String(detail.value).trim())

  if (!details.length) return ''

  const rows = details.map((detail, index) => `
    <tr>
      <td style="padding:${index === 0 ? '0' : '12px'} 0 0;color:#928a9a;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.4;text-transform:uppercase;letter-spacing:.08em;vertical-align:top;width:110px;">${escapeHtml(detail.label)}</td>
      <td style="padding:${index === 0 ? '0' : '12px'} 0 0 16px;color:#f7f4fa;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;font-weight:700;vertical-align:top;">${escapeHtml(String(detail.value))}</td>
    </tr>`).join('')

  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:8px 0 24px;background:#17141c;border:1px solid #2f2935;border-radius:12px;">
      <tr>
        <td style="padding:18px 20px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            ${rows}
          </table>
        </td>
      </tr>
    </table>`
}

export function renderBrandedEmailHtml(templateKey: string, text: string, variables: EmailVariables) {
  const presentation = EMAIL_PRESENTATIONS[templateKey] || {
    eyebrow: 'NightLight',
    title: 'Een bericht van NightLight',
  }
  const ctaUrl = safeHttpUrl(presentation.ctaVariable ? variables[presentation.ctaVariable] : '')
  const title = renderEmailTemplate(presentation.title, variables)
  const details = detailsHtml(presentation, variables)
  const content = bodyHtml(text, ctaUrl)
  const cta = ctaUrl && presentation.ctaLabel
    ? `
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:8px 0 4px;">
        <tr>
          <td style="background:#ffffff;border-radius:10px;">
            <a href="${escapeHtml(ctaUrl)}" style="display:inline-block;padding:13px 20px;color:#0d0b10;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1;font-weight:700;text-decoration:none;">${escapeHtml(presentation.ctaLabel)}</a>
          </td>
        </tr>
      </table>`
    : ''

  return `<!doctype html>
<html lang="nl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:#09080b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#09080b;">
    <tr>
      <td align="center" style="padding:34px 14px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;">
          <tr>
            <td style="padding:0 4px 18px;color:#f7f4fa;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:800;letter-spacing:.22em;text-transform:uppercase;">
              NIGHTLIGHT
            </td>
          </tr>
          <tr>
            <td style="background:#121016;border:1px solid #2b2631;border-radius:18px;padding:34px 32px;">
              <div style="margin:0 0 12px;color:#cbb7dc;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:800;letter-spacing:.17em;text-transform:uppercase;">${escapeHtml(presentation.eyebrow)}</div>
              <h1 style="margin:0 0 24px;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:30px;line-height:1.15;letter-spacing:-.03em;">${escapeHtml(title)}</h1>
              ${content}
              ${details}
              ${cta}
            </td>
          </tr>
          <tr>
            <td style="padding:18px 6px 0;color:#746d7b;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;">
              DJ NightLight
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export function formatMoney(cents: number, currency = 'EUR') {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency }).format(cents / 100)
}
