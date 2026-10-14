-- Whether the VAT return (omzetbelastingaangifte) of a quarter was filed and paid.
-- One row per quarter; no row means nothing was recorded yet.
CREATE TABLE "vat_filings" (
  "year" integer NOT NULL,
  "period" varchar(2) NOT NULL,
  "submitted_on" date,
  -- The amount to pay (negative: to receive) as it stood when the return was marked as filed,
  -- so a later change in the figures can be flagged.
  "filed_balance_cents" integer,
  "paid_on" date,
  "updated_by_user_id" uuid REFERENCES "users"("id") ON DELETE set null,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "vat_filings_pk" PRIMARY KEY ("year", "period"),
  CONSTRAINT "vat_filings_period_check" CHECK ("period" IN ('q1', 'q2', 'q3', 'q4')),
  CONSTRAINT "vat_filings_paid_check" CHECK ("paid_on" IS NULL OR ("submitted_on" IS NOT NULL AND "paid_on" >= "submitted_on")),
  CONSTRAINT "vat_filings_filed_check" CHECK (("submitted_on" IS NULL) = ("filed_balance_cents" IS NULL))
);
