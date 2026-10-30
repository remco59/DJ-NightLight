-- Reservation costs: an optional, non-refundable first payment on a quote. It is paid when the client accepts,
-- and becomes a partial payment on the invoice that is made for the same gig.
ALTER TABLE "quotes" ADD COLUMN "reservation_mode" varchar(12) CHECK ("reservation_mode" IN ('fixed', 'percentage'));
-- Cents for a fixed amount, basis points for a percentage.
ALTER TABLE "quotes" ADD COLUMN "reservation_value" integer CHECK ("reservation_value" > 0);
ALTER TABLE "quotes" ADD COLUMN "reservation_cents" integer DEFAULT 0 NOT NULL CHECK ("reservation_cents" >= 0);
ALTER TABLE "quotes" ADD COLUMN "reservation_paid_at" timestamptz;

CREATE TABLE "reservation_payments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "quote_id" uuid NOT NULL UNIQUE REFERENCES "quotes"("id") ON DELETE restrict,
  -- Set once the invoice for the gig exists; from then on the amount counts as paid on that invoice.
  "invoice_id" uuid REFERENCES "invoices"("id") ON DELETE set null,
  "provider" varchar(40) DEFAULT 'stripe' NOT NULL,
  "provider_session_id" varchar(255) UNIQUE,
  "provider_payment_intent_id" varchar(255) UNIQUE,
  "amount_cents" integer NOT NULL CHECK ("amount_cents" > 0),
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
CREATE INDEX "reservation_payments_invoice_id_idx" ON "reservation_payments" ("invoice_id");
