CREATE TYPE "email_job_status" AS ENUM ('pending', 'processing', 'sent', 'failed', 'cancelled', 'suppressed');
CREATE TYPE "email_delivery_status" AS ENUM ('sent', 'failed');

CREATE TABLE "email_templates" (
  "key" varchar(80) PRIMARY KEY NOT NULL,
  "name" varchar(160) NOT NULL,
  "enabled" boolean DEFAULT true NOT NULL,
  "subject" varchar(300) NOT NULL,
  "body" text NOT NULL,
  "schedule_anchor" varchar(40) DEFAULT 'event' NOT NULL,
  "offset_minutes" integer DEFAULT 0 NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE "email_jobs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "template_key" varchar(80) NOT NULL REFERENCES "email_templates"("key") ON DELETE restrict,
  "gig_id" uuid REFERENCES "gigs"("id") ON DELETE set null,
  "invoice_id" uuid REFERENCES "invoices"("id") ON DELETE set null,
  "recipient" varchar(320) NOT NULL,
  "variables" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "run_at" timestamptz NOT NULL,
  "status" "email_job_status" DEFAULT 'pending' NOT NULL,
  "attempt_count" integer DEFAULT 0 NOT NULL,
  "dedupe_key" varchar(255) NOT NULL UNIQUE,
  "last_error" text,
  "sent_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE "email_delivery_attempts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "job_id" uuid NOT NULL REFERENCES "email_jobs"("id") ON DELETE cascade,
  "status" "email_delivery_status" NOT NULL,
  "provider_message_id" varchar(255),
  "error" text,
  "attempted_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE "gig_email_suppressions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "gig_id" uuid NOT NULL REFERENCES "gigs"("id") ON DELETE cascade,
  "template_key" varchar(80) NOT NULL REFERENCES "email_templates"("key") ON DELETE cascade,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  UNIQUE ("gig_id", "template_key")
);

CREATE INDEX "email_jobs_due_idx" ON "email_jobs" ("status", "run_at");
CREATE INDEX "email_jobs_gig_idx" ON "email_jobs" ("gig_id", "created_at");
CREATE INDEX "email_delivery_job_idx" ON "email_delivery_attempts" ("job_id", "attempted_at");

INSERT INTO "email_templates" ("key", "name", "subject", "body", "schedule_anchor", "offset_minutes") VALUES
('lead_acknowledgement', 'Lead acknowledgement', 'Bedankt voor je aanvraag, {{clientName}}', 'Hoi {{clientName}},\n\nBedankt voor je aanvraag voor {{gigTitle}}. Ik heb hem ontvangen en kom zo snel mogelijk bij je terug.\n\nGroet,\nDJ NightLight', 'event', 0),
('booking_accepted', 'Booking accepted', 'Je boeking voor {{gigTitle}} staat vast', 'Hoi {{clientName}},\n\nLeuk nieuws: {{gigTitle}} staat bij NightLight als geboekt. Datum: {{gigDate}}.\n\nGroet,\nDJ NightLight', 'event', 0),
('client_portal_invitation', 'Client portal invitation', 'Jouw NightLight-portaal voor {{gigTitle}}', 'Hoi {{clientName}},\n\nVia deze beveiligde link kun je de gegevens en muziekwensen voor {{gigTitle}} invullen:\n{{portalUrl}}\n\nGroet,\nDJ NightLight', 'event', 0),
('portal_reminder', 'Portal reminder', 'Reminder: vul je NightLight-portaal in', 'Hoi {{clientName}},\n\nEen korte reminder om de gegevens en muziekwensen voor {{gigTitle}} in te vullen.\n\n{{portalUrl}}', 'gig_start', -20160),
('invoice_sent', 'Invoice sent', 'Factuur {{invoiceNumber}} voor {{gigTitle}}', 'Hoi {{clientName}},\n\nDe factuur voor {{gigTitle}} staat klaar. Factuurnummer: {{invoiceNumber}}, bedrag: {{invoiceTotal}}.\n\n{{invoiceUrl}}', 'event', 0),
('payment_reminder', 'Payment reminder', 'Betaalherinnering factuur {{invoiceNumber}}', 'Hoi {{clientName}},\n\nDit is een vriendelijke herinnering voor factuur {{invoiceNumber}} van {{invoiceTotal}}. De vervaldatum is {{invoiceDueDate}}.', 'invoice_due', -10080),
('overdue_reminder', 'Overdue reminder', 'Factuur {{invoiceNumber}} is verlopen', 'Hoi {{clientName}},\n\nFactuur {{invoiceNumber}} van {{invoiceTotal}} heeft als vervaldatum {{invoiceDueDate}} en staat nog open.', 'invoice_due', 1440),
('payment_received', 'Payment received', 'Betaling ontvangen voor factuur {{invoiceNumber}}', 'Hoi {{clientName}},\n\nBedankt! De betaling van {{invoiceTotal}} voor factuur {{invoiceNumber}} is ontvangen.', 'event', 0),
('pre_gig_reminder', 'Pre-gig reminder', 'Nog even tot {{gigTitle}}', 'Hoi {{clientName}},\n\nNog even en dan is het zover: {{gigTitle}} op {{gigDate}}. Als er nog wijzigingen zijn, laat het gerust weten.', 'gig_start', -10080),
('thank_you', 'Thank-you', 'Bedankt voor {{gigTitle}}!', 'Hoi {{clientName}},\n\nBedankt voor de mooie avond bij {{gigTitle}}. Ik hoop dat jullie hebben genoten!', 'gig_end', 1440),
('review_request', 'Review request', 'Wil je NightLight beoordelen?', 'Hoi {{clientName}},\n\nNogmaals bedankt voor {{gigTitle}}. Als je een moment hebt, zou een review enorm gewaardeerd worden.\n\n{{reviewUrl}}', 'gig_end', 2880)
ON CONFLICT ("key") DO NOTHING;
