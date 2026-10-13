# Offline use of the back office

The admin is an installable PWA (scope `/admin`). On location the connection is often bad, so the pages a DJ needs keep working without one. This is implemented by the service worker `public/admin-sw.js`, the client plugin `app/plugins/admin-pwa.client.ts` and `shared/offline-routes.ts`.

## What works offline

| Page | Data |
| --- | --- |
| Dashboard (`/admin`) | `/api/admin/dashboard` |
| Gigs and gig details | `/api/admin/gigs`, `/api/admin/gigs/:id`, including contacts, timeline, notes |
| Music wishes (on the gig) | `/api/admin/gigs/:id/portal-submission` |
| Agenda (`/admin/calendar`) | `/api/admin/calendar/events` for the current month |
| Venues (`/admin/venues/:id`) | `/api/admin/venues/:id` |
| Clients (`/admin/clients/:id`, owner/manager) | `/api/admin/clients/:id` |

These pages are read-only offline. Every other admin page shows "Je bent offline".

Network-first: the cached copy is only used when the network fails. While online (and after logging in or coming back online) the plugin warms the cache for the next 15 gigs, their venues and clients, the dashboard and the current month of the agenda.

Never cached: portal links (secret URLs), the calendar settings (ICS token), invoices, settings, media and everything that is not a `GET`. `tests/admin-pwa.test.ts` guards this list.

The cache holds client and fee information, so it is removed when the session ends (`clear-cache` message to the service worker).

## Changes made offline

Owners and managers can record two things on a gig while offline. They are stored in IndexedDB on the device (`app/utils/offline-outbox.ts`, `useOfflineOutbox`) and sent when the connection returns, on login and from the "Nu synchroniseren" button:

- **Note**: appended to the internal notes as `[13 okt 2026 21:04 · Naam] tekst`. It never overwrites other edits.
- **Status**: only applied when the gig still has the status the device saw (`expectedStatus`). Otherwise the server answers `409`, nothing changes and the entry stays visible with a "niet verwerkt" message until the user removes it. A status change made this way **never emails the client**.

`POST /api/admin/gigs/:id/offline-changes` is idempotent: each change carries a `changeId` that is stored in the audit log, so a retry after a lost response is applied only once.

Sync happens when the app is open (the `online` event, login and app start). Background Sync is deliberately not used: iOS Safari does not support it. Changes of another user on the same device stay untouched until that user signs in. A session that expires while offline keeps the queue.

## Working on two devices

Saving the full gig form (`PUT /api/admin/gigs/:id?version=<updatedAt>`) is checked against the version the page loaded. When the gig changed in the meantime (edited on another device, or an offline note that was synced), the server answers `409`, nothing is overwritten and the gig page offers "Gig opnieuw laden". Reloading shows the latest data; the change then has to be entered again. A request without `version` is still accepted.

## Not offline

Creating or editing venues, clients, invoices, portal links and everything else needs a connection. Gig attachments do not exist in the product yet, so there is nothing to store; the contract answers are only visible to owners and managers.
