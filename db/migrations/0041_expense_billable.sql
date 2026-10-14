-- Costs and trips can be passed on to the client: they become lines on the gig's invoice.
ALTER TABLE "expenses" ADD COLUMN "billable" boolean DEFAULT false NOT NULL;
-- The invoice that already carries this item, so it is never billed twice.
ALTER TABLE "expenses" ADD COLUMN "billed_invoice_id" uuid REFERENCES "invoices"("id") ON DELETE set null;
