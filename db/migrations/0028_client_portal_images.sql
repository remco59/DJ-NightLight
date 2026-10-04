ALTER TABLE "business_settings"
  ADD COLUMN IF NOT EXISTS "client_portal_default_image_url" text;

ALTER TABLE "gigs"
  ADD COLUMN IF NOT EXISTS "client_portal_image_url" text;
