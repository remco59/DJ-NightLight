ALTER TABLE "clients" ADD COLUMN "stripe_customer_id" varchar(255);
--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_stripe_customer_id_unique" UNIQUE("stripe_customer_id");
