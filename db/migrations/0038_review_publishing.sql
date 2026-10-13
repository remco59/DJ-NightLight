-- Reviews can be shown on the website, but only with the client's consent and after the owner approves.
ALTER TABLE "gig_reviews"
  ADD COLUMN "public_consent" boolean DEFAULT false NOT NULL,
  ADD COLUMN "published" boolean DEFAULT false NOT NULL;

-- The "review_received" owner notification is on by default, like the other kinds.
ALTER TABLE "business_settings"
  ALTER COLUMN "owner_notification_kinds"
  SET DEFAULT ARRAY['new_inquiry', 'invoice_paid', 'portal_submitted', 'lead_followup', 'review_received']::text[];
UPDATE "business_settings"
  SET "owner_notification_kinds" = array_append("owner_notification_kinds", 'review_received')
  WHERE NOT ('review_received' = ANY("owner_notification_kinds"));
