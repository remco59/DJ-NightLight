# Besluiten en bouwplan: boekingsportaal

> **Status 2026-10-30: alle zes stappen zijn gebouwd** (zie "Wat er is gebouwd" onderaan). Er is nog niets gepubliceerd: de voorwaarden staan als concept in Instellingen en moeten eerst worden nagekeken.

Opgesteld op 2026-10-30 in overleg met de eigenaar. Dit document is het uitgangspunt voor de bouw. De bijbehorende teksten staan in `voorwaarden-samengevoegd.md` en `boekingsformulier-vragen-en-feedback.md`.

## 1. Besluiten

### Voorwaarden
| Onderwerp | Besluit |
|---|---|
| Klanttype | Gemengd (consumenten en bedrijven). Eén tekst, met consumentenbescherming waar de wet dat eist |
| Boeking definitief | Zodra de klant de offerte accepteert (en eventuele reserveringskosten betaalt). Automatische bevestiging per e-mail. Geen intrekkingsrecht van 3 dagen meer |
| Btw | Per offerte kiezen (inclusief of exclusief). De site heeft al een btw-modus per offerte |
| Reserveringskosten | Optioneel per gig, standaard uit. Bedrag of percentage per gig te kiezen. Niet terugbetaalbaar, verrekend met latere annuleringskosten |
| Annulering | Tot 21 dagen vooraf kosteloos. Daarna 25% (tot 7 dagen), 50% (tot 24 uur), 100% (binnen 24 uur of niet verschijnen). Gemaakte kosten voor huur en reizen komen erbij, totaal nooit meer dan 100% |
| Uitloop | Eerste 20 min gratis, daarna per begonnen half uur tegen het uurtarief van de gig |
| Opbouwtijd | Minimaal 30 min, extra tijd op de offerte als nodig |
| Muziekrechten | Klant of locatie regelt en betaalt |
| Uitval DJ | Gelijkwaardige vervanger, anders alles terug inclusief reserveringskosten |
| Verzekering | AVB aanwezig. Dekking en verzekerd bedrag nog controleren |
| Beeldmateriaal | Mag gebruikt worden, klant kan bezwaar maken. **Let op:** juridisch zwakker dan toestemming vooraf; laat een jurist kijken, vooral voor herkenbare gasten |

### Website
| Onderwerp | Besluit |
|---|---|
| Flow | Eén pagina met stappen: 1. offerte + voorwaarden accepteren (bindend), 2. reserveringskosten betalen als van toepassing, 3. optioneel boekingsformulier |
| Boekingsformulier | **Standaard uit**, per gig aan te zetten in het adminpaneel. Geen voorwaarde voor de boeking |
| Formulier per gig | Eerst een template kiezen (Bruiloft, Bedrijfsfeest/zakelijk, Verjaardag/privéfeest), daarna per gig vragen aan/uit zetten, wijzigen en toevoegen |
| Na insturen | Klant kan aanpassen tot het event begint. Beheerder kan altijd heropenen |
| Voorwaarden beheren | In het adminpaneel met versies, zoals de vragenlijst. Publieke pagina `/voorwaarden` met download. Akkoord van de klant wordt aan de versie gekoppeld |
| Reservering betalen | Online via bestaande betaallink (Stripe) direct na akkoord |
| Betaling technisch | **Eén factuur met deelbetalingen** (reservering = eerste deelbetaling, rest later) |

## 2. Gevolgen voor de bestaande code

Gebaseerd op wat ik in de code heb gelezen. Controleer dit tijdens de bouw.

1. **Vragenlijst is globaal.** `questionnaire_templates` en `questionnaire_template_versions` gelden voor alle gigs. `contract_submissions` is 1 per gig en verwijst naar een templateversie. Voor per-gig aanpassing is een gig-eigen kopie van de velden nodig (snapshot), met de gekozen template als bron.
2. **Vragenlijst-velden missen** voorwaardelijke zichtbaarheid, secties en herhaalbare rijen (zie het formulierdocument, punt 5).
3. **Offerte-akkoord en formulier zijn twee losse stappen.** `quote-accept.post.ts` en `submit.post.ts` bestaan al apart; dat past bij de nieuwe volgorde.
4. **Voorwaarden worden nergens opgeslagen.** `quotes.terms` is een vrij tekstveld; er is geen versie of koppeling met het akkoord. Nieuw: tabel voor voorwaardenversies, en bij `quotes` (en eventueel `contract_submissions`) een verwijzing naar de geaccepteerde versie.
5. **Reserveringskosten bestaan niet.** Er is geen veld op `quotes` of `gigs`. Nieuw: per offerte of gig aan/uit, bedrag of percentage.
6. **Deelbetalingen vragen een ombouw.** `payments` heeft een unieke index op `invoiceId` (één betaling per factuur) en `checkout.post.ts` maakt één betaling per factuur aan. Voor een deelbetaling moet dit meerdere betalingen per factuur toestaan en de factuurstatus afleiden uit de som.
7. **Stripe is nog niet live** volgens `docs/LAUNCH_CHECKLIST.md`. De reserveringsbetaling kan in testmodus worden gebouwd en getest.

## 3. Voorgestelde bouwvolgorde

Elke stap is zelfstandig op te leveren en te testen.

1. **Voorwaarden in de admin** met versies, publieke pagina `/voorwaarden`, en de samengevoegde tekst als eerste versie.
2. **Akkoord vastleggen**: voorwaardenversie koppelen aan het offerte-akkoord, en een bevestigingsmail met kopie.
3. **Portaalpagina "Bevestig je boeking"**: stappen (offerte, voorwaarden, betalen, formulier), formulier standaard uit met schakelaar per gig in de admin.
4. **Formulier per gig**: templates (Bruiloft, Bedrijfsfeest, Verjaardag), kopie naar de gig, vragen aan/uit/aanpassen, `showIf`, secties, herhaalbare rijen. Pas de vragen aan op de lijst uit het formulierdocument.
5. **Reserveringskosten**: velden op de offerte, getoond in het portaal, verrekening in annuleringskosten en eindfactuur.
6. **Deelbetalingen**: meerdere betalingen per factuur, checkout voor een deelbedrag, webhook en statusafleiding.

## 4. Nog open

- Tekst en vragen per template (Bruiloft, Bedrijfsfeest, Verjaardag): welke vragen aan, welke uit.
- Standaardbedrag of -percentage voor reserveringskosten in het adminpaneel.
- Hoe lang het openstaande akkoord geldt als de reservering niet wordt betaald (vervalt de boeking dan na een termijn?).
- Controle door een jurist van de punten met `[CONTROLEER]` in de voorwaarden.
- Dekking en verzekerd bedrag van de AVB.

## 5. Wat er is gebouwd

| Stap | Resultaat | Waar |
|---|---|---|
| 1. Voorwaarden met versies | Tabel `terms_versions`, concept/publiceren in Instellingen → Voorwaarden, publieke pagina `/voorwaarden` (inhoudsopgave, samenvatting, afdrukken, tekstdownload, oudere versies via `?version=`). Versie 1 is als **concept** ingeladen | `db/migrations/0043`, `shared/terms.ts`, `app/pages/voorwaarden.vue`, `app/pages/admin/settings/terms.vue` |
| 2. Akkoord aan versie koppelen | Het offerte-akkoord slaat de voorwaardenversie op en weigert een verouderde versie. Daarna wordt de boeking automatisch bevestigd (gig wordt Geboekt) en gaat een mail met offerte-PDF en voorwaarden als bijlage | `db/migrations/0044`, `server/utils/booking-confirmation.ts`, `quote-accept.post.ts` |
| 3. Portaal en schakelaar | Het formulier staat per gig standaard uit en gaat aan in het gig-scherm. Het portaal toont stappen (offerte, reservering, formulier), het formulier ontgrendelt na het akkoord, en de klant kan wijzigen tot het event begint | `db/migrations/0045`, `app/pages/client/[token].vue`, `app/components/admin/GigBookingForm.vue` |
| 4. Formulier per gig | Templates Bruiloft, Bedrijfsfeest, Verjaardag en de standaard vragenlijst; per gig een eigen kopie die je aanpast. Nieuw in de vragenlijst: secties, `showIf`-voorwaarden en een lijst met tijdstip + tekst (omroepen) | `db/migrations/0046`, `shared/booking-form-templates.ts`, `shared/questionnaire.ts`, `app/components/forms/QuestionnaireFieldsEditor.vue` |
| 5. Reserveringskosten | Per offerte aan/uit (vast bedrag of percentage, 25% als startwaarde). Klant betaalt via Stripe na het akkoord; de boeking is pas definitief na betaling. Handmatig vastleggen voor bankoverschrijving. Annuleringskosten volgens de staffel zijn zichtbaar bij een geaccepteerde offerte | `db/migrations/0047`, `shared/reservation.ts`, `shared/cancellation.ts`, `reservation-checkout.post.ts` |
| 6. Deelbetalingen | De reservering telt als deelbetaling op de factuur van de gig. Factuur, PDF, portaal, Stripe-checkout, webhook en handmatig betalen gebruiken het restbedrag | `server/utils/invoice-balance.ts` |

### Afwijkingen van het plan
- **Deelbetalingen staan in een eigen tabel** (`reservation_payments`), niet als extra rijen in `payments`. `payments` heeft één rij per factuur en veel code (lijsten, dashboard, mark-paid, privacy-export) rekent daarop. Voor de klant is het nog steeds één factuur met twee betalingen; de reservering wordt aan de factuur gekoppeld zodra die er is.
- **Heropenen door de beheerder** is niet nodig: de klant kan het formulier tot het event begint zelf opnieuw versturen.
- **PDF van de voorwaarden**: via afdrukken in de browser en een tekstdownload, niet als gegenereerde PDF. De bevestigingsmail bevat de voorwaarden als tekstbijlage.

### Keuzes die ik zelf heb gemaakt (de vragen waren nog open)
- **Vragen per template**: zie `shared/booking-form-templates.ts`. Ze volgen de feedback uit `boekingsformulier-vragen-en-feedback.md` en kunnen per gig worden aangepast.
- **Reserveringsbedrag**: standaard geen; als je het aanzet staat het percentage op 25%.
- **Onbetaalde reservering**: de offerte blijft geaccepteerd maar de boeking wordt niet bevestigd. Er is geen automatische vervaltermijn; de offertepagina laat zien dat de betaling nog openstaat.
- **Geen voorwaarden gepubliceerd**: een klant kan dan nog akkoord geven, zonder gekoppelde voorwaardenversie. Publiceer vóór livegang (staat in `docs/LAUNCH_CHECKLIST.md`).

### Wat nog moet gebeuren door jou
1. Tekst in Instellingen → Voorwaarden nalopen met de `[CONTROLEER]`-punten uit `voorwaarden-samengevoegd.md`, en publiceren.
2. Een jurist laten kijken naar de consumentenpunten en het beeldmateriaal-bezwaar.
3. De reserveringsbetaling testen met Stripe in testmodus (zie launch-checklist). Lokaal is alleen de webhook-logica getest, niet de echte Stripe-checkout.
4. BTW op een voorschot: de reservering telt mee in het factuurtotaal en de btw wordt dus in de factuurperiode verwerkt. Laat je boekhouder bevestigen dat dit zo klopt.
