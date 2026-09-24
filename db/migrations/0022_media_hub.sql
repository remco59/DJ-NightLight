-- Media hub: where an asset came from, original/variant relationships and
-- collections that group references to existing assets (never copies).
ALTER TABLE "media_assets" ADD COLUMN "source" varchar(20) DEFAULT 'upload' NOT NULL;
ALTER TABLE "media_assets" ADD COLUMN "parent_asset_id" uuid REFERENCES "media_assets"("id") ON DELETE set null;
ALTER TABLE "media_assets" ADD COLUMN "variant_label" varchar(80) DEFAULT '' NOT NULL;

CREATE INDEX "media_assets_parent_idx" ON "media_assets" ("parent_asset_id");
CREATE INDEX "media_assets_source_idx" ON "media_assets" ("source");

CREATE TABLE "media_collections" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(80) NOT NULL,
  "description" varchar(240) DEFAULT '' NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX "media_collections_name_unique" ON "media_collections" (lower("name"));

CREATE TABLE "media_collection_items" (
  "collection_id" uuid NOT NULL REFERENCES "media_collections"("id") ON DELETE cascade,
  "asset_id" uuid NOT NULL REFERENCES "media_assets"("id") ON DELETE cascade,
  "added_at" timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY ("collection_id", "asset_id")
);

CREATE INDEX "media_collection_items_asset_idx" ON "media_collection_items" ("asset_id");

INSERT INTO "media_collections" ("name", "description", "sort_order") VALUES
  ('Promo', 'Shots for flyers, socials and announcements', 0),
  ('Website', 'Photos used on the public website', 1),
  ('Recent gigs', 'Fresh material from the latest nights', 2),
  ('Recaps', 'Aftermovies and recap graphics', 3);
