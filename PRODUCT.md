# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Public site visitors** are people looking to book a DJ: private clients (weddings, birthdays, parties), companies and event organisers, and venues or bars. They arrive with a date and an occasion in mind, judge whether this DJ fits, and send a booking request.

**Existing clients** use a magic-link portal (no account) to review contract details, fill in the questionnaire, add music wishes with Spotify links, and pay the invoice.

**The owner** is a single working DJ running the business alone. They use the private back office, often on a phone between gigs, to manage leads, gigs, clients, venues, invoices, calendar sync, email, media and social posts. Roles for extra DJs, a manager and content editors are planned, not yet built.

## Product Purpose

DJ NightLight is a custom DJ website plus a private operating system for the DJ business. A gig is entered once and reused everywhere: public agenda, client portal, invoice, calendar, emails and social content all read the same records. Success is a visitor who books with confidence, and an owner who does almost no duplicate administration.

## Positioning

A single, named DJ you deal with directly, from first message to last song. The public site and the client portal are that one person's own tools, not an agency platform or a marketplace.

## Operating Context

- Public site and back office are one Nuxt application; the back office is mobile-heavy in practice (phone navigation, bottom-sheet editors).
- Self-hosted on an Unraid server via Docker, behind Nginx Proxy Manager and Cloudflare, with a separate staging environment.
- Gig status and invoice/payment status are separate concepts. Defaults (dates, invoice details, templates) are sensible but editable.
- Google Calendar sync is one-way (app to calendar). Stripe takes the full invoice amount only.
- Media library feeds a photo post generator for Instagram and other social formats; Remotion video generation is in progress.

## Capabilities and Constraints

- In scope: public pages (home, about, services, agenda, booking, media), admin (gigs, clients, venues, invoices, calendar, email, media, post generator, social, reviews, landing pages, content, users), client portal.
- Out of scope for now: deposits, Stripe Connect payouts, AI-generated copy or decisions, two-way calendar sync, automatic Instagram publishing, native apps, multi-DJ scheduling UX.
- Authorization is role-aware in the data model even though V1 has only an owner.
- Public copy is editable content stored in the app, not hard-coded.

## Brand Commitments

- Name: DJ NightLight.
- Public copy is in Dutch, informal (je/jij), warm and direct.
- Back office and technical documentation may stay English or Dutch as they are today.

## Evidence on Hand

- Real content is managed through the site content editor; hero, gallery and about images come from it. Some pages still fall back to stock Unsplash photos when no own image is set.
- No confirmed testimonials, press or client case studies are recorded here. Do not invent them; reviews belong to the reviews feature.

## Product Principles

1. **Enter once, reuse everywhere.** Any new surface reads existing records instead of creating a second source of truth.
2. **One person, not a platform.** Copy and flows should feel like dealing with the DJ directly.
3. **Owner-first, phone-first admin.** The owner works fast and one-handed at gigs; anything frequent must work on a small screen.
4. **Make the booking easy.** Every public page moves a visitor toward a clear, low-friction request.
5. **Explicit states, no surprises.** Gig, invoice and payment states stay separate and visible.

## Accessibility & Inclusion

No product-specific standard has been set. Public pages should meet WCAG AA contrast and keyboard use as a baseline; this is an open decision to confirm.
