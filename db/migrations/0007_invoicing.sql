CREATE TYPE "invoice_status" AS ENUM ('draft', 'finalized', 'void');
CREATE TYPE "invoice_payment_status" AS ENUM ('unpaid', 'pending', 'paid', 'failed');
CREATE TYPE "invoice_vat_mode" AS ENUM ('exclusive', 'inclusive', 'exempt');

CREATE TABLE "business_settings" (
  "key" varchar(40) PRIMARY KEY DEFAULT 'default' NOT NULL,
  "company_name" varchar(240) NOT NULL,
  "address" text DEFAULT '' NOT NULL,
  "postal_code" varchar(32) DEFAULT '' NOT NULL,
  "city" varchar(160) DEFAULT '' NOT NULL,
  "country" varchar(120) DEFAULT 'Nederland' NOT NULL,
  "email" varchar(320) DEFAULT '' NOT NULL,
  "phone" varchar(64) DEFAULT '' NOT NULL,
  "registration_number" varchar(80) DEFAULT '' NOT NULL,
  "vat_number" varchar(80) DEFAULT '' NOT NULL,
  "iban" varchar(64) DEFAULT '' NOT NULL,
  "invoice_prefix" varchar(16) DEFAULT 'NL' NOT NULL,
  "next_invoice_number" integer DEFAULT 1 NOT NULL,
  "default_vat_mode" "invoice_vat_mode" DEFAULT 'exclusive' NOT NULL,
  "default_vat_rate_basis_points" integer DEFAULT 2100 NOT NULL,
  "default_payment_term_days" integer DEFAULT 30 NOT NULL,
  "payment_terms" text DEFAULT 'Please pay the full amount before the due date.' NOT NULL,
  "legal_text" text DEFAULT '' NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

INSERT INTO "business_settings" ("key", "company_name") VALUES ('default', 'DJ NightLight');

CREATE TABLE "invoices" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "gig_id" uuid NOT NULL REFERENCES "gigs"("id") ON DELETE restrict,
  "client_id" uuid REFERENCES "clients"("id") ON DELETE restrict,
  "invoice_number" varchar(80) UNIQUE,
  "status" "invoice_status" DEFAULT 'draft' NOT NULL,
  "payment_status" "invoice_payment_status" DEFAULT 'unpaid' NOT NULL,
  "issue_date" date NOT NULL,
  "due_date" date NOT NULL,
  "currency" varchar(3) DEFAULT 'EUR' NOT NULL,
  "vat_mode" "invoice_vat_mode" DEFAULT 'exclusive' NOT NULL,
  "vat_rate_basis_points" integer DEFAULT 2100 NOT NULL,
  "subtotal_cents" integer DEFAULT 0 NOT NULL,
  "vat_amount_cents" integer DEFAULT 0 NOT NULL,
  "total_cents" integer DEFAULT 0 NOT NULL,
  "payment_terms" text DEFAULT '' NOT NULL,
  "legal_text" text DEFAULT '' NOT NULL,
  "notes" text DEFAULT '' NOT NULL,
  "document_snapshot" jsonb,
  "document_hash" varchar(64),
  "finalized_at" timestamptz,
  "voided_at" timestamptz,
  "replacement_for_invoice_id" uuid REFERENCES "invoices"("id") ON DELETE set null,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE "invoice_line_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "invoice_id" uuid NOT NULL REFERENCES "invoices"("id") ON DELETE cascade,
  "description" varchar(500) NOT NULL,
  "quantity" numeric(12,3) NOT NULL,
  "unit_price_cents" integer NOT NULL,
  "ordering" integer DEFAULT 0 NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX "invoices_gig_idx" ON "invoices" ("gig_id");
CREATE INDEX "invoices_status_idx" ON "invoices" ("status", "payment_status");
CREATE INDEX "invoice_line_items_invoice_idx" ON "invoice_line_items" ("invoice_id", "ordering");
