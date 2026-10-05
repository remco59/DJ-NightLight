CREATE TABLE IF NOT EXISTS "gig_reviews" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "gig_id" uuid NOT NULL REFERENCES "gigs"("id") ON DELETE CASCADE,
  "portal_link_id" uuid REFERENCES "portal_links"("id") ON DELETE SET NULL,
  "rating" integer NOT NULL CHECK ("rating" BETWEEN 1 AND 5),
  "comment" text,
  "author_name" varchar(200),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "gig_reviews_gig_id_unique" ON "gig_reviews" ("gig_id");
