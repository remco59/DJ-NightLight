ALTER TABLE "video_projects"
  ADD COLUMN "thumbnail_key" varchar(500),
  ADD COLUMN "thumbnail_revision" integer DEFAULT 0 NOT NULL,
  ADD COLUMN "thumbnail_updated_at" timestamptz;
