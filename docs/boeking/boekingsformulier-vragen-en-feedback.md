# Boekingsformulier: vragen op een rijtje + feedback

Bron: `Boekingsformulier.pdf` (3 pagina's), gecombineerd met de aanvullende voorwaarden en de algemene voorwaarden van MediaCorp. Bedoeld om ingebouwd te worden in de DJ NightLight-website (klantportaal `app/pages/client/[token].vue` + vragenlijst `shared/questionnaire.ts`).

## 1. Wat de website al kan (uitgangspunt)

Uit de code:

- Vragenlijst met veldtypes: `short_text`, `long_text`, `email`, `phone`, `number`, `date`, `time`, `select`, `multi_select`, `checkbox`, `acknowledgement`, `url`.
- Muziekwensen als aparte stap, met categorieën `must_play`, `nice_to_have`, `do_not_play`, `special_moment`, een Spotify-link en een notitie per wens (`musicWishSchema`).
- "Je volledige naam als akkoord" onder de vragenlijst, en een offerte-akkoord met naam + vinkje.
- Een offerte heeft standaard 14 dagen geldigheid (`QUOTE_DEFAULT_VALID_DAYS`), gelijk aan de 2 weken in de algemene voorwaarden.

Wat ontbreekt: voorwaardelijke velden (een vraag alleen tonen als een eerdere vraag "ja" is), groepering in secties, herhaalbare rijen (tijdstip + tekst voor omroepen) en bestandsupload. Zie punt 5.

## 2. De vragen uit het formulier

| # | Vraag in PDF | Type nu | Voorstel voor de website | Verplicht |
|---|---|---|---|---|
| 1 | Omschrijving event | vrije tekst, 3 regels | `select` soort feest (Bruiloft, Verjaardag, Bedrijfsfeest, Jubileum, Anders) + optioneel `short_text` toelichting | Ja |
| 2 | Locatie event (adres + omschrijving) | vrije tekst, 2 regels | Splitsen: locatienaam, straat + nr, postcode, plaats, `select` type (zaal / feesttent / buiten / thuis / anders) | Ja |
| 3 | Datum en tijd | vrije tekst, 2 regels | `date` + `time` aanvang + `time` einde. Vooraf invullen vanuit offerte/lead | Ja |
| 4 | Is er geluidsapparatuur aanwezig? | vrije tekst | `select` (Nee, DJ verzorgt / Ja, klant of locatie verzorgt) en bij "Ja": merk/type + `multi_select` aansluitingen (XLR, 6,3 mm jack, RCA/tulp, 3,5 mm, weet ik niet) | Ja |
| 5 | Wat voor soort muziek mag er gedraaid worden? | vrije tekst, 4 regels | `multi_select` genres + `long_text` aanvulling, optie "Van alles wat" | Ja |
| 6 | Nummers die sowieso voorbij moeten komen (10 regels) + "Op volgorde? Ja/Nee" | 10 genummerde regels | Niet 10 vaste regels: gebruik de bestaande stap Muziekwensen (`must_play`) met Spotify-link. "Op volgorde" als `checkbox` | Nee |
| 7 | Wat voor muziek mag er niet gedraaid worden? | vrije tekst, 5 regels | Bestaande categorie `do_not_play` + `multi_select` genres + `checkbox` "geen expliciete teksten" | Nee |
| 8 | Dingen die tijdens het event omgeroepen moeten worden | vrije tekst, 5 regels | Rijen met tijdstip + tekst (of 'moment'), plus uitspraak van namen. Past bij `special_moment` | Nee |
| 9 | Overige opmerkingen | vrije tekst, 9 regels | `long_text` | Nee |
| 10 | Handtekening (akkoord voorwaarden) | tekenvak | `acknowledgement` (verplicht) met links naar beide voorwaarden + naamveld (bestaat al) | Ja |

## 3. Feedback op de vragen die er al staan

1. **Veel vrije tekst.** Dat levert onvolledige antwoorden op ("bruiloft" zonder tijd of aantal gasten). Gebruik keuzevelden waar het antwoord een vaste set is (soort feest, locatietype, aansluitingen, genres) en vrije tekst alleen als aanvulling.
2. **Vraag 3 en de voorwaarden spreken elkaar tegen.** Het formulier zegt "De DJ komt altijd 30-60 min eerder", de aanvullende voorwaarden zeggen "altijd 30 min van te voren". Kies één waarde (voorstel: minimaal 30 minuten) en gebruik die in beide teksten.
3. **Vraag 3 mist de structuur die de voorwaarden gebruiken.** De voorwaarden rekenen met speeltijd, pauzes tussen sets (50%-regel) en uitloop. Het formulier vraagt één datum/tijd. Laat de klant per set een start- en eindtijd invullen en vraag of er andere artiesten spelen. Dan klopt de offerte met de werkelijkheid.
4. **Vraag 4 dekt maar de helft van de voorwaarden.** De voorwaarden stellen ook eisen aan de DJ-plek, stroom en afstand tot de installatie. Laat die zien als afvinkregels (zie punt 4) in plaats van ze alleen in de PDF te laten staan. Dat is ook je bewijs als er achteraf discussie komt.
5. **Vraag 6 sluit niet aan op de website.** "10 regels + neem contact op voor een playlist" is een omweg als de site al muziekwensen met Spotify-link heeft. Verwijs naar die stap.
6. **Vraag 7 en 8 zijn nu losse tekstvakken.** "Niet draaien" hoort bij dezelfde muziekwensenstap. "Omroepen" werkt beter als lijst met tijdstip, zodat de DJ het in het draaiboek kan zetten.
7. **De tekst "Je event is bijna geboekt" en de slotzin zijn niet consistent met de algemene voorwaarden.** Het formulier zegt dat de boeking definitief is na ondertekenen en bevestiging. De algemene voorwaarden (art. Aanvaarding, lid 1) geven MediaCorp nog 3 dagen om een aanbod in te trekken. Kies één regel en zeg die ook in de bevestigingsmail.
8. **Het formulier zegt dat je de voorwaarden "goed hebt ontvangen en doorgelezen".** Prima als vinkje, maar toon op de website de voorwaarden zelf (pagina + PDF), niet alleen een link, en bewaar bij het akkoord de versie en het tijdstip.

## 4. Ontbrekende vragen (aanbevolen toevoeging)

Gegroepeerd per sectie, in de volgorde waarin een klant ze logisch invult.

**Contact en facturatie** (alleen als het niet al uit de lead/offerte komt)
- Naam opdrachtgever(s). De voorwaarden maken meerdere klanten hoofdelijk aansprakelijk, dus bij een bruiloft beide namen.
- Telefoonnummer en e-mail.
- Particulier of zakelijk. Bij zakelijk: bedrijfsnaam, KvK-nummer, btw-nummer, factuuradres, referentie/PO-nummer. De voorwaarden onderscheiden consumenten en bedrijven, dus dit moet bekend zijn.
- Contactpersoon op de dag zelf + telefoonnummer (vaak niet de opdrachtgever).

**Event**
- Aantal gasten en grofweg de leeftijdsgroep.
- Programma/tijdschema: andere artiesten, toespraken, diner, openingsdans, pauzes.

**Locatie en techniek** (hier zitten de eisen uit de aanvullende voorwaarden)
- Afvinkregel: "Er is een plek van minimaal 2 m x 1,5 m voor de DJ" + `select` verhoging ja/nee.
- Afvinkregel: "Er is minimaal 1 stopcontact binnen 1,5 m."
- Bij eigen geluidsinstallatie: afvinkregel "Er is een aansluiting (XLR, 6,3 mm jack of RCA/tulp) binnen 6 m."
- Licht: wordt dat door de DJ verzorgd, de klant of de locatie? Het formulier vraagt wel naar geluid maar niet naar licht, terwijl de voorwaarden het wel benoemen.
- Laden/lossen en parkeren: afstand tot de opstelplek, verdieping, lift, toegang vanaf hoe laat. Bepaalt de opbouwtijd en eventuele parkeerkosten.
- Geluidslimiet, eindtijd door gemeente/locatie, buren, buiten met overkapping of niet. Voorkomt dat het feest vroeg stopt zonder dat dit in de offerte staat.

**Muziek en entertainment**
- Zie tabel hierboven (genres, wensen, niet draaien, omroepen).

**Toestemmingen**
- Mag MediaCorp foto's of video van de set gebruiken voor promotie (optioneel, standaard uit). Relevant omdat de site een social/video-module heeft.
- Akkoord algemene + aanvullende voorwaarden (verplicht) en kennisgeving privacy.
- Muziekrechten: wie regelt Buma/Stemra en Sena bij een openbaar of zakelijk evenement? Het is nu nergens geregeld (zie de voorwaardenfeedback).

## 5. Feedback voor het inbouwen in de website

1. **Eén klantportaal, drie stappen.** Stap 1 Het feest (vragen 1-5 en techniek), stap 2 Muziekwensen (6, 7, 8), stap 3 Akkoord (voorwaarden + naam). De site heeft stap 1 en 2 al; stap 3 vraagt alleen een naam. Voeg de voorwaarden hier toe.
2. **Voorwaardelijke velden toevoegen.** Voeg een `showIf` toe aan `QuestionnaireField` (`{ fieldId, equals }`). Dan verschijnen merk, aansluitingen en de 6-meter-regel alleen als de klant zelf de installatie levert, en het veld "Welke andere artiesten?" alleen bij "ja".
3. **Secties.** De huidige weergave is één platte `field-grid`. Een `section`-eigenschap per veld geeft koppen ("Locatie", "Techniek") en houdt het formulier op een telefoon overzichtelijk.
4. **Herhaalbare rijen** voor omroepen en tijdschema (tijd + tekst). Anders blijft het een tekstvak.
5. **Vooraf invullen.** Datum, tijden, locatie en namen staan meestal al in de lead of offerte. Toon ze voorgevuld en laat de klant alleen bevestigen of corrigeren. Dat verkleint de kans op tegenstrijdige gegevens.
6. **Akkoord vastleggen.** Sla bij het akkoord op: versienummer of datum van beide voorwaarden, tijdstip, naam, en e-mailadres. Stuur de klant automatisch een kopie (PDF of tekst) per e-mail. Voor consumenten moeten elektronische voorwaarden voor of tijdens het sluiten van de overeenkomst beschikbaar worden gesteld op een manier dat ze opgeslagen kunnen worden (art. 6:230c BW). Laat een jurist dit bevestigen.
7. **Korte samenvatting boven de volledige tekst.** Zes punten: annuleren, betalen, wat de klant regelt, uitloop, verzoeknummers, schade. De volledige tekst blijft de bindende versie.
8. **Opslag en bewerken.** De site laat de klant nu al tot het versturen aanpassen. Houd dat vast, en vergrendel het formulier na versturen (dat doet de huidige code al met `status === 'submitted'`).
9. **Standaardtekst van de offerte.** `DEFAULT_QUOTE_TERMS` zegt alleen "Door akkoord te geven bevestig je dat je de offerte hebt gelezen". Laat die tekst ook naar de voorwaarden verwijzen, zodat offerte-akkoord en formulier-akkoord dezelfde basis hebben.

## 6. Beperking van deze analyse

Ik heb alleen de PDF's en de frontend/shared-code van de vragenlijst gelezen. Ik heb niet gecontroleerd hoe de database het akkoord opslaat (bijvoorbeeld `contractSubmissions`), dus punt 5.6 is een aanbeveling en geen beschrijving van wat al bestaat. De juridische opmerkingen zijn geen juridisch advies.
