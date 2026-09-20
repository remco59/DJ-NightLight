CREATE TABLE "operations_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "kind" varchar(80) NOT NULL,
  "status" varchar(40) NOT NULL,
  "message" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "occurred_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX "operations_events_kind_idx" ON "operations_events" ("kind", "occurred_at");
CREATE INDEX "operations_events_status_idx" ON "operations_events" ("status", "occurred_at");
