# Instagram connection

Admin → Instellingen → Integraties connects NightLight to the DJ NightLight Instagram account. This is phase 1 of the publishing roadmap (see issue #326): the connection, the access lifecycle and health checks. Phase 2 (below) publishes an image right away; scheduling, the queue, reels, stories and carousels follow.

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
2. NightLight lists the Pages the user manages and picks the first one with a linked Instagram account.
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

Guards: the 9:16 preset is refused (feed images need 4:5 to 1.91:1; stories come in phase 4), the same export cannot be published twice at the same moment, 100 posts per 24 hours per account, JPEG max 8 MB. An export used for a post cannot be deleted (`409`), because `social_post_media` references it with `restrict`.

Audit log: `social_post.publish_started`, `social_post.published`, `social_post.failed`.

Not in this phase: scheduling, automatic retries and recovery of a `publishing` row after a crash (a row older than 10 minutes no longer blocks a new attempt), the Social page, the Agenda overlay, and the mobile editor (use Recente exports on desktop).
