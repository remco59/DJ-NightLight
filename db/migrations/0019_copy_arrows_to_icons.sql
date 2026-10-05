-- These labels are now followed by a Lucide icon on the public site, so drop the
-- trailing arrow glyph the text used to carry (→, ↗, ↓). Only a trailing arrow is
-- removed; the rest of any customized label is kept as written.

UPDATE "site_content"
SET "public_copy" = jsonb_set("public_copy", '{navigation,mobileBooking}', to_jsonb(regexp_replace("public_copy" #>> '{navigation,mobileBooking}', '\s*[→↗↓]\s*$', '')))
WHERE "public_copy" #>> '{navigation,mobileBooking}' ~ '[→↗↓]\s*$';

UPDATE "site_content"
SET "public_copy" = jsonb_set("public_copy", '{footer,instagram}', to_jsonb(regexp_replace("public_copy" #>> '{footer,instagram}', '\s*[→↗↓]\s*$', '')))
WHERE "public_copy" #>> '{footer,instagram}' ~ '[→↗↓]\s*$';

UPDATE "site_content"
SET "public_copy" = jsonb_set("public_copy", '{footer,spotify}', to_jsonb(regexp_replace("public_copy" #>> '{footer,spotify}', '\s*[→↗↓]\s*$', '')))
WHERE "public_copy" #>> '{footer,spotify}' ~ '[→↗↓]\s*$';

UPDATE "site_content"
SET "public_copy" = jsonb_set("public_copy", '{home,scrollLabel}', to_jsonb(regexp_replace("public_copy" #>> '{home,scrollLabel}', '\s*[→↗↓]\s*$', '')))
WHERE "public_copy" #>> '{home,scrollLabel}' ~ '[→↗↓]\s*$';

UPDATE "site_content"
SET "public_copy" = jsonb_set("public_copy", '{home,aboutCta}', to_jsonb(regexp_replace("public_copy" #>> '{home,aboutCta}', '\s*[→↗↓]\s*$', '')))
WHERE "public_copy" #>> '{home,aboutCta}' ~ '[→↗↓]\s*$';

UPDATE "site_content"
SET "public_copy" = jsonb_set("public_copy", '{media,showreelExternalLabel}', to_jsonb(regexp_replace("public_copy" #>> '{media,showreelExternalLabel}', '\s*[→↗↓]\s*$', '')))
WHERE "public_copy" #>> '{media,showreelExternalLabel}' ~ '[→↗↓]\s*$';

UPDATE "site_content"
SET "public_copy" = jsonb_set("public_copy", '{landing,asideCta}', to_jsonb(regexp_replace("public_copy" #>> '{landing,asideCta}', '\s*[→↗↓]\s*$', '')))
WHERE "public_copy" #>> '{landing,asideCta}' ~ '[→↗↓]\s*$';
