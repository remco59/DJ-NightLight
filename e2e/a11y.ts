import { AxeBuilder } from '@axe-core/playwright'
import { chromium, type Page } from 'playwright-core'

/**
 * Automated accessibility baseline for the public website (axe-core, WCAG 2.0/2.1 A + AA
 * and axe best practices). Fails on any violation so regressions are caught in CI.
 *
 * Needs a running app (E2E_BASE_URL, default http://127.0.0.1:3100) and a Chromium/Chrome:
 * CI uses the preinstalled Google Chrome; locally set A11Y_BROWSER_PATH to a Chromium binary.
 *
 * axe cannot measure contrast on gradients or background images ("incomplete" results), so
 * those still need an occasional manual check.
 */
const baseUrl = process.env.E2E_BASE_URL || 'http://127.0.0.1:3100'
const browserPath = process.env.A11Y_BROWSER_PATH

const staticPages = ['/', '/about', '/media', '/agenda', '/boeken']
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

async function publishedLandingPages() {
  const response = await fetch(`${baseUrl}/api/public/landing-pages/navigation`)
  if (!response.ok) return []
  const body = await response.json() as { pages?: Array<{ slug: string }> }
  return (body.pages ?? []).map(page => `/diensten/${page.slug}`)
}

const browser = await chromium.launch(browserPath ? { executablePath: browserPath } : { channel: 'chrome' })
const findings: Finding[] = []
const paths = [...staticPages, ...await publishedLandingPages()]

for (const [viewportName, viewport] of Object.entries(viewports)) {
  const context = await browser.newContext({ viewport })

  for (const path of paths) {
    const page = await context.newPage()
    await page.goto(`${baseUrl}${path}`, { waitUntil: 'networkidle' })
    await analyze(page, path, viewportName, findings)

    if (path === '/boeken') {
      // The validation errors are a separate state of the same page.
      await page.locator('form button[type="submit"]').first().click()
      await page.locator('[aria-invalid="true"]').first().waitFor({ timeout: 5000 }).catch(() => undefined)
      await analyze(page, `${path} (met foutmeldingen)`, viewportName, findings)
    }

    await page.close()
  }

  await context.close()
}

await browser.close()

console.log(`[a11y] checked ${paths.length} pages x ${Object.keys(viewports).length} viewports`)

if (findings.length) {
  for (const finding of findings) {
    console.error(`[a11y] ${finding.viewport} ${finding.page}: [${finding.impact}] ${finding.id} - ${finding.help}`)
    for (const target of finding.targets) console.error(`         ${target}`)
  }
  console.error(`[a11y] ${findings.length} violation(s)`)
  process.exit(1)
}

console.log('[a11y] no violations')
