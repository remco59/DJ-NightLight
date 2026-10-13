# Privacy: inzage- en verwijderverzoeken (AVG)

Een klant mag vragen wat je van hem bewaart (inzage en overdraagbaarheid) en om verwijdering van zijn gegevens. Beide staan op de klantpagina onder **Privacy**.

## Klantgegevens downloaden

**Download klantgegevens** (eigenaar en manager) geeft een JSON-bestand met alles wat de app over deze klant bewaart:

- de klantgegevens zelf;
- gigs, met contactpersonen, tijdlijn, interne notities, ingevulde vragenlijst, muziekwensen, review en portaallinks;
- offertes en facturen met regels en betalingen;
- e-mails die naar de klant gingen of gepland zijn, met de ontvanger en de ingevulde velden.

Geheime gegevens staan er niet in: portaaltokens, hashes en het gehashte IP-adres van een akkoord. Elke download komt in het auditlog.

## Persoonsgegevens verwijderen

**Persoonsgegevens verwijderen** (alleen eigenaar) maakt de klant anoniem. De klant kan niet echt worden verwijderd, omdat facturen ernaar verwijzen en je die wettelijk moet bewaren (fiscale bewaarplicht).

Wat wordt gewist:

- op de klant: naam (wordt "Verwijderde klant"), e-mailadres, factuur-e-mailadres, telefoon, adres, notities en de koppeling met Stripe;
- op de gigs van de klant: de gignaam (die bevat vaak de naam), interne notities, contactpersonen, antwoorden op de vragenlijst en de naam van de invuller, notities bij muziekwensen;
- reviews: naam en tekst, en de review gaat van de website af (de sterren blijven);
- offertes: naam van wie akkoord gaf, het gehashte IP-adres, de reden van afwijzen, notities, en de klantgegevens en persoonlijke link in het bewaarde document;
- portaallinks worden ingetrokken;
- e-mails: geplande mails worden geannuleerd, en ontvanger en inhoud van alle mails aan de klant worden gewist;
- meldingen aan de eigenaar in de outbox over deze klant worden verwijderd, en de naam bij "offerte geaccepteerd" in het auditlog;
- agenda-items worden opnieuw gesynchroniseerd, zodat de naam ook daar verdwijnt.

Wat blijft:

- **facturen** met hun bewaarde document, bedragen en regels (fiscale bewaarplicht);
- de omschrijvingen van factuur- en offerteregels. Staat daar een naam in (bijvoorbeeld "Bruiloft Sanne & Joris"), dan moet je die zelf aanpassen als dat kan;
- bedragen, datums en statussen, zonder naam.

Niet mogelijk zolang de klant nog een **geboekte gig in de toekomst** heeft: annuleer of verplaats die eerst.

## Wat de app niet voor je doet

- **Stripe, Resend (e-mail) en Google Agenda** bewaren zelf ook gegevens. Als een klant om verwijdering vraagt, wis je die daar zelf.
- Gegevens die niet aan de klant of een gig van de klant hangen, worden niet gevonden. Een gig zonder gekoppelde klant (bijvoorbeeld een review of melding daarop) valt dus buiten de export en het wissen.
- Back-ups bevatten de gegevens tot ze verlopen (zie [PRODUCTION_READINESS.md](./PRODUCTION_READINESS.md), standaard 14 dagen). Een herstel van een oude back-up brengt de gegevens terug; wis ze dan opnieuw.
