ALTER TABLE "media_assets" ADD COLUMN "duration_ms" integer;
ALTER TABLE "media_assets" ADD COLUMN "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL;

CREATE TABLE "video_projects" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(160) NOT NULL,
  "project" jsonb NOT NULL,
  "revision" integer DEFAULT 1 NOT NULL,
  "created_by_user_id" uuid REFERENCES "users"("id") ON DELETE set null,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX "video_projects_updated_idx" ON "video_projects" ("updated_at");

ALTER TABLE "video_render_jobs" ALTER COLUMN "source_media_asset_id" DROP NOT NULL;
ALTER TABLE "video_render_jobs" ADD COLUMN "project_id" uuid REFERENCES "video_projects"("id") ON DELETE set null;
ALTER TABLE "video_render_jobs" ADD COLUMN "project_snapshot" jsonb;

CREATE INDEX "video_render_jobs_project_idx" ON "video_render_jobs" ("project_id", "created_at");
