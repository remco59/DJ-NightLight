CREATE TABLE "video_render_jobs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "source_media_asset_id" uuid NOT NULL REFERENCES "media_assets"("id") ON DELETE restrict,
  "created_by_user_id" uuid REFERENCES "users"("id") ON DELETE set null,
  "template_key" varchar(80) NOT NULL,
  "motion_preset" varchar(40) NOT NULL,
  "brand_preset" varchar(40) NOT NULL,
  "design" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "width" integer DEFAULT 1080 NOT NULL,
  "height" integer DEFAULT 1920 NOT NULL,
  "fps" integer DEFAULT 30 NOT NULL,
  "duration_seconds" integer DEFAULT 10 NOT NULL,
  "audio_key" varchar(500),
  "audio_mime_type" varchar(100),
  "output_key" varchar(500) UNIQUE,
  "output_mime_type" varchar(100) DEFAULT 'video/mp4' NOT NULL,
  "status" varchar(30) DEFAULT 'queued' NOT NULL,
  "progress" integer DEFAULT 0 NOT NULL,
  "error" text,
  "started_at" timestamptz,
  "finished_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX "video_render_jobs_queue_idx" ON "video_render_jobs" ("status", "created_at");
CREATE INDEX "video_render_jobs_source_idx" ON "video_render_jobs" ("source_media_asset_id");
