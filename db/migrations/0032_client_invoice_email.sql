-- Optional separate email address that invoice emails are sent to.
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "invoice_email" varchar(320);
