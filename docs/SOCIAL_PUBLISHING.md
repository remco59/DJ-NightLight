# Instagram connection

Admin → Instellingen → Integraties connects NightLight to the DJ NightLight Instagram account. This is phase 1 of the publishing roadmap (see issue #326): the connection, the access lifecycle and health checks. Phase 2 (below) publishes an image right away; scheduling and the queue followed in phase 3, and reels, stories and carousels in phase 4.

NightLight uses the **Instagram API with Facebook Login**. New Meta apps created from the "Manage messaging & content on Instagram" use case only offer this variant ("API setup with Facebook login"). The Instagram account is found through the Facebook Page it is linked to.

## What you need

- An Instagram **Business or Creator** account, **linked to a Facebook Page** (Instagram → Settings → Account → Linked accounts / Page).
- A Facebook account that manages that Page and has a role (admin, developer or tester) on the Meta app.
- A Meta app with the use case **Manage messaging & content on Instagram**.

In Development mode no App Review is required, as long as NightLight only publishes to accounts of people who have a role on the app.

## Set up the Meta app

1. Create the app at developers.facebook.com and add the use case **Manage messaging & content on Instagram** (only that one).
2. Open the use case → Customize → **API setup with Facebook login** → **Add required content permissions** (`instagram_basic`, `instagram_content_publish`, `pages_show_list`, `pages_read_engagement`, `business_management`). Skip the messaging permissions.
3. Add the OAuth redirect URI shown in NightLight (Instellingen → Integraties → Meta-app), for example `https://<domain>/api/admin/social/instagram/callback`, to **Valid OAuth Redirect URIs** in the Facebook Login settings. It must match exactly, including `https` and no trailing slash.
4. If Meta asks you to set up **Facebook Login for Business**, create a *configuration* that includes the permissions above (token type: user access token) and note its **configuration ID**.
5. Copy the **App ID** and **App secret** from App settings → Algemeen (Basic).

## Configure NightLight

Either enter the app ID, app secret and (optionally) configuration ID in Instellingen → Integraties → Meta-app (stored encrypted with the session password, like the other integrations), or set them on the server:

- `INSTAGRAM_APP_ID`
- `INSTAGRAM_APP_SECRET`
- `INSTAGRAM_LOGIN_CONFIG_ID` (only with Facebook Login for Business)

Settings saved in NightLight win over the environment. Then press **Instagram verbinden**, log in with Facebook, choose the Page and Instagram account, approve the permissions, and you are sent back to the settings page.

Without a configuration ID NightLight asks for the permissions directly (`scope`). With one, the permissions come from the configuration.

Only the owner can configure the app, connect, check or disconnect.

## How the connection is stored

1. The code from Facebook is exchanged for a user token, then for a long-lived user token.
2. NightLight lists the Facebook Pages with a linked Instagram account that Facebook granted access to. One candidate is connected straight away, and so is the account that is already connected (a reconnect never asks again). When Facebook granted several new accounts, the settings page shows a list and the owner picks one. The user token waits meanwhile in a short-lived (10 minutes), encrypted, `HttpOnly` cookie and is never stored in the database. NightLight connects one Instagram account at a time; choosing another replaces the current one.
3. The **Page access token** of that Page is stored encrypted (`social_accounts.access_token_encrypted`) and never shown again. Page tokens derived from a long-lived user token do not expire on their own.
4. Meta's token inspection (`debug_token`) gives the granted permissions and the moment access stops working. Meta limits how long user data stays accessible (about 90 days), so that date is shown as "Toegang geldig tot".

NightLight cannot extend this access by itself: **connect again before the date shown** (the warning appears 7 days before). Reconnecting is one click.

## Daily check

The social worker (`server/plugins/social-worker.ts`) ticks every minute and, once a day per account, asks Meta whether the stored access still works. It updates the expiry and permissions, and sets the account to `needs_reauth` when Meta rejects it. **Verbinding controleren** runs the same check immediately.

A different app ID than before also sets `needs_reauth`, because tokens belong to the app that issued them.

## Health

The Instagram card and Systeemstatus show one of:

| State | Meaning |
| --- | --- |
| Instagram-koppeling werkt | Access valid, publish permission present, worker active |
| Toegang verloopt binnenkort | Fewer than 7 days left; connect again |
| Controle van de verbinding mislukt | The last check failed; it is retried |
| Worker niet actief | The worker has not reported in the last 3 minutes |
| Opnieuw verbinden nodig | Access expired or revoked |
| Publicatierechten ontbreken | The publish permission was not granted |

Connecting, checking and disconnecting write to the audit log (`instagram.connected`, `instagram.connection_checked`, `instagram.connection_check_failed`, `instagram.disconnected`).

## Security notes

- The OAuth `state` is signed, bound to the logged-in user and to a short-lived `HttpOnly` cookie, and expires after 10 minutes. A tampered, replayed or cross-browser callback is rejected.
- Tokens and the app secret are never logged or included in error messages.

## Troubleshooting

When connecting fails, the settings page shows Meta's own message after "Meta meldt". The same text is in the server log as `instagram_connect_failed`.

- **Several accounts in the Facebook dialog**: tick only the account NightLight should use. If you tick more, NightLight asks which one to connect.
- **"Geen Instagram-account gevonden"**: the Instagram account is not linked to a Facebook Page, or you did not give NightLight access to that Page in the Facebook dialog.
- **Redirect URI / "URL blocked"**: the redirect URI in the Facebook Login settings does not match the one NightLight shows.
- **"Invalid scope" or a permission error**: the permissions were not added to the use case, or (with Facebook Login for Business) the configuration does not include them. Add a configuration ID.
- **Account cannot log in**: while the app is in Development mode the Facebook user needs a role on the app.
- **Worker niet actief** right after a deploy usually clears within a minute.

## Publishing an image (phase 2)

In the Foto editor, **Publiceren** exports the current design and opens the publish drawer; **Recente exports** has a **Publiceren** button per export (and **Opnieuw** after a failure). The drawer shows the connected account, a caption (max 2.200 characters, max 30 hashtags, hashtags are plain caption text) and optional alt text. The post is published immediately and the PNG stays available as an export. Each export shows its Instagram status (Gepubliceerd, Mislukt, ...) with a link to the post.

Who: `content:manage` (owner, manager, content editor). Connecting stays owner only.

### How it works

1. **Prepare.** Instagram only accepts JPEG. NightLight converts the PNG with `sharp` (flattened on the dark brand colour) and stores it under `instagram/<export id>.jpg` in generated storage. The original PNG is kept. Meta fetches it from the public, immutable URL `/api/generated-posts/<id>/instagram.jpg`, so `NUXT_PUBLIC_SITE_URL` must be reachable from the internet; with a localhost URL publishing is refused with a clear message.
2. **Create a container** (`POST /{ig-id}/media` with `image_url`, caption and `alt_text`), and store the container id on the row **before** publishing.
3. **Wait** until the container status is `FINISHED` (polled every 3 s, up to about 30 s).
4. **Publish** (`POST /{ig-id}/media_publish`), then fetch the permalink. A missing permalink never turns a live post into a failure.

The `social_posts` row exists from the start (`publishing`), so a Meta error always leaves a visible record with Meta's own message (`failed`). An invalid or revoked token also sets the account to `needs_reauth`. A container that Meta already reports as `PUBLISHED` is never published again.

Guards: the 9:16 preset is not a feed image (feed images need 4:5 to 1.91:1; 9:16 is published as a story, phase 4), the same export cannot be published twice at the same moment, 100 posts per 24 hours per account, JPEG max 8 MB. An export used for a post cannot be deleted (`409`), because `social_post_media` references it with `restrict`.

Audit log: `social_post.publish_started`, `social_post.published`, `social_post.failed`.

Scheduling, the queue, automatic retries and crash recovery came in phase 3 (below). Still not available: the mobile editor (use Recente exports on desktop).

## Facebook Page (phase 2b)

The same login also posts on the Facebook Page the Instagram account is linked to. Connecting stores the Page as a second account (`provider = 'facebook'`) with the same Page token, and the daily check keeps both rows in step.

**Setup.** Add the permission `pages_manage_posts` in the Meta app (use case *Manage Pages* → Customize → Permissions and features → Add; also add it to the Facebook Login for Business configuration if you use one). In Development mode no App Review is needed. NightLight now asks for it when connecting, so **connect once more** after adding it. Until then the Facebook option in the drawer is disabled with an explanation.

**Publishing.** In the drawer, tick **Instagram** and/or **Facebook-pagina**. Facebook is one call, `POST /{page-id}/photos` with the public PNG URL, caption (`message`) and alt text (`alt_text_custom`), then the permalink is fetched. There is no container and nothing to wait for. Each platform gets its own post row, status, Meta error text and audit entries, so one can fail while the other is live; **Opnieuw** in Recente exports lets you retry only the platform that failed (untick the other one). The 9:16 refusal and the 100 posts per day limit only apply to Instagram.

**Disconnecting** keeps posts and their history: an account that has posts is set to `disabled` and its token is wiped; connecting again reactivates it. The settings card shows a disabled account as not connected.

## Scheduling and the queue (phase 3)

Meta has no native scheduling for Instagram, so NightLight holds the post and publishes it at the right time. The publish drawer has **Nu publiceren / Inplannen**, a date and time in Europe/Amsterdam (stored as UTC), and **Opslaan als concept**. Each platform gets its own row, so Instagram can succeed while Facebook is retried.

### Statuses

| Status | Meaning |
| --- | --- |
| Concept (`draft`) | Saved, not planned. Can be planned, edited or cancelled. |
| Gepland (`scheduled`) | Waiting for its moment, or for the next retry. |
| Wordt gepubliceerd (`publishing`) | The worker (or a "nu" publish) is talking to Meta. |
| Gepubliceerd (`published`) | Live, with a link. |
| Mislukt (`failed`) | Not published. Meta's own text is shown; use **Opnieuw**. |
| Geannuleerd (`cancelled`) | Will not be published. The export is kept. |

Planning refuses a moment in the past, more than a year ahead, or after the date the Meta access ends (connect again first).

### The worker

`server/plugins/social-worker.ts` ticks every 60 seconds and calls `processDueSocialPosts`:

1. **Recover.** Rows left in `publishing` for more than 10 minutes (a crashed process) are picked up. An Instagram row with a container id is checked at Meta instead of published blindly: a container that is already `PUBLISHED` is marked as published and never posted again. Without a container nothing was created, so it is simply run again. A Facebook row has no container to look up, so it is set to `failed` with a message to check the Page first (a double post is public).
2. **Publish what is due.** `scheduled` rows whose `scheduled_at` and `next_retry_at` have passed are claimed with `FOR UPDATE SKIP LOCKED`, moved to `publishing` and run.

The container id is stored before publishing. An old container that Meta reports as `ERROR` or `EXPIRED` is replaced once; a fresh container that fails is a real error.

### Retries

Only **temporary** problems are retried: Meta 5xx and rate-limit codes, network errors and media that Meta has not finished processing. The post goes back to `scheduled` with a growing delay (2, 4, 8, 16 minutes), up to 5 attempts, then `failed`. Revoked access, rejected media and our own checks (inactive account, missing permissions) are never retried: they go straight to `failed` and revoked access also sets the account to `needs_reauth`. A post "nu publiceren" is not retried automatically, the error is shown right away.

Instagram's 24 hour limit never fails a scheduled post: it waits 30 minutes and tries again without using an attempt.

**Opnieuw** on a failed post queues it again (attempts reset) and the worker publishes it within a minute. It needs an active connection.

### Social page

Admin → **Social** (owner and content editor). Tabs **Planning & wachtrij**, **Geschiedenis**, **Mislukt** (with a count badge), stat cards (Gepland, Deze week gepubliceerd, Mislukt, connected account), a table with thumbnail, account, moment, status and actions (Opnieuw, Aanpassen/Inplannen, Annuleren, Bekijk). Concepts and planned posts can be edited; a post the worker already picked up cannot (`409`).

### Agenda

Agenda shows social posts as a purple event type next to the gigs, with legend toggles **Gigs** and **Social posts**, and a **Social planning** panel with the next planned posts and **Open Social →**.

### API

- `POST /api/admin/social/posts` with `mode: 'now' | 'schedule' | 'draft'` and `scheduledAt`.
- `GET /api/admin/social/posts?tab=queue|history|failed` or `?start=&end=` (Agenda), plus counts and stats.
- `PATCH /api/admin/social/posts/:id`, `POST /api/admin/social/posts/:id/cancel`, `POST /api/admin/social/posts/:id/retry`.

All need `content:manage`. Audit log: `social_post.scheduled`, `social_post.draft_saved`, `social_post.updated`, `social_post.cancelled`, `social_post.retry_scheduled`, `social_post.retry_requested`, next to the phase 2 entries.

## Reels, stories and carousels (phase 4)

| Kind | Media | Caption | Where |
| --- | --- | --- | --- |
| Afbeelding (`image`) | one 1:1 or 4:5 export | yes, plus alt text | Instagram and Facebook-pagina |
| Carrousel (`carousel`) | 2 to 10 exports, all 1:1 or all 4:5 | yes | Instagram |
| Story (`story`) | one 9:16 export, or a 9:16 video of 3 to 60 s | no (Instagram stories have none) | Instagram |
| Reel (`reel`) | a finished 9:16 render of 3 s to 15 min; also shown in the feed | yes | Instagram |

The Facebook Page still takes single images only; the drawer disables it for the other kinds. Alt text only applies to a single image (a carousel has one alt text field in NightLight but Instagram takes it per slide, so it is left out rather than applied to the wrong slide).

### Where to start

- **Story from an image:** make the design in the **9:16** preset in the Foto editor and press **Publiceren**; the drawer recognises it as a story.
- **Carrousel:** open **Recente exports**, tick **Voor carrousel** on 2 to 10 exports (the order you tick is the order of the slides) and press **Carrousel publiceren**.
- **Reel or video story:** on **Post generator → Video**, press **Publiceren** next to a finished render and choose **Reel** or **Story**.

Everything else (Nu publiceren / Inplannen, concept, statuses, retries, the Social page and the Agenda) works as in phase 3. The Social page and Agenda show the kind, the number of slides and the duration; a video post has a small video preview instead of an image thumbnail.

### How it works

- **Carousel.** Each slide gets its own container (a JPEG, like a single image), NightLight waits until Meta reports `FINISHED` for every slide, then creates the carousel container from the slide ids and publishes only that one. Only the carousel container id is stored. If the process dies before that, nothing is public yet and the slides are simply created again. After that the usual recovery applies (a container Meta already reports as `PUBLISHED` is never published again).
- **Story from an image** is a JPEG container with `media_type=STORIES`.
- **Reel and video story.** Meta fetches the MP4 from the public, immutable URL `/api/generated-videos/<id>` and processes it for a while. So the worker creates the container **about 10 minutes before the planned moment** (`prepareUpcomingContainers`, `FOR UPDATE SKIP LOCKED`, nothing is public yet) and stores its id on the row. At the planned moment the publish step finds the container, checks its status and publishes when it is `FINISHED`. If Meta is still busy it waits up to a minute, then the post goes back in the queue and is checked again after a minute (a "not ready yet" counts as one of the 5 attempts, so it cannot loop forever). A container that Meta reports as `ERROR` or `EXPIRED` is replaced once.
- **"Nu publiceren" with a video** is never waited on inside the request: the post is queued for this moment, the worker publishes it within a minute or two and the status follows in Social.
- **Editing** a planned reel or story discards the prepared container, because it carries the old caption.
- The 100 posts per 24 hours limit counts a carousel as one post.

A render that was used for a social post cannot be deleted (`409`), like exports.

### Not covered

Resumable upload for very large videos (Meta pulls from our public URL; keep reels reasonably small, Meta allows up to 300 MB for reels), Facebook reels and stories, and alt text per carousel slide.

### API

`POST /api/admin/social/posts` takes `kind` (`image`, `carousel`, `reel`, `story`), `generatedPostIds` (or `generatedPostId`) for images and `videoRenderJobId` for video, next to the fields from the earlier phases. Audit entries carry the kind, the export ids and the render id.
