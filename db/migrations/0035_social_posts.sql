CREATE TYPE "social_post_kind" AS ENUM ('image', 'carousel', 'reel', 'story');
CREATE TYPE "social_post_status" AS ENUM ('draft', 'scheduled', 'publishing', 'published', 'failed', 'cancelled');

CREATE TABLE "social_posts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "account_id" uuid NOT NULL REFERENCES "social_accounts"("id") ON DELETE restrict,
  "title" varchar(200) NOT NULL,
  "kind" "social_post_kind" DEFAULT 'image' NOT NULL,
  "caption" text DEFAULT '' NOT NULL,
  "alt_text" varchar(1000),
  "scheduled_at" timestamptz,
  "status" "social_post_status" DEFAULT 'draft' NOT NULL,
  "container_id" varchar(100),
  "provider_post_id" varchar(100),
  "permalink" text,
  "retry_count" integer DEFAULT 0 NOT NULL,
  "next_retry_at" timestamptz,
  "last_attempt_at" timestamptz,
  "published_at" timestamptz,
  "last_error" text,
  "gig_id" uuid REFERENCES "gigs"("id") ON DELETE set null,
  "created_by_user_id" uuid REFERENCES "users"("id") ON DELETE set null,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX "social_posts_status_idx" ON "social_posts" ("status", "scheduled_at");
CREATE INDEX "social_posts_account_idx" ON "social_posts" ("account_id");

-- Rows reference the exported outputs instead of copying them. `restrict` keeps a queued or published
-- post from losing its media when the export is deleted.
CREATE TABLE "social_post_media" (
  "post_id" uuid NOT NULL REFERENCES "social_posts"("id") ON DELETE cascade,
  "position" integer DEFAULT 0 NOT NULL,
  "generated_post_id" uuid REFERENCES "generated_posts"("id") ON DELETE restrict,
  "video_render_job_id" uuid REFERENCES "video_render_jobs"("id") ON DELETE restrict,
  "media_asset_id" uuid REFERENCES "media_assets"("id") ON DELETE restrict,
  PRIMARY KEY ("post_id", "position"),
  CONSTRAINT "social_post_media_one_source" CHECK (
    (CASE WHEN "generated_post_id" IS NULL THEN 0 ELSE 1 END)
    + (CASE WHEN "video_render_job_id" IS NULL THEN 0 ELSE 1 END)
    + (CASE WHEN "media_asset_id" IS NULL THEN 0 ELSE 1 END) = 1
  )
);

CREATE INDEX "social_post_media_generated_idx" ON "social_post_media" ("generated_post_id");
