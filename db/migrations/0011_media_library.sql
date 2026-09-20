CREATE TABLE "media_assets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "storage_key" varchar(500) NOT NULL UNIQUE,
  "thumbnail_key" varchar(500),
  "original_filename" varchar(255) NOT NULL,
  "mime_type" varchar(100) NOT NULL,
  "byte_size" integer NOT NULL,
  "width" integer NOT NULL,
  "height" integer NOT NULL,
  "title" varchar(240) DEFAULT '' NOT NULL,
  "alt_text" varchar(500) DEFAULT '' NOT NULL,
  "tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "gig_id" uuid REFERENCES "gigs"("id") ON DELETE set null,
  "venue_id" uuid REFERENCES "venues"("id") ON DELETE set null,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX "media_assets_created_idx" ON "media_assets" ("created_at");
CREATE INDEX "media_assets_gig_idx" ON "media_assets" ("gig_id");
CREATE INDEX "media_assets_venue_idx" ON "media_assets" ("venue_id");
