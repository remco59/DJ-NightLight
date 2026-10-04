import type { EmailBranding } from '../../shared/email-automation'
import { sql } from './db'

const DEFAULT_LOGO_URL = '/brand/web/wordmark-arcs-960.webp'
const DEFAULT_HERO_URL = '/images/login-background.webp'

type BrandingRow = {
  templateHeroImageUrl: string | null
  defaultHeroImageUrl: string | null
}

export async function loadEmailBranding(templateKey: string, templateHeroOverride?: string | null): Promise<EmailBranding> {
  const rows = await sql`
    SELECT
      e.hero_image_url AS "templateHeroImageUrl",
      b.email_default_hero_image_url AS "defaultHeroImageUrl"
    FROM email_templates e
    LEFT JOIN business_settings b ON b.key = 'default'
    WHERE e.key = ${templateKey}
    LIMIT 1
  ` as BrandingRow[]

  const row = rows[0]
  const config = useRuntimeConfig()
  const siteUrl = String(config.public.siteUrl || 'https://djnightlight.nl').replace(/\/$/, '')
  const effectiveTemplateHero = templateHeroOverride === undefined ? row?.templateHeroImageUrl : templateHeroOverride

  return {
    siteUrl,
    logoUrl: DEFAULT_LOGO_URL,
    heroImageUrl: effectiveTemplateHero || row?.defaultHeroImageUrl || DEFAULT_HERO_URL,
  }
}
