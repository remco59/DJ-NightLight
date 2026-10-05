-- Per-client choice of which automatic emails are sent. Stores the template keys
-- that are switched off, so new templates are sent automatically by default.
ALTER TABLE "clients" ADD COLUMN "email_automation_disabled" jsonb DEFAULT '[]'::jsonb NOT NULL;

-- Manual emails composed from a gig: edited subject/body and optional attachments.
ALTER TABLE "email_jobs" ADD COLUMN "manual" boolean DEFAULT false NOT NULL;
ALTER TABLE "email_jobs" ADD COLUMN "subject_override" varchar(300);
ALTER TABLE "email_jobs" ADD COLUMN "body_override" text;
ALTER TABLE "email_jobs" ADD COLUMN "attachments" jsonb DEFAULT '[]'::jsonb NOT NULL;
ALTER TABLE "email_jobs" ADD COLUMN "created_by_user_id" uuid REFERENCES "users"("id") ON DELETE set null;

INSERT INTO "email_templates" ("key", "name", "subject", "body", "schedule_anchor", "offset_minutes") VALUES
('custom_message', 'Custom message', 'Bericht over {{gigTitle}}', 'Hoi {{clientName}},\n\n\n\nGroet,\nDJ NightLight', 'event', 0)
ON CONFLICT ("key") DO NOTHING;
