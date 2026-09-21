ALTER TABLE "gigs"
  ADD COLUMN "assigned_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL;

CREATE INDEX "gigs_assigned_user_id_idx" ON "gigs" ("assigned_user_id");
