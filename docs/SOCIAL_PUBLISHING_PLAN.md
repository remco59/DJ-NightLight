# Social publishing plan (Instagram first)

Status: proposal. Supersedes the "automatic Instagram publishing is not part of V1" boundary in `POST_GENERATOR.md` once accepted.

## 1. Goal

Turn the post generator's exports into published and scheduled Instagram content without leaving NightLight. Publishing should feel like a native part of the existing back office, not a bolt-on: same settings pattern, same retry behaviour as Google Calendar sync, same RBAC, same Dutch UI, and the Agenda shows what is going out.

Non-goals: AI copy (still out of scope), unified inbox, analytics, other platforms (the data model leaves room for them), posting for third-party accounts.

## 2. Decision: build natively, do not embed BrightBean

BrightBean Studio is Django, AGPL-3.0 and would be a second app with its own login and data. NightLight already owns the media, the gigs and the generated output, so the only missing part is the thin layer that talks to Meta and a queue. See "Reference code" for why nothing is copied.

## 3. Meta setup (one-off, owner)

This works in **Development mode, without App Review**, because we only publish to DJ NightLight's own account.

1. Create a Meta app, add the Instagram product, use **Instagram API with Instagram Login** (no Facebook Page required, scope `instagram_business_basic` + `instagram_business_content_publish`).
2. Convert the Instagram account to Business or Creator.
3. Add the owner as an admin/developer/tester of the app.
4. Fill in the privacy policy URL the app settings ask for (the public site needs a privacy page; check this exists before launch).
5. Put the OAuth redirect URI `https://<domain>/api/admin/social/instagram/callback` in the app.

Re-evaluate if another DJ's account must be connected: they need an app role, or the app needs App Review and business verification.

Facebook Page posting uses Facebook Login (`instagram_content_publish` path) and a Page token. Treat it as a later phase; it reuses the queue unchanged.

## 4. What already exists and gets reused

| Need | Existing piece |
| --- | --- |
| Image output | `generated_posts` rows, served publicly and immutably at `/api/generated-posts/<uuid>` |
| Video output | `video_render_jobs` (completed MP4), served at `/api/generated-videos/<uuid>`, 9:16 H.264 |
| Image conversion | `sharp` is already a dependency |
| Encrypted credentials | `shared/secret-box.ts`, `server/utils/integration-settings.ts` (DB first, env fallback) |
| Queue and retries | `server/plugins/calendar-worker.ts` + `server/utils/calendar-sync.ts` (persistent rows, `nextRetryAt`, bounded backoff, "Sync now") |
| HTTP client style | `server/utils/google-calendar.ts` (token cache, one retry on 401) |
| Permissions | `shared/auth.ts` (`content:manage` already covers `content_editor`) |
| Audit | `server/utils/audit.ts` |
| Admin UI | `app/pages/admin/calendar.vue` (status chips, retry list), `IntegrationsSettings.vue`, `MediaPicker.vue` |
| Labels | `shared/labels.ts` (all UI copy is Dutch) |

The output URLs are already public, so Meta can fetch the media directly with no new proxy endpoint.

## 5. Data model (migration `0033_social_publishing.sql`)

```
social_accounts
  id, provider ('instagram'), externalId, username,
  accessTokenEncrypted, tokenExpiresAt, scopes[],
  status ('active' | 'needs_reauth' | 'disabled'),
  connectedByUserId, timestamps

social_posts
  id, accountId, kind ('image' | 'carousel' | 'reel' | 'story'),
  caption, altText, scheduledAt,
  status ('draft' | 'scheduled' | 'publishing' | 'published' | 'failed' | 'cancelled'),
  containerId, providerPostId, permalink,
  retryCount, nextRetryAt, lastAttemptAt, publishedAt, lastError,
  gigId (nullable, for "post about this gig"),
  createdByUserId, timestamps

social_post_media
  postId, position,
  generatedPostId | videoRenderJobId | mediaAssetId   (exactly one, CHECK constraint)
```

Rows reference outputs instead of copying them, so deleting a generated post that is queued must be blocked (`onDelete: 'restrict'`), mirroring `video_render_jobs.sourceMediaAssetId`.

## 6. Publishing engine (`server/utils/social-publish.ts`)

Meta's API has no scheduling for Instagram, so NightLight holds the post and publishes at the right time.

1. **Prepare** (image): convert the PNG to JPEG with `sharp` into generated storage under a stable key, so Meta gets a JPEG at a public HTTPS URL. Keep the original.
2. **Create container** `POST /{ig-id}/media` with `image_url` / `video_url` + `media_type`, caption, alt text. For reels, create the container ahead of time (about 10 minutes before `scheduledAt`) and poll `status_code` until `FINISHED` (Meta recommends once a minute, up to five minutes).
3. **Publish** `POST /{ig-id}/media_publish` with the container id at `scheduledAt`.
4. **Record** `providerPostId`, fetch `permalink`.

Idempotency is the important part, because a double post is visible to the public:
- Persist `containerId` before publishing and move the row to `publishing` with a `lastAttemptAt`.
- If the process dies between `media_publish` and the DB write, recovery checks the container's status (`PUBLISHED`) before retrying instead of publishing again.
- Claim rows with `FOR UPDATE SKIP LOCKED`, as the render worker does.

Retries: bounded exponential backoff like calendar sync. Permanent errors (invalid media, auth revoked) go straight to `failed` / `needs_reauth` with the Meta error text visible in the UI, not retried blindly.

Limits to enforce in the UI: 100 API posts per 24 h, carousels up to 10 items, JPEG-only images.

Worker: new Nitro plugin `server/plugins/social-worker.ts`, 60 s tick, same shape as `calendar-worker.ts`. Video preparation does not need the render worker.

## 7. Auth and token lifecycle

- `GET /api/admin/social/instagram/connect` builds the authorize URL with a signed `state` bound to the session.
- `GET /api/admin/social/instagram/callback` exchanges the code, swaps for a long-lived token (about 60 days), stores it encrypted, records `tokenExpiresAt`.
- A daily refresh in the same worker refreshes tokens that expire within 14 days. Failure sets `needs_reauth`.
- Fallback for dev: paste a token in Settings → Integraties, same as the Google Calendar env/DB pattern.
- App id and secret follow `loadCalendarIntegration`: DB first, environment fallback, secrets masked with `maskSecret`.

## 8. Making it feel native

- **Post generator**: after "Exporteer post", a "Publiceren" action next to download opens a sheet with account, caption, date/time and "Nu publiceren / Inplannen". "Recent exports" gets a status badge (Gepland, Gepubliceerd, Mislukt).
- **Video editor**: same action on a completed export.
- **Gigs**: a "Post over deze gig" action pre-fills the Gig announcement / Recap template and a deterministic caption template with venue, city and date placeholders (no AI). Optional follow-up: suggest the recap post after the gig date.
- **Agenda**: scheduled posts appear on the admin calendar as a separate overlay type, so gigs and posts are planned in one place.
- **Dashboard**: a card for "Posts deze week", failed posts and a token-expiring warning.
- **Content page**: a "Social" tab (queue, history, retry, cancel), built like the Agenda sync list.
- **System page**: health row for the Instagram connection and last worker run, next to the render-worker status.
- **Settings**: connect/disconnect with the connected `@username` shown.
- **RBAC**: `content:manage` can draft and schedule; connecting an account is `system:manage` (owner only). Every publish, cancel and connect writes an audit log.
- **Docs and API**: update `docs/POST_GENERATOR.md`, add `docs/SOCIAL_PUBLISHING.md`, extend `openapi.yaml` and its test.
- **Offline PWA**: publishing endpoints are not cacheable; add them to the offline route exclusions.

## 9. Phases

Each phase is one PR and ships on its own.

1. **Foundations**: migration, schema, encrypted account storage, Meta app settings UI, OAuth connect/callback, token refresh, health row. Nothing publishes yet.
2. **Publish an image now**: JPEG conversion, container + publish, "Publiceren" in the post generator, status in Recent exports, audit log.
3. **Scheduling and queue**: worker, backoff, idempotent recovery, Social tab with retry/cancel, Agenda overlay.
4. **Reels and carousels**: video publishing from export, container polling ahead of time, multi-image posts.
5. **Gig integration**: "Post over deze gig", caption templates, dashboard card.
6. **Later**: Facebook Page, Stories, first comment, additional platforms.

## 10. Testing

- Unit tests (vitest) for payload building, JPEG conversion, status transitions, backoff and idempotent recovery, using a mocked Meta client, in the style of `tests/calendar.test.ts`.
- Migration file test already covers numbering; add the schema to it.
- One manual end-to-end run against a real test account in Development mode before release; Meta's API cannot be meaningfully mocked for container status behaviour.

## 11. Risks and open questions

- Meta is not required to approve anything in Development mode, but policy and API versions change; pin the Graph API version in one constant.
- A privacy policy URL is needed for the Meta app settings. Does the public site have one?
- Large videos: Meta pulls from our public URL, which goes through Cloudflare. Cloudflare's proxy limits and Unraid upload bandwidth may matter. The resumable upload endpoint is the fallback.
- Public immutable URLs are UUID-based. That is fine for published content, but unpublished drafts are also fetchable by anyone who guesses a UUID. Acceptable for now (same as today), revisit with signed URLs if drafts become sensitive.
- Timezone: store `scheduledAt` in UTC, show Europe/Amsterdam, as the rest of the app does (`shared/dutch-date.ts`).
- Do we want to support more than one Instagram account at launch? The model allows it; the UI in phase 1 can stay single-account.

## 12. Reference code

Checked whether existing open-source projects can be copied from:

| Project | Licence | Verdict |
| --- | --- | --- |
| [Mixpost](https://github.com/inovector/mixpost) (Lite) | MIT | PHP/Laravel, so not portable to Nuxt; MIT allows reading it for flow ideas (container polling, token refresh, error mapping). Instagram/Facebook availability in Lite vs Pro not verified. |
| [Postiz](https://github.com/gitroomhq/postiz-app) | AGPL-3.0 | Do not copy. Same copyleft problem as BrightBean. |
| [BrightBean Studio](https://github.com/brightbeanxyz/brightbean-studio) | AGPL-3.0 | Python/Django. Do not copy. |
| [OpenPost](https://github.com/getopenpost/openpost) | AGPL-3.0-only | TypeScript (about 38%) and Go (about 32%) monorepo with SvelteKit/Expo frontends; 16 platforms including Instagram. Do not copy: AGPL applies to the whole repo and the TypeScript is not Nuxt/Vue. Which part handles Meta publishing was not verified. |
| [graph-ig](https://github.com/wldeh/graph-ig) | MIT | TypeScript, but self-described as under development and not stable. Not worth a dependency. |

Conclusion: nothing is worth copying. The surface is about five HTTP calls (authorize, token exchange, token refresh, create container, publish, plus status polling), and Meta's own [content publishing docs](https://developers.facebook.com/docs/instagram-platform/content-publishing) are the real reference. Writing it ourselves with `fetch`, in the style of `google-calendar.ts`, avoids a dependency and any licence entanglement. Mixpost can be consulted for edge cases while building.
