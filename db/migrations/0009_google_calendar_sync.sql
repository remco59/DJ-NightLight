CREATE TYPE "calendar_sync_status" AS ENUM ('pending', 'syncing', 'synced', 'failed', 'skipped');
CREATE TYPE "calendar_cancellation_behavior" AS ENUM ('delete', 'mark_cancelled', 'keep');

CREATE TABLE "calendar_sync_settings" (
  "key" varchar(40) PRIMARY KEY DEFAULT 'default' NOT NULL,
  "enabled" boolean DEFAULT false NOT NULL,
  "calendar_id" varchar(255) DEFAULT 'primary' NOT NULL,
  "cancellation_behavior" "calendar_cancellation_behavior" DEFAULT 'delete' NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

INSERT INTO "calendar_sync_settings" ("key") VALUES ('default') ON CONFLICT DO NOTHING;

CREATE TABLE "gig_calendar_sync" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "gig_id" uuid NOT NULL UNIQUE REFERENCES "gigs"("id") ON DELETE cascade,
  "provider_event_id" varchar(255) UNIQUE,
  "status" "calendar_sync_status" DEFAULT 'pending' NOT NULL,
  "retry_count" integer DEFAULT 0 NOT NULL,
  "next_retry_at" timestamptz DEFAULT now() NOT NULL,
  "last_attempt_at" timestamptz,
  "last_synced_at" timestamptz,
  "last_error" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX "gig_calendar_sync_due_idx" ON "gig_calendar_sync" ("status", "next_retry_at");
