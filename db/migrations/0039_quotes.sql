-- Quotes: a priced offer for a gig that the client can accept in the client portal.
CREATE TYPE "quote_status" AS ENUM ('draft', 'sent', 'accepted', 'declined', 'void');

CREATE TABLE "quotes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "gig_id" uuid NOT NULL REFERENCES "gigs"("id") ON DELETE restrict,
  "client_id" uuid REFERENCES "clients"("id") ON DELETE restrict,
  "quote_number" varchar(80) UNIQUE,
  "status" "quote_status" DEFAULT 'draft' NOT NULL,
  "issue_date" date NOT NULL,
  "valid_until" date NOT NULL,
  "currency" varchar(3) DEFAULT 'EUR' NOT NULL,
  "vat_mode" "invoice_vat_mode" DEFAULT 'exclusive' NOT NULL,
  "vat_rate_basis_points" integer DEFAULT 2100 NOT NULL,
  "subtotal_cents" integer DEFAULT 0 NOT NULL,
  "vat_amount_cents" integer DEFAULT 0 NOT NULL,
  "total_cents" integer DEFAULT 0 NOT NULL,
  "terms" text DEFAULT '' NOT NULL,
  "notes" text DEFAULT '' NOT NULL,
  "document_snapshot" jsonb,
  "document_hash" varchar(64),
  "sent_at" timestamptz,
  "accepted_at" timestamptz,
  "accepted_name" varchar(200),
  "accepted_ip_hash" varchar(64),
  "declined_at" timestamptz,
  "decline_reason" text,
  "voided_at" timestamptz,
  "invoice_id" uuid REFERENCES "invoices"("id") ON DELETE set null,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX "quotes_gig_id_idx" ON "quotes" ("gig_id");

CREATE TABLE "quote_line_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "quote_id" uuid NOT NULL REFERENCES "quotes"("id") ON DELETE cascade,
  "description" varchar(500) NOT NULL,
  "quantity" numeric(12, 3) NOT NULL,
  "unit_price_cents" integer NOT NULL,
  "ordering" integer DEFAULT 0 NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE "business_settings" ADD COLUMN "next_quote_number" integer DEFAULT 1 NOT NULL;

-- The quote mail to the client.
INSERT INTO "email_templates" ("key", "name", "subject", "body", "schedule_anchor", "offset_minutes") VALUES
('quote_sent', 'Quote sent', 'Offerte {{quoteNumber}} voor {{gigTitle}}', E'Hoi {{clientName}},\n\nHierbij mijn offerte voor {{gigTitle}}: {{quoteTotal}}. De offerte is geldig tot {{quoteValidUntil}}.\n\nJe kunt hem bekijken en akkoord geven via je persoonlijke klantportaal:\n{{portalUrl}}\n\nGroet,\nDJ NightLight', 'event', 0)
ON CONFLICT ("key") DO NOTHING;

-- The "quote_response" owner notification (accepted or declined) is on by default, like the other kinds.
ALTER TABLE "business_settings"
  ALTER COLUMN "owner_notification_kinds"
  SET DEFAULT ARRAY['new_inquiry', 'invoice_paid', 'portal_submitted', 'lead_followup', 'review_received', 'quote_response']::text[];
UPDATE "business_settings"
  SET "owner_notification_kinds" = array_append("owner_notification_kinds", 'quote_response')
  WHERE NOT ('quote_response' = ANY("owner_notification_kinds"));
