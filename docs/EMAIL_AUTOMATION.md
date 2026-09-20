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

## Reliability

Every job has a unique dedupe key. Sending also uses that key as the provider idempotency key. Provider attempts and failures are persisted. Failed deliveries retry with bounded exponential backoff. Jobs left in `processing` after an interrupted process are recovered automatically.

The Stripe webhook only writes a transactional outbox event. The email worker converts that event into the persistent payment-received job and marks the outbox row processed only after the job exists.

## Suppression

Admin → Email can suppress one template for one gig. The worker re-checks suppression and current business state immediately before delivery. For example, reminders are suppressed when the invoice is already paid or the portal was already submitted.
