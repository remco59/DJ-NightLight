import { AxeBuilder } from '@axe-core/playwright'
import { chromium, type BrowserContext, type Page } from 'playwright-core'

/**
 * Automated accessibility check (axe-core, WCAG 2.0/2.1 A + AA and axe best practices). The product
 * standard is WCAG 2.1 AA (see PRODUCT.md); this test fails on any violation, so regressions are
 * caught in CI.
 *
 * It covers three areas:
 * - the public website, including the booking form with its error state and an availability message;
 * - the client portal, with a quote waiting for the client's answer;
 * - the back office (dashboard, gigs, quotes, invoices, finance, clients and more), on desktop and
 *   on a phone, because the owner mostly works from a phone.
 *
 * The client portal and back office need an account. The test signs in with the owner account that
 * the E2E workflows create in CI (override with A11Y_ADMIN_EMAIL and A11Y_ADMIN_PASSWORD) and makes
 * the data it needs itself ("A11y"-named client and gig, a quote, a cost). Without a working login
 * it still checks the public site and says so, so a local run against an empty database does not fail.
 * Set A11Y_REQUIRE_ADMIN=1 to make a missing login an error (CI does).
 *
 * Needs a running app (E2E_BASE_URL, default http://127.0.0.1:3100) and a Chromium/Chrome:
 * CI uses the preinstalled Google Chrome; locally set A11Y_BROWSER_PATH to a Chromium binary.
 *
 * axe cannot measure contrast on gradients or background images ("incomplete" results), so
 * those still need an occasional manual check.
 */
const baseUrl = process.env.E2E_BASE_URL || 'http://127.0.0.1:3100'
const browserPath = process.env.A11Y_BROWSER_PATH
const adminEmail = process.env.A11Y_ADMIN_EMAIL || 'owner-e2e@example.com'
const adminPassword = process.env.A11Y_ADMIN_PASSWORD || 'nightlight-e2e-password-123'
const requireAdmin = process.env.A11Y_REQUIRE_ADMIN === '1'

const staticPages = ['/', '/about', '/media', '/agenda', '/boeken', '/voorwaarden']
const adminPages = [
  '/admin',
  '/admin/gigs',
  '/admin/invoices',
  '/admin/finance',
  '/admin/clients',
  '/admin/venues',
  '/admin/calendar',
  '/admin/reviews',
  '/admin/settings/emails',
  '/admin/settings/company',
  '/admin/settings/invoicing',
  '/admin/settings/terms',
  '/admin/settings/questionnaire',
  '/admin/settings/integrations',
]
const viewports = {
  desktop: { width: 1280, height: 900 },
  mobile: { width: 390, height: 844 },
} as const

type Finding = { page: string, viewport: string, id: string, impact: string | null | undefined, help: string, targets: string[] }

async function analyze(page: Page, label: string, viewport: string, findings: Finding[]) {
  const result = await new AxeBuilder({ page })
    // Nuxt's dev overlay, only present when running `nuxt dev`
    .exclude('nuxt-devtools-frame')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
    .analyze()
  for (const violation of result.violations) {
    findings.push({
      page: label,
      viewport,
      id: violation.id,
      impact: violation.impact,
      help: violation.help,
      targets: violation.nodes.slice(0, 3).map(node => node.target.join(' ')),
    })
  }
}

/** Lets Vue hydrate and animations settle, so axe sees the page a visitor sees. */
async function settle(page: Page) {
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(600)
}

async function publishedLandingPages() {
  const response = await fetch(`${baseUrl}/api/public/landing-pages/navigation`)
  if (!response.ok) return []
  const body = await response.json() as { pages?: Array<{ slug: string }> }
  return (body.pages ?? []).map(page => `/diensten/${page.slug}`)
}

async function api<T>(context: BrowserContext, method: 'GET' | 'POST', path: string, data?: unknown) {
  const response = await context.request.fetch(`${baseUrl}${path}`, { method, ...(data === undefined ? {} : { data }) })
  if (!response.ok()) throw new Error(`${method} ${path} -> ${response.status()}: ${(await response.text()).slice(0, 200)}`)
  return await response.json() as T
}

/** Finds or makes what the back-office and portal pages need, so they are checked with real content. */
async function ensureFixtures(context: BrowserContext) {
  const clientName = 'A11y Testklant'
  const found = await api<{ clients: Array<{ id: string }> }>(context, 'GET', `/api/admin/clients?search=${encodeURIComponent(clientName)}`)
  const client = found.clients[0] ?? (await api<{ client: { id: string } }>(context, 'POST', '/api/admin/clients', {
    type: 'company', companyName: clientName, email: 'a11y@example.com', phone: '0612345678', billingAddress: 'Teststraat 1, 9711 AA Groningen',
  })).client

  const gigTitle = 'A11y testgig'
  const gigs = await api<{ gigs: Array<{ id: string, title: string }> }>(context, 'GET', `/api/admin/gigs?search=${encodeURIComponent(gigTitle)}`)
  const gig = gigs.gigs.find(item => item.title === gigTitle) ?? (await api<{ gig: { id: string } }>(context, 'POST', '/api/admin/gigs', {
    title: gigTitle, status: 'lead', clientId: client.id, startsAt: '2099-06-01T18:00:00.000Z', endsAt: '2099-06-01T23:00:00.000Z',
    fee: '1000', currency: 'EUR', publicVisibility: false, eventType: 'Bedrijfsfeest',
  })).gig

  type GigDetail = { quotes: Array<{ id: string, status: string }>, expenses: unknown[] }
  let detail = await api<GigDetail>(context, 'GET', `/api/admin/gigs/${gig.id}`)
  if (!detail.quotes.length) {
    const created = await api<{ quote: { id: string } }>(context, 'POST', `/api/admin/gigs/${gig.id}/quote`)
    await api(context, 'POST', `/api/admin/quotes/${created.quote.id}/send`)
    detail = await api<GigDetail>(context, 'GET', `/api/admin/gigs/${gig.id}`)
  }
  else if (detail.quotes[0]!.status === 'draft') {
    await api(context, 'POST', `/api/admin/quotes/${detail.quotes[0]!.id}/send`)
  }
  if (!detail.expenses.length) {
    await api(context, 'POST', '/api/admin/expenses', { kind: 'cost', gigId: gig.id, spentOn: '2026-01-15', description: 'A11y testkosten', category: 'overig', amountCents: 1210, vatCents: 210 })
    await api(context, 'POST', '/api/admin/expenses', { kind: 'mileage', gigId: gig.id, spentOn: '2026-01-15', description: '', kilometers: 40, kmRateCents: 23 })
  }

  const quote = detail.quotes[0]!
  const link = await api<{ url: string }>(context, 'POST', `/api/admin/gigs/${gig.id}/portal-links`, { expiresInDays: 30 })
  return { clientId: client.id, gigId: gig.id, quoteId: quote.id, portalPath: `/client/${link.url.split('/').pop()}` }
}

const browser = await chromium.launch(browserPath ? { executablePath: browserPath } : { channel: 'chrome' })
const findings: Finding[] = []
let checked = 0

// --- public website ----------------------------------------------------------------------
const publicPaths = [...staticPages, ...await publishedLandingPages()]

for (const [viewportName, viewport] of Object.entries(viewports)) {
  const context = await browser.newContext({ viewport })

  for (const path of publicPaths) {
    const page = await context.newPage()
    await page.goto(`${baseUrl}${path}`, { waitUntil: 'networkidle' })
    await analyze(page, path, viewportName, findings)
    checked += 1

    if (path === '/boeken') {
      // The availability message under the date field is its own state of the page.
      const year = new Date().getFullYear() + 2
      await page.locator('input[type="date"]').fill(`${year}-06-15`)
      await page.locator('.availability-card').waitFor({ timeout: 5000 }).catch(() => undefined)
      await analyze(page, `${path} (met beschikbaarheid)`, viewportName, findings)
      // The validation errors are a separate state of the same page.
      await page.locator('form button[type="submit"]').first().click()
      await page.locator('[aria-invalid="true"]').first().waitFor({ timeout: 5000 }).catch(() => undefined)
      await analyze(page, `${path} (met foutmeldingen)`, viewportName, findings)
      checked += 2
    }

    await page.close()
  }

  await context.close()
}

// --- client portal and back office -------------------------------------------------------
let adminChecked = false
const probe = await browser.newContext()
const login = await probe.request.post(`${baseUrl}/api/auth/login`, { data: { email: adminEmail, password: adminPassword } })
await probe.close()

if (login.ok()) {
  for (const [viewportName, viewport] of Object.entries(viewports)) {
    const context = await browser.newContext({ viewport })
    await context.request.post(`${baseUrl}/api/auth/login`, { data: { email: adminEmail, password: adminPassword } })
    const fixtures = await ensureFixtures(context)

    const paths = [
      ...adminPages,
      `/admin/gigs/${fixtures.gigId}`,
      `/admin/gigs/${fixtures.gigId}?tab=finance`,
      `/admin/gigs/${fixtures.gigId}?tab=client`,
      `/admin/clients/${fixtures.clientId}`,
      `/admin/quotes/${fixtures.quoteId}`,
      fixtures.portalPath,
    ]
    for (const path of paths) {
      const page = await context.newPage()
      await page.goto(`${baseUrl}${path}`, { waitUntil: 'networkidle' })
      await settle(page)
      await analyze(page, path, `${viewportName}`, findings)
      checked += 1
      await page.close()
    }
    await context.close()
  }
  adminChecked = true
}
else {
  const message = `could not sign in as ${adminEmail} (HTTP ${login.status()}): the client portal and back office were NOT checked`
  if (requireAdmin) {
    console.error(`[a11y] ${message}`)
    process.exit(1)
  }
  console.warn(`[a11y] ${message}. Set A11Y_ADMIN_EMAIL and A11Y_ADMIN_PASSWORD, or run the E2E workflows first.`)
}

await browser.close()

console.log(`[a11y] checked ${checked} page states${adminChecked ? ' (public site, client portal and back office)' : ' (public site only)'}`)

if (findings.length) {
  for (const finding of findings) {
    console.error(`[a11y] ${finding.viewport} ${finding.page}: [${finding.impact}] ${finding.id} - ${finding.help}`)
    for (const target of finding.targets) console.error(`         ${target}`)
  }
  console.error(`[a11y] ${findings.length} violation(s)`)
  process.exit(1)
}

console.log('[a11y] no violations')
