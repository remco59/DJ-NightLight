ALTER TABLE "site_content"
ADD COLUMN "public_copy" jsonb DEFAULT '{}'::jsonb NOT NULL;
