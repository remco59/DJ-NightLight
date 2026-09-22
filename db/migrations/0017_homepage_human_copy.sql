-- Refresh legacy homepage copy without overwriting content that was already customized in the editor.
UPDATE "site_content"
SET
  "hero_body" = CASE
    WHEN "hero_body" = 'Een avond die rustig kan beginnen en precies op het juiste moment losgaat. DJ NightLight draait breed, leest de zaal en bouwt de energie op rond jouw publiek.'
      THEN 'Ik draai op bruiloften, studentenfeesten, clubs en privé-events. Van achtergrondmuziek tijdens de eerste borrel tot een volle dansvloer later op de avond.'
    ELSE "hero_body"
  END,
  "about_title" = CASE
    WHEN "about_title" = 'Niet één vaste set. Wel de juiste muziek voor de zaal.'
      THEN 'Ik ben Remco, de DJ achter NightLight.'
    ELSE "about_title"
  END,
  "about_body" = CASE
    WHEN "about_body" = 'DJ NightLight draait op bruiloften, clubavonden, studentenfeesten, bedrijfsfeesten en privé-events. De muziek beweegt mee met het publiek: herkenbaar waar het moet, verrassend waar het kan.'
      THEN 'Mijn set ligt niet vooraf van begin tot eind vast. Ik kijk naar wat er in de zaal gebeurt, probeer dingen uit en bouw vanuit daar verder. Soms betekent dat disco en guilty pleasures, soms house of stevige dance, en soms precies die onverwachte klassieker op het goede moment.'
    ELSE "about_body"
  END,
  "public_copy" =
    jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            jsonb_set(
              jsonb_set(
                "public_copy",
                '{home,visualBody}',
                CASE WHEN "public_copy" #>> '{home,visualBody}' = 'De avond in beeld — donker, dichtbij en midden in de energie.'
                  THEN to_jsonb('Een paar momenten van echte avonden met NightLight achter de booth.'::text)
                  ELSE COALESCE("public_copy" #> '{home,visualBody}', 'null'::jsonb) END,
                true
              ),
              '{home,visualCaption}',
              CASE WHEN "public_copy" #>> '{home,visualCaption}' = 'Lees de ruimte. Bouw het moment.'
                THEN to_jsonb('Tijdens het draaien kijk ik vooral naar wat er op de vloer gebeurt.'::text)
                ELSE COALESCE("public_copy" #> '{home,visualCaption}', 'null'::jsonb) END,
              true
            ),
            '{home,aboutImageCaption}',
            CASE WHEN "public_copy" #>> '{home,aboutImageCaption}' = 'Geen vaste setlist. Wel een duidelijke lijn door de avond.'
              THEN to_jsonb('Ik bereid de avond voor, maar laat de volgorde afhangen van wat er in de zaal gebeurt.'::text)
              ELSE COALESCE("public_copy" #> '{home,aboutImageCaption}', 'null'::jsonb) END,
            true
          ),
          '{home,servicesEyebrow}',
          CASE WHEN "public_copy" #>> '{home,servicesEyebrow}' = 'Voor elke zaal een andere energie'
            THEN to_jsonb('Waar ik draai'::text)
            ELSE COALESCE("public_copy" #> '{home,servicesEyebrow}', 'null'::jsonb) END,
          true
        ),
        '{home,servicesBody}',
        CASE WHEN "public_copy" #>> '{home,servicesBody}' = 'De muziek verandert met het publiek. De aandacht voor opbouw blijft hetzelfde.'
          THEN to_jsonb('Bruiloft, studentennacht of bedrijfsfeest: de muziek en opbouw verschillen per publiek en moment.'::text)
          ELSE COALESCE("public_copy" #> '{home,servicesBody}', 'null'::jsonb) END,
        true
      ),
      '{home,proofQuote}',
      CASE WHEN "public_copy" #>> '{home,proofQuote}' = 'Niet vooraf bepalen waar de avond heen moet. Eerst voelen waar de zaal klaar voor is.'
        THEN to_jsonb('Ik werk niet met één vaste setlist. Ik bereid de avond voor, maar beslis in de zaal welke richting werkt.'::text)
        ELSE COALESCE("public_copy" #> '{home,proofQuote}', 'null'::jsonb) END,
      true
    ),
  "updated_at" = now()
WHERE "key" = 'main';
