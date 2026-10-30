-- A quote acceptance is tied to the exact terms version the client saw, and a booking has a confirmation moment.
ALTER TABLE "quotes" ADD COLUMN "accepted_terms_version_id" uuid REFERENCES "terms_versions"("id") ON DELETE restrict;
ALTER TABLE "quotes" ADD COLUMN "booking_confirmed_at" timestamptz;

INSERT INTO "email_templates" ("key", "name", "subject", "body", "schedule_anchor", "offset_minutes") VALUES
('booking_confirmed', 'Booking confirmed', 'Bevestiging van je boeking: {{gigTitle}}', E'Hoi {{clientName}},\n\nBedankt, je boeking voor {{gigTitle}} op {{gigDate}} staat vast.\n\nIn de bijlage vind je de offerte ({{quoteNumber}}) en de voorwaarden waarmee je akkoord bent gegaan ({{termsVersionLabel}}). Je kunt de voorwaarden ook altijd teruglezen op {{termsUrl}}.\n\nVia je persoonlijke klantportaal kun je de gegevens en wensen voor je feest doorgeven:\n{{portalUrl}}\n\nGroet,\nDJ NightLight', 'event', 0);
