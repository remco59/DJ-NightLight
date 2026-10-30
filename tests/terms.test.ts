import { describe, expect, it } from 'vitest'
import { renderTermsHtml, termsAnchor, termsHeadings, termsInputSchema, termsPlainText } from '../shared/terms'

describe('terms rendering', () => {
  const body = '## Artikel 1. Definities\n\n1. **Klant**: degene met wie MediaCorp een overeenkomst aangaat.\n2. Tweede lid.\n\nLos stuk tekst.'

  it('renders headings, numbered items, bold and paragraphs', () => {
    const html = renderTermsHtml(body)
    expect(html).toContain('<h2 id="artikel-1">Artikel 1. Definities</h2>')
    expect(html).toContain('<ol><li><strong>Klant</strong>: degene met wie MediaCorp een overeenkomst aangaat.</li><li>Tweede lid.</li></ol>')
    expect(html).toContain('<p>Los stuk tekst.</p>')
  })

  it('escapes markup so the terms can never inject HTML', () => {
    const html = renderTermsHtml('<script>alert(1)</script> & "quote"\n1. <img src=x onerror=alert(1)>')
    expect(html).not.toContain('<script>')
    expect(html).not.toContain('<img')
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('&amp; &quot;quote&quot;')
  })

  it('anchors articles by number and lists the headings', () => {
    expect(termsAnchor('Artikel 12. Geen herroepingsrecht bij events')).toBe('artikel-12')
    expect(termsAnchor('Bijlage: wat weg is')).toBe('bijlage-wat-weg-is')
    expect(termsHeadings(body)).toEqual([{ title: 'Artikel 1. Definities', anchor: 'artikel-1' }])
  })

  it('makes a plain-text download without markdown bold', () => {
    expect(termsPlainText({ title: 'Voorwaarden', version: 3, body })).toContain('Klant: degene')
    expect(termsPlainText({ title: 'Voorwaarden', version: 3, body })).toContain('versie 3')
  })
})

describe('terms input', () => {
  const valid = { title: 'Voorwaarden', body: 'x'.repeat(60), summary: ['Punt een'] }

  it('accepts a title, a body and a summary', () => {
    expect(termsInputSchema.safeParse(valid).success).toBe(true)
  })

  it('rejects an empty title or a body that is too short', () => {
    expect(termsInputSchema.safeParse({ ...valid, title: ' ' }).success).toBe(false)
    expect(termsInputSchema.safeParse({ ...valid, body: 'kort' }).success).toBe(false)
  })
})
