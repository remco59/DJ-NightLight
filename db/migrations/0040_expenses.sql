-- Costs and mileage, per gig or general, for the finance overview and the accountant export.
CREATE TABLE "expenses" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "gig_id" uuid REFERENCES "gigs"("id") ON DELETE set null,
  "kind" varchar(16) DEFAULT 'cost' NOT NULL,
  "spent_on" date NOT NULL,
  "description" varchar(300) NOT NULL,
  "category" varchar(40) DEFAULT 'overig' NOT NULL,
  "amount_cents" integer NOT NULL,
  "vat_cents" integer DEFAULT 0 NOT NULL,
  "kilometers" numeric(8, 1),
  "km_rate_cents" integer,
  "created_by_user_id" uuid REFERENCES "users"("id") ON DELETE set null,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "expenses_amount_check" CHECK ("amount_cents" >= 0 AND "vat_cents" >= 0 AND "vat_cents" <= "amount_cents"),
  CONSTRAINT "expenses_kind_check" CHECK ("kind" IN ('cost', 'mileage'))
);
CREATE INDEX "expenses_spent_on_idx" ON "expenses" ("spent_on");
CREATE INDEX "expenses_gig_id_idx" ON "expenses" ("gig_id");

-- Default reimbursement per kilometre, in cents. Changeable on the finance page.
ALTER TABLE "business_settings" ADD COLUMN "km_rate_cents" integer DEFAULT 23 NOT NULL;
