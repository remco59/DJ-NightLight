ALTER TABLE "calendar_sync_settings"
  ADD COLUMN "client_id" varchar(500),
  ADD COLUMN "client_secret_encrypted" text,
  ADD COLUMN "refresh_token_encrypted" text;

CREATE TABLE "email_provider_settings" (
  "key" varchar(40) PRIMARY KEY DEFAULT 'default' NOT NULL,
  "api_key_encrypted" text,
  "from_address" varchar(500),
  "review_url" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
