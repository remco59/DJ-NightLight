CREATE TYPE "payment_record_status" AS ENUM ('pending', 'succeeded', 'failed', 'cancelled', 'expired');

CREATE TABLE "payments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "invoice_id" uuid NOT NULL UNIQUE REFERENCES "invoices"("id") ON DELETE restrict,
  "provider" varchar(40) DEFAULT 'stripe' NOT NULL,
  "provider_session_id" varchar(255) UNIQUE,
  "provider_payment_intent_id" varchar(255) UNIQUE,
  "amount_cents" integer NOT NULL,
  "currency" varchar(3) NOT NULL,
  "status" "payment_record_status" DEFAULT 'pending' NOT NULL,
  "attempt_count" integer DEFAULT 0 NOT NULL,
  "checkout_expires_at" timestamptz,
  "paid_at" timestamptz,
  "failure_code" varchar(160),
  "metadata" jsonb,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE "stripe_webhook_events" (
  "event_id" varchar(255) PRIMARY KEY NOT NULL,
  "event_type" varchar(160) NOT NULL,
  "livemode" boolean NOT NULL,
  "processed_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE "outbox_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "type" varchar(120) NOT NULL,
  "aggregate_type" varchar(80) NOT NULL,
  "aggregate_id" uuid NOT NULL,
  "dedupe_key" varchar(255) NOT NULL UNIQUE,
  "payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "occurred_at" timestamptz DEFAULT now() NOT NULL,
  "processed_at" timestamptz
);

CREATE INDEX "payments_status_idx" ON "payments" ("status", "updated_at");
CREATE INDEX "outbox_events_pending_idx" ON "outbox_events" ("processed_at", "occurred_at");
