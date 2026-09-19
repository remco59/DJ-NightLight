# DJ NightLight

A custom DJ website and operations platform for **DJ NightLight**.

This repository will contain both the public website and the private back office used to manage gigs, clients, invoices, payments, calendar sync, communication, media and social content.

## Product direction

DJ NightLight is not intended to be only a brochure website. The long-term goal is a single system in which one source of truth can drive:

- the public DJ website;
- gig and lead management;
- client and venue records;
- invoices and payment status;
- Stripe payments for the full invoice amount;
- a magic-link client portal for contract details and music wishes;
- Spotify-linked music requests;
- one-way synchronization to Google Calendar;
- automated booking and follow-up emails;
- a reusable media library;
- a photo post generator for Instagram and other social formats;
- future roles for additional DJs, a manager and content editors;
- future video generation, with Remotion as the preferred direction.

AI-generated copy or decision-making is deliberately **out of scope for the initial product**.

## Planned stack

- **Nuxt 4** — public website, admin application and server API
- **PostgreSQL** — primary application database
- **Docker Compose** — local and Unraid runtime
- **Nginx Proxy Manager** — reverse proxy on Unraid
- **Cloudflare** — DNS/proxy layer
- **Persistent Unraid storage** — uploaded media and generated files
- **Stripe** — full-amount customer payments
- **Google Calendar** — downstream calendar synchronization

The production application is intended to run on the existing Unraid server. A separate staging environment will be used before production deployments.

## Documentation

The full product, architecture and implementation plan is in:

- [docs/PROJECT_PLAN.md](docs/PROJECT_PLAN.md)

Implementation work is tracked as GitHub issues in this repository.

## Guiding principle

A gig should be entered once and reused everywhere. Client details, scheduling, invoicing, payment state, wishes, communication and public visibility should reference the same underlying records instead of becoming separate sources of truth.
