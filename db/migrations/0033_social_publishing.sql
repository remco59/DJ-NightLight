CREATE TYPE "social_account_status" AS ENUM ('active', 'needs_reauth', 'disabled');

CREATE TABLE "social_settings" (
  "key" varchar(40) PRIMARY KEY DEFAULT 'default' NOT NULL,
  "app_id" varchar(100),
  "app_secret_encrypted" text,
  "last_worker_run_at" timestamptz,
  "last_published_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE "social_accounts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "provider" varchar(30) DEFAULT 'instagram' NOT NULL,
  "external_id" varchar(100) NOT NULL,
  "username" varchar(150) NOT NULL,
  "account_type" varchar(40),
  "access_token_encrypted" text NOT NULL,
  "token_issued_at" timestamptz NOT NULL,
  "token_expires_at" timestamptz NOT NULL,
  "scopes" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "status" "social_account_status" DEFAULT 'active' NOT NULL,
  "last_refresh_attempt_at" timestamptz,
  "last_refresh_error" text,
  "connected_by_user_id" uuid REFERENCES "users"("id") ON DELETE set null,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX "social_accounts_provider_external_idx" ON "social_accounts" ("provider", "external_id");
