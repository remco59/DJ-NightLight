CREATE TABLE "stripe_settings" (
  "key" varchar(40) PRIMARY KEY DEFAULT 'default' NOT NULL,
  "secret_key_encrypted" text,
  "webhook_secret_encrypted" text,
  "webhook_endpoint_id" varchar(255),
  "livemode" boolean,
  "account_id" varchar(255),
  "account_name" varchar(255),
  "verified_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
