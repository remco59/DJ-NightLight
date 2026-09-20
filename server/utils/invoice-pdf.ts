import type { InvoiceSnapshot } from '../../shared/invoice'

function safeText(value: string) {
  return value.replace(/[^\x20-\xFF]/g, '?').replace(/([\\()])/g, '\\$1')
}

function money(cents: number, currency: string) {
  return `${currency} ${(cents / 100).toFixed(2)}`
}

function textCommand(text: string, x: number, y: number, size = 10) {
  return `BT /F1 ${size} Tf ${x} ${y} Td (${safeText(text)}) Tj ET`
}

export function buildInvoicePdf(snapshot: InvoiceSnapshot) {
  const itemLines = snapshot.lines.map(line => `${line.description} | ${line.quantity} x ${money(line.unitPriceCents, snapshot.currency)} | ${money(line.totalCents, snapshot.currency)}`)
  const chunks: string[][] = []
  for (let index = 0; index < itemLines.length; index += 32) chunks.push(itemLines.slice(index, index + 32))
  if (!chunks.length) chunks.push([])

  const objects: Buffer[] = []
  objects[0] = Buffer.from('<< /Type /Catalog /Pages 2 0 R >>', 'latin1')
  const pageIds = chunks.map((_, index) => 4 + index * 2)
  objects[1] = Buffer.from(`<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`, 'latin1')
  objects[2] = Buffer.from('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', 'latin1')

  chunks.forEach((chunk, pageIndex) => {
    const pageId = 4 + pageIndex * 2
    const contentId = pageId + 1
    const commands = [
      textCommand(snapshot.business.companyName, 52, 790, 11),
      textCommand(`INVOICE ${snapshot.invoiceNumber}`, 52, 752, 20),
      textCommand(`Page ${pageIndex + 1} of ${chunks.length}`, 480, 790, 8),
    ]
    if (pageIndex === 0) {
      commands.push(
        textCommand(`Issue date: ${snapshot.issueDate}`, 52, 720),
        textCommand(`Due date: ${snapshot.dueDate}`, 300, 720),
        textCommand(`Bill to: ${snapshot.client.name}`, 52, 694, 12),
        textCommand(snapshot.client.billingAddress || snapshot.client.email, 52, 676, 9),
      )
    }
    let y = pageIndex === 0 ? 638 : 730
    chunk.forEach(line => { commands.push(textCommand(line, 52, y, 9)); y -= 18 })
    if (pageIndex === chunks.length - 1) {
      y -= 12
      commands.push(
        textCommand(`Subtotal: ${money(snapshot.totals.subtotalCents, snapshot.currency)}`, 330, y, 10),
        textCommand(`VAT: ${money(snapshot.totals.vatAmountCents, snapshot.currency)}`, 330, y - 18, 10),
        textCommand(`Total: ${money(snapshot.totals.totalCents, snapshot.currency)}`, 330, y - 42, 13),
        textCommand(`IBAN: ${snapshot.business.iban}`, 52, 110, 9),
        textCommand(snapshot.paymentTerms, 52, 88, 8),
        textCommand(snapshot.legalText, 52, 70, 7),
      )
    }
    const content = Buffer.from(commands.join('\n'), 'latin1')
    objects[pageId - 1] = Buffer.from(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`, 'latin1')
    objects[contentId - 1] = Buffer.concat([Buffer.from(`<< /Length ${content.length} >>\nstream\n`, 'latin1'), content, Buffer.from('\nendstream', 'latin1')])
  })

  const parts = [Buffer.from('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n', 'latin1')]
  const offsets = [0]
  let offset = parts[0]!.length
  objects.forEach((object, index) => {
    offsets[index + 1] = offset
    const wrapped = Buffer.concat([Buffer.from(`${index + 1} 0 obj\n`, 'latin1'), object, Buffer.from('\nendobj\n', 'latin1')])
    parts.push(wrapped); offset += wrapped.length
  })
  const xrefOffset = offset
  const xref = [`xref`, `0 ${objects.length + 1}`, '0000000000 65535 f ']
  for (let index = 1; index <= objects.length; index++) xref.push(`${String(offsets[index]).padStart(10, '0')} 00000 n `)
  xref.push(`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`)
  parts.push(Buffer.from(`${xref.join('\n')}\n`, 'latin1'))
  return Buffer.concat(parts)
}
