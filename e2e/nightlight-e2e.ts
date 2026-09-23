import { createHmac } from 'node:crypto'
import { deflateSync } from 'node:zlib'
import assert from 'node:assert/strict'

const baseUrl = process.env.E2E_BASE_URL || 'http://127.0.0.1:3100'
const bootstrapToken = process.env.E2E_BOOTSTRAP_TOKEN || 'e2e-bootstrap-token'
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_e2e_secret'

let cookie = ''

function log(step: string) {
  console.log(`[e2e] ${step}`)
}

async function request(path: string, options: {
  method?: string
  body?: unknown
  headers?: Record<string, string>
  authenticated?: boolean
} = {}) {
  const headers = new Headers(options.headers || {})
  let body: BodyInit | undefined

  if (options.body instanceof FormData || typeof options.body === 'string' || options.body instanceof Uint8Array) {
    body = options.body as BodyInit
  } else if (options.body !== undefined) {
    headers.set('content-type', 'application/json')
    body = JSON.stringify(options.body)
  }

  if (options.authenticated !== false && cookie) headers.set('cookie', cookie)

  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method || (body ? 'POST' : 'GET'),
    headers,
    body,
    redirect: 'manual',
  })

  const setCookie = response.headers.get('set-cookie')
  if (setCookie) {
    cookie = setCookie.split(';')[0] || ''
  }

  return response
}

async function json<T>(response: Response, expected = 200): Promise<T> {
  const text = await response.text()
  assert.equal(
    response.status,
    expected,
    `Expected HTTP ${expected}, got ${response.status}: ${text.slice(0, 1000)}`,
  )
  return text ? JSON.parse(text) as T : {} as T
}

async function ok(response: Response, expected = 200) {
  const text = await response.text()
  assert.equal(
    response.status,
    expected,
    `Expected HTTP ${expected}, got ${response.status}: ${text.slice(0, 1000)}`,
  )
  return text
}

function futureDate(days: number, hour = 20) {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() + days)
  date.setUTCHours(hour, 0, 0, 0)
  return date
}

function dateOnly(date: Date) {
  return date.toISOString().slice(0, 10)
}

type QuestionnaireField = {
  id: string
  type: string
  required: boolean
  options?: string[]
}

function answerFor(field: QuestionnaireField) {
  switch (field.type) {
    case 'email': return 'e2e-client@example.com'
    case 'number': return 120
    case 'acknowledgement':
    case 'checkbox': return true
    case 'date': return '2030-01-01'
    case 'time': return '20:00'
    case 'select': return field.options?.[0] || ''
    case 'multi_select': return field.options?.[0] ? [field.options[0]] : []
    case 'url': return 'https://example.com/'
    default: return field.required ? 'E2E answer' : 'E2E optional answer'
  }
}

const crcTable = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(data: Uint8Array) {
  let c = 0xffffffff
  for (const byte of data) c = crcTable[(c ^ byte) & 0xff]! ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function pngChunk(type: string, data: Uint8Array) {
  const typeBytes = Buffer.from(type, 'ascii')
  const payload = Buffer.concat([typeBytes, Buffer.from(data)])
  const out = Buffer.alloc(12 + data.length)
  out.writeUInt32BE(data.length, 0)
  typeBytes.copy(out, 4)
  Buffer.from(data).copy(out, 8)
  out.writeUInt32BE(crc32(payload), 8 + data.length)
  return out
}

function solidPng(width: number, height: number) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  const row = Buffer.alloc(1 + width * 4)
  row[0] = 0
  for (let x = 0; x < width; x += 1) {
    const offset = 1 + x * 4
    row[offset] = 38
    row[offset + 1] = 16
    row[offset + 2] = 54
    row[offset + 3] = 255
  }

  const raw = Buffer.alloc(row.length * height)
  for (let y = 0; y < height; y += 1) row.copy(raw, y * row.length)

  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND', new Uint8Array()),
  ])
}

async function findGig(search: string) {
  const response = await json<{
    gigs: Array<{
      id: string
      title: string
      clientId: string | null
      status: string
    }>
  }>(await request(`/api/admin/gigs?search=${encodeURIComponent(search)}`))
  const gig = response.gigs.find(item => item.title.includes(search))
  assert.ok(gig, `Gig matching "${search}" was not found`)
  return gig
}

async function bookGig(input: {
  id: string
  clientId: string | null
  title: string
  startsAt: Date
  publicVisibility: boolean
  publicTitle?: string
  internalNotes: string
}) {
  const result = await json<{ gig: { id: string, status: string } }>(await request(`/api/admin/gigs/${input.id}`, {
    method: 'PUT',
    body: {
      title: input.title,
      eventType: 'Wedding',
      clientId: input.clientId,
      venueId: null,
      status: 'booked',
      startsAt: input.startsAt.toISOString(),
      endsAt: new Date(input.startsAt.getTime() + 4 * 60 * 60 * 1000).toISOString(),
      loadInAt: new Date(input.startsAt.getTime() - 90 * 60 * 1000).toISOString(),
      fee: '950.00',
      currency: 'EUR',
      publicVisibility: input.publicVisibility,
      publicTitle: input.publicTitle || '',
      publicDescription: input.publicVisibility ? 'E2E public description' : '',
      internalNotes: input.internalNotes,
      source: 'e2e',
      contacts: [],
      timeline: [],
    },
  }))
  assert.equal(result.gig.status, 'booked')
  return result.gig
}

async function main() {
  const marker = `E2E-${Date.now()}`
  const mainStart = futureDate(180)
  const privateStart = futureDate(181)
  const internalSecret = `PRIVATE-${marker}`

  log('health and authorization boundary')
  await ok(await request('/api/ready', { authenticated: false }))
  const unauthorized = await request('/api/admin/gigs', { authenticated: false })
  assert.ok([401, 403].includes(unauthorized.status), `Admin endpoint unexpectedly returned ${unauthorized.status}`)

  log('bootstrap owner and establish authenticated session')
  await json(await request('/api/auth/bootstrap', {
    method: 'POST',
    authenticated: false,
    headers: { 'x-bootstrap-token': bootstrapToken },
    body: {
      email: 'owner-e2e@example.com',
      name: 'E2E Owner',
      password: 'nightlight-e2e-password-123',
    },
  }))

  await json(await request('/api/auth/login', {
    method: 'POST',
    authenticated: false,
    body: {
      email: 'owner-e2e@example.com',
      password: 'nightlight-e2e-password-123',
    },
  }))
  assert.ok(cookie, 'Login did not set an authenticated session cookie')

  log('create website lead and move it to Booked')
  await json(await request('/api/public/inquiry', {
    method: 'POST',
    authenticated: false,
    body: {
      name: 'E2E Main Customer',
      company: '',
      email: 'e2e-main@example.com',
      phone: '0612345678',
      eventType: 'Wedding',
      eventDate: dateOnly(mainStart),
      location: 'Groningen',
      message: internalSecret,
      website: '',
    },
  }), 201)

  const mainLead = await findGig('E2E Main Customer')
  assert.equal(mainLead.status, 'lead')
  await bookGig({
    id: mainLead.id,
    clientId: mainLead.clientId,
    title: `E2E Main Gig ${marker}`,
    startsAt: mainStart,
    publicVisibility: true,
    publicTitle: `E2E Public Night ${marker}`,
    internalNotes: internalSecret,
  })

  log('verify gig edit reached Google Calendar synchronization boundary')
  const calendar = await json<{
    items: Array<{ gigId: string, syncStatus: string }>
  }>(await request('/api/admin/calendar'))
  const calendarItem = calendar.items.find(item => item.gigId === mainLead.id)
  assert.ok(calendarItem, 'Booked gig was not queued for Calendar synchronization')
  assert.ok(['pending', 'skipped', 'failed', 'synced', 'syncing'].includes(calendarItem.syncStatus))

  log('invite client portal and submit questionnaire + music wishes')
  const portalLink = await json<{ url: string }>(await request(`/api/admin/gigs/${mainLead.id}/portal-links`, {
    method: 'POST',
    body: { expiresInDays: 30, revokeExisting: false },
  }))
  const token = new URL(portalLink.url).pathname.split('/').filter(Boolean).pop()
  assert.ok(token, 'Portal token was not returned')

  const portalBefore = await json<{
    gig: Record<string, unknown>
    questionnaire: { fields: QuestionnaireField[], status: string }
    wishes: unknown[]
  }>(await request(`/api/client/portal/${token}`, { authenticated: false }))
  assert.equal(portalBefore.questionnaire.status, 'not_started')
  assert.equal('internalNotes' in portalBefore.gig, false, 'Portal exposed internal notes')

  const answers = Object.fromEntries(
    portalBefore.questionnaire.fields.map(field => [field.id, answerFor(field)]),
  )
  await json(await request(`/api/client/portal/${token}/submit`, {
    method: 'POST',
    authenticated: false,
    body: {
      answers,
      acceptedName: 'E2E Main Customer',
      wishes: [{
        category: 'nice_to_have',
        artist: 'Daft Punk',
        title: 'One More Time',
        spotifyUrl: '',
        note: 'E2E wish',
        ordering: 0,
      }],
    },
  }))

  const portalAfter = await json<{
    questionnaire: { status: string }
    wishes: Array<{ artist: string | null, title: string | null }>
  }>(await request(`/api/client/portal/${token}`, { authenticated: false }))
  assert.equal(portalAfter.questionnaire.status, 'submitted')
  assert.ok(portalAfter.wishes.some(wish => wish.artist === 'Daft Punk' && wish.title === 'One More Time'))

  log('generate/finalize invoice and process a cryptographically signed Stripe webhook')
  const invoiceCreated = await json<{ invoice: { id: string } }>(await request(`/api/admin/gigs/${mainLead.id}/invoice`, {
    method: 'POST',
  }))
  const finalized = await json<{
    invoice: { id: string, totalCents: number, currency: string, invoiceNumber: string | null }
  }>(await request(`/api/admin/invoices/${invoiceCreated.invoice.id}/finalize`, {
    method: 'POST',
  }))
  assert.ok(finalized.invoice.invoiceNumber)
  assert.ok(finalized.invoice.totalCents > 0)

  const stripeEvent = {
    id: `evt_${marker.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}`,
    object: 'event',
    api_version: '2026-08-27.basil',
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: `cs_${marker}`,
        object: 'checkout.session',
        metadata: { invoiceId: finalized.invoice.id },
        payment_status: 'paid',
        amount_total: finalized.invoice.totalCents,
        currency: finalized.invoice.currency.toLowerCase(),
        payment_intent: `pi_${marker}`,
      },
    },
    livemode: false,
    pending_webhooks: 1,
    request: { id: null, idempotency_key: null },
    type: 'checkout.session.completed',
  }
  const stripeRaw = JSON.stringify(stripeEvent)
  const timestamp = Math.floor(Date.now() / 1000)
  const signature = createHmac('sha256', stripeWebhookSecret)
    .update(`${timestamp}.${stripeRaw}`, 'utf8')
    .digest('hex')

  await json(await request('/api/webhooks/stripe', {
    method: 'POST',
    authenticated: false,
    headers: {
      'content-type': 'application/json',
      'stripe-signature': `t=${timestamp},v1=${signature}`,
    },
    body: stripeRaw,
  }))

  const invoiceDetail = await json<{ invoice: { paymentStatus: string } }>(
    await request(`/api/admin/invoices/${finalized.invoice.id}`),
  )
  assert.equal(invoiceDetail.invoice.paymentStatus, 'paid')

  log('upload image and persist a branded generated social post')
  const sourcePng = solidPng(16, 16)
  const sourceForm = new FormData()
  sourceForm.append('file', new Blob([sourcePng], { type: 'image/png' }), 'e2e-source.png')
  sourceForm.append('thumbnail', new Blob([sourcePng], { type: 'image/png' }), 'e2e-thumb.png')
  sourceForm.append('title', `E2E Source ${marker}`)
  sourceForm.append('altText', 'E2E source image')
  sourceForm.append('tags', 'e2e,launch')
  sourceForm.append('gigId', '')
  sourceForm.append('venueId', '')
  const media = await json<{ asset: { id: string, url: string } }>(await request('/api/admin/media', {
    method: 'POST',
    body: sourceForm,
  }), 201)

  const renderedPng = solidPng(1080, 1080)
  const design = {
    preset: 'square',
    templateKey: 'gradient',
    brandPreset: 'night',
    headline: 'E2E NIGHT',
    subline: 'DJ NightLight',
    dateText: 'TEST',
    timeText: '20:00',
    locationText: 'GRONINGEN',
    ctaText: 'SEE YOU THERE',
    logoText: 'NIGHTLIGHT',
    visibility: {
      logo: true,
      headline: true,
      subline: true,
      date: true,
      time: true,
      location: true,
      cta: true,
      gigList: false,
    },
    gigItems: [],
    imageX: 0,
    imageY: 0,
    zoom: 1,
    overlayOpacity: 0.7,
    textAlign: 'left',
    textPosition: 'bottom',
    showSafeArea: true,
  }
  const renderForm = new FormData()
  renderForm.append('file', new Blob([renderedPng], { type: 'image/png' }), 'e2e-render.png')
  renderForm.append('design', JSON.stringify(design))
  renderForm.append('sourceMediaAssetId', media.asset.id)
  const generated = await json<{ post: { id: string, imageUrl: string } }>(
    await request('/api/admin/post-generator/render', { method: 'POST', body: renderForm }),
    201,
  )
  const generatedFile = await request(generated.post.imageUrl, { authenticated: false })
  assert.equal(generatedFile.status, 200)
  assert.equal(generatedFile.headers.get('content-type'), 'image/png')
  assert.ok((await generatedFile.arrayBuffer()).byteLength > 100)

  log('edit public website content and verify public rendering')
  const adminContent = await json<{ content: Record<string, unknown> }>(await request('/api/admin/content'))
  const websiteMarker = `NightLight E2E Website ${marker}`
  const contentUpdate = {
    ...adminContent.content,
    heroTitle: websiteMarker,
    heroImageUrl: adminContent.content.heroImageUrl || '',
    showreelUrl: adminContent.content.showreelUrl || '',
    contactEmail: adminContent.content.contactEmail || '',
    contactPhone: adminContent.content.contactPhone || '',
    instagramUrl: adminContent.content.instagramUrl || '',
    spotifyUrl: adminContent.content.spotifyUrl || '',
    seoImageUrl: adminContent.content.seoImageUrl || '',
  }
  await json(await request('/api/admin/content', { method: 'PUT', body: contentUpdate }))
  const publicContent = await json<{ content: { heroTitle: string } }>(
    await request('/api/public/content', { authenticated: false }),
  )
  assert.equal(publicContent.content.heroTitle, websiteMarker)
  const homeHtml = await ok(await request('/', { authenticated: false }))
  assert.ok(homeHtml.includes(websiteMarker), 'Updated website content was not rendered on the public homepage')

  log('create a private booked gig and verify public agenda privacy')
  await json(await request('/api/public/inquiry', {
    method: 'POST',
    authenticated: false,
    body: {
      name: 'E2E Private Customer',
      company: '',
      email: 'e2e-private@example.com',
      phone: '',
      eventType: 'Private party',
      eventDate: dateOnly(privateStart),
      location: 'Private venue',
      message: `PRIVATE-ONLY-${marker}`,
      website: '',
    },
  }), 201)
  const privateLead = await findGig('E2E Private Customer')
  await bookGig({
    id: privateLead.id,
    clientId: privateLead.clientId,
    title: `E2E Private Gig ${marker}`,
    startsAt: privateStart,
    publicVisibility: false,
    internalNotes: `PRIVATE-ONLY-${marker}`,
  })

  const agenda = await json<{ gigs: Array<{ title: string, description: string | null }> }>(
    await request('/api/public/agenda', { authenticated: false }),
  )
  const serializedAgenda = JSON.stringify(agenda)
  assert.ok(serializedAgenda.includes(`E2E Public Night ${marker}`), 'Public booked gig missing from agenda')
  assert.equal(serializedAgenda.includes('E2E Private Customer'), false)
  assert.equal(serializedAgenda.includes(`E2E Private Gig ${marker}`), false)
  assert.equal(serializedAgenda.includes(`PRIVATE-ONLY-${marker}`), false)
  assert.equal(serializedAgenda.includes(internalSecret), false)

  log('critical E2E workflows passed')
}

main().catch((error) => {
  console.error('[e2e] FAILED')
  console.error(error)
  process.exitCode = 1
})
