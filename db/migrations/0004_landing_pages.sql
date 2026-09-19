CREATE TABLE IF NOT EXISTS "landing_pages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "slug" varchar(160) NOT NULL UNIQUE,
  "nav_label" varchar(120) NOT NULL,
  "eyebrow" varchar(160) NOT NULL,
  "title" varchar(300) NOT NULL,
  "intro" text NOT NULL,
  "body" text NOT NULL,
  "hero_image_url" text,
  "cta_label" varchar(120) NOT NULL,
  "cta_href" varchar(500) DEFAULT '/boeken' NOT NULL,
  "published" boolean DEFAULT false NOT NULL,
  "show_in_navigation" boolean DEFAULT false NOT NULL,
  "indexable" boolean DEFAULT true NOT NULL,
  "seo_title" varchar(180) NOT NULL,
  "seo_description" varchar(320) NOT NULL,
  "seo_image_url" text,
  "ordering" integer DEFAULT 0 NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "landing_pages_published_idx" ON "landing_pages" ("published");
CREATE INDEX IF NOT EXISTS "landing_pages_navigation_idx" ON "landing_pages" ("show_in_navigation", "ordering");

INSERT INTO "landing_pages" (
  "slug", "nav_label", "eyebrow", "title", "intro", "body",
  "cta_label", "cta_href", "published", "show_in_navigation", "indexable",
  "seo_title", "seo_description", "ordering"
) VALUES
(
  'bruiloften', 'Bruiloften', 'DJ voor bruiloften',
  'Een bruiloft die klinkt als jullie.',
  'Van ontvangst en diner tot openingsdans en een volle dansvloer.',
  'De muziek van een bruiloft hoeft niet in één hokje te passen. NightLight bouwt de avond op rond jullie planning, jullie smaak en vooral de mensen op de dansvloer. Verzoeknummers en eigen favorieten krijgen een plek zonder dat de flow van de avond verdwijnt.',
  'Bespreek jullie bruiloft', '/boeken', true, false, true,
  'DJ voor bruiloften · DJ NightLight',
  'DJ NightLight voor bruiloften: persoonlijke muziekkeuzes, een flexibele opbouw en een dansvloer die past bij jullie gasten.',
  10
),
(
  'clubs', 'Clubs', 'Club DJ',
  'Energie die met de zaal meebeweegt.',
  'Geen vooraf dichtgetimmerde set, maar schakelen op het moment.',
  'Voor clubavonden draait NightLight breed en energiek. House, pop, classics en guilty pleasures kunnen naast elkaar bestaan zolang de overgang en de energie kloppen. De zaal bepaalt wanneer er wordt doorgepakt en wanneer er ruimte nodig is.',
  'Boek NightLight', '/boeken', true, false, true,
  'Club DJ · DJ NightLight',
  'Boek DJ NightLight voor clubavonden met een flexibele, energieke set die aansluit op het publiek.',
  20
),
(
  'studentenfeesten', 'Studentenfeesten', 'DJ voor studentenfeesten',
  'Herkenning, tempo en precies genoeg chaos.',
  'Voor verenigingen, introducties, gala’s en studentenfeesten.',
  'Een studentenfeest vraagt om snel kunnen schakelen. Van meezingers naar dance, van 00’s naar de track die op dat moment iedereen kent. NightLight houdt de energie hoog zonder dat de avond één lange piek wordt.',
  'Plan je studentenfeest', '/boeken', true, false, true,
  'DJ voor studentenfeesten · DJ NightLight',
  'DJ NightLight voor studentenfeesten, gala’s, introducties en verenigingsavonden.',
  30
),
(
  'bedrijfsfeesten', 'Bedrijfsfeesten', 'DJ voor bedrijfsfeesten',
  'Van borrel naar dansvloer zonder geforceerde overgang.',
  'Een muzikale lijn die werkt voor verschillende leeftijden en teams.',
  'Bij bedrijfsfeesten begint de avond vaak anders dan hij eindigt. NightLight kan rustig ondersteunen tijdens ontvangst en borrel en daarna steeds meer richting dansvloer bewegen. De muziek blijft toegankelijk zonder voorspelbaar te worden.',
  'Bespreek het event', '/boeken', true, false, true,
  'DJ voor bedrijfsfeesten · DJ NightLight',
  'DJ NightLight voor bedrijfsfeesten: achtergrond tijdens de borrel en een natuurlijke opbouw richting dansvloer.',
  40
),
(
  'privefeesten', 'Privéfeesten', 'DJ voor privéfeesten',
  'Jouw feest, zonder standaard playlist.',
  'Verjaardagen, jubilea en andere avonden die gewoon goed moeten voelen.',
  'Voor een privéfeest is er geen universele formule. NightLight stemt de muziek af op de groep, de ruimte en het moment. Van ontspannen binnenkomst tot een dansvloer die vanzelf op gang komt.',
  'Vertel over je feest', '/boeken', true, false, true,
  'DJ voor privéfeesten · DJ NightLight',
  'DJ NightLight voor verjaardagen, jubilea en privéfeesten met een flexibele muzikale opbouw.',
  50
)
ON CONFLICT ("slug") DO NOTHING;
