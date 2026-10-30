-- Terms versions: the general and supplementary terms as one editable document.
-- A published version never changes; a new version is a new row. The seeded first version
-- is a draft so nothing legal goes public before the owner has reviewed it.
CREATE TABLE "terms_versions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "version" integer NOT NULL UNIQUE,
  "title" varchar(200) NOT NULL,
  "body" text NOT NULL,
  "summary" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "status" varchar(16) DEFAULT 'draft' NOT NULL CHECK ("status" IN ('draft', 'published')),
  "published_at" timestamptz,
  "created_by_user_id" uuid REFERENCES "users"("id") ON DELETE set null,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
-- At most one draft at a time.
CREATE UNIQUE INDEX "terms_versions_one_draft" ON "terms_versions" (("status")) WHERE "status" = 'draft';

INSERT INTO "terms_versions" ("version", "title", "body", "summary", "status") VALUES (
  1,
  'Voorwaarden DJ NightLight',
  $terms$## Artikel 1. Definities

1. **MediaCorp**: Land Designs, gevestigd te Drachten, KvK-nummer 80074146.
2. **DJ NightLight**: merknaam van MediaCorp.
3. **Klant**: degene met wie MediaCorp een overeenkomst aangaat.
4. **Consument**: een klant die een natuurlijk persoon is en niet handelt in de uitoefening van een beroep of bedrijf.
5. **Partijen**: MediaCorp en klant samen.
6. **Event**: de gebeurtenis waar de DJ aanwezig is, zoals een bruiloft, (bedrijfs)feest of evenement.
7. **Boekingsformulier**: het formulier waarin de klant de gegevens en wensen voor het event doorgeeft.

## Artikel 2. Toepasselijkheid en rangorde

1. Deze voorwaarden gelden voor alle offertes, aanbiedingen, overeenkomsten en diensten van MediaCorp en DJ NightLight.
2. Als een bepaling in deze voorwaarden een andere bepaling tegenspreekt, gaan de artikelen 7 tot en met 11 (de DJ-specifieke afspraken) voor.
3. Afwijken van deze voorwaarden kan alleen als partijen dat uitdrukkelijk en schriftelijk (ook per e-mail) overeenkomen.
4. Voorwaarden van de klant of van derden zijn niet van toepassing.

## Artikel 3. Offerte en overeenkomst

1. Een offerte is vrijblijvend en 14 dagen geldig, tenzij anders vermeld. Daarna vervalt de offerte.
2. De klant ontvangt de offerte via het boekingsportaal. De overeenkomst komt tot stand op het moment dat de klant de offerte daar accepteert en, als de offerte reserveringskosten bevat, die heeft betaald. MediaCorp bevestigt dit automatisch per e-mail.
3. Een mondelinge aanvaarding bindt MediaCorp pas nadat de klant die schriftelijk of elektronisch heeft bevestigd.
4. Bij het accepteren van de offerte verklaart de klant deze voorwaarden te hebben ontvangen en gelezen.
5. Als MediaCorp het boekingsformulier voor dit event heeft ingeschakeld, vult de klant daarin de gegevens en wensen voor het event in. Het formulier is geen voorwaarde voor de overeenkomst. De klant kan het aanpassen tot het event begint; wijzigingen kort voor het event kunnen alleen worden doorgevoerd als dat redelijkerwijs nog mogelijk is.

## Artikel 4. Prijzen

1. Alle prijzen zijn in euro's. Op de offerte staat per offerte of de prijzen inclusief of exclusief btw zijn, met het btw-bedrag apart vermeld.
2. Prijzen zijn exclusief reiskosten, parkeerkosten, huur van extra apparatuur en andere kosten, tenzij op de offerte anders staat.
3. Een prijs op de offerte staat vast voor de duur van die offerte. Verhoogt MediaCorp de prijs na het sluiten van de overeenkomst door gestegen kostprijzen die niet te voorzien waren, dan heeft een consument het recht de overeenkomst te ontbinden, tenzij de verhoging het gevolg is van een wettelijke regeling.

## Artikel 5. Betaling

1. MediaCorp kan op de offerte reserveringskosten opnemen, als vast bedrag of percentage. Die zijn bedoeld om de datum vast te houden en worden niet terugbetaald, ook niet bij kosteloos annuleren. Bij annulering volgens artikel 11 lid 3 worden ze in mindering gebracht op de annuleringskosten. De reserveringskosten tellen mee voor het totaalbedrag van het event. De offerte vermeldt duidelijk dat ze niet terugbetaalbaar zijn.
2. De klant betaalt het overige bedrag binnen 30 dagen na factuurdatum, tenzij op offerte of factuur een andere termijn staat.
3. Kan de klant door omstandigheden niet op tijd betalen, dan neemt de klant tijdig contact op met MediaCorp (telefoon, e-mail of anderszins) om een andere regeling af te spreken.
4. MediaCorp mag de dienstverlening afhankelijk stellen van volledige of gedeeltelijke betaling vooraf of van zekerheidstelling.

## Artikel 6. Gevolgen niet tijdig betalen

1. Betaalt de klant niet binnen de termijn, dan is de klant van rechtswege in verzuim en kan MediaCorp rente in rekening brengen: de wettelijke rente voor consumenten, de wettelijke handelsrente voor bedrijven.
2. Bij een consument stuurt MediaCorp eerst een aanmaning met een nieuwe termijn van minimaal 14 dagen voordat incassokosten worden berekend. Bij een bedrijf zijn buitengerechtelijke incassokosten verschuldigd volgens het Besluit vergoeding voor buitengerechtelijke incassokosten.
3. Bij liquidatie, faillissement, beslag of surseance van betaling aan de zijde van de klant zijn alle vorderingen van MediaCorp direct opeisbaar.
4. Weigert de klant medewerking aan de uitvoering van de overeenkomst, dan blijft de afgesproken prijs verschuldigd.
5. Bij niet-tijdige betaling mag MediaCorp zijn verplichtingen opschorten totdat de klant volledig heeft betaald.

## Artikel 7. Voorafgaand aan het event: wat de klant regelt

1. De klant zorgt voor een plek voor de DJ van minimaal 2 meter lang en 1,5 meter breed, bij voorkeur op een verhoging.
2. Er is minimaal 1 stopcontact (of stekkerdoos/verlengsnoer) binnen 1,5 meter van de DJ-plek.
3. Levert de klant de geluidsinstallatie, dan is binnen 6 meter van de DJ-plek een aansluiting (XLR, 6,3 mm jack of RCA/tulp) naar die installatie aanwezig.
4. De DJ is minimaal 30 minuten voor de afgesproken starttijd aanwezig om de apparatuur op te bouwen en aan te sluiten. Is meer opbouwtijd nodig, dan staat dat op de offerte. Is er nog geen publiek, dan kan een soundcheck plaatsvinden.
5. De klant zorgt dat de DJ op tijd toegang heeft tot de locatie en dat laden en lossen mogelijk is.
6. De klant zorgt voor de benodigde vergunningen en meldingen voor het event, en regelt en betaalt de muziekrechten (Buma/Stemra en Sena) als die voor het event nodig zijn. De locatie kan al een licentie hebben; de klant controleert dit.

## Artikel 8. De apparatuur

1. De DJ brengt zelf de mixer (DJ-decks), koptelefoon, microfoon en microfoonstandaard mee.
2. De klant verzorgt de geluidsinstallatie en het licht, tenzij schriftelijk anders is afgesproken.
3. Verzorgt de DJ geluid, dan bestaat dat uit minimaal 2 speakers van minimaal 500 W (met ingebouwde versterker). Verzorgt de DJ licht, dan bestaat dat uit minimaal 2 par-lights en 1 combi-unit (laser, UV en LED).
4. Het is niet toegestaan de apparatuur van de DJ te bedienen of aan te raken zonder toestemming van de DJ.
5. De klant is verantwoordelijk voor schade aan de apparatuur van MediaCorp die is veroorzaakt door een ander dan de DJ, en voor schade door apparatuur die de klant heeft aangeleverd. De vergoeding is het bedrag van de reparatie of, als herstel niet mogelijk is, de nieuwwaarde van een soortgelijk model.
6. De klant zorgt dat de apparatuur tijdens het event niet onbeheerd achterblijft in een ruimte die voor derden toegankelijk is, en verzekert de aanwezige apparatuur van MediaCorp niet zelf tenzij MediaCorp dit verzoekt.

## Artikel 9. Tijden, pauzes en uitloop

1. Partijen spreken vooraf af op welke tijden de DJ speelt.
2. Wisselt de DJ af met andere artiesten en zit er 1 uur of meer tussen, dan wordt die tussentijd voor 50% gerekend. Voorbeeld: de DJ speelt 2 uur, er zit 1 uur tussen, daarna weer 2 uur: dan wordt 4,5 uur gerekend.
3. In het afgesproken tijdvak vult de DJ de tijd met muziek (en entertainment). Moet de DJ even bij de mixer weg, dan zorgt de DJ dat de muziek doorloopt.
4. Bij uitloop kunnen op locatie afspraken worden gemaakt om langer door te spelen. Uitloop wordt per begonnen half uur berekend tegen het uurtarief van het event, tenzij anders is afgesproken. Tot 20 minuten uitloop is kosteloos.

## Artikel 10. Muziek en verzoeknummers

1. Het publiek mag verzoeknummers aanvragen. MediaCorp garandeert niet dat alle verzoeken worden gedraaid; de DJ weegt af of het nummer past en beschikbaar is.
2. De klant kan van tevoren in het boekingsformulier opgeven welke nummers wel en niet gedraaid moeten worden.

## Artikel 11. Annulering en verplaatsing

1. De klant meldt annulering schriftelijk (ook per e-mail) aan MediaCorp.
2. Annuleren tot 21 dagen voor het event is kosteloos. Eventuele reserveringskosten (artikel 5 lid 1) worden niet terugbetaald; er komen geen verdere kosten bij.
3. Bij annulering korter dan 21 dagen voor het event is van de afgesproken prijs verschuldigd: 25% bij annulering tot 7 dagen ervoor, 50% bij annulering tussen 7 dagen en 24 uur ervoor. Betaalde reserveringskosten worden hierop in mindering gebracht. Heeft MediaCorp al aantoonbare kosten gemaakt voor huur van apparatuur of reizen, dan kunnen die daarnaast worden doorberekend, maar het totaal is nooit hoger dan 100% van de afgesproken prijs.
4. Bij annulering binnen 24 uur voor het event, of niet verschijnen, is 100% verschuldigd.
5. Verplaatsen tot 21 dagen voor het event is kosteloos. Daarna worden kosten berekend die afhangen van de nieuwe datum. Is de DJ op de nieuwe datum niet beschikbaar, dan wordt het event geannuleerd (met bovenstaande gevolgen) of wordt een andere datum gezocht.
6. Kan de DJ door ziekte of een andere reden die bij MediaCorp ligt niet optreden, dan zorgt MediaCorp voor een gelijkwaardige vervanger. Lukt dat niet, dan ontvangt de klant alles terug wat is betaald, inclusief reserveringskosten.

## Artikel 12. Geen herroepingsrecht bij events

Een overeenkomst voor een DJ-optreden is een dienst in verband met vrijetijdsbesteding die op een bepaalde datum wordt uitgevoerd. Een consument heeft daarom geen wettelijk herroepingsrecht van 14 dagen. Annuleren kan volgens artikel 11.

## Artikel 13. Uitvoering van de overeenkomst en informatie van de klant

1. MediaCorp voert de overeenkomst naar beste inzicht en vermogen en volgens de eisen van goed vakmanschap uit. Dit is een inspanningsverplichting, geen resultaatsverplichting.
2. MediaCorp mag de dienst (gedeeltelijk) door derden laten uitvoeren.
3. De klant geeft alle informatie die nodig is voor een goede uitvoering tijdig door (onder meer via het boekingsformulier) en staat in voor de juistheid en volledigheid ervan.
4. Is de informatie niet, niet tijdig of onjuist aangeleverd en leidt dat tot vertraging of extra werk, dan zijn de extra kosten en uren voor rekening van de klant.
5. De DJ mag het optreden stoppen als de veiligheid van de DJ of de apparatuur niet is gewaarborgd.
6. Meerdere klanten zijn ieder hoofdelijk aansprakelijk voor het volledige bedrag.

## Artikel 14. Aansprakelijkheid

1. MediaCorp is alleen aansprakelijk voor schade die de klant lijdt als gevolg van opzet of bewuste roekeloosheid van MediaCorp.
2. Als MediaCorp aansprakelijk is, is dat alleen voor directe schade en tot het bedrag dat de afgesloten (beroeps)aansprakelijkheidsverzekering uitkeert. Keert de verzekeraar niet uit, dan is de aansprakelijkheid beperkt tot het factuurbedrag waarop de aansprakelijkheid betrekking heeft.
3. MediaCorp is niet aansprakelijk voor indirecte schade, zoals gevolgschade, gederfde winst, gemiste besparingen of schade aan derden.
4. De klant vrijwaart MediaCorp tegen aanspraken van derden die verband houden met de geleverde diensten, behalve als de schade is veroorzaakt door opzet of bewuste roekeloosheid van MediaCorp.
5. Afbeeldingen, foto's en omschrijvingen op de website zijn indicatief.
6. Een recht op schadevergoeding vervalt 12 maanden na de gebeurtenis waaruit de aansprakelijkheid voortvloeit, onverminderd artikel 6:89 BW.

## Artikel 15. Overmacht

1. Een tekortkoming van MediaCorp is niet toerekenbaar bij overmacht, naast het bepaalde in artikel 6:75 BW. Daaronder vallen ook, maar niet uitsluitend: noodtoestand (oorlog, opstand, natuurrampen), wanprestatie of overmacht van toeleveranciers, onwerkbaar weer, storingen in stroom, internet en telecom, overheidsmaatregelen, ziekte van de DJ en onvoorziene vervoersproblemen.
2. Bij overmacht worden de verplichtingen van MediaCorp opgeschort. Duurt de overmacht minstens 30 kalenderdagen, dan mogen beide partijen de overeenkomst schriftelijk geheel of gedeeltelijk ontbinden.
3. In een overmachtsituatie is MediaCorp geen schadevergoeding verschuldigd.
4. Betaalde bedragen voor diensten die niet zijn geleverd worden terugbetaald.

## Artikel 16. Klachten

1. De klant meldt een tekortkoming zo snel mogelijk. Tijdens het event kan dat bij de DJ zodat het ter plekke kan worden opgelost.
2. Daarna meldt de klant de tekortkoming binnen 1 maand na constatering schriftelijk bij MediaCorp (via info@landdesigns.nl), met een duidelijke omschrijving. Consumenten doen dat uiterlijk binnen 2 maanden.
3. Een klacht schort de betalingsverplichting niet op.

## Artikel 17. Ontbinding

1. De klant mag de overeenkomst ontbinden als MediaCorp toerekenbaar tekortschiet in de nakoming, tenzij de tekortkoming gezien haar aard of geringe betekenis de ontbinding niet rechtvaardigt. Is nakoming niet blijvend of tijdelijk onmogelijk, dan kan ontbinding pas nadat MediaCorp in verzuim is.
2. MediaCorp mag de overeenkomst ontbinden als de klant zijn verplichtingen niet (volledig of tijdig) nakomt, of als er goede grond is te vrezen dat de klant dat niet zal doen.

## Artikel 18. Wijziging, overdracht en nietigheid

1. Is wijziging van de overeenkomst nodig, dan passen partijen die tijdig en in overleg aan.
2. MediaCorp mag deze voorwaarden wijzigen. Voor lopende overeenkomsten blijft de versie gelden die bij het sluiten van de overeenkomst is verstrekt, tenzij de wijziging van ondergeschikt belang is. Een consument mag bij een wezenlijke wijziging de overeenkomst opzeggen.
3. Rechten van de klant kunnen niet worden overgedragen zonder voorafgaande schriftelijke toestemming van MediaCorp (goederenrechtelijke werking, art. 3:83 lid 2 BW).
4. Is een bepaling nietig of vernietigbaar, dan blijven de overige bepalingen gelden. De ongeldige bepaling wordt vervangen door een bepaling die het dichtst komt bij wat MediaCorp bedoelde.

## Artikel 19. Privacy

1. MediaCorp verwerkt de gegevens uit het boekingsformulier alleen om het event uit te voeren, te factureren en contact te onderhouden, en volgens de privacyverklaring op de website.
2. MediaCorp mag foto's en video's van het optreden gebruiken voor promotie, zoals op de website en sociale media. De klant kan hiertegen voor of na het event bezwaar maken via info@landdesigns.nl; MediaCorp verwijdert het materiaal dan binnen redelijke termijn.

## Artikel 20. Toepasselijk recht en geschillen

1. Op elke overeenkomst is Nederlands recht van toepassing.
2. Geschillen worden voorgelegd aan de bevoegde Nederlandse rechter in het arrondissement waar MediaCorp is gevestigd, tenzij de wet dwingend anders voorschrijft (bij consumenten kan de consument kiezen voor de rechter van de eigen woonplaats).$terms$,
  '["Annuleren kan tot 21 dagen vooraf kosteloos. Daarna betaal je 25%, 50% of 100% van de prijs, afhankelijk van hoe laat je annuleert.","Reserveringskosten (als die op je offerte staan) worden niet terugbetaald, maar wel verrekend met eventuele annuleringskosten.","Jij zorgt voor een plek van minimaal 2 x 1,5 meter, een stopcontact binnen 1,5 meter en, bij eigen geluid, een aansluiting binnen 6 meter.","De DJ is minimaal 30 minuten voor de start aanwezig. Tot 20 minuten uitloop is gratis, daarna per begonnen half uur.","Verzoeknummers zijn welkom, maar niet gegarandeerd. Wensen geef je door in het boekingsformulier.","Is er schade aan de apparatuur door gasten of jouw materiaal, dan is die voor jouw rekening. Valt de DJ uit, dan zorgen wij voor een vervanger of je krijgt alles terug."]'::jsonb,
  'draft'
);
