-- Follow-up of open leads: when the owner last answered and when to follow up.
ALTER TABLE "gigs"
  ADD COLUMN "last_contacted_at" timestamptz,
  ADD COLUMN "follow_up_at" timestamptz;

-- The new "lead_followup" owner notification is on by default, like the other kinds.
ALTER TABLE "business_settings"
  ALTER COLUMN "owner_notification_kinds"
  SET DEFAULT ARRAY['new_inquiry', 'invoice_paid', 'portal_submitted', 'lead_followup']::text[];
UPDATE "business_settings"
  SET "owner_notification_kinds" = array_append("owner_notification_kinds", 'lead_followup')
  WHERE NOT ('lead_followup' = ANY("owner_notification_kinds"));
