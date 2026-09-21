import type { InvoiceSnapshot } from '../../shared/invoice'
import type { BankTransferInstructions } from './stripe-customer'

function safeText(value: string) {
  return value
    .replace(/\u00a0/g, ' ')
    .replace(/[–—]/g, '-')
    .replace(/€/g, '\\200')
    .replace(/[^\x20-\xFF\\]/g, '?')
    .replace(/([\\()])/g, '\\$1')
}

function money(cents: number, currency: string) {
  const amount = new Intl.NumberFormat('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cents / 100).replace(/\u00a0/g, ' ')
  const symbol = currency.toUpperCase() === 'EUR' ? '€' : currency.toUpperCase() === 'GBP' ? '£' : currency.toUpperCase() === 'USD' ? '$' : currency.toUpperCase()
  return `${symbol} ${amount}`
}

function dateLabel(value: string) {
  const date = new Date(`${value}T12:00:00Z`)
  return new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date)
}

function textCommand(text: string, x: number, y: number, size = 10, font: 'F1' | 'F2' = 'F1', color = '0 0 0') {
  return `${color} rg BT /${font} ${size} Tf ${x} ${y} Td (${safeText(text)}) Tj ET`
}

function rightTextCommand(text: string, right: number, y: number, size = 10, font: 'F1' | 'F2' = 'F1', color = '0 0 0') {
  const width = text.length * size * 0.49
  return textCommand(text, Math.max(36, right - width), y, size, font, color)
}

function lineCommand(x1: number, y1: number, x2: number, y2: number, width = 0.5, color = '0.75 0.75 0.75') {
  return `${color} RG ${width} w ${x1} ${y1} m ${x2} ${y2} l S`
}

function fillRect(x: number, y: number, width: number, height: number, color: string) {
  return `${color} rg ${x} ${y} ${width} ${height} re f`
}

function addressLines(value: string) {
  return value.split(/\r?\n|,\s*(?=\d{4}\s?[A-Z]{2}\b)/).map(line => line.trim()).filter(Boolean)
}

function shortText(value: string, max = 54) {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`
}

export function buildInvoicePdf(snapshot: InvoiceSnapshot, stripeBankTransfer?: BankTransferInstructions | null) {
  const fallbackBankTransfer: BankTransferInstructions | null = !stripeBankTransfer && snapshot.business.iban
    ? {
        iban: snapshot.business.iban,
        bic: '',
        country: snapshot.business.country,
        accountHolderName: snapshot.business.companyName,
        reference: snapshot.invoiceNumber,
      }
    : null
  const bankTransfer = stripeBankTransfer || fallbackBankTransfer

  const firstPageItems = snapshot.lines.slice(0, 8)
  const pages: typeof snapshot.lines[] = [firstPageItems]
  for (let index = 8; index < snapshot.lines.length; index += 8) pages.push(snapshot.lines.slice(index, index + 8))

  const objects: Buffer[] = []
  objects[0] = Buffer.from('<< /Type /Catalog /Pages 2 0 R >>', 'latin1')
  const pageIds = pages.map((_, index) => 5 + index * 2)
  objects[1] = Buffer.from(`<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`, 'latin1')
  objects[2] = Buffer.from('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>', 'latin1')
  objects[3] = Buffer.from('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>', 'latin1')

  pages.forEach((items, pageIndex) => {
    const pageId = 5 + pageIndex * 2
    const contentId = pageId + 1
    const commands: string[] = [
      fillRect(0, 837, 595, 5, '1 0.08 0.24'),
      textCommand(`Pagina ${pageIndex + 1} van ${pages.length}`, 500, 26, 7, 'F1', '0.3 0.3 0.3'),
      lineCommand(36, 44, 559, 44, 0.35, '0.85 0.85 0.85'),
    ]

    if (pageIndex === 0) {
      commands.push(
        textCommand('Factuur', 36, 790, 20, 'F2'),
        fillRect(486, 760, 73, 52, '1 0.08 0.24'),
        textCommand(shortText(snapshot.business.companyName.toUpperCase(), 12), 495, 783, 8, 'F2', '1 1 1'),
        textCommand('Factuurnummer', 36, 755, 8, 'F2'),
        textCommand(snapshot.invoiceNumber, 112, 755, 8, 'F2'),
        textCommand('Uitgiftedatum', 36, 741, 8, 'F2'),
        textCommand(dateLabel(snapshot.issueDate), 112, 741, 8),
        textCommand('Vervaldatum', 36, 727, 8, 'F2'),
        textCommand(dateLabel(snapshot.dueDate), 112, 727, 8),
        textCommand(snapshot.business.companyName, 36, 687, 9, 'F2'),
      )

      const sender = [
        snapshot.business.address,
        [snapshot.business.postalCode, snapshot.business.city].filter(Boolean).join(' '),
        snapshot.business.country,
        snapshot.business.phone,
        snapshot.business.email,
        snapshot.business.vatNumber ? `NL VAT ${snapshot.business.vatNumber}` : '',
        snapshot.business.registrationNumber ? `KvK ${snapshot.business.registrationNumber}` : '',
      ].filter(Boolean)
      sender.forEach((line, index) => commands.push(textCommand(shortText(line), 36, 671 - index * 13, 8)))

      commands.push(textCommand('Factuur aan', 275, 687, 9, 'F2'))
      const recipient = [snapshot.client.name, ...addressLines(snapshot.client.billingAddress), snapshot.client.email].filter(Boolean)
      recipient.slice(0, 7).forEach((line, index) => commands.push(textCommand(shortText(line), 275, 671 - index * 13, 8)))

      commands.push(
        textCommand(`${money(snapshot.totals.totalCents, snapshot.currency)} vervalt op ${dateLabel(snapshot.dueDate)}`, 36, 548, 16, 'F2'),
        textCommand('Online betalen via het beveiligde NightLight-klantportaal', 36, 527, 8, 'F1', '0.25 0.30 0.75'),
      )
    } else {
      commands.push(
        textCommand('Factuur', 36, 790, 16, 'F2'),
        textCommand(snapshot.invoiceNumber, 36, 770, 8),
        textCommand('Vervolg factuurregels', 36, 735, 10, 'F2'),
      )
    }

    const tableTop = pageIndex === 0 ? 466 : 704
    commands.push(
      textCommand('Beschrijving', 36, tableTop, 7),
      rightTextCommand('Aantal', 365, tableTop, 7),
      rightTextCommand('Eenheidsprijs', 453, tableTop, 7),
      rightTextCommand('Belasting', 505, tableTop, 7),
      rightTextCommand('Bedrag', 559, tableTop, 7),
      lineCommand(36, tableTop - 8, 559, tableTop - 8, 0.55, '0 0 0'),
    )

    let y = tableTop - 27
    for (const item of items) {
      commands.push(
        textCommand(shortText(item.description, 50), 36, y, 8),
        rightTextCommand(String(Number(item.quantity)), 365, y, 8),
        rightTextCommand(money(item.unitPriceCents, snapshot.currency), 453, y, 8),
        rightTextCommand(snapshot.vatMode === 'exempt' ? '-' : `${snapshot.vatRateBasisPoints / 100}%`, 505, y, 8),
        rightTextCommand(money(item.totalCents, snapshot.currency), 559, y, 8),
      )
      if (snapshot.serviceDate) commands.push(textCommand(dateLabel(snapshot.serviceDate), 36, y - 12, 7, 'F1', '0.25 0.25 0.25'))
      y -= 34
    }

    if (pageIndex === pages.length - 1) {
      const totalsY = Math.max(190, y - 8)
      commands.push(
        textCommand('Subtotaal', 330, totalsY, 8),
        rightTextCommand(money(snapshot.totals.subtotalCents, snapshot.currency), 559, totalsY, 8),
        textCommand('Totaal exclusief belasting', 330, totalsY - 16, 8),
        rightTextCommand(money(snapshot.totals.subtotalCents, snapshot.currency), 559, totalsY - 16, 8),
        textCommand(snapshot.vatMode === 'exempt' ? 'Omzetbelasting' : `Omzetbelasting (${snapshot.vatRateBasisPoints / 100}%)`, 330, totalsY - 32, 8),
        rightTextCommand(money(snapshot.totals.vatAmountCents, snapshot.currency), 559, totalsY - 32, 8),
        lineCommand(330, totalsY - 39, 559, totalsY - 39, 0.35, '0.7 0.7 0.7'),
        textCommand('Totaal', 330, totalsY - 54, 8),
        rightTextCommand(money(snapshot.totals.totalCents, snapshot.currency), 559, totalsY - 54, 8),
        textCommand('Verschuldigd bedrag', 330, totalsY - 72, 8, 'F2'),
        rightTextCommand(money(snapshot.totals.totalCents, snapshot.currency), 559, totalsY - 72, 8, 'F2'),
      )

      if (bankTransfer) {
        const bankY = 155
        commands.push(
          textCommand(`Betaal ${money(snapshot.totals.totalCents, snapshot.currency)} met een bankoverschrijving`, 36, bankY, 8, 'F2'),
          textCommand('Gebruik onderstaande bankgegevens. Bankoverschrijvingen kunnen enkele werkdagen duren.', 36, bankY - 15, 7),
          textCommand('Vermeld de referentie zodat Stripe de betaling automatisch aan deze factuur kan koppelen.', 36, bankY - 27, 7),
        )
        const rows = [
          ['BIC', bankTransfer.bic || '-'],
          ['IBAN', bankTransfer.iban],
          ['Land', bankTransfer.country || snapshot.business.country],
          ['Naam rekeninghouder', bankTransfer.accountHolderName || snapshot.business.companyName],
          ['Referentie', bankTransfer.reference],
        ]
        rows.forEach(([label, value], index) => {
          commands.push(textCommand(label!, 36, bankY - 48 - index * 13, 7, 'F2'))
          commands.push(textCommand(shortText(value!, 46), 132, bankY - 48 - index * 13, 7))
        })
      } else {
        commands.push(textCommand(snapshot.paymentTerms || 'Betaal het verschuldigde bedrag voor de vervaldatum.', 36, 96, 7))
      }

      if (snapshot.legalText) commands.push(textCommand(shortText(snapshot.legalText, 92), 36, 58, 6, 'F1', '0.35 0.35 0.35'))
    }

    const pageStream = Buffer.from(commands.join('\n'), 'latin1')
    objects[pageId - 1] = Buffer.from(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`, 'latin1')
    objects[contentId - 1] = Buffer.concat([
      Buffer.from(`<< /Length ${pageStream.length} >>\nstream\n`, 'latin1'),
      pageStream,
      Buffer.from('\nendstream', 'latin1'),
    ])
  })

  const parts = [Buffer.from('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n', 'latin1')]
  const offsets = [0]
  let offset = parts[0]!.length
  objects.forEach((object, index) => {
    offsets[index + 1] = offset
    const wrapped = Buffer.concat([Buffer.from(`${index + 1} 0 obj\n`, 'latin1'), object, Buffer.from('\nendobj\n', 'latin1')])
    parts.push(wrapped)
    offset += wrapped.length
  })
  const xrefOffset = offset
  const xref = ['xref', `0 ${objects.length + 1}`, '0000000000 65535 f ']
  for (let index = 1; index <= objects.length; index++) xref.push(`${String(offsets[index]).padStart(10, '0')} 00000 n `)
  xref.push(`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`)
  parts.push(Buffer.from(`${xref.join('\n')}\n`, 'latin1'))
  return Buffer.concat(parts)
}
