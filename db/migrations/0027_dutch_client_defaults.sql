-- Client-facing defaults were seeded in English. Switch them to Dutch, but only
-- where the owner never changed them: edited text is left exactly as it is.

ALTER TABLE "business_settings"
  ALTER COLUMN "payment_terms" SET DEFAULT 'Betaal het volledige bedrag vóór de vervaldatum.';

UPDATE "business_settings"
SET "payment_terms" = 'Betaal het volledige bedrag vóór de vervaldatum.'
WHERE "payment_terms" = 'Please pay the full amount before the due date.';

-- Finalized invoices are immutable documents; only drafts take the new wording.
UPDATE "invoices"
SET "payment_terms" = 'Betaal het volledige bedrag vóór de vervaldatum.'
WHERE "status" = 'draft' AND "payment_terms" = 'Please pay the full amount before the due date.';

-- The questionnaire is versioned (submissions keep the version they answered),
-- so a Dutch copy is added as a new version instead of rewriting the old one.
INSERT INTO "questionnaire_template_versions" ("template_id", "version", "fields")
SELECT latest."template_id", latest."version" + 1, '[
  {"id":"contact_email","type":"email","label":"E-mailadres voor contact","required":true},
  {"id":"guest_count","type":"number","label":"Verwacht aantal gasten","required":false},
  {"id":"event_details","type":"long_text","label":"Wat moet ik weten over het feest?","required":false},
  {"id":"terms","type":"acknowledgement","label":"Ik bevestig dat deze gegevens kloppen en ga akkoord met de afgesproken voorwaarden.","required":true}
]'::jsonb
FROM (
  SELECT DISTINCT ON (v."template_id") v."template_id", v."version", v."fields"
  FROM "questionnaire_template_versions" v
  ORDER BY v."template_id", v."version" DESC
) latest
WHERE latest."fields" = '[
  {"id":"contact_email","type":"email","label":"Contact email","required":true},
  {"id":"guest_count","type":"number","label":"Expected number of guests","required":false},
  {"id":"event_details","type":"long_text","label":"What should I know about the event?","required":false},
  {"id":"terms","type":"acknowledgement","label":"I confirm that these details are correct and accept the agreed terms.","required":true}
]'::jsonb;

UPDATE "questionnaire_templates" SET "name" = 'Vragenlijst voor klanten' WHERE "name" = 'Default client questionnaire';
