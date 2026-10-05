# Email automation

NightLight stores templates, jobs and delivery attempts in PostgreSQL. The worker can restart without losing scheduled mail.

## Provider configuration

V1 uses the Resend HTTP API without storing provider credentials in the database.

Set these deployment secrets:

- `RESEND_API_KEY`
- `EMAIL_FROM` (for example `DJ NightLight <boekingen@djnightlight.nl>`)
- `REVIEW_URL` (optional, used by the review template)

Verify the sending domain in the provider before enabling production mail.

## Templates and timing

Admin → Email contains the initial workflows:

- lead acknowledgement
- booking accepted
- client portal invitation
- portal reminder
- invoice sent
- payment reminder
- overdue reminder
- payment received
- pre-gig reminder
- thank-you
- review request

Each template can be enabled/disabled and its subject/body/timing can be edited. Variables use `{{variableName}}`.

Timing anchors are event, gig start, gig end or invoice due date. Offsets are stored in minutes; negative values run before an anchor and positive values after it.

## Per-client automation

Every client page has an **Automatische e-mails** section with a switch per template. Switched-off templates are stored on the client (`clients.email_automation_disabled`), so templates added later are sent automatically by default. The worker checks the client's choice right before delivery; a job for a switched-off template is marked `suppressed` with the reason "Automatisch versturen staat uit voor deze klant".

A template that is disabled in Admin → Email stays off for every client.

## Sending by hand from a gig

The gig page has an **E-mails naar de klant** card. It shows every automatic and manual email for the gig and lets you write one yourself:

- start from any template (or the *Eigen bericht* (`custom_message`) template, which never runs automatically), prefilled with the gig's details;
- edit the recipient, subject and text, and preview the branded email;
- optionally attach up to 5 files (10 MB each, 20 MB in total) and/or the PDF of a finalized invoice of the gig.

Every automatic email that has not gone out (scheduled, failed or skipped for the client) has **Bewerken en versturen** in the history. It opens the same editor right under that email, prefilled with that email's own details (recipient, portal link, invoice details). Sending it cancels the automatic email first, with the reason "Vervangen door een handmatig verstuurde e-mail", so the client never gets both; if it has already been sent or replaced, the manual send is refused. Use **E-mail schrijven** to send another one.

Manual emails are sent immediately and always go out: template switches, client choices, gig suppressions and business-state checks only apply to automatic mail. Uploaded attachments are stored under `email-attachments/` in the uploads storage. If delivery fails the job is retried by the worker like any other job.

## Reliability

Every job has a unique dedupe key. Sending also uses that key as the provider idempotency key. Provider attempts and failures are persisted. Failed deliveries retry with bounded exponential backoff. Jobs left in `processing` after an interrupted process are recovered automatically.

The Stripe webhook only writes a transactional outbox event. The email worker converts that event into the persistent payment-received job and marks the outbox row processed only after the job exists.

## Suppression

Admin → Email can suppress one template for one gig. The worker re-checks suppression and current business state immediately before delivery. For example, reminders are suppressed when the invoice is already paid or the portal was already submitted.
