ALTER TABLE "calendar_sync_settings"
ADD COLUMN IF NOT EXISTS "ics_token_encrypted" text;
