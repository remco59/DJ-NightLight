# DJ NightLight — Complete Product & Implementation Plan

## 1. Product vision

DJ NightLight will be a custom website plus a private operating system for running the DJ business.

The public website is one presentation layer on top of the same structured data used by the back office. The platform should reduce duplicate administration, keep gig information consistent, and make recurring workflows such as invoicing, client preparation, calendar updates and content creation fast.

The initial product is for one owner/operator. The architecture must, however, avoid assumptions that make future accounts for additional DJs, managers or content editors difficult.

### Core principles

1. **One source of truth.** Gig, client, venue, finance and content information should live in structured records and be reused across the system.
2. **Owner-first UX.** V1 is optimized for one DJ, not a multi-tenant SaaS product.
3. **Future-ready permissions.** The data model and authorization layer must support more accounts later without exposing that complexity in V1.
4. **No unnecessary AI in V1.** Copy generation, automated decisions and generative features are deferred.
5. **Self-hosted application.** Production runs on Unraid using Docker.
6. **Public website and back office are one product.** Avoid separate CMS and admin stacks unless there is a strong technical reason.
7. **Explicit financial states.** Gig status and invoice/payment status are separate concepts.
8. **Editable defaults.** Dates, invoice details, templates and workflow defaults should be sensible but overrideable.

---

## 2. Scope

### In scope

- Public DJ NightLight website
- Private admin dashboard
- Lead and gig manager
- Client and venue management
- Public/private gig visibility
- Invoice generation
- Full-amount Stripe payment
- Client magic-link portal
- Contract/questionnaire workflow
- Music wishes with Spotify links
- Google Calendar synchronization
- Automated email workflows
- Media library
- Photo post generator
- User/account foundation for future roles
- Staging and production deployment on Unraid
- Backups, observability and security hardening

### Explicitly out of scope for the first implementation

- Deposits
- Stripe Connect or payouts to other DJs/crew
- AI-generated copy
- AI-generated social posts
- Video post generation
- Remotion rendering
- Multi-DJ scheduling UX
- Full CRM sales pipeline
- Migration of the old WordPress site
- Two-way Google Calendar sync
- Automatic Instagram publishing
- Native mobile apps

These can be added later without restructuring the core data model.

---

## 3. Users and permissions

### V1

One owner account with full access.

### Future roles

The authorization model should support:

- **Owner** — full access, billing/settings/user management
- **DJ** — assigned gigs, relevant clients, preparation and files
- **Manager** — gigs, clients, finance, communication and planning
- **Content editor** — website content, media and post generator

V1 does not need a role-management UI beyond the owner, but database records and authorization checks should be role-aware from the start.

---

## 4. Gig lifecycle

Gig state and financial state must not be collapsed into one status.

### Gig status

Use a compact status model:

- **Lead** — inquiry/option; replaces separate Lead and Option states
- **Booked** — accepted booking
- **Declined** — not accepted / lost; retained for history and analytics
- **Cancelled** — booking cancelled after acceptance

There is deliberately no separate Confirmed or Completed status.

Whether a gig is upcoming or historical follows from its date/time. A booked gig in the past is naturally a past gig.

Declined gigs remain in the database by default but can be permanently deleted by the owner.

### Financial state

Separate field derived from invoices/payments where possible:

- Not invoiced
- Draft invoice
- Invoiced
- Unpaid
- Paid
- Overdue
- Voided / cancelled invoice

### Public state

A separate setting determines whether an eligible gig appears in the public agenda.

This avoids exposing private weddings or corporate events while allowing public club nights to appear automatically.

---

## 5. Core data model

The initial relational model should contain at least the following entities.

### User

- id
- email
- name
- password/auth provider data
- role
- active
- createdAt / updatedAt

### Client

- id
- type: person | company
- firstName / lastName
- companyName
- email
- phone
- billing address
- notes
- createdAt / updatedAt

A client can have many gigs.

### Venue

- id
- name
- address
- city
- contact details
- website
- parking/load-in notes
- booth/technical notes
- general notes

A venue can be reused across gigs.

### Gig

- id
- title
- event type
- clientId
- venueId
- status
- startsAt
- endsAt
- arrival/load-in time
- fee
- currency
- publicVisibility
- publicTitle
- publicDescription
- internalNotes
- source/referral source
- createdAt / updatedAt / deletedAt if soft-delete is used

### GigContact

For event-specific contacts that are not necessarily the billing client.

### GigTimelineItem

- time
- title
- description
- ordering

Examples: arrival, dinner, speeches, opening dance, DJ start, end.

### Invoice

- id
- invoiceNumber
- gigId
- clientId
- status
- issueDate
- dueDate
- subtotal
- VAT configuration
- VAT amount
- total
- currency
- custom line items
- payment instructions
- notes
- PDF version / generated file reference

**Default behavior:** invoice issue date defaults to the gig date. Due date defaults to issue date + 30 days. Both can be changed manually before finalizing.

### Payment

- id
- invoiceId
- provider
- providerPaymentId
- amount
- status
- paidAt
- metadata

V1 accepts the complete invoice amount. Deposits are deferred.

### ClientPortalAccess

- id
- gigId
- tokenHash
- expiresAt
- revokedAt
- lastUsedAt

Never store a usable magic-link token in plaintext after issuance.

### ContractSubmission

Stores the client-provided contractual/event information and acceptance state.

The owner must be able to customize the questions/template.

### MusicWish

- id
- gigId
- category: must-play | nice-to-have | do-not-play | special-moment
- artist
- title
- Spotify URL
- note
- order

### MediaAsset

- id
- type
- original filename
- storage path
- mime type
- dimensions
- file size
- alt text
- tags
- optional gigId
- optional venueId
- createdAt

A media asset does **not** need to belong to a gig.

### WebsitePage / ContentBlock

Content records for homepage and normal public pages. The exact block model can evolve, but website text/media should be editable without code.

### LandingPage

For service-specific landing pages such as weddings, clubs, student parties and corporate events.

These pages are publicly accessible and may be indexable for SEO, but are hidden from the primary navigation by default. Visibility/indexability must be configurable independently.

### EmailTemplate

Editable transactional email templates.

### EmailDelivery / AutomationLog

Track when workflow messages were scheduled, sent, skipped or failed.

### CalendarSyncRecord

Maps a gig to its downstream Google Calendar event and tracks last synchronization state.

### PostTemplate

Defines canvas dimensions and editable styling for generated image posts.

### GeneratedPost

Stores generation settings and output references. It is independent of gigs.

### AuditLog

Record sensitive administrative changes, particularly invoices, payments, user management and magic-link activity.

---

## 6. Public website

### Primary pages

- Home
- About
- Media
- Agenda
- Booking / contact
- Optional EPK / press section later

### Service landing pages

Initially create a framework for:

- Weddings
- Clubs
- Student parties
- Corporate events
- Private parties

These are **hidden from main navigation** by default. Each page can have its own SEO metadata, copy, gallery, CTA and publishing/indexing flags.

### Design direction

Take inspiration from the previous DJ NightLight website, but do not migrate it or reproduce it directly.

The new site should feel much closer to the custom portfolio approach:

- high-impact hero;
- strong typography;
- dark/night visual identity;
- motion used deliberately;
- photo/video-forward sections;
- responsive mobile-first layout;
- fast page loads;
- accessible navigation and controls;
- structured SEO metadata;
- clear booking CTA.

The public site should not expose private event details.

---

## 7. Admin application

Suggested routes:

```
/admin
/admin/gigs
/admin/gigs/:id
/admin/clients
/admin/venues
/admin/invoices
/admin/media
/admin/content
/admin/landing-pages
/admin/post-generator
/admin/calendar
/admin/email
/admin/users
/admin/settings
```

### Dashboard

The dashboard should prioritize actionable information:

- upcoming gigs;
- leads awaiting action;
- invoices unpaid/overdue;
- upcoming client deadlines;
- calendar sync failures;
- recent client portal submissions;
- recent payments;
- quick-create gig button.

Avoid a dashboard that is mainly decorative analytics.

---

## 8. Gig manager

### List view

Filters:

- status
- upcoming/past
- event type
- public/private
- payment/invoice status
- client
- venue
- date range

### Gig detail

Tabs or sections:

- Overview
- Client
- Venue
- Timeline
- Contract & wishes
- Invoice/payment
- Communication
- Calendar
- Files/media
- Internal notes
- Activity log

### Useful actions

- duplicate gig;
- mark booked/declined/cancelled;
- create invoice;
- open/regenerate client portal link;
- resend client portal email;
- sync calendar;
- toggle public agenda visibility;
- delete a declined record with confirmation.

---

## 9. Client magic-link portal

The client should not need to create an account.

### Entry

A secure emailed magic link opens a portal scoped to one booking.

### Combined preparation flow

The portal should guide the client through the contract/questionnaire and event wishes in one coherent flow rather than separate disconnected forms.

Possible sections:

1. Contact information
2. Billing details
3. Venue/event details
4. Event timeline
5. Technical/logistical information
6. Music preferences
7. Special moments
8. Contract terms / acceptance
9. Review and submit

### Music wishes

Support:

- Must play
- Nice to have
- Do not play
- Special moment
- Artist/title
- Spotify track or playlist links
- Notes

Spotify links should be validated as URLs and shown as convenient previews/links where feasible. V1 does not need Spotify account authorization.

### Security

- token is high entropy;
- only its hash is persisted;
- configurable expiration;
- revoke/regenerate from admin;
- rate-limit access;
- never expose unrelated client or gig data;
- log submissions and important changes.

---

## 10. Contract and questionnaire system

The owner should be able to customize the client preparation form.

Use structured field definitions rather than hard-coded questions where practical.

Supported question types can include:

- short text
- long text
- email
- phone
- number
- date/time
- select
- multi-select
- checkbox
- acknowledgement/terms
- URL

The system should preserve the exact submitted version of contractual answers even if the template changes later.

Do not overwrite historical contract data when a template is edited.

---

## 11. Invoicing

### Requirements

- invoices linked to gig and client;
- customizable NightLight company/invoice details;
- customizable invoice line items;
- configurable VAT behavior;
- sequential invoice numbering;
- draft/finalized distinction;
- generated PDF;
- stable historical invoice once finalized;
- corrections through explicit replacement/void flow rather than silently modifying historical financial documents;
- full amount payment in V1.

### Dates

Default:

```
issueDate = gig date
dueDate   = issueDate + 30 days
```

Both values are editable before finalization.

Global settings should allow the default payment window and invoice text to change later.

### Compliance

Implementation should make business identity, invoice-number pattern, VAT data, legal text and payment terms configurable rather than embedding assumptions in code.

Before production financial use, verify the configured invoice template against the business's actual Dutch accounting/VAT requirements.

---

## 12. Stripe

### V1

Stripe is used for customers to pay the **full outstanding invoice amount**.

Expected flow:

1. invoice finalized;
2. owner enables or sends online payment;
3. server creates a Stripe Checkout/payment session for that invoice;
4. customer pays;
5. webhook is received;
6. signature is verified;
7. webhook processing is idempotent;
8. payment record is stored;
9. invoice state becomes paid when appropriate;
10. owner/client emails can be triggered.

The database remains the business source of truth while Stripe is the payment processor/source of truth for provider payment events.

### Not V1

- deposits;
- split payments;
- paying other DJs;
- Stripe Connect.

The model should not prevent these later.

---

## 13. Calendar integration

DJ NightLight remains the source of truth.

### Direction

```
NightLight gig -> Google Calendar
```

Not:

```
Google Calendar -> NightLight gig
```

### Behavior

For booked gigs, create/update a corresponding calendar event.

A gig edit should update its mapped event. Cancellation should update or remove the external event according to a configurable policy.

The mapping ID must be persisted so repeated syncs update rather than duplicate.

Provide:

- manual sync/retry;
- sync status;
- last synced timestamp;
- error visibility;
- background retry.

Do not infer gig changes from manually edited Google Calendar events in V1.

---

## 14. Email workflows

Use editable templates and event-driven automations.

Initial templates/workflows:

- lead received acknowledgement;
- booking accepted;
- client portal invitation;
- client portal reminder;
- invoice sent;
- payment reminder;
- overdue reminder;
- payment received;
- pre-gig information reminder;
- thank-you message;
- review request.

Each automation should support:

- enabled/disabled;
- timing rules;
- editable subject/body;
- preview;
- test send;
- per-gig suppression;
- delivery history.

Avoid sending duplicate automated messages by storing execution records/idempotency keys.

---

## 15. Media library

The media library is shared by the website and social post generator.

### Features

- image upload;
- metadata extraction;
- title/alt text;
- tags;
- optional gig association;
- optional venue association;
- filter/search;
- generated thumbnails;
- safe filenames;
- configurable maximum upload size;
- delete/replacement protections if an asset is in use.

Originals and derivatives should live on persistent Unraid storage, not inside the application container.

Later storage can be abstracted to S3-compatible object storage without changing higher-level product logic.

---

## 16. Photo post generator

V1 is intentionally independent from gigs.

### Flow

1. Choose one or more photos from media library / upload.
2. Choose a template.
3. Choose output format.
4. Adjust crop/position.
5. Edit text elements.
6. Edit template-specific styling parameters.
7. Preview.
8. Render/export image.
9. Save generated post for later reuse.

### Initial output presets

- 1:1 square
- 4:5 portrait feed
- 9:16 Story/Reel cover

### Template capabilities

- NightLight logo/brand elements
- background image
- overlays/gradients
- text layers
- optional date/location text entered manually
- alignment/spacing controls
- safe-area guides
- reusable brand presets

### Future

Phase 2 can add video templates and Remotion rendering.

Automatic Instagram publishing is not part of V1. Export comes first.

---

## 17. Website content management

Do not introduce WordPress.

The admin should allow changing:

- hero copy/media;
- biography;
- service summaries;
- gallery selections;
- social links;
- booking CTA;
- public agenda settings;
- landing pages;
- SEO title/description/social image;
- contact/business information.

Prefer typed content structures over an unrestricted WYSIWYG for the main website so the design stays consistent.

---

## 18. Architecture

### Application

Use a single Nuxt 4 repository/application initially:

```
Nuxt
├── Public pages
├── Admin pages
├── Client portal
└── Nitro/server API
```

Avoid separate frontend/backend repositories until scale or team boundaries justify it.

### Database

PostgreSQL.

Use migrations committed to the repository.

Recommended ORM/query layer: Drizzle ORM, subject to a short compatibility validation during foundation work.

### Authentication

Owner/staff accounts use normal authenticated sessions.

Requirements:

- secure password hashing;
- HTTP-only secure cookies;
- CSRF-aware mutation design;
- session revocation;
- rate limiting on authentication;
- optional TOTP/2FA in a later security phase.

A maintained auth library compatible with the selected Nuxt version should be selected during foundation; do not create a bespoke crypto/session protocol.

### Client portal auth

Independent scoped magic-link token model, not a normal user account.

### API

Use server routes with explicit validation schemas.

Business logic should live in service/domain modules rather than directly inside page components.

### Suggested repository structure

```
.
├── app/
│   ├── components/
│   ├── layouts/
│   ├── pages/
│   │   ├── admin/
│   │   └── client/
│   └── assets/
├── server/
│   ├── api/
│   ├── services/
│   ├── repositories/
│   ├── middleware/
│   ├── jobs/
│   └── utils/
├── db/
│   ├── schema/
│   ├── migrations/
│   └── seed/
├── shared/
│   ├── schemas/
│   └── types/
├── public/
├── docs/
├── tests/
├── Dockerfile
└── docker-compose.yml
```

Exact Nuxt-generated folder conventions can be adapted during implementation.

---

## 19. Background jobs

Some work should not be tied to a browser request:

- emails;
- calendar retries;
- invoice reminders;
- thumbnail generation;
- generated social images;
- cleanup tasks.

V1 can use a database-backed job table and a dedicated worker process/container if necessary.

Do not depend on in-memory timers inside the web process because deployments/restarts would lose work.

---

## 20. Docker / Unraid infrastructure

### Production components

```
Internet
  |
Cloudflare
  |
Nginx Proxy Manager
  |
  +-- djnightlight.nl --------> NightLight web container
  |
  +-- internal services ------> PostgreSQL / worker as needed
```

PostgreSQL should not be publicly exposed.

### Containers

At minimum:

- `web` — Nuxt application
- `db` — PostgreSQL

Potentially:

- `worker` — background jobs
- `backup` — scheduled backup helper, if not handled elsewhere

### Persistent paths

Suggested:

```
/mnt/user/appdata/djnightlight/
├── postgres/
├── uploads/
├── generated/
├── backups/
└── config/
```

Secrets should be supplied through environment variables/secrets and never committed.

---

## 21. Staging and deployment

### Environments

- local development
- staging: `dev.djnightlight.nl` preferred
- production: `djnightlight.nl`

Staging and production must use separate databases, storage directories, cookies/session secrets and Stripe configuration.

### Deployment approach

Source of truth: GitHub.

Desired flow:

```
feature branch
    |
Pull Request
    |
CI tests/build
    |
merge to main
    |
staging/production deployment workflow
    |
Unraid Docker image/build
```

Production deployment should be explicit/controlled until confidence is high; automatic deployment can be enabled later.

### Health checks

Provide at least:

- web health endpoint;
- database readiness;
- container health checks.

Uptime monitoring can target the public endpoint.

---

## 22. Backups and recovery

Backups are mandatory because this becomes operational business data.

### Back up

- PostgreSQL database
- uploaded media
- generated documents/posts
- important configuration that is not recreated by deployment

### Do not rely on

- Docker container filesystem;
- Git repository for user-generated content;
- RAID/parity alone as a backup.

### Recovery requirement

Document and test restoration, not only backup creation.

Recommended policy:

- frequent local database dumps;
- scheduled media/config snapshots;
- second-copy/off-machine backup;
- retention rotation;
- periodic restore test.

---

## 23. Security requirements

Baseline:

- TLS via proxy;
- database private to Docker network;
- secrets outside Git;
- parameterized ORM/database access;
- server-side authorization on every admin mutation;
- input validation;
- upload MIME/extension/size checks;
- rate limiting for auth, forms and magic links;
- secure cookies;
- webhook signature verification;
- idempotent Stripe webhook processing;
- audit trail for sensitive actions;
- no personally identifiable data in public client-side payloads unnecessarily;
- backups protected like production data;
- dependency update process.

Client magic links and invoice/payment endpoints deserve dedicated abuse tests.

---

## 24. Testing strategy

### Unit tests

- invoice totals and dates;
- gig status rules;
- authorization;
- email scheduling rules;
- calendar mapping logic;
- post template calculations.

### Integration tests

- database repositories;
- invoice creation;
- Stripe webhook handling;
- client portal submission;
- Google Calendar synchronization boundary;
- media uploads.

### End-to-end tests

Critical flows:

1. create lead -> book gig;
2. send portal -> client submits contract/wishes;
3. create/finalize invoice -> payment;
4. update gig -> calendar sync;
5. upload image -> generate social post.

CI must at least lint, type-check, test and build before merge.

---

## 25. Observability

Admin-visible operational states are more useful than server logs alone.

Track:

- last successful calendar sync;
- failed email deliveries;
- failed jobs;
- Stripe webhook processing state;
- image generation failures.

Infrastructure:

- structured application logs;
- Docker logs;
- Uptime Kuma endpoint monitoring;
- optional error tracking later.

---

## 26. Implementation phases

### Phase 0 — Foundation

- Nuxt application
- Docker development environment
- PostgreSQL
- migrations
- CI
- environment configuration
- staging deployment
- basic auth

### Phase 1 — Core back office

- admin shell
- clients
- venues
- gig manager
- dashboard
- audit/activity foundation

This establishes the central source of truth before building integrations.

### Phase 2 — Public website

- design system
- homepage
- about/media/contact
- booking form
- service landing pages
- content editing
- public agenda

### Phase 3 — Client preparation

- magic links
- portal
- customizable questionnaire/contract
- music wishes
- Spotify URLs
- submission review

### Phase 4 — Finance

- invoice settings
- PDF generation
- numbering
- editable issue date
- 30-day default due date
- Stripe full-payment flow
- payment webhooks/status

### Phase 5 — Operations integrations

- Google Calendar one-way sync
- email templates
- automated reminders/follow-ups
- retry/job infrastructure

### Phase 6 — Content tooling

- media library
- post templates
- photo post generator
- 1:1, 4:5, 9:16 export

### Phase 7 — Hardening

- backups and restore documentation
- authorization review
- rate limiting
- security tests
- end-to-end tests
- performance/accessibility review
- production launch checklist

### Future phases

- additional users and role UI
- assigned DJs
- deposits
- payouts / Stripe Connect if ever needed
- advanced reporting
- customer reviews/testimonials
- Remotion video generator
- Instagram publishing integration
- Spotify API enhancements
- EPK generation
- equipment/load-in manager

---

## 27. Initial success criteria

The first major usable release is successful when the owner can:

1. log into the admin;
2. create a client, venue and gig;
3. move a gig from Lead to Booked/Declined/Cancelled;
4. send a secure portal link;
5. receive the client's contractual details and music wishes;
6. create a customizable invoice with default gig-date issue date and +30-day due date;
7. receive full payment through Stripe and see the invoice become paid;
8. have the gig synchronized to Google Calendar;
9. send automated/editable transactional emails;
10. edit the public website without code;
11. select which gigs appear publicly;
12. upload photos and generate branded social images;
13. deploy safely to staging/production on Unraid;
14. restore the database/media from documented backups.

---

## 28. Product decisions captured

The following decisions are intentional and should not be reopened without a concrete reason:

- one DJ/owner UX first;
- future accounts supported architecturally;
- Lead and Option are combined;
- no Confirmed status;
- no Completed status;
- Declined records remain but may be deleted;
- no deposits initially;
- invoice defaults to gig date and 30-day payment window;
- invoice/contract settings customizable;
- client portal uses magic links;
- contract/questionnaire and wishes are one portal flow;
- music wishes support Spotify links;
- NightLight is calendar source of truth;
- calendar synchronization is one-way;
- email automation is in scope;
- social generator starts with photos;
- post generator is not tied to gigs;
- Remotion video support is future work;
- AI is not part of initial implementation;
- old website is inspiration only, not migration source;
- service pages are hidden landing pages by default;
- only owner account needed in V1 UI;
- Postgres is accepted;
- production runs on Unraid;
- staging is required;
- plan, README and implementation issues belong in this repository.
