CREATE TYPE "submission_status" AS ENUM ('draft', 'submitted');
CREATE TYPE "music_wish_category" AS ENUM ('must_play', 'nice_to_have', 'do_not_play', 'special_moment');

CREATE TABLE "questionnaire_templates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(200) NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE "questionnaire_template_versions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "template_id" uuid NOT NULL REFERENCES "questionnaire_templates"("id") ON DELETE cascade,
  "version" integer NOT NULL,
  "fields" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "created_by_user_id" uuid REFERENCES "users"("id") ON DELETE set null,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "questionnaire_template_version_unique" UNIQUE ("template_id", "version")
);

CREATE TABLE "contract_submissions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "gig_id" uuid NOT NULL UNIQUE REFERENCES "gigs"("id") ON DELETE cascade,
  "template_version_id" uuid NOT NULL REFERENCES "questionnaire_template_versions"("id") ON DELETE restrict,
  "portal_link_id" uuid REFERENCES "portal_links"("id") ON DELETE set null,
  "status" "submission_status" DEFAULT 'draft' NOT NULL,
  "answers" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "accepted_name" varchar(200),
  "accepted_at" timestamptz,
  "submitted_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE "music_wishes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "gig_id" uuid NOT NULL REFERENCES "gigs"("id") ON DELETE cascade,
  "category" "music_wish_category" NOT NULL,
  "artist" varchar(240),
  "title" varchar(240),
  "spotify_url" text,
  "note" text,
  "ordering" integer DEFAULT 0 NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX "contract_submissions_gig_idx" ON "contract_submissions" ("gig_id");
CREATE INDEX "music_wishes_gig_idx" ON "music_wishes" ("gig_id", "ordering");

WITH template AS (
  INSERT INTO "questionnaire_templates" ("name") VALUES ('Default client questionnaire') RETURNING "id"
)
INSERT INTO "questionnaire_template_versions" ("template_id", "version", "fields")
SELECT "id", 1, '[
  {"id":"contact_email","type":"email","label":"Contact email","required":true},
  {"id":"guest_count","type":"number","label":"Expected number of guests","required":false},
  {"id":"event_details","type":"long_text","label":"What should I know about the event?","required":false},
  {"id":"terms","type":"acknowledgement","label":"I confirm that these details are correct and accept the agreed terms.","required":true}
]'::jsonb FROM template;
