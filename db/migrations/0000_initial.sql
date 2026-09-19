CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$ BEGIN
  CREATE TYPE "user_role" AS ENUM ('owner', 'dj', 'manager', 'content_editor');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "client_type" AS ENUM ('person', 'company');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "gig_status" AS ENUM ('lead', 'booked', 'declined', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "email" varchar(320) NOT NULL UNIQUE,
  "name" varchar(200) NOT NULL,
  "password_hash" text,
  "role" "user_role" DEFAULT 'owner' NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "clients" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "type" "client_type" DEFAULT 'person' NOT NULL,
  "first_name" varchar(120),
  "last_name" varchar(120),
  "company_name" varchar(200),
  "email" varchar(320),
  "phone" varchar(64),
  "billing_address" text,
  "notes" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "venues" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(240) NOT NULL,
  "address" text,
  "city" varchar(160),
  "contact_name" varchar(200),
  "contact_email" varchar(320),
  "contact_phone" varchar(64),
  "website" text,
  "parking_notes" text,
  "technical_notes" text,
  "notes" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "gigs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "title" varchar(240) NOT NULL,
  "event_type" varchar(120),
  "client_id" uuid REFERENCES "clients"("id") ON DELETE restrict,
  "venue_id" uuid REFERENCES "venues"("id") ON DELETE set null,
  "status" "gig_status" DEFAULT 'lead' NOT NULL,
  "starts_at" timestamptz,
  "ends_at" timestamptz,
  "load_in_at" timestamptz,
  "fee" numeric(12,2),
  "currency" varchar(3) DEFAULT 'EUR' NOT NULL,
  "public_visibility" boolean DEFAULT false NOT NULL,
  "public_title" varchar(240),
  "public_description" text,
  "internal_notes" text,
  "source" varchar(160),
  "deleted_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "gigs_status_idx" ON "gigs" ("status");
CREATE INDEX IF NOT EXISTS "gigs_starts_at_idx" ON "gigs" ("starts_at");
CREATE INDEX IF NOT EXISTS "gigs_client_idx" ON "gigs" ("client_id");
