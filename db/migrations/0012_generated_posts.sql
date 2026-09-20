CREATE TABLE "generated_posts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "source_media_asset_id" uuid REFERENCES "media_assets"("id") ON DELETE set null,
  "template_key" varchar(80) NOT NULL,
  "preset" varchar(20) NOT NULL,
  "width" integer NOT NULL,
  "height" integer NOT NULL,
  "design" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "output_key" varchar(500) NOT NULL UNIQUE,
  "output_mime_type" varchar(100) DEFAULT 'image/png' NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX "generated_posts_created_idx" ON "generated_posts" ("created_at");
CREATE INDEX "generated_posts_source_idx" ON "generated_posts" ("source_media_asset_id");
