export type EmailVariables = Record<string, string | number | null | undefined>

export type EmailAttachment =
  | { kind: 'file', storageKey: string, filename: string, mimeType: string, byteSize: number }
  | { kind: 'invoice', invoiceId: string, filename: string }

export type EmailBranding = {
  siteUrl?: string
  logoUrl?: string | null
  heroImageUrl?: string | null
}

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
    eyebrow: 'Aanvraag',
    title: 'Bedankt voor je aanvraag',
    details: [{ label: 'Boeking', variable: 'gigTitle' }],
  },
  booking_accepted: {
    eyebrow: 'Boeking',
    title: 'Je boeking is bevestigd',
    ctaVariable: 'portalUrl',
    ctaLabel: 'Open klantenportaal',
    details: [
      { label: 'Boeking', variable: 'gigTitle' },
      { label: 'Datum', variable: 'gigDate' },
    ],
  },
  client_portal_invitation: {
    eyebrow: 'Klantenportaal',
    title: 'Activeer je klantenportaal',
    ctaVariable: 'portalUrl',
    ctaLabel: 'Account activeren',
    details: [{ label: 'Boeking', variable: 'gigTitle' }],
  },
  portal_reminder: {
    eyebrow: 'Herinnering',
    title: 'Je klantenportaal wacht nog op je',
    ctaVariable: 'portalUrl',
    ctaLabel: 'Open klantenportaal',
    details: [
      { label: 'Boeking', variable: 'gigTitle' },
      { label: 'Datum', variable: 'gigDate' },
    ],
  },
  invoice_sent: {
    eyebrow: 'Factuur',
    title: 'Je factuur staat klaar',
    ctaVariable: 'portalUrl',
    ctaLabel: 'Open klantenportaal',
    details: [
      { label: 'Factuurnummer', variable: 'invoiceNumber' },
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
      { label: 'Factuurnummer', variable: 'invoiceNumber' },
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
      { label: 'Factuurnummer', variable: 'invoiceNumber' },
      { label: 'Bedrag', variable: 'invoiceTotal' },
      { label: 'Vervaldatum', variable: 'invoiceDueDate' },
    ],
  },
  payment_received: {
    eyebrow: 'Betaling',
    title: 'Je betaling is ontvangen',
    ctaVariable: 'portalUrl',
    ctaLabel: 'Open klantenportaal',
    details: [
      { label: 'Factuurnummer', variable: 'invoiceNumber' },
      { label: 'Ontvangen bedrag', variable: 'invoiceTotal' },
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

function safeAssetUrl(value: string | null | undefined, siteUrl = '') {
  if (!value) return ''
  const raw = value.trim()
  if (/^https?:\/\//i.test(raw)) return raw
  if (/^\/(?!\/)/.test(raw)) {
    const base = safeHttpUrl(siteUrl).replace(/\/$/, '')
    return base ? `${base}${raw}` : raw
  }
  return ''
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
    return `<p style="margin:0 0 18px;color:#cfc8d7;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.65;">${html}</p>`
  }).join('')
}

function detailsHtml(presentation: EmailPresentation, variables: EmailVariables) {
  const details = (presentation.details || [])
    .map(detail => ({ label: detail.label, value: variables[detail.variable] }))
    .filter(detail => detail.value !== null && detail.value !== undefined && String(detail.value).trim())

  if (!details.length) return ''

  const rows = details.map((detail, index) => `
    <tr>
      <td style="padding:${index === 0 ? '0' : '16px'} 0 ${index === details.length - 1 ? '0' : '16px'};${index === details.length - 1 ? '' : 'border-bottom:1px solid #302a38;'}">
        <div style="margin:0 0 4px;color:#91899b;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.4;">${escapeHtml(detail.label)}</div>
        <div style="color:#fbf9fc;font-family:Arial,Helvetica,sans-serif;font-size:17px;line-height:1.45;font-weight:700;overflow-wrap:anywhere;word-break:normal;">${escapeHtml(String(detail.value))}</div>
      </td>
    </tr>`).join('')

  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:28px 0 0;background:#15121a;border:1px solid #393140;border-radius:14px;border-collapse:separate;">
      <tr><td style="padding:20px 22px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">${rows}</table>
      </td></tr>
    </table>`
}

function ctaHtml(label: string | undefined, url: string) {
  if (!label || !url) return ''
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:26px 0 0;">
      <tr>
        <td align="center" bgcolor="#7c3aed" style="border-radius:13px;background:linear-gradient(135deg,#8b5cf6,#6d28d9);">
          <a href="${escapeHtml(url)}" style="display:block;padding:16px 22px;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.15;font-weight:800;text-align:center;text-decoration:none;border-radius:13px;">${escapeHtml(label)} &nbsp;→</a>
        </td>
      </tr>
    </table>`
}

function headerHtml(branding: EmailBranding) {
  const logoUrl = safeAssetUrl(branding.logoUrl || '/brand/web/wordmark-arcs-960.webp', branding.siteUrl)
  const heroUrl = safeAssetUrl(branding.heroImageUrl || '/images/login-background.webp', branding.siteUrl)
  const logo = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" width="176" alt="NightLight" style="display:block;width:100%;max-width:176px;height:auto;border:0;outline:none;text-decoration:none;">`
    : '<span style="color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:20px;font-weight:800;letter-spacing:.16em;">NIGHTLIGHT</span>'
  const hero = heroUrl
    ? `<img src="${escapeHtml(heroUrl)}" width="360" height="150" alt="" style="display:block;width:100%;height:150px;object-fit:cover;border:0;outline:none;text-decoration:none;">`
    : ''

  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#0d0b11;border-radius:18px 18px 0 0;border-collapse:separate;overflow:hidden;">
      <tr>
        <td width="40%" valign="middle" style="padding:24px 20px 24px 28px;background:#0d0b11;">${logo}</td>
        <td width="60%" valign="middle" style="background:#15101d;overflow:hidden;">${hero}</td>
      </tr>
    </table>`
}

export function renderBrandedEmailHtml(templateKey: string, text: string, variables: EmailVariables, branding: EmailBranding = {}) {
  const presentation = EMAIL_PRESENTATIONS[templateKey] || {
    eyebrow: 'NightLight',
    title: 'Een bericht van NightLight',
  }
  const ctaUrl = safeHttpUrl(presentation.ctaVariable ? variables[presentation.ctaVariable] : '')
  const title = renderEmailTemplate(presentation.title, variables)
  const content = bodyHtml(text, ctaUrl)
  const cta = ctaHtml(presentation.ctaLabel, ctaUrl)
  const details = detailsHtml(presentation, variables)
  const header = headerHtml(branding)
  const siteUrl = safeHttpUrl(branding.siteUrl)
  const footerBrand = siteUrl
    ? `<a href="${escapeHtml(siteUrl)}" style="color:#8f8798;text-decoration:none;">NightLight • ${escapeHtml(siteUrl.replace(/^https?:\/\//i, '').replace(/\/$/, ''))}</a>`
    : 'NightLight'

  return `<!doctype html>
<html lang="nl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
  <title>${escapeHtml(title)}</title>
  <style>
    @media screen and (max-width:620px) {
      .email-shell { padding:16px 10px !important; }
      .email-content { padding:28px 20px 26px !important; }
      .email-title { font-size:31px !important; line-height:1.08 !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#08070a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#08070a;">
    <tr>
      <td class="email-shell" align="center" style="padding:28px 14px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;">
          <tr>
            <td style="padding:0;border:1px solid #2c2632;border-radius:18px;background:#111014;overflow:hidden;">
              ${header}
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td class="email-content" style="padding:36px 34px 32px;background:#111014;">
                    <div style="margin:0 0 14px;color:#b77cff;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;">${escapeHtml(presentation.eyebrow)}</div>
                    <h1 class="email-title" style="margin:0 0 24px;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:38px;line-height:1.08;letter-spacing:-.035em;">${escapeHtml(title)}</h1>
                    ${content}
                    ${cta}
                    ${details}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:18px 8px 0;color:#776f80;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;">${footerBrand}</td>
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
