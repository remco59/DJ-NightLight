-- Where the owner is notified about new inquiries, paid invoices and submitted client portals.
-- An empty address means no notifications.
ALTER TABLE "business_settings"
  ADD COLUMN "owner_notification_email" varchar(320) DEFAULT '' NOT NULL,
  ADD COLUMN "owner_notification_kinds" text[] DEFAULT ARRAY['new_inquiry', 'invoice_paid', 'portal_submitted']::text[] NOT NULL;
