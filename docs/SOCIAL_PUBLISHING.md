# Instagram connection

Admin → Instellingen → Integraties connects NightLight to the DJ NightLight Instagram account. This is phase 1 of the publishing roadmap (see issue #326): the connection, token lifecycle and health checks. Nothing is published yet.

## What you need

- An Instagram **Business or Creator** account.
- A Meta app with the **Instagram** product, using **Instagram API with Instagram Login** (no Facebook Page needed).
- The owner added to the Meta app as admin, developer or tester.

In Development mode no App Review is required, as long as NightLight only publishes to accounts that have a role on the app.

## Set up the Meta app

1. Create the app at developers.facebook.com and add the Instagram product.
2. Add the Instagram account as a tester (or use the owner account that is already admin).
3. Under the Instagram login settings add the redirect URI shown in NightLight (Instellingen → Integraties → Meta-app), for example `https://<domain>/api/admin/social/instagram/callback`. It must match exactly, including `https` and no trailing slash.
4. Copy the Instagram app ID and app secret.
5. Fill in the privacy policy URL that Meta asks for in the app settings.

## Configure NightLight

Either enter the app ID and secret in Instellingen → Integraties → Meta-app (stored encrypted with the session password, like the other integrations), or set them on the server:

- `INSTAGRAM_APP_ID`
- `INSTAGRAM_APP_SECRET`

Settings saved in NightLight win over the environment. Then press **Instagram verbinden**, approve the permissions at Instagram and you are sent back to the settings page.

Requested permissions: `instagram_business_basic` and `instagram_business_content_publish`. If the user deselects the publish permission, the health message says so and the account has to be connected again.

Only the owner can configure the app, connect, refresh or disconnect.

## Token lifecycle

- The code from Instagram is exchanged for a short-lived token, which is exchanged for a **long-lived token** (about 60 days). Tokens are stored encrypted (`social_accounts.access_token_encrypted`) and never shown again.
- The social worker (`server/plugins/social-worker.ts`) ticks every minute. It refreshes a token when it expires within 14 days, is at least 24 hours old (a Meta requirement) and was not tried in the last 12 hours.
- A token that Instagram rejects, or that has expired, sets the account to `needs_reauth`. Connect the account again.
- A different app ID than before also sets `needs_reauth`, because tokens belong to the app that issued them.
- **Token nu vernieuwen** refreshes immediately.

## Health

The Instagram card and Systeemstatus show one of:

| State | Meaning |
| --- | --- |
| Instagram-koppeling werkt | Token valid, publish permission present, worker active |
| Token verloopt binnenkort | Fewer than 7 days left |
| Vernieuwen van het token mislukt | The last refresh failed; it is retried |
| Worker niet actief | The worker has not reported in the last 3 minutes |
| Opnieuw verbinden nodig | Token expired or revoked |
| Publicatierechten ontbreken | The publish permission was not granted |

Connecting, refreshing and disconnecting write to the audit log (`instagram.connected`, `instagram.token_refreshed`, `instagram.token_refresh_failed`, `instagram.disconnected`).

## Security notes

- The OAuth `state` is signed, bound to the logged-in user and to a short-lived `HttpOnly` cookie, and expires after 10 minutes. A tampered, replayed or cross-browser callback is rejected.
- Tokens and the app secret are never logged or included in error messages.

## Troubleshooting

- **"Koppelen is niet gelukt"**: check the app ID, the app secret and that the redirect URI in the Meta app matches the one NightLight shows.
- **Account cannot be connected**: it must be a Business or Creator account and have a role on the app while the app is in Development mode.
- **Worker niet actief** right after a deploy usually clears within a minute.
