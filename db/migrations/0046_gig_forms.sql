-- A booking form per gig: the questions are copied from a template when the form is switched on, and can then
-- be changed for that gig alone. Gigs without a row keep using the questionnaire from Instellingen.
CREATE TABLE "gig_forms" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "gig_id" uuid NOT NULL UNIQUE REFERENCES "gigs"("id") ON DELETE cascade,
  "template_key" varchar(40) NOT NULL,
  "fields" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE "contract_submissions" ALTER COLUMN "template_version_id" DROP NOT NULL;
ALTER TABLE "contract_submissions" ADD COLUMN "gig_form_id" uuid REFERENCES "gig_forms"("id") ON DELETE set null;
