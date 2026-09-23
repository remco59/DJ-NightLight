CREATE TABLE "render_settings" (
  "key" varchar(40) PRIMARY KEY DEFAULT 'default' NOT NULL,
  "engine" varchar(20) DEFAULT 'auto' NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

INSERT INTO "render_settings" ("key") VALUES ('default') ON CONFLICT DO NOTHING;

CREATE TABLE "render_worker_status" (
  "key" varchar(40) PRIMARY KEY DEFAULT 'default' NOT NULL,
  "capabilities" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "detected_at" timestamptz DEFAULT now() NOT NULL,
  "heartbeat_at" timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE "video_render_jobs" ADD COLUMN "render_engine" varchar(20);
