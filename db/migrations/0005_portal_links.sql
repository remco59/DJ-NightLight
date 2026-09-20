CREATE TABLE IF NOT EXISTS "portal_links" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "gig_id" uuid NOT NULL REFERENCES "gigs"("id") ON DELETE cascade,
  "token_hash" varchar(64) NOT NULL UNIQUE,
  "expires_at" timestamptz NOT NULL,
  "revoked_at" timestamptz,
  "last_used_at" timestamptz,
  "last_invited_at" timestamptz DEFAULT now() NOT NULL,
  "invitation_count" integer DEFAULT 1 NOT NULL,
  "created_by_user_id" uuid REFERENCES "users"("id") ON DELETE set null,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "portal_links_gig_idx" ON "portal_links" ("gig_id");
CREATE INDEX IF NOT EXISTS "portal_links_token_hash_idx" ON "portal_links" ("token_hash");
CREATE INDEX IF NOT EXISTS "portal_links_expiry_idx" ON "portal_links" ("expires_at");
