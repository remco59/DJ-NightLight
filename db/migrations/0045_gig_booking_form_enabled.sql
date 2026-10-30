-- The booking form is optional per gig, off by default. Gigs that already use the form keep it.
ALTER TABLE "gigs" ADD COLUMN "booking_form_enabled" boolean DEFAULT false NOT NULL;
UPDATE "gigs" SET "booking_form_enabled" = true
WHERE "id" IN (SELECT "gig_id" FROM "contract_submissions")
   OR "id" IN (SELECT "gig_id" FROM "music_wishes");
