ALTER TABLE "landing_pages"
ADD COLUMN IF NOT EXISTS "sections" jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE "landing_pages"
SET "sections" = '{
  "benefits": [
    {"icon":"lucide:music-2","title":"Muziek op maat","body":"Van ontspannen diner tot volle dansvloer."},
    {"icon":"lucide:users-round","title":"Voor alle generaties","body":"Een set die iedereen in beweging krijgt."},
    {"icon":"lucide:heart","title":"Zorgeloos genieten","body":"Heldere afspraken en professionele setup."}
  ],
  "storyEyebrow":"Mijn aanpak",
  "storyTitle":"Meer dan alleen een DJ.",
  "storyImageUrl":null,
  "galleryTitle":"Sfeerimpressie",
  "galleryCtaLabel":"Bekijk meer",
  "galleryCtaHref":"/media",
  "galleryImages":[
    {"url":null,"alt":""},
    {"url":null,"alt":""},
    {"url":null,"alt":""},
    {"url":null,"alt":""}
  ],
  "closingEyebrow":"Jullie avond, mijn focus",
  "closingTitle":"Laten we kennismaken.",
  "closingBody":"Ik denk graag met jullie mee over de invulling, muziekstijl en planning. Zo wordt het een avond die echt bij jullie past.",
  "closingCtaLabel":"Neem contact op",
  "closingCtaHref":"/boeken",
  "closingImageUrl":null
}'::jsonb
WHERE "slug" ~* '(bruiloft|wedding)';

UPDATE "landing_pages"
SET "sections" = '{
  "benefits": [
    {"icon":"lucide:zap","title":"Energie van begin tot eind","body":"Een set die de avond momentum blijft geven."},
    {"icon":"lucide:users-round","title":"Muziek die iedereen kent","body":"Van meezingers tot de nieuwste clubtracks."},
    {"icon":"lucide:star","title":"Ervaring met studentenfeesten","body":"Introducties, gala’s, verenigingen en themafeesten."}
  ],
  "storyEyebrow":"Mijn aanpak",
  "storyTitle":"Een set die zich aanpast aan het moment.",
  "storyImageUrl":null,
  "galleryTitle":"Sfeerimpressie",
  "galleryCtaLabel":"Bekijk meer",
  "galleryCtaHref":"/media",
  "galleryImages":[
    {"url":null,"alt":""},
    {"url":null,"alt":""},
    {"url":null,"alt":""},
    {"url":null,"alt":""}
  ],
  "closingEyebrow":"Van plan tot dansvloer",
  "closingTitle":"Lets make it happen.",
  "closingBody":"Vertel me meer over jullie feest, locatie en wensen. Ik denk graag mee over de perfecte invulling.",
  "closingCtaLabel":"Neem contact op",
  "closingCtaHref":"/boeken",
  "closingImageUrl":null
}'::jsonb
WHERE "slug" ~* 'student';

UPDATE "landing_pages"
SET "sections" = '{
  "benefits": [
    {"icon":"lucide:music-2","title":"Muziek op maat","body":"Een set die past bij publiek, locatie en moment."},
    {"icon":"lucide:users-round","title":"Ervaring met publiek","body":"Herkennen wanneer het tijd is om te schakelen."},
    {"icon":"lucide:sparkles","title":"Professionele uitstraling","body":"Van voorbereiding tot laatste track verzorgd."}
  ],
  "storyEyebrow":"Mijn aanpak",
  "storyTitle":"Een set die zich aanpast aan het moment.",
  "storyImageUrl":null,
  "galleryTitle":"Sfeerimpressie",
  "galleryCtaLabel":"Bekijk meer",
  "galleryCtaHref":"/media",
  "galleryImages":[
    {"url":null,"alt":""},
    {"url":null,"alt":""},
    {"url":null,"alt":""},
    {"url":null,"alt":""}
  ],
  "closingEyebrow":"Samen iets neerzetten",
  "closingTitle":"Klaar voor jullie feest?",
  "closingBody":"Vertel me wat je in gedachten hebt. Ik denk graag mee over muziek, planning en sfeer.",
  "closingCtaLabel":"Neem contact op",
  "closingCtaHref":"/boeken",
  "closingImageUrl":null
}'::jsonb
WHERE "sections" = '{}'::jsonb;
