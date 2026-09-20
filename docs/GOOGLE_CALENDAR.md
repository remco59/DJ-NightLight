# Google Calendar synchronization

NightLight is the source of truth. Calendar synchronization is intentionally one-way: edits made in Google Calendar are never imported.

## Credentials

Create an OAuth 2 client in Google Cloud with Calendar API enabled and obtain a refresh token for the owner account. Configure these as deployment secrets:

- `GOOGLE_CALENDAR_CLIENT_ID`
- `GOOGLE_CALENDAR_CLIENT_SECRET`
- `GOOGLE_CALENDAR_REFRESH_TOKEN`

Do not commit token values. The application exchanges the refresh token for short-lived access tokens in memory.

## Enable

Open **Admin → Calendar**. Select a Calendar ID (usually `primary`), choose cancellation behavior and enable synchronization.

A booked gig with a start time gets one deterministic Google event ID derived from the NightLight gig UUID. This makes retries idempotent even if a previous insert response was lost.

## Retry behavior

Gig creates/updates only enqueue a persistent database record. A server worker checks pending/failed jobs every minute. Failures use bounded exponential backoff and remain visible in Admin → Calendar. “Sync now” retries a single gig; “Sync all” reconciles every active NightLight gig.

## Cancellation behavior

- **Delete:** remove the mapped Google event.
- **Mark cancelled:** keep the mapped event and prefix the title with `[Cancelled]`.
- **Keep:** leave the Google event unchanged.

No Google Calendar changes flow back into NightLight.
