ALTER TABLE "business_settings"
  ADD COLUMN IF NOT EXISTS "email_default_hero_image_url" text;

ALTER TABLE "email_templates"
  ADD COLUMN IF NOT EXISTS "hero_image_url" text;
