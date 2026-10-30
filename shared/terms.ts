import { z } from 'zod'

export const termsInputSchema = z.object({
  title: z.string().trim().min(1, 'Geef de voorwaarden een titel').max(200),
  body: z.string().trim().min(50, 'De voorwaarden zijn te kort').max(100_000),
  summary: z.array(z.string().trim().min(1).max(500)).max(10),
})
export type TermsInput = z.infer<typeof termsInputSchema>

export type PublicTerms = { id: string, version: number, title: string, body: string, summary: string[], publishedAt: string }

function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

/** `**bold**` after escaping, so the text can never bring its own markup. */
function inline(value: string) {
  return escapeHtml(value).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
}

/**
 * The terms are written as simple Markdown: `## ` headings, `1.` numbered items, `**bold**` and paragraphs.
 * Everything else is plain text. All input is escaped first.
 */
export function renderTermsHtml(body: string) {
  const html: string[] = []
  let list: string[] = []
  const flush = () => {
    if (!list.length) return
    html.push(`<ol>${list.map(item => `<li>${item}</li>`).join('')}</ol>`)
    list = []
  }
  for (const raw of body.replace(/\r\n/g, '\n').split('\n')) {
    const line = raw.trim()
    if (!line) { flush(); continue }
    const heading = /^##\s+(.+)$/.exec(line)
    if (heading) { flush(); html.push(`<h2 id="${termsAnchor(heading[1]!)}">${inline(heading[1]!)}</h2>`); continue }
    const item = /^\d+\.\s+(.+)$/.exec(line)
    if (item) { list.push(inline(item[1]!)); continue }
    flush()
    html.push(`<p>${inline(line)}</p>`)
  }
  flush()
  return html.join('\n')
}

/** `Artikel 5. Betaling` becomes `artikel-5` so every article can be linked to. */
export function termsAnchor(heading: string) {
  const article = /^Artikel\s+(\d+)/i.exec(heading)
  if (article) return `artikel-${article[1]}`
  return heading.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export function termsHeadings(body: string) {
  return body.split('\n').map(line => /^##\s+(.+)$/.exec(line.trim())?.[1]).filter((heading): heading is string => Boolean(heading))
    .map(heading => ({ title: heading, anchor: termsAnchor(heading) }))
}

export function termsPlainText(terms: { title: string, body: string, version: number }) {
  return `${terms.title} (versie ${terms.version})\n\n${terms.body.replace(/\*\*/g, '')}\n`
}
